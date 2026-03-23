import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import type { StringValue } from 'ms';
import { User, IUser } from '../models/user.model';
import { RefreshToken } from '../models/refresh-token.model';
import { config } from '../config/env';

interface RegisterInput {
  email: string;
  password: string;
  name: string;
  phone: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  async register(input: RegisterInput): Promise<IUser> {
    const existing = await User.findOne({ email: input.email.toLowerCase() });
    if (existing) {
      throw new Error('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(input.password, 10);
    const user = await User.create({
      ...input,
      password: hashedPassword,
      role: 'driver',
    });

    return user;
  }

  async login(email: string, password: string): Promise<TokenPair> {
    const user = await User.findOne({ email: email.toLowerCase(), status: 'active' });
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error('Invalid credentials');
    }

    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user);

    return { accessToken, refreshToken };
  }

  async refresh(token: string): Promise<TokenPair> {
    const stored = await RefreshToken.findOne({ token });
    if (!stored || stored.expiresAt < new Date()) {
      throw new Error('Invalid or expired refresh token');
    }

    await RefreshToken.deleteOne({ _id: stored._id });

    const user = await User.findById(stored.userId);
    if (!user) {
      throw new Error('User not found');
    }

    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user);

    return { accessToken, refreshToken };
  }

  async logout(token: string): Promise<void> {
    await RefreshToken.deleteOne({ token });
  }

  private generateAccessToken(user: IUser): string {
    const payload = { userId: String(user._id), role: user.role };
    const secret: jwt.Secret = config.jwtSecret;
    const options: jwt.SignOptions = { expiresIn: config.jwtExpiry as StringValue };
    return jwt.sign(payload, secret, options);
  }

  private async generateRefreshToken(user: IUser): Promise<string> {
    const token = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await RefreshToken.create({
      token,
      userId: user._id,
      expiresAt,
    });

    return token;
  }
}
