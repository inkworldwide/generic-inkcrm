const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/inkcrm').then(async () => {
  const db = mongoose.connection.db;

  const users = await db.collection('users').find({}).toArray();
  console.log('Users and their departments:');
  users.forEach(u => {
    console.log(`  - Email: ${u.email}`);
    console.log(`    First Name: ${u.firstName}, Last Name: ${u.lastName}`);
    console.log(`    Department field: ${u.department}`);
    console.log(`    IsActive: ${u.isActive}`);
  });

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
