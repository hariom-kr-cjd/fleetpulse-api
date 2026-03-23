import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Trip } from '../trip.model';

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
  await Trip.deleteMany({});
});

describe('Trip Model', () => {
  it('should auto-generate tripNumber on save', async () => {
    const trip = await Trip.create({
      vehicleId: new mongoose.Types.ObjectId(),
      driverId: new mongoose.Types.ObjectId(),
      createdBy: new mongoose.Types.ObjectId(),
      origin: { address: 'A', lat: 28.6, lng: 77.2 },
      destination: { address: 'B', lat: 28.7, lng: 77.3 },
      status: 'pending',
    });
    expect(trip.tripNumber).toMatch(/^FP-\d{8}-[A-Z0-9]{4}$/);
  });

  it('should reject invalid status', async () => {
    await expect(
      Trip.create({
        vehicleId: new mongoose.Types.ObjectId(),
        driverId: new mongoose.Types.ObjectId(),
        createdBy: new mongoose.Types.ObjectId(),
        origin: { address: 'A', lat: 28.6, lng: 77.2 },
        destination: { address: 'B', lat: 28.7, lng: 77.3 },
        status: 'invalid_status',
      })
    ).rejects.toThrow();
  });

  it('should default status to pending', async () => {
    const trip = await Trip.create({
      vehicleId: new mongoose.Types.ObjectId(),
      driverId: new mongoose.Types.ObjectId(),
      createdBy: new mongoose.Types.ObjectId(),
      origin: { address: 'A', lat: 28.6, lng: 77.2 },
      destination: { address: 'B', lat: 28.7, lng: 77.3 },
    });
    expect(trip.status).toBe('pending');
  });
});
