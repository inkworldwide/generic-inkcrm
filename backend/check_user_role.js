const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/inkcrm_generic').then(async () => {
  const db = mongoose.connection.db;

  const user = await db.collection('users').findOne({ email: 'ink@hashmat' });
  if (!user) {
    console.error('User ink@hashmat not found.');
    process.exit(1);
  }
  console.log(`User: ${user.email}, Role ID: ${user.roleId}`);

  const role = await db.collection('roles').findOne({ _id: user.roleId });
  if (!role) {
    console.error('Role not found.');
    process.exit(1);
  }
  console.log(`Role Name: ${role.name}`);
  console.log('Permissions modules detail:', JSON.stringify(role.permissions?.modules, null, 2));

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
