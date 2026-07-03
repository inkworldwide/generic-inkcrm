# inkCRM: Production Deployment & Operations Guide

This guide details the operational procedures, architecture layouts, security guidelines, and recovery mechanisms required to deploy **inkCRM** in a high-availability, production-ready SaaS environment.

---

## 1. Production Environment Configuration

Create a secure `.env` file inside the `backend` server root. Never check this file into source control.

```ini
# ==========================================
# Server Settings
# ==========================================
PORT=5000
NODE_ENV=production
ALLOWED_ORIGINS=https://app.inkcrm.com,https://admin.inkcrm.com

# ==========================================
# Multi-Tenant Database Config
# ==========================================
# MongoDB connection with connection pooling and replica set options
MONGODB_URI=mongodb+srv://admin_user:SecurePasswordHash@cluster0.mongodb.net/inkcrm?retryWrites=true&w=majority&maxPoolSize=50&wtimeoutMS=2500

# ==========================================
# Security & JWT Tokens
# ==========================================
# Generate cryptographically secure keys (e.g. openssl rand -base64 32)
JWT_SECRET=U3VwZXJTZWNyZXRLZXlGb3JBY2Nlc3NUb2tlbnM=
JWT_REFRESH_SECRET=UnlwaHJlc2hTZWNyZXRLZXlGb3JTZXNzaW9ucw==
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ==========================================
# SMTP Email Transporter
# ==========================================
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASS=SG.YourSendGridApiKeyHere
EMAIL_FROM=notifications@inkcrm.com

# ==========================================
# Document Uploads - AWS S3 / MinIO
# ==========================================
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1
S3_ENDPOINT=https://s3.amazonaws.com
S3_BUCKET_NAME=inkcrm-production-documents
S3_CDN_URL=https://cdn.inkcrm.com

# ==========================================
# Redis Cache Configuration
# ==========================================
REDIS_URL=redis://:RedisPassword@redis-server:6379/0

# ==========================================
# Sentry / Error Monitoring
# ==========================================
SENTRY_DSN=https://examplePublicKey@sentry.io/exampleProjectId
```

---

## 2. SSL/HTTPS & Reverse Proxy Configuration (Nginx)

