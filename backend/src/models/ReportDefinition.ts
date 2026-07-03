import mongoose, { Schema, Document } from 'mongoose';

export interface IReportFilter {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'between';
  value: string; // Comma separated for between/in
}

export interface IReportDefinition extends Document {
  organizationId: mongoose.Types.ObjectId;
  moduleId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  chartType: 'bar' | 'line' | 'pie' | 'donut' | 'table' | 'pivot';
  groupByField?: string; // Grouping (x-axis)
  metricField?: string; // Calculation target (y-axis)
  aggregation: 'count' | 'sum' | 'avg' | 'min' | 'max';
  filters: IReportFilter[];
  columns: string[]; // Fields to display in details table
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ReportDefinitionSchema = new Schema<IReportDefinition>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    moduleId: { type: Schema.Types.ObjectId, ref: 'ModuleDefinition', required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String },
    chartType: {
      type: String,
      enum: ['bar', 'line', 'pie', 'donut', 'table', 'pivot'],
      required: true
    },
    groupByField: { type: String },
    metricField: { type: String },
    aggregation: {
      type: String,
      enum: ['count', 'sum', 'avg', 'min', 'max'],
      default: 'count'
    },
    filters: [
      {
        field: { type: String, required: true },
        operator: {
          type: String,
          enum: ['equals', 'not_equals', 'greater_than', 'less_than', 'contains', 'between'],
          required: true
        },
        value: { type: String, required: true }
      }
    ],
    columns: [{ type: String }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

// Indexes
ReportDefinitionSchema.index({ organizationId: 1, moduleId: 1 });

export default mongoose.model<IReportDefinition>('ReportDefinition', ReportDefinitionSchema);
