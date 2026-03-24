import { Vehicle, IVehicle } from '../models/vehicle.model';
import { MaintenanceLog, IMaintenanceLog } from '../models/maintenance-log.model';
import { AuditService } from './audit.service';
import mongoose from 'mongoose';

interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  sort: string;
}

interface VehicleListQuery {
  status?: string;
  type?: string;
  q?: string;
}

interface PaginatedResult<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; pages: number };
}

export class VehicleService {
  private auditService = new AuditService();

  async list(
    pagination: PaginationParams,
    query: VehicleListQuery
  ): Promise<PaginatedResult<IVehicle>> {
    const filter: Record<string, unknown> = {};

    if (query.status) filter.status = query.status;
    if (query.type) filter.type = query.type;
    if (query.q) {
      const regex = new RegExp(query.q, 'i');
      filter.$or = [{ registrationNumber: regex }, { make: regex }, { model: regex }];
    }

    const [data, total] = await Promise.all([
      Vehicle.find(filter)
        .populate('assignedDriverId', 'name email')
        .sort(pagination.sort)
        .skip(pagination.skip)
        .limit(pagination.limit),
      Vehicle.countDocuments(filter),
    ]);

    return {
      data,
      meta: {
        total,
        page: pagination.page,
        limit: pagination.limit,
        pages: Math.ceil(total / pagination.limit),
      },
    };
  }

  async findById(id: string): Promise<IVehicle | null> {
    return Vehicle.findById(id).populate('assignedDriverId', 'name email');
  }

  async create(
    data: Partial<IVehicle>,
    performedBy: string
  ): Promise<IVehicle> {
    const vehicle = await Vehicle.create(data);

    await this.auditService.log({
      userId: performedBy,
      action: 'vehicle_created',
      resource: 'Vehicle',
      resourceId: String(vehicle._id),
    });

    return vehicle;
  }

  async update(
    id: string,
    updates: Partial<IVehicle>,
    performedBy: string
  ): Promise<IVehicle | null> {
    const vehicle = await Vehicle.findByIdAndUpdate(id, updates, {
      returnDocument: 'after',
      runValidators: true,
    }).populate('assignedDriverId', 'name email');

    if (vehicle) {
      await this.auditService.log({
        userId: performedBy,
        action: 'vehicle_updated',
        resource: 'Vehicle',
        resourceId: String(vehicle._id),
        details: updates as Record<string, unknown>,
      });
    }

    return vehicle;
  }

  async updateLocation(
    id: string,
    lat: number,
    lng: number,
    driverId: string
  ): Promise<IVehicle | null> {
    const vehicle = await Vehicle.findById(id);
    if (!vehicle) return null;

    if (String(vehicle.assignedDriverId) !== driverId) {
      throw new Error('Not assigned to this vehicle');
    }

    return Vehicle.findByIdAndUpdate(
      id,
      { currentLocation: { lat, lng } },
      { returnDocument: 'after' }
    );
  }

  async addMaintenanceLog(
    vehicleId: string,
    data: { description: string; cost: number; serviceDate: Date; nextServiceDate?: Date },
    performedBy: string
  ): Promise<IMaintenanceLog> {
    const log = await MaintenanceLog.create({
      vehicleId: new mongoose.Types.ObjectId(vehicleId),
      ...data,
      createdBy: new mongoose.Types.ObjectId(performedBy),
    });

    await Vehicle.findByIdAndUpdate(vehicleId, {
      lastServiceDate: data.serviceDate,
      status: 'maintenance',
    });

    await this.auditService.log({
      userId: performedBy,
      action: 'maintenance_logged',
      resource: 'Vehicle',
      resourceId: vehicleId,
      details: { description: data.description, cost: data.cost },
    });

    return log;
  }

  async getMaintenanceHistory(
    vehicleId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResult<IMaintenanceLog>> {
    const filter = { vehicleId: new mongoose.Types.ObjectId(vehicleId) };

    const [data, total] = await Promise.all([
      MaintenanceLog.find(filter)
        .populate('createdBy', 'name email')
        .sort(pagination.sort)
        .skip(pagination.skip)
        .limit(pagination.limit),
      MaintenanceLog.countDocuments(filter),
    ]);

    return {
      data,
      meta: {
        total,
        page: pagination.page,
        limit: pagination.limit,
        pages: Math.ceil(total / pagination.limit),
      },
    };
  }

  async getUpcomingMaintenance(): Promise<IMaintenanceLog[]> {
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    return MaintenanceLog.find({
      nextServiceDate: { $gte: now, $lte: thirtyDays },
    })
      .populate('vehicleId')
      .populate('createdBy', 'name email')
      .sort('nextServiceDate');
  }
}
