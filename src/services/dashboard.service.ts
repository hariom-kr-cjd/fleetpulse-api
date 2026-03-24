import { Trip } from '../models/trip.model';
import { User } from '../models/user.model';
import { Vehicle } from '../models/vehicle.model';

export class DashboardService {
  async getStats() {
    const [totalTrips, activeDrivers, vehiclesInUse, avgDuration] = await Promise.all([
      Trip.countDocuments(),
      User.countDocuments({ role: 'driver', status: 'active', availability: 'on_duty' }),
      Vehicle.countDocuments({ status: 'active' }),
      Trip.aggregate([
        { $match: { status: 'completed', startedAt: { $exists: true }, completedAt: { $exists: true } } },
        { $project: { duration: { $subtract: ['$completedAt', '$startedAt'] } } },
        { $group: { _id: null, avgDuration: { $avg: '$duration' } } },
      ]),
    ]);

    return {
      totalTrips,
      activeDrivers,
      vehiclesInUse,
      avgTripDurationMs: avgDuration[0]?.avgDuration || 0,
    };
  }

  async getFleetMap() {
    return Vehicle.find({
      'currentLocation.lat': { $exists: true },
      'currentLocation.lng': { $exists: true },
    }).select('registrationNumber type status currentLocation assignedDriverId')
      .populate('assignedDriverId', 'name');
  }
}
