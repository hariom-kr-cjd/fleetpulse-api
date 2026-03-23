import mongoose, { Document, Schema } from 'mongoose';

export type AuditAction =
  | 'user_created'
  | 'user_updated'
  | 'user_deactivated'
  | 'vehicle_created'
  | 'vehicle_updated'
  | 'trip_created'
  | 'trip_started'
  | 'trip_completed'
  | 'trip_cancelled'
  | 'maintenance_logged';

export interface IAuditLog extends Document {
  userId: mongoose.Types.ObjectId;
  action: AuditAction;
  resource: string;
  resourceId: mongoose.Types.ObjectId;
  details?: Record<string, unknown>;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: {
      type: String,
      required: true,
      enum: [
        'user_created', 'user_updated', 'user_deactivated',
        'vehicle_created', 'vehicle_updated',
        'trip_created', 'trip_started', 'trip_completed', 'trip_cancelled',
        'maintenance_logged',
      ],
    },
    resource: { type: String, required: true },
    resourceId: { type: Schema.Types.ObjectId, required: true },
    details: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
