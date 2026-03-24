import mongoose from 'mongoose';
import { User, IUser } from '../models/user.model';
import { Trip } from '../models/trip.model';

export class DriverService {
  async getAvailableDrivers(): Promise<IUser[]> {
    const driversOnTrip = await Trip.find({ status: 'in_progress' }).distinct('driverId');

    return User.find({
      role: 'driver',
      status: 'active',
      availability: 'on_duty',
      _id: { $nin: driversOnTrip },
    }).select('-password');
  }

  async getTripHistory(
    driverId: string,
    pagination: { skip: number; limit: number; sort: string; page: number }
  ) {
    const filter = { driverId: new mongoose.Types.ObjectId(driverId) };

    const [data, total] = await Promise.all([
      Trip.find(filter)
        .populate('vehicleId', 'registrationNumber make model')
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

  async getStats(driverId: string) {
    const id = new mongoose.Types.ObjectId(driverId);

    const [totalTrips, completedTrips, cancelledTrips, avgDuration] = await Promise.all([
      Trip.countDocuments({ driverId: id }),
      Trip.countDocuments({ driverId: id, status: 'completed' }),
      Trip.countDocuments({ driverId: id, status: 'cancelled' }),
      Trip.aggregate([
        { $match: { driverId: id, status: 'completed', startedAt: { $exists: true }, completedAt: { $exists: true } } },
        { $project: { duration: { $subtract: ['$completedAt', '$startedAt'] } } },
        { $group: { _id: null, avgDuration: { $avg: '$duration' } } },
      ]),
    ]);

    return {
      totalTrips,
      completedTrips,
      cancelledTrips,
      avgDurationMs: avgDuration[0]?.avgDuration || 0,
    };
  }

  async updateAvailability(
    driverId: string,
    availability: 'on_duty' | 'off_duty'
  ): Promise<IUser | null> {
    return User.findOneAndUpdate(
      { _id: driverId, role: 'driver' },
      { availability },
      { returnDocument: 'after' }
    ).select('-password');
  }
}
