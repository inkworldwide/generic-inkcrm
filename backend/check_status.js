const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/inkcrm_generic').then(async () => {
  const db = mongoose.connection.db;
  
  // Check all collections
  const collections = await db.listCollections().toArray();
  const statusCol = collections.find(c => c.name.toLowerCase().includes('status'));
  console.log('Status-related collections:', collections.filter(c => c.name.toLowerCase().includes('status')).map(c => c.name));
  
  // Try multiple possible collection names
  for (const name of ['statuses', 'status', 'leadstatuses', 'lead_statuses']) {
    try {
      const count = await db.collection(name).countDocuments();
      if (count > 0) {
        console.log(`\nCollection '${name}' has ${count} documents`);
        const docs = await db.collection(name).find({}).toArray();
        docs.forEach(d => console.log(`  ${d.name || d.status || JSON.stringify(d)}`));
      }
    } catch(e) {}
  }

  // Check organizations
  const orgs = await db.collection('organizations').find({}).toArray();
  console.log('\nOrganizations:', orgs.map(o => `${o.name} (${o._id})`));

  // Now search with org filter
  if (orgs.length > 0) {
    const orgId = orgs[0]._id;
    const statuses = await db.collection('statuses').find({ organizationId: orgId }).sort({ order: 1 }).toArray();
    console.log(`\nStatuses for org ${orgs[0].name}:`, statuses.length);
    statuses.forEach(s => console.log(`  [${s.order}] ${s.name}`));
  }

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
