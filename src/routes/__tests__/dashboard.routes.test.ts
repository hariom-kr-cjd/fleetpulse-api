import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../index';
import { User } from '../../models/user.model';
import { Vehicle } from '../../models/vehicle.model';
import { Trip } from '../../models/trip.model';
import { AuditLog } from '../../models/audit-log.model';
import { config } from '../../config/env';

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

afterEach(async () => {
  await User.deleteMany({});
  await Vehicle.deleteMany({});
  await Trip.deleteMany({});
  await AuditLog.deleteMany({});
});

function makeToken(userId: string, role: string): string {
  return jwt.sign({ userId, role }, config.jwtSecret as jwt.Secret, { expiresIn: '15m' });
}

describe('Dashboard Routes', () => {
  describe('GET /api/v1/dashboard/stats', () => {
    it('should return dashboard KPIs', async () => {
      const admin = await User.create({ email: 'a@t.com', password: 'h', name: 'A', phone: '1', role: 'admin' });
      await User.create({ email: 'd@t.com', password: 'h', name: 'D', phone: '1', role: 'driver', availability: 'on_duty' });
      await Vehicle.create({ registrationNumber: 'V1', type: 'truck', make: 'T', model: 'A', year: 2023, status: 'active' });

      const token = makeToken(String(admin._id), 'admin');
      const res = await request(app)
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('totalTrips');
      expect(res.body.data).toHaveProperty('activeDrivers');
      expect(res.body.data).toHaveProperty('vehiclesInUse');
      expect(res.body.data).toHaveProperty('avgTripDurationMs');
      expect(res.body.data.activeDrivers).toBe(1);
      expect(res.body.data.vehiclesInUse).toBe(1);
    });

    it('should reject for driver', async () => {
      const driver = await User.create({ email: 'd@t.com', password: 'h', name: 'D', phone: '1', role: 'driver' });
      const token = makeToken(String(driver._id), 'driver');
      const res = await request(app)
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/dashboard/fleet-map', () => {
    it('should return vehicles with locations', async () => {
      const admin = await User.create({ email: 'a@t.com', password: 'h', name: 'A', phone: '1', role: 'admin' });
      await Vehicle.create({ registrationNumber: 'V1', type: 'truck', make: 'T', model: 'A', year: 2023, currentLocation: { lat: 28.6, lng: 77.2 } });
      await Vehicle.create({ registrationNumber: 'V2', type: 'van', make: 'M', model: 'B', year: 2022 }); // no location

      const token = makeToken(String(admin._id), 'admin');
      const res = await request(app)
        .get('/api/v1/dashboard/fleet-map')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].currentLocation.lat).toBe(28.6);
    });
  });

  describe('Analytics Routes', () => {
    it('GET /api/v1/analytics/vehicles should return utilization', async () => {
      const admin = await User.create({ email: 'a@t.com', password: 'h', name: 'A', phone: '1', role: 'admin' });
      await Vehicle.create([
        { registrationNumber: 'V1', type: 'truck', make: 'T', model: 'A', year: 2023, status: 'active' },
        { registrationNumber: 'V2', type: 'van', make: 'M', model: 'B', year: 2022, status: 'idle' },
      ]);

      const token = makeToken(String(admin._id), 'admin');
      const res = await request(app)
        .get('/api/v1/analytics/vehicles')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(2);
      expect(res.body.data.byStatus.length).toBe(2);
    });
  });

  describe('Audit Log Routes', () => {
    it('GET /api/v1/audit-logs should return logs (admin only)', async () => {
      const admin = await User.create({ email: 'a@t.com', password: 'h', name: 'A', phone: '1', role: 'admin' });
      await AuditLog.create({
        userId: admin._id,
        action: 'user_created',
        resource: 'User',
        resourceId: admin._id,
      });

      const token = makeToken(String(admin._id), 'admin');
      const res = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.meta.total).toBe(1);
    });

    it('should reject for non-admin', async () => {
      const fm = await User.create({ email: 'fm@t.com', password: 'h', name: 'FM', phone: '1', role: 'fleet_manager' });
      const token = makeToken(String(fm._id), 'fleet_manager');
      const res = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });
  });
});
