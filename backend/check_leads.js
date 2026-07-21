const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/inkcrm').then(async () => {
  const db = mongoose.connection.db;
  
  // Find leads matching 'test raja' source
  const leads = await db.collection('customrecords').find({ 'data.source': 'test raja' }).toArray();
  console.log(`Found ${leads.length} leads under 'test raja' campaign.`);
  if (leads.length > 0) {
    console.log('Lead 1 sample:', JSON.stringify(leads[0].data, null, 2));
  }

  // Also let's print dynamic Lead validation fields list
  const leadModule = await db.collection('moduledefinitions').findOne({ apiPath: 'leads' });
  if (leadModule) {
    console.log('\nRequired Lead Fields:');
    leadModule.fields.forEach(f => {
      if (f.required) {
        console.log(`  - ${f.name} (${f.label})`);
      }
    });
  }

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
