import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/fleetpulse',
  jwtSecret: process.env.JWT_SECRET || 'default-secret',
  jwtExpiry: process.env.JWT_EXPIRY || '15m',
  jwtRefreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  notificationServiceUrl: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3001',
  internalApiKey: process.env.INTERNAL_API_KEY || 'default-key',
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:4200').split(','),
} as const;
