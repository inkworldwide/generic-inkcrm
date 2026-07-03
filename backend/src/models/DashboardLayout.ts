import mongoose, { Schema, Document } from 'mongoose';

export interface IDashboardWidget {
  id: string;
  type: string; // e.g. "leads_kpi", "revenue_chart", "funnel", "recent_activities", "tasks"
  title: string;
  x: number; // grid layout coordinates
  y: number;
  w: number;
  h: number;
  config: Record<string, any>;
}

export interface IDashboardLayout extends Document {
  organizationId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId; // If null, this is the tenant's global default dashboard
  name: string;
  isDefault: boolean;
  widgets: IDashboardWidget[];
  createdAt: Date;
  updatedAt: Date;
}

const DashboardLayoutSchema = new Schema<IDashboardLayout>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true, default: 'My Dashboard' },
    isDefault: { type: Boolean, default: false },
    widgets: [
      {
        id: { type: String, required: true },
        type: { type: String, required: true },
        title: { type: String, required: true },
        x: { type: Number, required: true },
        y: { type: Number, required: true },
        w: { type: Number, required: true },
        h: { type: Number, required: true },
        config: { type: Schema.Types.Map, of: Schema.Types.Mixed, default: {} }
      }
    ]
  },
  { timestamps: true }
);

// Indexes
DashboardLayoutSchema.index({ organizationId: 1, userId: 1 });

export default mongoose.model<IDashboardLayout>('DashboardLayout', DashboardLayoutSchema);
