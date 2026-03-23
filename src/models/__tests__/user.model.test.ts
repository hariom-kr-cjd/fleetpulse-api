import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User } from '../user.model';

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
});

describe('User Model', () => {
  it('should create a user with valid fields', async () => {
    const user = await User.create({
      email: 'test@test.com',
      password: 'hashed-password',
      name: 'Test User',
      phone: '1234567890',
      role: 'driver',
    });
    expect(user.email).toBe('test@test.com');
    expect(user.role).toBe('driver');
    expect(user.status).toBe('active');
    expect(user.availability).toBe('off_duty');
  });

  it('should reject duplicate email', async () => {
    await User.create({ email: 'dup@test.com', password: 'p', name: 'A', phone: '1', role: 'driver' });
    await expect(
      User.create({ email: 'dup@test.com', password: 'p', name: 'B', phone: '2', role: 'driver' })
    ).rejects.toThrow();
  });

  it('should reject invalid role', async () => {
    await expect(
      User.create({ email: 'a@b.com', password: 'p', name: 'A', phone: '1', role: 'superadmin' })
    ).rejects.toThrow();
  });
});
