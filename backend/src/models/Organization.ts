import mongoose, { Schema, Document } from 'mongoose';

export interface IModuleRequest {
  moduleKey: string;
  requestedAt: Date;
  requestedBy?: mongoose.Types.ObjectId;
  note?: string;
}

export interface IOrganization extends Document {
  name: string;
  subdomain: string;
  verticalType: string; // 'bank' | 'school' | 'medical' | 'fmcg' | 'developer' | 'vehicle' | custom
  verticalId?: mongoose.Types.ObjectId;
  status: 'active' | 'disabled' | 'archived' | 'pending_setup';
  createdBy?: mongoose.Types.ObjectId;
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
  enabledModules: string[];
  requestedModules?: IModuleRequest[];

  // Company Details
  companyCode?: string;
  registrationId?: string;
  startDate?: string;
  endDate?: string;
  companyDocUrl?: string;
  phoneNumber?: string;
  mobile?: string;
  email?: string;
  fax?: string;
  website?: string;
  currency?: string;

  // Address
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;

  // Admin details
  adminDetails?: {
    firstName?: string;
    lastName?: string;
    username?: string;
    password?: string;
    financialYear?: string;
    roleType?: string;
  };

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
    verticalType: { type: String, default: 'custom', index: true },
    verticalId: { type: Schema.Types.ObjectId, ref: 'Vertical' },
    status: { 
      type: String, 
      enum: ['active', 'disabled', 'archived', 'pending_setup'], 
      default: 'active',
      index: true 
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
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
    requestedModules: [
      {
        moduleKey: { type: String, required: true },
        requestedAt: { type: Date, default: Date.now },
        requestedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        note: { type: String }
      }
    ],
    
    // Company Details
    companyCode: { type: String },
    registrationId: { type: String },
    startDate: { type: String },
    endDate: { type: String },
    companyDocUrl: { type: String },
    phoneNumber: { type: String },
    mobile: { type: String },
    email: { type: String },
    fax: { type: String },
    website: { type: String },
    currency: { type: String, default: 'INR' },

    // Address
    address: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String },
    postalCode: { type: String },

    // Admin Details
    adminDetails: {
      firstName: { type: String },
      lastName: { type: String },
      username: { type: String },
      password: { type: String },
      financialYear: { type: String },
      roleType: { type: String }
    },

    subscription: {
      plan: { type: String, enum: ['free', 'growth', 'enterprise'], default: 'enterprise' },
      status: { type: String, enum: ['active', 'suspended', 'trial'], default: 'active' },
      expiresAt: { type: Date, default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) }
    }
  },
  { timestamps: true }
);

export default mongoose.model<IOrganization>('Organization', OrganizationSchema);
