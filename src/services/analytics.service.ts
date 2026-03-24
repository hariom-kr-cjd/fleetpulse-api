import mongoose from 'mongoose';
import { Trip } from '../models/trip.model';
import { Vehicle } from '../models/vehicle.model';

export class AnalyticsService {
  async getTripsSummary(period: 'day' | 'week' | 'month' = 'month') {
    const now = new Date();
    const start = new Date(now);

    if (period === 'day') start.setDate(start.getDate() - 30);
    else if (period === 'week') start.setDate(start.getDate() - 90);
    else start.setFullYear(start.getFullYear() - 1);

    const dateFormat = period === 'day' ? '%Y-%m-%d' : period === 'week' ? '%Y-W%V' : '%Y-%m';

    return Trip.aggregate([
      { $match: { createdAt: { $gte: start } } },
      {
        $group: {
          _id: {
            period: { $dateToString: { format: dateFormat, date: '$createdAt' } },
            status: '$status',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.period': 1 } },
    ]);
  }

  async getDriverPerformance(limit = 10) {
    return Trip.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: '$driverId',
          completedTrips: { $sum: 1 },
          avgDuration: {
            $avg: { $subtract: ['$completedAt', '$startedAt'] },
          },
          totalDistance: { $sum: '$distance' },
        },
      },
      { $sort: { completedTrips: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'driver',
        },
      },
      { $unwind: '$driver' },
      {
        $project: {
          driverId: '$_id',
          driverName: '$driver.name',
          driverEmail: '$driver.email',
          completedTrips: 1,
          avgDurationMs: '$avgDuration',
          totalDistance: 1,
        },
      },
    ]);
  }

  async getVehicleUtilization() {
    const [total, byStatus] = await Promise.all([
      Vehicle.countDocuments(),
      Vehicle.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    return { total, byStatus };
  }
}
