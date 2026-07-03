import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  organizationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  action: string; // e.g., "auth.login", "record.delete", "workflow.trigger"
  resource: string; // e.g., "CustomRecord", "Role", "User"
  resourceId?: string; // ID of the specific item changed
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
  browser?: string;
  device?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    resource: { type: String, required: true },
    resourceId: { type: String },
    oldValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
    userAgent: { type: String },
    browser: { type: String },
    device: { type: String }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Indexes
AuditLogSchema.index({ organizationId: 1, createdAt: -1 });
AuditLogSchema.index({ userId: 1, action: 1 });

export default mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
