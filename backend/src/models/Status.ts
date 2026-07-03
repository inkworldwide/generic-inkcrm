import mongoose, { Schema, Document } from 'mongoose';

export interface IStatus extends Document {
  organizationId: mongoose.Types.ObjectId;
  name: string;
  color: string; // hex or CSS color representation
  icon: string; // Lucide icon string name
  pipelinePosition: number; // 0 if not on pipeline, >0 for step order
  dashboardVisibility: boolean;
  isFinal: boolean; // Is it a closed state (Won/Lost)?
  isSuccess: boolean; // If isFinal, did we win?
  order: number; // Order in status settings list
  createdAt: Date;
  updatedAt: Date;
}

const StatusSchema = new Schema<IStatus>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true },
    color: { type: String, required: true, default: '#4F46E5' },
    icon: { type: String, required: true, default: 'Circle' },
    pipelinePosition: { type: Number, default: 0 },
    dashboardVisibility: { type: Boolean, default: true },
    isFinal: { type: Boolean, default: false },
    isSuccess: { type: Boolean, default: false },
    order: { type: Number, default: 0 }
  },
  { timestamps: true }
);

StatusSchema.index({ organizationId: 1, name: 1 }, { unique: true });
StatusSchema.index({ organizationId: 1, order: 1 });

export default mongoose.model<IStatus>('Status', StatusSchema);
