import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { app } from '../../index';
import { User } from '../../models/user.model';
import { RefreshToken } from '../../models/refresh-token.model';

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
  await RefreshToken.deleteMany({});
});

describe('Auth Routes', () => {
  describe('POST /api/v1/auth/register', () => {
    it('should register a new driver', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'new@test.com', password: 'Pass123!', name: 'New User', phone: '123' });
      expect(res.status).toBe(201);
      expect(res.body.data.role).toBe('driver');
      expect(res.body.data.password).toBeUndefined();
    });

    it('should reject registration with missing fields', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'a@b.com' });
      expect(res.status).toBe(400);
    });

    it('should reject duplicate email', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'dup@test.com', password: 'Pass123!', name: 'A', phone: '1' });
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'dup@test.com', password: 'Pass123!', name: 'B', phone: '2' });
      expect(res.status).toBe(409);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should return access token and set refresh cookie', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'log@test.com', password: 'Pass123!', name: 'A', phone: '1' });
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'log@test.com', password: 'Pass123!' });
      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('should reject wrong credentials', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'wrong@test.com', password: 'Pass123!', name: 'A', phone: '1' });
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'wrong@test.com', password: 'wrongpass' });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should refresh tokens using cookie', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'ref@test.com', password: 'Pass123!', name: 'A', phone: '1' });
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'ref@test.com', password: 'Pass123!' });
      const cookie = loginRes.headers['set-cookie'];
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should clear refresh cookie', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'out@test.com', password: 'Pass123!', name: 'A', phone: '1' });
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'out@test.com', password: 'Pass123!' });
      const cookie = loginRes.headers['set-cookie'];
      const token = loginRes.body.data.accessToken;
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', cookie)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });
  });
});
