import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import User from '../models/User';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/inkcrm_generic';

async function main() {
  await mongoose.connect(MONGODB_URI);
  
  // Set all existing users to approved
  const res = await User.updateMany(
    {},
    {
      $set: {
        isApproved: true,
        approvalStatus: 'approved',
        isActive: true
      }
    }
  );
  console.log('Updated existing users to approved:', res.modifiedCount);

  const users = await User.find().select('firstName lastName email isApproved approvalStatus isActive');
  console.log(users);

  await mongoose.disconnect();
}
main().catch(console.error);
