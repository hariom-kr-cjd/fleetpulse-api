import mongoose, { Document, Schema } from 'mongoose';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'trip_assigned' | 'trip_completed' | 'maintenance_due' | 'general';
  title: string;
  message: string;
  read: boolean;
  tripId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      required: true,
      enum: ['trip_assigned', 'trip_completed', 'maintenance_due', 'general'],
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    tripId: { type: Schema.Types.ObjectId, ref: 'Trip' },
  },
  { timestamps: true }
);

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
