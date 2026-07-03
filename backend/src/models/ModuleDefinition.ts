import mongoose, { Schema, Document } from 'mongoose';

export interface IFieldDefinition {
  name: string;
  label: string;
  type:
    | 'text'
    | 'number'
    | 'currency'
    | 'email'
    | 'phone'
    | 'date'
    | 'dropdown'
    | 'multiselect'
    | 'checkbox'
    | 'switch'
    | 'rating'
    | 'file'
    | 'image'
    | 'formula'
    | 'rich-text'
    | 'signature'
    | 'url';
  required: boolean;
  unique: boolean;
  regexValidation?: string;
  defaultValue?: string;
  formulaExpression?: string; // e.g. "{hourlyRate} * {hoursWorked}"
  options?: string[]; // For select type fields
  conditionalVisibility?: {
    dependsOnField: string;
    conditionValue: string;
  };
}

export interface IRelationshipDefinition {
  targetModule: string; // The singular or plural name of the target module
  type: 'one-to-many' | 'many-to-one' | 'many-to-many';
  fieldName: string; // The field name that holds the association (e.g., "companyId")
}

export interface IModuleDefinition extends Document {
  organizationId: mongoose.Types.ObjectId;
  name: string; // Unique within organization, e.g. "Student"
  singularLabel: string;
  pluralLabel: string;
  apiPath: string; // Path segment e.g., "students"
  icon: string; // Lucide React icon name
  description?: string;
  isSystem: boolean; // default system modules vs admin-built custom modules
  fields: IFieldDefinition[];
  relationships: IRelationshipDefinition[];
  createdAt: Date;
  updatedAt: Date;
}

const FieldDefinitionSchema = new Schema<IFieldDefinition>({
  name: { type: String, required: true },
  label: { type: String, required: true },
  type: {
    type: String,
    enum: [
      'text',
      'number',
      'currency',
      'email',
      'phone',
      'date',
      'dropdown',
      'multiselect',
      'checkbox',
      'switch',
      'rating',
      'file',
      'image',
      'formula',
      'rich-text',
      'signature',
      'url'
    ],
    required: true
  },
  required: { type: Boolean, default: false },
  unique: { type: Boolean, default: false },
  regexValidation: { type: String },
  defaultValue: { type: String },
  formulaExpression: { type: String },
  options: [{ type: String }],
  conditionalVisibility: {
    dependsOnField: { type: String },
    conditionValue: { type: String }
  }
});

const RelationshipDefinitionSchema = new Schema<IRelationshipDefinition>({
  targetModule: { type: String, required: true },
  type: { type: String, enum: ['one-to-many', 'many-to-one', 'many-to-many'], required: true },
  fieldName: { type: String, required: true }
});

const ModuleDefinitionSchema = new Schema<IModuleDefinition>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true },
    singularLabel: { type: String, required: true },
    pluralLabel: { type: String, required: true },
    apiPath: { type: String, required: true, lowercase: true, trim: true },
    icon: { type: String, default: 'FileText' },
    description: { type: String },
    isSystem: { type: Boolean, default: false },
    fields: [FieldDefinitionSchema],
    relationships: [RelationshipDefinitionSchema]
  },
  { timestamps: true }
);

// Indexes
ModuleDefinitionSchema.index({ organizationId: 1, name: 1 }, { unique: true });
ModuleDefinitionSchema.index({ organizationId: 1, apiPath: 1 }, { unique: true });

export default mongoose.model<IModuleDefinition>('ModuleDefinition', ModuleDefinitionSchema);
