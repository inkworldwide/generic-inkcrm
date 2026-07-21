const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/inkcrm').then(async () => {
  const db = mongoose.connection.db;

  // 1. List all organizations
  const orgs = await db.collection('organizations').find({}).toArray();
  console.log('Organizations in DB:');
  orgs.forEach(o => console.log(`  - Name: ${o.name}, ID: ${o._id}, Subdomain: ${o.subdomain}`));

  // 2. List all users
  const users = await db.collection('users').find({}).toArray();
  console.log('\nUsers in DB:');
  users.forEach(u => console.log(`  - Email: ${u.email}, Org ID: ${u.organizationId}`));

  // 3. List all module definitions for departments
  const deptDefs = await db.collection('moduledefinitions').find({ apiPath: 'departments' }).toArray();
  console.log('\nDepartment module definitions:');
  deptDefs.forEach(d => console.log(`  - Org ID: ${d.organizationId}, Module ID: ${d._id}`));

  // 4. List all department records
  const deptRecords = await db.collection('customrecords').find({ moduleId: { $in: deptDefs.map(d => d._id) } }).toArray();
  console.log('\nDepartment custom records in DB:');
  deptRecords.forEach(r => console.log(`  - Org ID: ${r.organizationId}, Module ID: ${r.moduleId}, Name: ${r.data?.name}, Code: ${r.data?.code}`));

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
