import mongoose, { Schema, Document } from 'mongoose';

export interface IWorkflowCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains';
  value: string;
}

export interface IWorkflowAction {
  type: 'assign_user' | 'send_email' | 'create_task' | 'webhook' | 'notification';
  params: Record<string, any>;
  delayMinutes?: number;
}

export interface IWorkflow extends Document {
  organizationId: mongoose.Types.ObjectId;
  moduleId: mongoose.Types.ObjectId;
  name: string;
  trigger: {
    event: 'create' | 'update' | 'delete';
    fieldTrigger?: string; // e.g., run workflow only if "status" changes
  };
  conditions: IWorkflowCondition[];
  actions: IWorkflowAction[];
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const WorkflowSchema = new Schema<IWorkflow>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    moduleId: { type: Schema.Types.ObjectId, ref: 'ModuleDefinition', required: true },
    name: { type: String, required: true, trim: true },
    trigger: {
      event: { type: String, enum: ['create', 'update', 'delete'], required: true },
      fieldTrigger: { type: String }
    },
    conditions: [
      {
        field: { type: String, required: true },
        operator: {
          type: String,
          enum: ['equals', 'not_equals', 'greater_than', 'less_than', 'contains'],
          required: true
        },
        value: { type: String, required: true }
      }
    ],
    actions: [
      {
        type: {
          type: String,
          enum: ['assign_user', 'send_email', 'create_task', 'webhook', 'notification'],
          required: true
        },
        params: { type: Schema.Types.Map, of: Schema.Types.Mixed, default: {} },
        delayMinutes: { type: Number, default: 0 }
      }
    ],
    isEnabled: { type: Boolean, default: true }
  },
  { timestamps: true }
);

// Indexes
WorkflowSchema.index({ organizationId: 1, moduleId: 1, isEnabled: 1 });

export default mongoose.model<IWorkflow>('Workflow', WorkflowSchema);
