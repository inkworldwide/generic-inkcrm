const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/inkcrm_generic').then(async () => {
  const db = mongoose.connection.db;

  const org = await db.collection('organizations').findOne({});
  if (!org) {
    console.error('No organization found.');
    process.exit(1);
  }

  // Find the new roles
  const teliCallerRole = await db.collection('roles').findOne({ name: 'TELI CALLER', organizationId: org._id });
  const ariaManagerRole = await db.collection('roles').findOne({ name: 'ARIA SALES MANAGER', organizationId: org._id });
  const partnerRole = await db.collection('roles').findOne({ name: 'PARTNER', organizationId: org._id });

  if (teliCallerRole) {
    await db.collection('users').updateOne({ email: 'agent.suma@gmail.com' }, { $set: { roleId: teliCallerRole._id } });
    await db.collection('users').updateOne({ email: 'agent.priya@gmail.com' }, { $set: { roleId: teliCallerRole._id } });
    console.log('Updated Suma & Priya to TELI CALLER role.');
  }

  if (ariaManagerRole) {
    await db.collection('users').updateOne({ email: 'agent.sunita@gmail.com' }, { $set: { roleId: ariaManagerRole._id } });
    console.log('Updated Sunita to ARIA SALES MANAGER role.');
  }

  if (partnerRole) {
    await db.collection('users').updateOne({ email: 'agent.ankit@gmail.com' }, { $set: { roleId: partnerRole._id } });
    console.log('Updated Ankit to PARTNER role.');
  }

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
