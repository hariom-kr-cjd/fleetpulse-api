import mongoose from 'mongoose';
import { Trip, ITrip } from '../models/trip.model';
import { User } from '../models/user.model';
import { Vehicle } from '../models/vehicle.model';
import { AuditService } from './audit.service';
import { NotificationClientService } from './notification-client.service';

interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  sort: string;
}

interface TripListQuery {
  status?: string;
  driverId?: string;
}

interface PaginatedResult<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; pages: number };
}

interface CreateTripInput {
  vehicleId: string;
  driverId: string;
  origin: { address: string; lat: number; lng: number };
  destination: { address: string; lat: number; lng: number };
  checkpoints?: Array<{ address: string; lat: number; lng: number }>;
  notes?: string;
  distance?: number;
  estimatedDuration?: number;
}

export class TripService {
  private auditService = new AuditService();
  private notificationClient = new NotificationClientService();

  async list(
    pagination: PaginationParams,
    query: TripListQuery
  ): Promise<PaginatedResult<ITrip>> {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.driverId) filter.driverId = new mongoose.Types.ObjectId(query.driverId);

    const [data, total] = await Promise.all([
      Trip.find(filter)
        .populate('vehicleId', 'registrationNumber make model')
        .populate('driverId', 'name email')
        .populate('createdBy', 'name email')
        .sort(pagination.sort)
        .skip(pagination.skip)
        .limit(pagination.limit),
      Trip.countDocuments(filter),
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

  async findById(id: string): Promise<ITrip | null> {
    return Trip.findById(id)
      .populate('vehicleId', 'registrationNumber make model')
      .populate('driverId', 'name email')
      .populate('createdBy', 'name email');
  }

  async create(input: CreateTripInput, createdBy: string): Promise<ITrip> {
    // Validate driver exists, is active, and on duty
    const driver = await User.findOne({
      _id: input.driverId,
      role: 'driver',
      status: 'active',
      availability: 'on_duty',
    });
    if (!driver) {
      throw new Error('Driver not available');
    }

    // Validate driver not on active trip
    const activeTrip = await Trip.findOne({
      driverId: input.driverId,
      status: 'in_progress',
    });
    if (activeTrip) {
      throw new Error('Driver already on an active trip');
    }

    // Validate vehicle not on active trip
    const vehicleTrip = await Trip.findOne({
      vehicleId: input.vehicleId,
      status: 'in_progress',
    });
    if (vehicleTrip) {
      throw new Error('Vehicle already on an active trip');
    }

    const trip = await Trip.create({
      ...input,
      vehicleId: new mongoose.Types.ObjectId(input.vehicleId),
      driverId: new mongoose.Types.ObjectId(input.driverId),
      createdBy: new mongoose.Types.ObjectId(createdBy),
    });

    await this.auditService.log({
      userId: createdBy,
      action: 'trip_created',
      resource: 'Trip',
      resourceId: String(trip._id),
    });

    await this.notificationClient.send({
      userId: input.driverId,
      type: 'trip_assigned',
      title: 'New Trip Assigned',
      message: `You have been assigned trip ${trip.tripNumber}`,
      tripId: String(trip._id),
    });

    return trip;
  }

  async start(tripId: string, driverId: string): Promise<ITrip | null> {
    const trip = await Trip.findOne({ _id: tripId, driverId, status: 'pending' });
    if (!trip) return null;

    trip.status = 'in_progress';
    trip.startedAt = new Date();
    await trip.save();

    // Set vehicle to active
    await Vehicle.findByIdAndUpdate(trip.vehicleId, { status: 'active' });

    await this.auditService.log({
      userId: driverId,
      action: 'trip_started',
      resource: 'Trip',
      resourceId: String(trip._id),
    });

    return trip;
  }

  async arriveCheckpoint(
    tripId: string,
    checkpointIndex: number,
    driverId: string
  ): Promise<ITrip | null> {
    const trip = await Trip.findOne({ _id: tripId, driverId, status: 'in_progress' });
    if (!trip) return null;

    if (checkpointIndex < 0 || checkpointIndex >= trip.checkpoints.length) {
      throw new Error('Invalid checkpoint index');
    }

    trip.checkpoints[checkpointIndex].arrivedAt = new Date();
    trip.markModified('checkpoints');
    await trip.save();

    return trip;
  }

  async complete(tripId: string, driverId: string): Promise<ITrip | null> {
    const trip = await Trip.findOne({ _id: tripId, driverId, status: 'in_progress' });
    if (!trip) return null;

    trip.status = 'completed';
    trip.completedAt = new Date();
    await trip.save();

    // Set vehicle back to idle
    await Vehicle.findByIdAndUpdate(trip.vehicleId, { status: 'idle' });

    await this.auditService.log({
      userId: driverId,
      action: 'trip_completed',
      resource: 'Trip',
      resourceId: String(trip._id),
    });

    await this.notificationClient.send({
      userId: String(trip.createdBy),
      type: 'trip_completed',
      title: 'Trip Completed',
      message: `Trip ${trip.tripNumber} has been completed`,
      tripId: String(trip._id),
    });

    return trip;
  }

  async cancel(tripId: string, cancelledBy: string): Promise<ITrip | null> {
    const trip = await Trip.findOne({
      _id: tripId,
      status: { $in: ['pending', 'in_progress'] },
    });
    if (!trip) return null;

    trip.status = 'cancelled';
    trip.cancelledAt = new Date();
    trip.cancelledBy = new mongoose.Types.ObjectId(cancelledBy);
    await trip.save();

    // Set vehicle back to idle if it was active
    await Vehicle.findByIdAndUpdate(trip.vehicleId, { status: 'idle' });

    await this.auditService.log({
      userId: cancelledBy,
      action: 'trip_cancelled',
      resource: 'Trip',
      resourceId: String(trip._id),
    });

    return trip;
  }

  async getTimeline(tripId: string): Promise<Array<{ event: string; timestamp: Date }>> {
    const trip = await Trip.findById(tripId);
    if (!trip) return [];

    const events: Array<{ event: string; timestamp: Date }> = [];
    events.push({ event: 'created', timestamp: trip.createdAt });

    if (trip.startedAt) {
      events.push({ event: 'started', timestamp: trip.startedAt });
    }

    trip.checkpoints.forEach((cp, i) => {
      if (cp.arrivedAt) {
        events.push({ event: `checkpoint_${i}_arrived`, timestamp: cp.arrivedAt });
      }
    });

    if (trip.completedAt) {
      events.push({ event: 'completed', timestamp: trip.completedAt });
    }
    if (trip.cancelledAt) {
      events.push({ event: 'cancelled', timestamp: trip.cancelledAt });
    }

    return events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async getMyTrips(
    driverId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResult<ITrip>> {
    return this.list(pagination, { driverId });
  }
}
