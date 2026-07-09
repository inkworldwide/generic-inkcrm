import mongoose, { Schema, Document } from 'mongoose';

export interface IModulePermission {
  moduleName: string;
  create: boolean;
  read: 'all' | 'own' | 'none';
  update: 'all' | 'own' | 'none';
  delete: 'all' | 'own' | 'none';
}

export interface IFieldPermission {
  moduleName: string;
  fieldName: string;
  access: 'read' | 'write' | 'none';
}

export interface IRole extends Document {
  organizationId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  isSystem: boolean; // default system roles like Admin, Manager, Employee
  permissions: {
    modules: IModulePermission[];
    fields: IFieldPermission[];
    menus: string[]; // Allowed navigation menu identifiers
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RoleSchema = new Schema<IRole>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String },
    isSystem: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    permissions: {
      modules: [
        {
          moduleName: { type: String, required: true },
          create: { type: Boolean, default: false },
          read: { type: String, enum: ['all', 'own', 'none'], default: 'none' },
          update: { type: String, enum: ['all', 'own', 'none'], default: 'none' },
          delete: { type: String, enum: ['all', 'own', 'none'], default: 'none' }
        }
      ],
      fields: [
        {
          moduleName: { type: String, required: true },
          fieldName: { type: String, required: true },
          access: { type: String, enum: ['read', 'write', 'none'], default: 'read' }
        }
      ],
      menus: [{ type: String }]
    }
  },
  { timestamps: true }
);

// Indexes for tenant queries
RoleSchema.index({ organizationId: 1, name: 1 }, { unique: true });

export default mongoose.model<IRole>('Role', RoleSchema);
