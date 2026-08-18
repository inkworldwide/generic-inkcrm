import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import CustomRecord from '../models/CustomRecord';
import ModuleDefinition from '../models/ModuleDefinition';
import Organization from '../models/Organization';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/inkcrm_generic';

async function main() {
  await mongoose.connect(MONGODB_URI);
  const org = await Organization.findOne();
  const leadModule = await ModuleDefinition.findOne({ apiPath: 'leads', organizationId: org?._id });
  
  const leadAgg = await CustomRecord.aggregate([
    { $match: { moduleId: leadModule?._id, organizationId: org?._id } },
    { $group: { _id: '$data.status', count: { $sum: 1 } } }
  ]);
  console.log('Aggregate results by status:', JSON.stringify(leadAgg, null, 2));

  // Let's verify if there is any status with 0 leads
  await mongoose.disconnect();
}
main().catch(console.error);
