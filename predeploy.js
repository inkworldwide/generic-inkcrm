const fs = require('fs');
const path = require('path');
const { MongoClient } = require('./backend/node_modules/mongodb');

console.log('=========================================================');
console.log(' Running inkCRM Pre-deployment Validation Checks');
console.log('=========================================================');

let validationFailed = false;

// Helper to log errors
const logError = (msg) => {
  console.error(`❌ [ERROR] ${msg}`);
  validationFailed = true;
};

// Helper to log success
const logSuccess = (msg) => {
  console.log(`✅ [SUCCESS] ${msg}`);
};

// 1. Verify Directories Exist
const folders = ['uploads', 'logs', 'backend/dist', 'frontend/dist'];
folders.forEach(f => {
  const p = path.resolve(__dirname, f);
  if (!fs.existsSync(p)) {
    if (f === 'uploads' || f === 'logs') {
      fs.mkdirSync(p, { recursive: true });
      logSuccess(`Created missing directory: ${f}`);
    } else {
      logError(`Missing required build folder: ${f}. Please run builds first.`);
    }
  } else {
    logSuccess(`Directory found: ${f}`);
  }
});

// 2. Verify backend/.env and Required Environment Variables
const envPath = path.resolve(__dirname, 'backend/.env');
if (!fs.existsSync(envPath)) {
  logError('backend/.env file is missing!');
} else {
  logSuccess('backend/.env file found.');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const envVars = {};
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const parts = trimmed.split('=');
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      envVars[key] = val;
    }
  });

  const requiredVars = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'MONGODB_URI', 'ENCRYPTION_KEY'];
  requiredVars.forEach(v => {
    if (!envVars[v]) {
      logError(`Environment variable '${v}' is missing or empty in backend/.env`);
    } else {
      logSuccess(`Environment variable verified: ${v}`);
    }
  });

  if (envVars['ENCRYPTION_KEY'] && envVars['ENCRYPTION_KEY'].length < 16) {
    logError("ENCRYPTION_KEY must be at least 16 characters long.");
  }
}

// 3. Verify Database Connectivity
let mongoUri = process.env.MONGODB_URI;
if (!mongoUri && fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const parts = trimmed.split('=');
      const key = parts[0].trim();
      if (key === 'MONGODB_URI') {
        mongoUri = parts.slice(1).join('=').trim();
      }
    }
  });
}
if (!mongoUri) {
  mongoUri = 'mongodb://127.0.0.1:27017/inkcrm';
}

if (!mongoUri) {
  logError('MONGODB_URI is not set in process environment or backend/.env');
} else {
  console.log(`Connecting to MongoDB at: ${mongoUri.replace(/:([^@]+)@/, ':****@')} ...`);
  
  const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 3000 });
  client.connect()
    .then(async () => {
      logSuccess('Successfully connected to MongoDB database.');
      await client.close();
      finalize();
    })
    .catch(err => {
      logError(`Failed to connect to MongoDB: ${err.message}`);
      finalize();
    });
}

function finalize() {
  console.log('=========================================================');
  if (validationFailed) {
    console.error('❌ PRE-DEPLOYMENT VALIDATION FAILED!');
    console.error('Please fix the errors above before deploying.');
    console.log('=========================================================');
    process.exit(1);
  } else {
    console.log('✅ ALL PRE-DEPLOYMENT CHECKS PASSED!');
    console.log('inkCRM is fully ready for production.');
    console.log('=========================================================');
    process.exit(0);
  }
}
