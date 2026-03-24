import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { app } from '../../index';
import { User } from '../../models/user.model';
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
  await AuditLog.deleteMany({});
});

async function createUserWithToken(
  role: 'admin' | 'fleet_manager' | 'driver',
  email = `${role}@test.com`
): Promise<{ token: string; userId: string }> {
  const hashed = await bcrypt.hash('Pass123!', 10);
  const user = await User.create({
    email,
    password: hashed,
    name: `Test ${role}`,
    phone: '1234567890',
    role,
  });
  const token = jwt.sign(
    { userId: String(user._id), role },
    config.jwtSecret as jwt.Secret,
    { expiresIn: '15m' }
  );
  return { token, userId: String(user._id) };
}

describe('User Routes', () => {
  describe('GET /api/v1/users/me', () => {
    it('should return current user profile', async () => {
      const { token } = await createUserWithToken('driver');
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe('driver@test.com');
      expect(res.body.data.password).toBeUndefined();
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app).get('/api/v1/users/me');
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/v1/users/me', () => {
    it('should update own profile (limited fields)', async () => {
      const { token } = await createUserWithToken('driver');
      const res = await request(app)
        .put('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Name', phone: '9999999999' });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated Name');
      expect(res.body.data.phone).toBe('9999999999');
    });
  });

  describe('GET /api/v1/users', () => {
    it('should list users for admin (paginated)', async () => {
      const { token } = await createUserWithToken('admin');
      // Create additional users
      const hashed = await bcrypt.hash('Pass123!', 10);
      await User.create([
        { email: 'd1@test.com', password: hashed, name: 'Driver One', phone: '1', role: 'driver' },
        { email: 'd2@test.com', password: hashed, name: 'Driver Two', phone: '2', role: 'driver' },
      ]);

      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(3); // admin + 2 drivers
      expect(res.body.meta.total).toBe(3);
    });

    it('should search users by name', async () => {
      const { token } = await createUserWithToken('admin');
      const hashed = await bcrypt.hash('Pass123!', 10);
      await User.create({ email: 'john@test.com', password: hashed, name: 'John Doe', phone: '1', role: 'driver' });

      const res = await request(app)
        .get('/api/v1/users?q=john')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('John Doe');
    });

    it('should filter users by role', async () => {
      const { token } = await createUserWithToken('admin');
      const hashed = await bcrypt.hash('Pass123!', 10);
      await User.create([
        { email: 'fm@test.com', password: hashed, name: 'FM', phone: '1', role: 'fleet_manager' },
        { email: 'd@test.com', password: hashed, name: 'D', phone: '2', role: 'driver' },
      ]);

      const res = await request(app)
        .get('/api/v1/users?role=fleet_manager')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].role).toBe('fleet_manager');
    });

    it('should return 403 for non-admin', async () => {
      const { token } = await createUserWithToken('driver');
      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it('should return 403 for fleet_manager', async () => {
      const { token } = await createUserWithToken('fleet_manager');
      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/users/:id', () => {
    it('should return user by ID for admin', async () => {
      const { token } = await createUserWithToken('admin');
      const hashed = await bcrypt.hash('Pass123!', 10);
      const driver = await User.create({ email: 'get@test.com', password: hashed, name: 'Get User', phone: '1', role: 'driver' });

      const res = await request(app)
        .get(`/api/v1/users/${driver._id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe('get@test.com');
      expect(res.body.data.password).toBeUndefined();
    });

    it('should return 404 for non-existent user', async () => {
      const { token } = await createUserWithToken('admin');
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/v1/users/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid ID', async () => {
      const { token } = await createUserWithToken('admin');
      const res = await request(app)
        .get('/api/v1/users/invalid-id')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/v1/users/:id', () => {
    it('should update user role (admin)', async () => {
      const { token } = await createUserWithToken('admin');
      const hashed = await bcrypt.hash('Pass123!', 10);
      const driver = await User.create({ email: 'up@test.com', password: hashed, name: 'Up User', phone: '1', role: 'driver' });

      const res = await request(app)
        .put(`/api/v1/users/${driver._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'fleet_manager' });
      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe('fleet_manager');
    });

    it('should create audit log on update', async () => {
      const { token } = await createUserWithToken('admin');
      const hashed = await bcrypt.hash('Pass123!', 10);
      const driver = await User.create({ email: 'aud@test.com', password: hashed, name: 'Aud User', phone: '1', role: 'driver' });

      await request(app)
        .put(`/api/v1/users/${driver._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Name' });

      const logs = await AuditLog.find({ action: 'user_updated' });
      expect(logs.length).toBe(1);
      expect(logs[0].resource).toBe('User');
    });
  });

  describe('DELETE /api/v1/users/:id', () => {
    it('should deactivate user (not delete)', async () => {
      const { token } = await createUserWithToken('admin');
      const hashed = await bcrypt.hash('Pass123!', 10);
      const driver = await User.create({ email: 'del@test.com', password: hashed, name: 'Del User', phone: '1', role: 'driver' });

      const res = await request(app)
        .delete(`/api/v1/users/${driver._id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('inactive');

      // User still exists in DB
      const stillExists = await User.findById(driver._id);
      expect(stillExists).not.toBeNull();
      expect(stillExists!.status).toBe('inactive');
    });

    it('should create audit log on deactivate', async () => {
      const { token } = await createUserWithToken('admin');
      const hashed = await bcrypt.hash('Pass123!', 10);
      const driver = await User.create({ email: 'deaud@test.com', password: hashed, name: 'Deaud', phone: '1', role: 'driver' });

      await request(app)
        .delete(`/api/v1/users/${driver._id}`)
        .set('Authorization', `Bearer ${token}`);

      const logs = await AuditLog.find({ action: 'user_deactivated' });
      expect(logs.length).toBe(1);
    });

    it('should return 403 for non-admin', async () => {
      const { token } = await createUserWithToken('driver');
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .delete(`/api/v1/users/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });
  });
});
