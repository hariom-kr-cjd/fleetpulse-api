import mongoose, { Document, Schema } from 'mongoose';

export interface IMaintenanceLog extends Document {
  vehicleId: mongoose.Types.ObjectId;
  description: string;
  cost: number;
  serviceDate: Date;
  nextServiceDate?: Date;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const maintenanceLogSchema = new Schema<IMaintenanceLog>(
  {
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    description: { type: String, required: true },
    cost: { type: Number, required: true },
    serviceDate: { type: Date, required: true },
    nextServiceDate: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const MaintenanceLog = mongoose.model<IMaintenanceLog>('MaintenanceLog', maintenanceLogSchema);