Nginx is used as the edge reverse proxy, termination endpoint for SSL/TLS certificates (Let's Encrypt), and router for static client-side content.

### Nginx Server Block Configuration (`/etc/nginx/sites-available/inkcrm`)
```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name *.inkcrm.com inkcrm.com;

    return 301 https://$host$request_uri;
}

# HTTPS Server Block
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name *.inkcrm.com inkcrm.com;

    # SSL Certs (Let's Encrypt path examples)
    ssl_certificate /etc/letsencrypt/live/inkcrm.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/inkcrm.com/privkey.pem;

    # Strong SSL Hardening Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384';
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 1000;

    # Frontend Assets Hosting (React SPA)
    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
        
        # Cache static browser assets
        location ~* \.(?:css|js|jpg|jpeg|gif|png|ico|cur|gz|svg|svgz|mp4|ogg|ogv|webm|htc)$ {
            expires 1y;
            access_log off;
            add_header Cache-Control "public";
        }
    }

    # API Proxy Path redirection
    location /api/v1/ {
        proxy_pass http://localhost:5000/api/v1/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Real IP Forwarding
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 3. Database Backup & Restore Guide

Production MongoDB clusters should run in Replica Sets. Enable automatic backups (e.g. MongoDB Atlas Backup). For VPS/on-premise database deployments, use the following scripts:

### Backup script (`/usr/local/bin/backup-mongodb.sh`)
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/mongodb"
TIMESTAMP=$(date +"%F_%H%M%S")
DATABASE_NAME="inkcrm"
MONGO_URI="mongodb://admin_user:SecurePassword@127.0.0.1:27017/$DATABASE_NAME?authSource=admin"

# Create destination folder
mkdir -p "$BACKUP_DIR"

# Perform dump
mongodump --uri="$MONGO_URI" --out="$BACKUP_DIR/backup_$TIMESTAMP"

# Compress backup
tar -czf "$BACKUP_DIR/backup_$TIMESTAMP.tar.gz" -C "$BACKUP_DIR" "backup_$TIMESTAMP"

# Upload to S3 (Cold Storage)
aws s3 cp "$BACKUP_DIR/backup_$TIMESTAMP.tar.gz" "s3://inkcrm-backups/db/backup_$TIMESTAMP.tar.gz"

# Delete uncompressed files and backups older than 7 days
rm -rf "$BACKUP_DIR/backup_$TIMESTAMP"
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete
```
Schedule using Cron (`crontab -e`):
```cron
0 2 * * * /usr/local/bin/backup-mongodb.sh >/dev/null 2>&1
```

### Restore Database Command
```bash
# Download backup from S3
aws s3 cp s3://inkcrm-backups/db/backup_2026-06-26.tar.gz ./

# Extract backup
tar -xzf backup_2026-06-26.tar.gz

# Restore to MongoDB
mongorestore --uri="mongodb://admin_user:SecurePassword@127.0.0.1:27017/inkcrm" ./backup_2026-06-26/inkcrm
```

---

## 4. Monitoring & Logging

### Node Process Management (PM2 Configuration)
Use PM2 to run the Express backend server inside virtual environments.

Create `ecosystem.config.js` in the backend root:
```javascript
module.exports = {
  apps: [{
    name: 'inkcrm-backend-production',
    script: './dist/server.js',
    instances: 'max', // run cluster mode utilizing all CPU cores
    exec_mode: 'cluster',
    watch: false,
    max_memory_restart: '1G',
    env_production: {
      NODE_ENV: 'production'
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
```
Start using command: `pm2 start ecosystem.config.js --env production`

### Docker Health Checks
Ensure container restarts if process locks up. Add to `docker-compose.yml`:
```yaml
  backend:
    build: ./backend
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

---

## 5. CI/CD Deployment Pipeline (GitHub Actions)

Deploy code changes automatically to a production server on merging to the `main` branch.

Create `.github/workflows/deploy.yml`:
```yaml
name: inkCRM Build and Deploy

on:
  push:
    branches: [ main ]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache-dependency-path: './backend/package-lock.json'

      - name: Install & Run Backend Tests
        run: |
          cd backend
          npm ci
          npm run build

  deploy-to-prod:
    needs: build-and-test
    runs-on: ubuntu-latest
    steps:
      - name: SSH Remote Deploy Command
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.PROD_SERVER_IP }}
          username: ${{ secrets.PROD_SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /var/www/inkcrm
            git pull origin main
            
            # Rebuild Backend
            cd backend
            npm install --production
            npm run build
            pm2 restart inkcrm-backend-production
            
            # Rebuild Frontend
            cd ../frontend
            npm install
            npm run build
            sudo cp -r dist/* /usr/share/nginx/html/
```

---

## 6. Performance & Scale Optimizations

1. **Redis Cache Layer**:
   * Implement Redis caching for static layout definitions, organizational branding styles, and user authorization role schemas. This reduces database queries.
2. **Metadata Indexing**:
   * Create compounds indexes in MongoDB to search user entries fast inside schema-free maps:
     ```javascript
     CustomRecordSchema.index({ organizationId: 1, moduleId: 1, 'data.status': 1 });
     ```
3. **Frontend CDN Delivery**:
   * Upload frontend compiled files (`dist/assets`) to AWS CloudFront or Cloudflare CDN. Configure assets mapping to expire far in the future.
4. **Database Query Pagination**:
   * Never let query parameters load all data without page limits. Implement limit restrictions on the REST API `/records/:apiPath` endpoints.

---

## 7. Production Security Hardening Checklist

- [ ] **Enforce HTTPS Only**: Disable plain HTTP access. Enforce HSTS header.
- [ ] **Hardened Cookies**: Set session cookie options to `HttpOnly`, `Secure=true`, and `SameSite='Strict'`.
- [ ] **Database Firewall Limits**: Restrict MongoDB port `27017` accessibility to localhost or backend container IP only.
- [ ] **Rate Limiting**: Enable IP limiters to throttle logins and database queries (protects against DDoS).
- [ ] **CORS Strict Settings**: Avoid wildcard `CORS *`. Bind to the explicit dashboard domain.
- [ ] **Inputs Sanitization**: Sanitize inputs to block NoSQL Injection attacks. Use Zod schema validation blocks on every post.

---

## 8. API Authentication & Swagger Usage

The REST API uses JWT token pairs. Authenticate endpoints by adding standard Authorization header:
`Authorization: Bearer <Access_Token>`

### Request Login Example (`POST /api/v1/auth/login`)
```json
{
  "email": "admin@sales.com",
  "password": "password123",
  "rememberMe": true
}
```
### Response Authentication Payload
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVC...",
  "user": {
    "id": "603d154df63d5b00155b525d",
    "firstName": "Sarah",
    "lastName": "Connor",
    "email": "admin@sales.com",
    "roleId": "603d154df63d5b00155b525a",
    "organizationId": "603d154df63d5b00155b5258"
  }
}
```

---

## 9. Upgrade & Database Migration Guide

When database schema modifications occur (e.g., adding calculated formulas attributes), use versioned migration scripts.

### Example Schema migration script (`backend/migrations/v1.1.0-formulas.ts`)
```typescript
import mongoose from 'mongoose';
import ModuleDefinition from '../src/models/ModuleDefinition';

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI!);
  
  // Set default formula values on old module definitions
  await ModuleDefinition.updateMany(
    { 'fields.type': 'formula', 'fields.formulaExpression': { $exists: false } },
    { $set: { 'fields.$[field].formulaExpression': '{gpa} * 10' } },
    { arrayFilters: [{ 'field.type': 'formula' }] }
  );

  console.log('Migration v1.1.0 completed successfully.');
  await mongoose.disconnect();
}

migrate();
```

---

## 10. Disaster Recovery Instructions

In the event of database failure or file store corruption:

1. **Restore Core Database**:
   * Restore the latest hourly MongoDB snapshot from S3.
2. **Re-initialize S3 Documents**:
   * If S3 bucket fails, set up a secondary replica S3 bucket and update environment configuration variables.
3. **Recovery Objectives**:
   * **Recovery Point Objective (RPO)**: 1 Hour (Database backed up hourly).
   * **Recovery Time Objective (RTO)**: 15 Minutes (Scripts ready for automated docker deployments).
