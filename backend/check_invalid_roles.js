const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/inkcrm').then(async () => {
  const db = mongoose.connection.db;

  const users = await db.collection('users').find({}).toArray();
  const roles = await db.collection('roles').find({}).toArray();
  const rolesMap = new Map(roles.map(r => [r._id.toString(), r.name]));

  console.log('User Role Resolution:');
  for (const user of users) {
    const roleIdStr = user.roleId ? user.roleId.toString() : null;
    const roleExists = roleIdStr ? rolesMap.has(roleIdStr) : false;
    const roleName = roleExists ? rolesMap.get(roleIdStr) : 'INVALID/DELETED ROLE';
    
    console.log(`  - User: ${user.email}, RoleId: ${roleIdStr}, Name: ${roleName}`);
  }

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
