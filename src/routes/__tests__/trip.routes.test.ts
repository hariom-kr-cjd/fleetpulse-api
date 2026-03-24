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

async function createDriver(email = 'driver@test.com', availability: 'on_duty' | 'off_duty' = 'on_duty') {
  const user = await User.create({
    email, password: 'h', name: 'Driver', phone: '1', role: 'driver', availability,
  });
  return { user, token: makeToken(String(user._id), 'driver') };
}

async function createAdmin() {
  const user = await User.create({
    email: 'admin@test.com', password: 'h', name: 'Admin', phone: '1', role: 'admin',
  });
  return { user, token: makeToken(String(user._id), 'admin') };
}

async function createVehicle(regNum = 'DL-01') {
  return Vehicle.create({
    registrationNumber: regNum, type: 'truck', make: 'Tata', model: 'Ace', year: 2023,
  });
}

const origin = { address: 'Delhi', lat: 28.6, lng: 77.2 };
const destination = { address: 'Jaipur', lat: 26.9, lng: 75.7 };

describe('Trip Routes', () => {
  describe('POST /api/v1/trips', () => {
    it('should create trip (admin)', async () => {
      const { user: admin, token } = await createAdmin();
      const { user: driver } = await createDriver();
      const vehicle = await createVehicle();

      const res = await request(app)
        .post('/api/v1/trips')
        .set('Authorization', `Bearer ${token}`)
        .send({ vehicleId: vehicle._id, driverId: driver._id, origin, destination });
      expect(res.status).toBe(201);
      expect(res.body.data.tripNumber).toMatch(/^FP-/);
      expect(res.body.data.status).toBe('pending');
    });

    it('should reject if driver not available', async () => {
      const { token } = await createAdmin();
      const { user: driver } = await createDriver('off@test.com', 'off_duty');
      const vehicle = await createVehicle('V-OFF');

      const res = await request(app)
        .post('/api/v1/trips')
        .set('Authorization', `Bearer ${token}`)
        .send({ vehicleId: vehicle._id, driverId: driver._id, origin, destination });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Driver not available');
    });

    it('should reject if vehicle already on active trip', async () => {
      const { token } = await createAdmin();
      const { user: driver1 } = await createDriver('d1@test.com');
      const { user: driver2 } = await createDriver('d2@test.com');
      const vehicle = await createVehicle('V-BUSY');

      // Create first trip and start it
      await Trip.create({
        vehicleId: vehicle._id, driverId: driver1._id, createdBy: driver1._id,
        origin, destination, status: 'in_progress', startedAt: new Date(),
      });

      const res = await request(app)
        .post('/api/v1/trips')
        .set('Authorization', `Bearer ${token}`)
        .send({ vehicleId: vehicle._id, driverId: driver2._id, origin, destination });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Vehicle already on an active trip');
    });

    it('should reject for driver role', async () => {
      const { token } = await createDriver('noauth@test.com');
      const res = await request(app)
        .post('/api/v1/trips')
        .set('Authorization', `Bearer ${token}`)
        .send({ vehicleId: new mongoose.Types.ObjectId(), driverId: new mongoose.Types.ObjectId(), origin, destination });
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/trips', () => {
    it('should list trips for admin', async () => {
      const { user: admin, token } = await createAdmin();
      const { user: driver } = await createDriver();
      const vehicle = await createVehicle();
      await Trip.create({
        vehicleId: vehicle._id, driverId: driver._id, createdBy: admin._id,
        origin, destination,
      });

      const res = await request(app)
        .get('/api/v1/trips')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.meta.total).toBe(1);
    });

    it('should filter by status', async () => {
      const { user: admin, token } = await createAdmin();
      const { user: driver } = await createDriver();
      const v1 = await createVehicle('F1');
      const v2 = await createVehicle('F2');
      await Trip.create([
        { vehicleId: v1._id, driverId: driver._id, createdBy: admin._id, origin, destination, status: 'pending' },
        { vehicleId: v2._id, driverId: driver._id, createdBy: admin._id, origin, destination, status: 'completed', completedAt: new Date() },
      ]);

      const res = await request(app)
        .get('/api/v1/trips?status=pending')
        .set('Authorization', `Bearer ${token}`);
      expect(res.body.data.length).toBe(1);
    });
  });

  describe('GET /api/v1/trips/my', () => {
    it('should return only assigned trips for driver', async () => {
      const { user: admin } = await createAdmin();
      const { user: driver, token } = await createDriver();
      const { user: other } = await createDriver('other@test.com');
      const v1 = await createVehicle('MY1');
      const v2 = await createVehicle('MY2');

      await Trip.create([
        { vehicleId: v1._id, driverId: driver._id, createdBy: admin._id, origin, destination },
        { vehicleId: v2._id, driverId: other._id, createdBy: admin._id, origin, destination },
      ]);

      const res = await request(app)
        .get('/api/v1/trips/my')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
    });
  });

  describe('Trip lifecycle', () => {
    it('should start → complete trip', async () => {
      const { user: admin } = await createAdmin();
      const { user: driver, token: driverToken } = await createDriver();
      const vehicle = await createVehicle('LC-1');

      const trip = await Trip.create({
        vehicleId: vehicle._id, driverId: driver._id, createdBy: admin._id,
        origin, destination,
        checkpoints: [{ address: 'Halfway', lat: 27.5, lng: 76.5 }],
      });

      // Start
      const startRes = await request(app)
        .patch(`/api/v1/trips/${trip._id}/start`)
        .set('Authorization', `Bearer ${driverToken}`);
      expect(startRes.status).toBe(200);
      expect(startRes.body.data.status).toBe('in_progress');
      expect(startRes.body.data.startedAt).toBeDefined();

      // Checkpoint
      const cpRes = await request(app)
        .patch(`/api/v1/trips/${trip._id}/checkpoint/0`)
        .set('Authorization', `Bearer ${driverToken}`);
      expect(cpRes.status).toBe(200);
      expect(cpRes.body.data.checkpoints[0].arrivedAt).toBeDefined();

      // Complete
      const completeRes = await request(app)
        .patch(`/api/v1/trips/${trip._id}/complete`)
        .set('Authorization', `Bearer ${driverToken}`);
      expect(completeRes.status).toBe(200);
      expect(completeRes.body.data.status).toBe('completed');
    });

    it('should not let non-assigned driver start trip', async () => {
      const { user: admin } = await createAdmin();
      const { user: driver } = await createDriver();
      const { token: otherToken } = await createDriver('wrong@test.com');
      const vehicle = await createVehicle('LC-2');

      const trip = await Trip.create({
        vehicleId: vehicle._id, driverId: driver._id, createdBy: admin._id,
        origin, destination,
      });

      const res = await request(app)
        .patch(`/api/v1/trips/${trip._id}/start`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/v1/trips/:id/cancel', () => {
    it('should cancel pending trip', async () => {
      const { user: admin, token } = await createAdmin();
      const { user: driver } = await createDriver();
      const vehicle = await createVehicle('CX-1');

      const trip = await Trip.create({
        vehicleId: vehicle._id, driverId: driver._id, createdBy: admin._id,
        origin, destination,
      });

      const res = await request(app)
        .patch(`/api/v1/trips/${trip._id}/cancel`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('cancelled');
      expect(res.body.data.cancelledAt).toBeDefined();
    });

    it('should not cancel already completed trip', async () => {
      const { user: admin, token } = await createAdmin();
      const { user: driver } = await createDriver();
      const vehicle = await createVehicle('CX-2');

      const trip = await Trip.create({
        vehicleId: vehicle._id, driverId: driver._id, createdBy: admin._id,
        origin, destination, status: 'completed', completedAt: new Date(),
      });

      const res = await request(app)
        .patch(`/api/v1/trips/${trip._id}/cancel`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/trips/:id/timeline', () => {
    it('should return trip timeline events', async () => {
      const { user: admin, token } = await createAdmin();
      const { user: driver } = await createDriver();
      const vehicle = await createVehicle('TL-1');

      const trip = await Trip.create({
        vehicleId: vehicle._id, driverId: driver._id, createdBy: admin._id,
        origin, destination, status: 'completed',
        startedAt: new Date('2026-01-01T10:00:00Z'),
        completedAt: new Date('2026-01-01T16:00:00Z'),
      });

      const res = await request(app)
        .get(`/api/v1/trips/${trip._id}/timeline`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(3); // created, started, completed
      const events = res.body.data.map((e: { event: string }) => e.event);
      expect(events).toContain('created');
      expect(events).toContain('started');
      expect(events).toContain('completed');
    });
  });
});
