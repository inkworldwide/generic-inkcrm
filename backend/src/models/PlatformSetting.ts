import mongoose, { Schema, Document } from 'mongoose';

export interface IPlatformSetting extends Document {
  platformName: string;
  platformTagline: string;
  logoUrl: string;
  companyCode?: string;
  phone?: string;
  email?: string;
  updatedAt: Date;
}

const PlatformSettingSchema = new Schema<IPlatformSetting>(
  {
    platformName: { type: String, default: 'inkCRM Platform', trim: true },
    platformTagline: { type: String, default: 'Super Admin Engine', trim: true },
    logoUrl: { type: String, default: '/logo.png' },
    companyCode: { type: String, default: 'COMP01', trim: true },
    phone: { type: String, default: '+1 (555) 019-2834', trim: true },
    email: { type: String, default: 'superadmin@inkcrm.com', trim: true }
  },
  { timestamps: true }
);

export default mongoose.model<IPlatformSetting>('PlatformSetting', PlatformSettingSchema);
