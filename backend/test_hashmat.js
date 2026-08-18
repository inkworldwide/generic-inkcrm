const mongoose = require('mongoose');

const matchModuleName = (permName, targetName) => {
  const p = permName.toLowerCase();
  const t = targetName.toLowerCase();
  if (p === t) return true;
  if (p === t + 's' || t === p + 's') return true;
  if (p === t.replace(/y$/, 'ies') || t === p.replace(/y$/, 'ies')) return true;
  return false;
};

const authorizeModuleAction = async (user, moduleName, action) => {
  const role = await mongoose.connection.db.collection('roles').findOne({ _id: user.roleId });
  if (!role) return { allowed: false, scope: 'none' };
  if (role.name === 'Super Admin' && role.isSystem) {
    return { allowed: true, scope: 'all' };
  }
  const permission = role.permissions?.modules?.find(m => matchModuleName(m.moduleName, moduleName));
  if (!permission) return { allowed: false, scope: 'none' };
  if (action === 'create') {
    return { allowed: permission.create, scope: 'all' };
  }
  const scope = permission[action];
  return {
    allowed: scope !== 'none',
    scope: scope === 'none' ? 'none' : scope
  };
};

mongoose.connect('mongodb://127.0.0.1:27017/inkcrm_generic').then(async () => {
  const db = mongoose.connection.db;

  const user = await db.collection('users').findOne({ email: 'ink@hashmat' });
  console.log(`Testing endpoints for user: ${user.email} (Role: ${user.roleId})`);

  const endpoints = ['bankingpartners', 'bankmasters', 'products', 'departments'];
  for (const path of endpoints) {
    try {
      const moduleDef = await db.collection('moduledefinitions').findOne({
        organizationId: user.organizationId,
        apiPath: path
      });
      if (!moduleDef) {
        console.log(`  - Endpoint ${path}: MODULE DEFINITION NOT FOUND`);
        continue;
      }
      const auth = await authorizeModuleAction(user, moduleDef.name, 'read');
      console.log(`  - Endpoint ${path} (Module: ${moduleDef.name}): Allowed=${auth.allowed}, Scope=${auth.scope}`);
    } catch (e) {
      console.error(`  - Endpoint ${path}: Error:`, e.message);
    }
  }

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
