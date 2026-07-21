const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/inkcrm').then(async () => {
  const db = mongoose.connection.db;

  // Find user ink@crm.com
  const user = await db.collection('users').findOne({ email: 'ink@crm.com' });
  console.log(`User org ID: ${user.organizationId}`);

  // Find Department module definition
  const deptModule = await db.collection('moduledefinitions').findOne({
    organizationId: user.organizationId,
    apiPath: 'departments'
  });
  console.log(`Department Module ID: ${deptModule._id}`);

  // Find custom records under departments
  const query = {
    organizationId: user.organizationId,
    moduleId: deptModule._id
  };
  const records = await db.collection('customrecords').find(query).toArray();
  console.log(`Found ${records.length} department records in DB.`);
  records.forEach(r => console.log(`  - Name: ${r.data?.name}`));

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
