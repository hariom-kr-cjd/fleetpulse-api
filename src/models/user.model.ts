import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  phone: string;
  role: 'admin' | 'fleet_manager' | 'driver';
  licenseNumber?: string;
  licenseExpiry?: Date;
  availability: 'on_duty' | 'off_duty';
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true },
    role: { type: String, required: true, enum: ['admin', 'fleet_manager', 'driver'] },
    licenseNumber: { type: String },
    licenseExpiry: { type: Date },
    availability: { type: String, enum: ['on_duty', 'off_duty'], default: 'off_duty' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', userSchema);
