import mongoose, { Schema, Document } from 'mongoose';

export interface IVertical extends Document {
  key: string; // Immutable unique identifier: 'bank', 'school', 'medical', 'fmcg', 'developer', 'vehicle', etc.
  label: string; // e.g. "Banking & Finance CRM"
  description?: string;
  icon: string; // Lucide icon name (e.g. 'Landmark', 'GraduationCap', 'Stethoscope', 'ShoppingBag', 'Building2', 'Car')
  defaultModules: string[]; // List of system module/menu keys enabled by default
  themeSettings: {
    primaryColor: string;
    sidebarBg: string;
    headerBg: string;
    fontFamily: string;
    mode: 'light' | 'dark' | 'system';
  };
  isCustom: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const VerticalSchema = new Schema<IVertical>(
  {
    key: { 
      type: String, 
      required: true, 
      unique: true, 
      trim: true, 
      lowercase: true,
      immutable: true // Key is immutable once created
    },
    label: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    icon: { type: String, default: 'Layers' },
    defaultModules: [{ type: String }],
    themeSettings: {
      primaryColor: { type: String, default: '#4F46E5' },
      sidebarBg: { type: String, default: '#0F172A' },
      headerBg: { type: String, default: '#FFFFFF' },
      fontFamily: { type: String, default: 'Inter' },
      mode: { type: String, enum: ['light', 'dark', 'system'], default: 'light' }
    },
    isCustom: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export default mongoose.model<IVertical>('Vertical', VerticalSchema);
