import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../index';
import { User } from '../../models/user.model';
import { Vehicle } from '../../models/vehicle.model';
import { MaintenanceLog } from '../../models/maintenance-log.model';
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
  await MaintenanceLog.deleteMany({});
  await AuditLog.deleteMany({});
});

function makeToken(userId: string, role: string): string {
  return jwt.sign({ userId, role }, config.jwtSecret as jwt.Secret, { expiresIn: '15m' });
}

async function createUser(role: 'admin' | 'fleet_manager' | 'driver', email?: string) {
  const user = await User.create({
    email: email || `${role}@test.com`,
    password: 'hashed',
    name: `Test ${role}`,
    phone: '123',
    role,
  });
  return { user, token: makeToken(String(user._id), role) };
}

function vehicleData(overrides?: Record<string, unknown>) {
  return {
    registrationNumber: `DL-${Date.now()}`,
    type: 'truck',
    make: 'Tata',
    model: 'Ace',
    year: 2023,
    ...overrides,
  };
}

describe('Vehicle Routes', () => {
  describe('POST /api/v1/vehicles', () => {
    it('should create vehicle (admin)', async () => {
      const { token } = await createUser('admin');
      const res = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`)
        .send(vehicleData({ registrationNumber: 'DL-01-AB-1234' }));
      expect(res.status).toBe(201);
      expect(res.body.data.registrationNumber).toBe('DL-01-AB-1234');
    });

    it('should create vehicle (fleet_manager)', async () => {
      const { token } = await createUser('fleet_manager');
      const res = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`)
        .send(vehicleData({ registrationNumber: 'DL-02' }));
      expect(res.status).toBe(201);
    });

    it('should reject for driver', async () => {
      const { token } = await createUser('driver');
      const res = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`)
        .send(vehicleData());
      expect(res.status).toBe(403);
    });

    it('should create audit log on create', async () => {
      const { token } = await createUser('admin');
      await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`)
        .send(vehicleData({ registrationNumber: 'DL-AUD' }));
      const logs = await AuditLog.find({ action: 'vehicle_created' });
      expect(logs.length).toBe(1);
    });
  });

  describe('GET /api/v1/vehicles', () => {
    it('should list vehicles with pagination', async () => {
      const { token } = await createUser('admin');
      await Vehicle.create([
        vehicleData({ registrationNumber: 'V1' }),
        vehicleData({ registrationNumber: 'V2' }),
      ]);
      const res = await request(app)
        .get('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.meta.total).toBe(2);
    });

    it('should filter by status', async () => {
      const { token } = await createUser('admin');
      await Vehicle.create([
        vehicleData({ registrationNumber: 'A1', status: 'active' }),
        vehicleData({ registrationNumber: 'A2', status: 'idle' }),
      ]);
      const res = await request(app)
        .get('/api/v1/vehicles?status=active')
        .set('Authorization', `Bearer ${token}`);
      expect(res.body.data.length).toBe(1);
    });

    it('should reject for driver', async () => {
      const { token } = await createUser('driver');
      const res = await request(app)
        .get('/api/v1/vehicles')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/vehicles/:id', () => {
    it('should return vehicle by ID', async () => {
      const { token } = await createUser('admin');
      const vehicle = await Vehicle.create(vehicleData({ registrationNumber: 'GET-1' }));
      const res = await request(app)
        .get(`/api/v1/vehicles/${vehicle._id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.registrationNumber).toBe('GET-1');
    });

    it('should return 404 for non-existent', async () => {
      const { token } = await createUser('admin');
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/v1/vehicles/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/v1/vehicles/:id', () => {
    it('should update vehicle', async () => {
      const { token } = await createUser('admin');
      const vehicle = await Vehicle.create(vehicleData({ registrationNumber: 'UP-1' }));
      const res = await request(app)
        .put(`/api/v1/vehicles/${vehicle._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ mileage: 50000 });
      expect(res.status).toBe(200);
      expect(res.body.data.mileage).toBe(50000);
    });
  });

  describe('PATCH /api/v1/vehicles/:id/location', () => {
    it('should update location for assigned driver', async () => {
      const { user, token } = await createUser('driver');
      const vehicle = await Vehicle.create(
        vehicleData({ registrationNumber: 'LOC-1', assignedDriverId: user._id })
      );
      const res = await request(app)
        .patch(`/api/v1/vehicles/${vehicle._id}/location`)
        .set('Authorization', `Bearer ${token}`)
        .send({ lat: 28.6, lng: 77.2 });
      expect(res.status).toBe(200);
      expect(res.body.data.currentLocation.lat).toBe(28.6);
    });

    it('should reject location update for non-assigned driver', async () => {
      const { token } = await createUser('driver');
      const otherDriver = await User.create({
        email: 'other@test.com', password: 'h', name: 'Other', phone: '1', role: 'driver',
      });
      const vehicle = await Vehicle.create(
        vehicleData({ registrationNumber: 'LOC-2', assignedDriverId: otherDriver._id })
      );
      const res = await request(app)
        .patch(`/api/v1/vehicles/${vehicle._id}/location`)
        .set('Authorization', `Bearer ${token}`)
        .send({ lat: 28.6, lng: 77.2 });
      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/v1/vehicles/:id/status', () => {
    it('should update vehicle status', async () => {
      const { token } = await createUser('fleet_manager');
      const vehicle = await Vehicle.create(vehicleData({ registrationNumber: 'ST-1' }));
      const res = await request(app)
        .patch(`/api/v1/vehicles/${vehicle._id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'active' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('active');
    });

    it('should reject invalid status', async () => {
      const { token } = await createUser('admin');
      const vehicle = await Vehicle.create(vehicleData({ registrationNumber: 'ST-2' }));
      const res = await request(app)
        .patch(`/api/v1/vehicles/${vehicle._id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'destroyed' });
      expect(res.status).toBe(400);
    });
  });

  describe('Maintenance sub-routes', () => {
    it('should add maintenance log', async () => {
      const { token } = await createUser('admin');
      const vehicle = await Vehicle.create(vehicleData({ registrationNumber: 'MX-1' }));
      const res = await request(app)
        .post(`/api/v1/vehicles/${vehicle._id}/maintenance`)
        .set('Authorization', `Bearer ${token}`)
        .send({ description: 'Oil change', cost: 2000, serviceDate: new Date() });
      expect(res.status).toBe(201);
      expect(res.body.data.description).toBe('Oil change');
    });

    it('should get maintenance history', async () => {
      const { user, token } = await createUser('admin');
      const vehicle = await Vehicle.create(vehicleData({ registrationNumber: 'MX-2' }));
      await MaintenanceLog.create({
        vehicleId: vehicle._id,
        description: 'Brake pad',
        cost: 3000,
        serviceDate: new Date(),
        createdBy: user._id,
      });
      const res = await request(app)
        .get(`/api/v1/vehicles/${vehicle._id}/maintenance`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
    });

    it('should create audit log on maintenance', async () => {
      const { token } = await createUser('admin');
      const vehicle = await Vehicle.create(vehicleData({ registrationNumber: 'MX-3' }));
      await request(app)
        .post(`/api/v1/vehicles/${vehicle._id}/maintenance`)
        .set('Authorization', `Bearer ${token}`)
        .send({ description: 'Tire rotation', cost: 1500, serviceDate: new Date() });
      const logs = await AuditLog.find({ action: 'maintenance_logged' });
      expect(logs.length).toBe(1);
    });
  });
});
