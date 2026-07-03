const { MongoClient } = require('mongodb');
require('dotenv').config({ path: './backend/.env' });

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/inkcrm';

MongoClient.connect(uri).then(client => {
  const db = client.db();
  return db.collection('users').updateMany(
    { email: 'admin@sales.com' },
    { $set: { firstName: 'Ink', lastName: 'CRM', email: 'ink@crm.com' } }
  ).then(r => {
    console.log('Updated', r.modifiedCount, 'user(s) successfully');
    return client.close();
  });
}).catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
