#!/bin/bash

echo "========================================================="
echo " Starting inkCRM Production Deployment Automation"
echo " Time: $(date)"
echo "========================================================="

# 1. Pull latest code (if not already handled by CI runner)
echo "Checking git status..."
git status

# 2. Verify environment files exist
if [ ! -f "backend/.env" ]; then
  echo "❌ Error: backend/.env is missing! Deployment aborted."
  echo "Please configure your environment variables based on backend/.env.example."
  exit 1
fi

if [ ! -f "frontend/.env" ]; then
  echo "⚠️ Warning: frontend/.env is missing! Creating default frontend/.env..."
  echo "VITE_API_URL=/api/v1" > frontend/.env
  echo "VITE_FILE_BASE_URL=" >> frontend/.env
fi

# 3. Install backend dependencies and build
echo "Installing backend dependencies..."
cd backend
npm install --omit=dev
echo "Compiling TypeScript backend..."
npm run build
cd ..

# 4. Install frontend dependencies and build
echo "Installing frontend dependencies..."
cd frontend
npm install
echo "Building React frontend production package..."
npm run build
cd ..

# 5. Verify build success and run pre-deployment checks
echo "Running Pre-deployment Validation Checks..."
node predeploy.js
if [ $? -ne 0 ]; then
  echo "❌ Error: Pre-deployment validation failed! Aborting reload."
  exit 1
fi

# 6. PM2 worker configurations & startup
echo "Configuring and reloading PM2 cluster processes..."
pm2 reload ecosystem.config.cjs --env production

if [ $? -eq 0 ]; then
  echo "✅ PM2 cluster processes reloaded successfully."
else
  echo "PM2 process config not found. Starting new PM2 processes..."
  pm2 start ecosystem.config.cjs --env production
fi

# Save PM2 process list to persist across OS reboots
pm2 save

echo "========================================================="
echo " inkCRM Production Deployment Completed Successfully! 🎉"
echo "========================================================="
