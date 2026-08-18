import mongoose, { Schema, Document } from 'mongoose';

export interface IImpersonationLog extends Document {
  superAdminId: mongoose.Types.ObjectId;
  tenantOrgId: mongoose.Types.ObjectId;
  tenantAdminId: mongoose.Types.ObjectId;
  tokenJti?: string;
  startedAt: Date;
  endedAt?: Date;
  ipAddress?: string;
  userAgent?: string;
}

const ImpersonationLogSchema = new Schema<IImpersonationLog>(
  {
    superAdminId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tenantOrgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    tenantAdminId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tokenJti: { type: String },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
    ipAddress: { type: String },
    userAgent: { type: String }
  },
  { timestamps: true }
);

export default mongoose.model<IImpersonationLog>('ImpersonationLog', ImpersonationLogSchema);
