import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../index';
import { User } from '../../models/user.model';
import { Vehicle } from '../../models/vehicle.model';
import { Trip } from '../../models/trip.model';
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
});

function makeToken(userId: string, role: string): string {
  return jwt.sign({ userId, role }, config.jwtSecret as jwt.Secret, { expiresIn: '15m' });
}

describe('Driver Routes', () => {
  describe('GET /api/v1/drivers/available', () => {
    it('should return available drivers', async () => {
      const admin = await User.create({ email: 'admin@t.com', password: 'h', name: 'Admin', phone: '1', role: 'admin' });
      const d1 = await User.create({ email: 'd1@t.com', password: 'h', name: 'D1', phone: '1', role: 'driver', availability: 'on_duty' });
      await User.create({ email: 'd2@t.com', password: 'h', name: 'D2', phone: '1', role: 'driver', availability: 'off_duty' });

      const token = makeToken(String(admin._id), 'admin');
      const res = await request(app)
        .get('/api/v1/drivers/available')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('D1');
    });

    it('should exclude drivers on active trips', async () => {
      const admin = await User.create({ email: 'admin@t.com', password: 'h', name: 'Admin', phone: '1', role: 'admin' });
      const d1 = await User.create({ email: 'd1@t.com', password: 'h', name: 'D1', phone: '1', role: 'driver', availability: 'on_duty' });
      const d2 = await User.create({ email: 'd2@t.com', password: 'h', name: 'D2', phone: '1', role: 'driver', availability: 'on_duty' });
      const v = await Vehicle.create({ registrationNumber: 'V1', type: 'truck', make: 'T', model: 'A', year: 2023 });

      await Trip.create({
        vehicleId: v._id, driverId: d1._id, createdBy: admin._id,
        origin: { address: 'A', lat: 0, lng: 0 }, destination: { address: 'B', lat: 1, lng: 1 },
        status: 'in_progress', startedAt: new Date(),
      });

      const token = makeToken(String(admin._id), 'admin');
      const res = await request(app)
        .get('/api/v1/drivers/available')
        .set('Authorization', `Bearer ${token}`);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('D2');
    });
  });

  describe('PATCH /api/v1/drivers/me/availability', () => {
    it('should update own availability', async () => {
      const driver = await User.create({ email: 'd@t.com', password: 'h', name: 'D', phone: '1', role: 'driver', availability: 'off_duty' });
      const token = makeToken(String(driver._id), 'driver');

      const res = await request(app)
        .patch('/api/v1/drivers/me/availability')
        .set('Authorization', `Bearer ${token}`)
        .send({ availability: 'on_duty' });
      expect(res.status).toBe(200);
      expect(res.body.data.availability).toBe('on_duty');
    });

    it('should reject invalid availability', async () => {
      const driver = await User.create({ email: 'd@t.com', password: 'h', name: 'D', phone: '1', role: 'driver' });
      const token = makeToken(String(driver._id), 'driver');

      const res = await request(app)
        .patch('/api/v1/drivers/me/availability')
        .set('Authorization', `Bearer ${token}`)
        .send({ availability: 'sleeping' });
      expect(res.status).toBe(400);
    });

    it('should reject non-driver role', async () => {
      const admin = await User.create({ email: 'a@t.com', password: 'h', name: 'A', phone: '1', role: 'admin' });
      const token = makeToken(String(admin._id), 'admin');

      const res = await request(app)
        .patch('/api/v1/drivers/me/availability')
        .set('Authorization', `Bearer ${token}`)
        .send({ availability: 'on_duty' });
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/drivers/me/stats', () => {
    it('should return driver stats', async () => {
      const driver = await User.create({ email: 'd@t.com', password: 'h', name: 'D', phone: '1', role: 'driver' });
      const v = await Vehicle.create({ registrationNumber: 'V1', type: 'truck', make: 'T', model: 'A', year: 2023 });

      await Trip.create([
        { vehicleId: v._id, driverId: driver._id, createdBy: driver._id, origin: { address: 'A', lat: 0, lng: 0 }, destination: { address: 'B', lat: 1, lng: 1 }, status: 'completed', startedAt: new Date('2026-01-01T10:00:00Z'), completedAt: new Date('2026-01-01T14:00:00Z') },
        { vehicleId: v._id, driverId: driver._id, createdBy: driver._id, origin: { address: 'A', lat: 0, lng: 0 }, destination: { address: 'B', lat: 1, lng: 1 }, status: 'cancelled' },
      ]);

      const token = makeToken(String(driver._id), 'driver');
      const res = await request(app)
        .get('/api/v1/drivers/me/stats')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.totalTrips).toBe(2);
      expect(res.body.data.completedTrips).toBe(1);
      expect(res.body.data.cancelledTrips).toBe(1);
    });
  });

  describe('GET /api/v1/drivers/:id/trips', () => {
    it('should return driver trip history (admin)', async () => {
      const admin = await User.create({ email: 'admin@t.com', password: 'h', name: 'Admin', phone: '1', role: 'admin' });
      const driver = await User.create({ email: 'd@t.com', password: 'h', name: 'D', phone: '1', role: 'driver' });
      const v = await Vehicle.create({ registrationNumber: 'V1', type: 'truck', make: 'T', model: 'A', year: 2023 });

      await Trip.create({ vehicleId: v._id, driverId: driver._id, createdBy: admin._id, origin: { address: 'A', lat: 0, lng: 0 }, destination: { address: 'B', lat: 1, lng: 1 } });

      const token = makeToken(String(admin._id), 'admin');
      const res = await request(app)
        .get(`/api/v1/drivers/${driver._id}/trips`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
    });
  });
});
