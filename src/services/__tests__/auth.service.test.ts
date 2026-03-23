import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { AuthService } from '../auth.service';
import { User } from '../../models/user.model';
import { RefreshToken } from '../../models/refresh-token.model';

let mongo: MongoMemoryServer;
let authService: AuthService;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  authService = new AuthService();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

afterEach(async () => {
  await User.deleteMany({});
  await RefreshToken.deleteMany({});
});

describe('AuthService', () => {
  describe('register', () => {
    it('should hash password and create user with driver role', async () => {
      const user = await authService.register({
        email: 'test@test.com',
        password: 'Password1!',
        name: 'Test',
        phone: '123',
      });
      expect(user.role).toBe('driver');
      expect(user.password).not.toBe('Password1!');
    });

    it('should reject duplicate email', async () => {
      await authService.register({ email: 'a@b.com', password: 'P1!', name: 'A', phone: '1' });
      await expect(
        authService.register({ email: 'a@b.com', password: 'P1!', name: 'B', phone: '2' })
      ).rejects.toThrow('Email already registered');
    });
  });

  describe('login', () => {
    it('should return access token and refresh token', async () => {
      await authService.register({ email: 'login@test.com', password: 'Pass1!', name: 'A', phone: '1' });
      const result = await authService.login('login@test.com', 'Pass1!');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should reject wrong password', async () => {
      await authService.register({ email: 'x@test.com', password: 'Pass1!', name: 'A', phone: '1' });
      await expect(authService.login('x@test.com', 'wrong')).rejects.toThrow('Invalid credentials');
    });

    it('should reject non-existent user', async () => {
      await expect(authService.login('nope@test.com', 'pass')).rejects.toThrow('Invalid credentials');
    });
  });

  describe('refresh', () => {
    it('should return new token pair and invalidate old refresh token', async () => {
      await authService.register({ email: 'ref@test.com', password: 'P1!', name: 'A', phone: '1' });
      const { refreshToken } = await authService.login('ref@test.com', 'P1!');
      const result = await authService.refresh(refreshToken);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshToken).not.toBe(refreshToken);
    });
  });

  describe('logout', () => {
    it('should delete refresh token', async () => {
      await authService.register({ email: 'out@test.com', password: 'P1!', name: 'A', phone: '1' });
      const { refreshToken } = await authService.login('out@test.com', 'P1!');
      await authService.logout(refreshToken);
      await expect(authService.refresh(refreshToken)).rejects.toThrow();
    });
  });
});
