import mongoose, { Schema, Document } from 'mongoose';

export interface IDocument extends Document {
  organizationId: mongoose.Types.ObjectId;
  name: string; // Original filename
  filePath: string; // URL or file path (local or S3 URL)
  mimeType: string;
  size: number; // in bytes
  version: number;
  uploadedBy: mongoose.Types.ObjectId;
  recordId?: mongoose.Types.ObjectId; // Associated CustomRecord ID (optional)
  createdAt: Date;
  updatedAt: Date;
}

const DocumentSchema = new Schema<IDocument>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true },
    filePath: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    version: { type: Number, default: 1 },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recordId: { type: Schema.Types.ObjectId, ref: 'CustomRecord' }
  },
  { timestamps: true }
);

// Indexes
DocumentSchema.index({ organizationId: 1, recordId: 1 });

export default mongoose.model<IDocument>('Document', DocumentSchema);
