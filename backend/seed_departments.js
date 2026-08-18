const mongoose = require('mongoose');

const departmentList = [
  { name: 'Telemarketing', code: 'TELEMARKETING' },
  { name: 'Management', code: 'MANAGEMENT' },
  { name: 'SALES MANAGER', code: 'SALES_MANAGER' },
  { name: 'Accounts', code: 'ACCOUNTS' },
  { name: 'RELATIONSHIP MANAGER', code: 'RELATIONSHIP_MANAGER' },
  { name: 'PRODUCTS SALES MANAGER', code: 'PRODUCTS_SALES_MANAGER' },
  { name: 'AREA SALES MANAGER', code: 'AREA_SALES_MANAGER' },
  { name: 'PARTNER', code: 'PARTNER' },
  { name: 'BUSINESS CORRESPONDENT', code: 'BUSINESS_CORRESPONDENT' },
  { name: 'SPOKE', code: 'SPOKE' }
];

mongoose.connect('mongodb://127.0.0.1:27017/inkcrm_generic').then(async () => {
  const db = mongoose.connection.db;

  // 1. Get the organization
  const org = await db.collection('organizations').findOne({});
  if (!org) {
    console.error('No organization found.');
    process.exit(1);
  }
  console.log(`Using organization: ${org.name} (${org._id})`);

  // 2. Get the Department module definition
  const deptModule = await db.collection('moduledefinitions').findOne({ 
    organizationId: org._id, 
    apiPath: 'departments' 
  });
  if (!deptModule) {
    console.error('Department module definition not found.');
    process.exit(1);
  }
  console.log(`Found Department module ID: ${deptModule._id}`);

  // 3. Get an admin or user to associate with createdBy
  const user = await db.collection('users').findOne({ organizationId: org._id });
  const userId = user ? user._id : null;
  console.log(`Using user ID for createdBy/updatedBy: ${userId}`);

  // 4. Delete existing department records
  const deleteRes = await db.collection('customrecords').deleteMany({
    organizationId: org._id,
    moduleId: deptModule._id
  });
  console.log(`Deleted ${deleteRes.deletedCount} existing department records.`);

  // 5. Insert new departments
  const recordsToInsert = departmentList.map(dept => ({
    organizationId: org._id,
    moduleId: deptModule._id,
    data: {
      name: dept.name,
      code: dept.code
    },
    createdBy: userId,
    updatedBy: userId,
    createdAt: new Date(),
    updatedAt: new Date()
  }));

  const insertRes = await db.collection('customrecords').insertMany(recordsToInsert);
  console.log(`Successfully inserted ${insertRes.insertedCount} new department records:`);
  departmentList.forEach(d => console.log(`  - ${d.name} (${d.code})`));

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
