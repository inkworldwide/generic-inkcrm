import mongoose, { Schema, Document } from 'mongoose';

export interface IDeviceSession {
  deviceId: string;
  browser: string;
  os: string;
  ip: string;
  lastActive: Date;
}

export interface IUser extends Document {
  organizationId: mongoose.Types.ObjectId;
  roleId: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  isVerified: boolean;
  twoFactor: {
    enabled: boolean;
    secret?: string;
    tempToken?: string;
  };
  faceRecognition: {
    enabled: boolean;
    encryptedEmbedding?: string;
    enrolledAt?: Date;
  };
  avatarUrl?: string;
  refreshTokens: string[]; // Supports multiple active sessions
  activeDevices: IDeviceSession[];
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    roleId: { type: Schema.Types.ObjectId, ref: 'Role', required: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    isVerified: { type: Boolean, default: false },
    twoFactor: {
      enabled: { type: Boolean, default: false },
      secret: { type: String },
      tempToken: { type: String }
    },
    faceRecognition: {
      enabled: { type: Boolean, default: false },
      encryptedEmbedding: { type: String },
      enrolledAt: { type: Date }
    },
    avatarUrl: { type: String },
    refreshTokens: [{ type: String }],
    activeDevices: [
      {
        deviceId: { type: String, required: true },
        browser: { type: String, default: 'Unknown' },
        os: { type: String, default: 'Unknown' },
        ip: { type: String, default: 'Unknown' },
        lastActive: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

// Indexes
UserSchema.index({ email: 1 });
UserSchema.index({ organizationId: 1 });

export default mongoose.model<IUser>('User', UserSchema);
