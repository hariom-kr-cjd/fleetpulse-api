import mongoose, { Schema, InferSchemaType } from 'mongoose';

const vehicleSchema = new Schema(
  {
    registrationNumber: { type: String, required: true, unique: true, trim: true },
    type: { type: String, required: true, enum: ['truck', 'van', 'bike'] },
    make: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    year: { type: Number, required: true },
    status: { type: String, enum: ['active', 'idle', 'maintenance'], default: 'idle' },
    currentLocation: {
      lat: { type: Number },
      lng: { type: Number },
    },
    mileage: { type: Number, default: 0 },
    fuelType: { type: String },
    assignedDriverId: { type: Schema.Types.ObjectId, ref: 'User' },
    lastServiceDate: { type: Date },
  },
  { timestamps: true }
);

export type IVehicle = InferSchemaType<typeof vehicleSchema> & mongoose.Document;
export const Vehicle = mongoose.model('Vehicle', vehicleSchema);
