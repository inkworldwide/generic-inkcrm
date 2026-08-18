const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/inkcrm_generic').then(async () => {
  const db = mongoose.connection.db;

  // Find all module definitions with a 'country' field
  const modules = await db.collection('moduledefinitions').find({ 'fields.name': 'country' }).toArray();
  console.log(`Found ${modules.length} module definitions with a 'country' field.`);

  for (const mod of modules) {
    const updatedFields = mod.fields.map(field => {
      if (field.name === 'country') {
        return {
          ...field,
          defaultValue: 'INDIA',
          options: ['INDIA']
        };
      }
      return field;
    });

    await db.collection('moduledefinitions').updateOne(
      { _id: mod._id },
      { $set: { fields: updatedFields } }
    );
    console.log(`Updated module definition: ${mod.name}`);
  }

  // Also update existing leads that might have other countries (optional, just to be clean)
  const leadModule = modules.find(m => m.apiPath === 'leads');
  if (leadModule) {
    const res = await db.collection('customrecords').updateMany(
      { moduleId: leadModule._id, 'data.country': { $exists: true, $ne: 'INDIA' } },
      { $set: { 'data.country': 'INDIA' } }
    );
    console.log(`Updated ${res.modifiedCount} existing records to country='INDIA'.`);
  }

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
