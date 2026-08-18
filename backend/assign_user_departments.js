const mongoose = require('mongoose');

const departmentAssignments = [
  { email: 'agent.suma@gmail.com', department: 'Telemarketing' },
  { email: 'agent.priya@gmail.com', department: 'Telemarketing' },
  { email: 'agent.sunita@gmail.com', department: 'AREA SALES MANAGER' },
  { email: 'agent.ankit@gmail.com', department: 'PARTNER' },
  { email: 'ink@crm.com', department: 'Management' },
  { email: 'ink@hashmat', department: 'SALES MANAGER' },
  { email: 'ink@sharfu', department: 'SALES MANAGER' },
  { email: 'ink@naushad.com', department: 'SALES MANAGER' },
  { email: 'ink@rajabaksha.com', department: 'SALES MANAGER' }
];

mongoose.connect('mongodb://127.0.0.1:27017/inkcrm_generic').then(async () => {
  const db = mongoose.connection.db;

  for (const assign of departmentAssignments) {
    const user = await db.collection('users').findOne({ email: assign.email });
    if (user) {
      await db.collection('users').updateOne(
        { _id: user._id },
        { $set: { department: assign.department } }
      );
      console.log(`Assigned user ${assign.email} to department: ${assign.department}`);
    } else {
      console.log(`User ${assign.email} not found.`);
    }
  }

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
