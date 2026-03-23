import mongoose, { Document, Schema } from 'mongoose';
import crypto from 'crypto';

export interface ICheckpoint {
  address: string;
  lat: number;
  lng: number;
  arrivedAt?: Date;
}

export interface ITrip extends Document {
  tripNumber: string;
  vehicleId: mongoose.Types.ObjectId;
  driverId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  origin: { address: string; lat: number; lng: number };
  destination: { address: string; lat: number; lng: number };
  checkpoints: ICheckpoint[];
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  startedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancelledBy?: mongoose.Types.ObjectId;
  distance?: number;
  estimatedDuration?: number;
  createdAt: Date;
  updatedAt: Date;
}

const locationSchema = new Schema(
  {
    address: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  { _id: false }
);

const checkpointSchema = new Schema(
  {
    address: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    arrivedAt: { type: Date },
  },
  { _id: false }
);

const tripSchema = new Schema<ITrip>(
  {
    tripNumber: { type: String, unique: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    driverId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    origin: { type: locationSchema, required: true },
    destination: { type: locationSchema, required: true },
    checkpoints: { type: [checkpointSchema], default: [] },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'cancelled'],
      default: 'pending',
    },
    notes: { type: String },
    startedAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    distance: { type: Number },
    estimatedDuration: { type: Number },
  },
  { timestamps: true }
);

tripSchema.pre('save', function () {
  if (!this.tripNumber) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    this.tripNumber = `FP-${date}-${suffix}`;
  }
});

export const Trip = mongoose.model<ITrip>('Trip', tripSchema);
