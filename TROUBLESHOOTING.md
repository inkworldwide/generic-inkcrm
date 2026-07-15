# inkCRM Production Troubleshooting Guide

This guide helps resolve common operational and deployment issues in production.

---

## 1. Stuck Loading Screens or Blank Pages
- **Symptoms**: The page loads sidebar and headers but main panels remain stuck as animated loading skeletons.
- **Root Cause**:
  - The backend `/api/v1/dashboard/metrics` or other route failed (500) or hung.
  - Check PM2 backend logs: `pm2 logs inkcrm-backend`.
  - Look for Mongoose connection dropouts or missing environment variables.
- **Resolution**:
  - Ensure `.env` is loaded with correct keys.
  - Verify that MongoDB service is active: `sudo systemctl status mongod`.
  - Check health routes directly: `curl -i http://localhost:5000/health`.

---

## 2. PM2 Restart Loops
- **Symptoms**: PM2 status lists `inkcrm-backend` as `errored` or constantly incrementing restart count.
- **Root Cause**:
  - The application is throwing a fatal exception during startup.
  - The most common cause is a missing required environment variable in production (`NODE_ENV=production`).
- **Resolution**:
  - Run the validation test script manually: `node predeploy.js` (inside `/var/www/inkCRM`).
  - View PM2 error logs: `tail -n 50 /var/www/inkCRM/logs/err.log`.
  - Correct any missing variable in `backend/.env`.

---

## 3. Nginx 502 Bad Gateway
- **Symptoms**: Browser displays a white Nginx 502 Gateway page when visiting the application.
- **Root Cause**:
  - Nginx is running, but the backend Node.js API process cluster is down or not listening on port 5000.
- **Resolution**:
  - Check if backend is active under PM2: `pm2 status`.
  - Verify port binding: `sudo netstat -tulpn | grep 5000`.
  - Restart the PM2 cluster: `pm2 reload ecosystem.config.cjs`.

---

## 4. CORS Errors on Client
- **Symptoms**: Browser console prints CORS access block messages when making login requests.
- **Root Cause**:
  - The request origin (e.g. `https://crm.company.com`) is not registered in the backend `ALLOWED_ORIGINS` list.
- **Resolution**:
  - Open `backend/.env`.
  - Append your frontend URL domain to `ALLOWED_ORIGINS` (separated by commas). E.g.:
    `ALLOWED_ORIGINS=https://crm.company.com,https://admin.company.com`
  - Reload PM2: `pm2 reload ecosystem.config.cjs`.

---

## 5. File Upload Failures
- **Symptoms**: Error message when uploading document attachments or company logos.
- **Root Cause**:
  - The destination directory (`uploads/`) is missing or does not have write permissions for the PM2 process runner.
- **Resolution**:
  - Create the uploads directory: `mkdir -p /var/www/inkCRM/uploads`.
  - Ensure correct folder ownership: `chown -R $USER:$USER /var/www/inkCRM/uploads`.
  - Grant read/write permissions: `chmod -R 775 /var/www/inkCRM/uploads`.
