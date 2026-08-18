const mongoose = require('mongoose');

const rolesList = [
  { name: 'Super Admin', description: 'Full organizational access', isSystem: true },
  { name: 'PARTNER', description: 'Partner role with standard access', isSystem: false },
  { name: 'ARIA SALES MANAGER', description: 'Area Sales Manager role', isSystem: false },
  { name: 'ADMIN', description: 'Admin role', isSystem: false },
  { name: 'TELI CALLER', description: 'Telecaller calling team role', isSystem: false }
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

  // 2. Get all module definitions for this organization
  const modules = await db.collection('moduledefinitions').find({ organizationId: org._id }).toArray();
  const moduleNames = modules.map(m => m.apiPath);
  console.log('Available modules:', moduleNames);

  // Helper to create full permissions
  const createPermissions = (apiPaths) => {
    return {
      modules: apiPaths.map((path) => ({
        moduleName: path,
        create: true,
        read: 'all',
        update: 'all',
        delete: 'all'
      })),
      fields: [],
      menus: ['dashboard', ...apiPaths, 'workflows', 'reports', 'settings']
    };
  };

  const defaultPermissions = createPermissions(moduleNames);

  // 3. Clear existing roles for this organization
  const deleteRes = await db.collection('roles').deleteMany({ organizationId: org._id });
  console.log(`Deleted ${deleteRes.deletedCount} existing roles.`);

  // 4. Insert new roles
  const rolesToInsert = rolesList.map(r => ({
    organizationId: org._id,
    name: r.name,
    description: r.description,
    isSystem: r.isSystem,
    isActive: true,
    permissions: defaultPermissions,
    createdAt: new Date(),
    updatedAt: new Date()
  }));

  const insertRes = await db.collection('roles').insertMany(rolesToInsert);
  console.log(`Successfully inserted ${insertRes.insertedCount} new roles:`);
  rolesList.forEach(r => console.log(`  - ${r.name}`));

  // 5. Update the first/admin user in the database to be a Super Admin
  const adminUser = await db.collection('users').findOne({ organizationId: org._id });
  if (adminUser) {
    const superAdminRole = await db.collection('roles').findOne({ name: 'Super Admin', organizationId: org._id });
    if (superAdminRole) {
      await db.collection('users').updateOne(
        { _id: adminUser._id },
        { $set: { roleId: superAdminRole._id } }
      );
      console.log(`Updated user ${adminUser.email} to have Super Admin role.`);
    }
  }

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
