import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  organizationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId; // Recipient
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  isRead: boolean;
  link?: string; // Optional URL path to redirect when clicked
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    type: { type: String, enum: ['info', 'success', 'warning', 'error'], default: 'info' },
    isRead: { type: Boolean, default: false },
    link: { type: String }
  },
  { timestamps: true }
);

// Indexes
NotificationSchema.index({ organizationId: 1, userId: 1, isRead: 1 });

export default mongoose.model<INotification>('Notification', NotificationSchema);
