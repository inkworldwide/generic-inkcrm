import mongoose, { Schema, Document } from 'mongoose';

export interface IActivity extends Document {
  organizationId: mongoose.Types.ObjectId;
  recordId: mongoose.Types.ObjectId; // ID of the CustomRecord
  userId: mongoose.Types.ObjectId; // Action author
  type: 'create' | 'edit' | 'delete' | 'comment' | 'mention' | 'attachment' | 'status_change' | 'assignment';
  details: {
    fieldName?: string;
    oldValue?: any;
    newValue?: any;
    commentText?: string;
    attachmentUrl?: string;
    assignedToId?: mongoose.Types.ObjectId; // User ID if assigned
  };
  createdAt: Date;
}

const ActivitySchema = new Schema<IActivity>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    recordId: { type: Schema.Types.ObjectId, ref: 'CustomRecord', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['create', 'edit', 'delete', 'comment', 'mention', 'attachment', 'status_change', 'assignment'],
      required: true
    },
    details: {
      fieldName: { type: String },
      oldValue: { type: Schema.Types.Mixed },
      newValue: { type: Schema.Types.Mixed },
      commentText: { type: String },
      attachmentUrl: { type: String },
      assignedToId: { type: Schema.Types.ObjectId, ref: 'User' }
    }
  },
  { timestamps: { createdAt: true, updatedAt: false } } // Only need creation time
);

// Indexes
ActivitySchema.index({ organizationId: 1, recordId: 1, createdAt: -1 });

export default mongoose.model<IActivity>('Activity', ActivitySchema);
