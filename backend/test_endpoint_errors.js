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

  // Let's test for Super Admin first
  const admin = await db.collection('users').findOne({ email: 'ink@crm.com' });
  console.log(`Testing endpoints for Admin user: ${admin.email}`);

  const endpoints = ['bankingpartners', 'bankmasters', 'products', 'departments'];
  for (const path of endpoints) {
    try {
      const moduleDef = await db.collection('moduledefinitions').findOne({
        organizationId: admin.organizationId,
        apiPath: path
      });
      if (!moduleDef) {
        console.log(`  - Endpoint ${path}: MODULE DEFINITION NOT FOUND`);
        continue;
      }
      const auth = await authorizeModuleAction(admin, moduleDef.name, 'read');
      console.log(`  - Endpoint ${path} (Module: ${moduleDef.name}): Allowed=${auth.allowed}, Scope=${auth.scope}`);
    } catch (e) {
      console.error(`  - Endpoint ${path}: Error:`, e.message);
    }
  }

  // Let's also test for another user, e.g. Suma (Teli Caller) or a regular agent
  const suma = await db.collection('users').findOne({ email: 'agent.suma@gmail.com' });
  if (suma) {
    console.log(`\nTesting endpoints for Teli Caller/Agent user: ${suma.email}`);
    for (const path of endpoints) {
      try {
        const moduleDef = await db.collection('moduledefinitions').findOne({
          organizationId: suma.organizationId,
          apiPath: path
        });
        if (!moduleDef) {
          console.log(`  - Endpoint ${path}: MODULE DEFINITION NOT FOUND`);
          continue;
        }
        const auth = await authorizeModuleAction(suma, moduleDef.name, 'read');
        console.log(`  - Endpoint ${path} (Module: ${moduleDef.name}): Allowed=${auth.allowed}, Scope=${auth.scope}`);
      } catch (e) {
        console.error(`  - Endpoint ${path}: Error:`, e.message);
      }
    }
  }

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
