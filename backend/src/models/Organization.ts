import mongoose, { Schema, Document } from 'mongoose';

export interface IOrganization extends Document {
  name: string;
  subdomain: string;
  logoUrl?: string;
  faviconUrl?: string;
  loginBgUrl?: string;
  themeSettings: {
    primaryColor: string;
    sidebarBg: string;
    headerBg: string;
    fontFamily: string;
    mode: 'light' | 'dark' | 'system';
  };
  enabledModules: string[]; // List of system module paths enabled for the tenant
  subscription: {
    plan: 'free' | 'growth' | 'enterprise';
    status: 'active' | 'suspended' | 'trial';
    expiresAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, trim: true },
    subdomain: { type: String, required: true, unique: true, lowercase: true, trim: true },
    logoUrl: { type: String },
    faviconUrl: { type: String },
    loginBgUrl: { type: String },
    themeSettings: {
      primaryColor: { type: String, default: '#4F46E5' },
      sidebarBg: { type: String, default: '#0F172A' },
      headerBg: { type: String, default: '#FFFFFF' },
      fontFamily: { type: String, default: 'Inter' },
      mode: { type: String, enum: ['light', 'dark', 'system'], default: 'light' }
    },
    enabledModules: [{ type: String }],
    subscription: {
      plan: { type: String, enum: ['free', 'growth', 'enterprise'], default: 'free' },
      status: { type: String, enum: ['active', 'suspended', 'trial'], default: 'trial' },
      expiresAt: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } // 30 days trial
    }
  },
  { timestamps: true }
);

// Indexes
OrganizationSchema.index({ subdomain: 1 });

export default mongoose.model<IOrganization>('Organization', OrganizationSchema);
