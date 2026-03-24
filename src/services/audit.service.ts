import { AuditLog, AuditAction } from '../models/audit-log.model';
import mongoose from 'mongoose';

interface AuditEntry {
  userId: string;
  action: AuditAction;
  resource: string;
  resourceId: string;
  details?: Record<string, unknown>;
}

export class AuditService {
  async log(entry: AuditEntry): Promise<void> {
    await AuditLog.create({
      userId: new mongoose.Types.ObjectId(entry.userId),
      action: entry.action,
      resource: entry.resource,
      resourceId: new mongoose.Types.ObjectId(entry.resourceId),
      details: entry.details,
    });
  }
}
