import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { config } from './config/env';
import { connectDB } from './config/db';
import authRoutes from './routes/auth.routes';

const app = express();

app.use(cors({ origin: config.allowedOrigins, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/api/v1/auth', authRoutes);

app.get('/health', async (_req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({ status: 'ok', db: dbStatus });
});

async function start() {
  await connectDB();
  app.listen(config.port, () => {
    console.log(`FleetPulse API running on port ${config.port}`);
  });
}

export { app };
export default start;

if (require.main === module) {
  start();
}
