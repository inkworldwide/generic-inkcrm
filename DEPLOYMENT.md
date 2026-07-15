# inkCRM Production Deployment Guide

This guide describes how to deploy **inkCRM** on a fresh production Ubuntu server (e.g., DigitalOcean, Linode, AWS EC2).

---

## 1. Prerequisites & Installation

Ensure Node.js (v20+), MongoDB, Nginx, and Git are installed:

```bash
# Update and install system dependencies
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl wget build-essential gnupg Nginx

# Install MongoDB Community Edition
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update
sudo apt install -y mongodb-org
sudo systemctl enable --now mongod

# Install Node.js (v20)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 globally
sudo npm install -y -g pm2
```

---

## 2. Set Up Project Directory

Clone the repository to `/var/www/inkCRM`:

```bash
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www
cd /var/www
git clone https://github.com/inkworldwide/INKCRM.git inkCRM
cd inkCRM
```

---

## 3. Environment Configurations

Create backend and frontend environment configuration files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

> [!IMPORTANT]
> Edit `backend/.env` and `frontend/.env` to configure actual secrets, databases, domains, and security parameters. Refer to `ENVIRONMENT_VARIABLES.md` for details.

---

## 4. Run Deploy Script

The project contains a `deploy.sh` script that automates backend compilation, frontend SPA bundling, pre-deployment validation tests, and PM2 process clustering:

```bash
chmod +x deploy.sh
./deploy.sh
```

---

## 5. Nginx Reverse Proxy & HTTP/2 Configuration

Configure Nginx to serve the compiled frontend React SPA and proxy API/file uploads:

Create Nginx site configuration: `/etc/nginx/sites-available/inkcrm`:

```nginx
server {
    listen 80;
    server_name crm.company.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name crm.company.com;

    # SSL certificates (configured via Certbot)
    ssl_certificate /etc/letsencrypt/live/crm.company.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/crm.company.com/privkey.pem;

    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Compression (Gzip)
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    gzip_min_length 1000;

    # React Frontend SPA
    location / {
        root /var/www/inkCRM/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # Backend API Proxy
    location /api/v1/ {
        proxy_pass http://127.0.0.1:5000/api/v1/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Uploaded static files
    location /uploads/ {
        alias /var/www/inkCRM/uploads/;
        expires 30d;
        add_header Cache-Control "public";
    }
}
```

Enable configuration and restart Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/inkcrm /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 6. PM2 Log Rotation & Service Monitoring

Install log-rotation to prevent PM2 log files from filling up disk space:

```bash
pm2 install pm2-logrotate
# Configure limits (rotate logs when they hit 10MB, retain up to 30 backup files)
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
```

---

## 7. Database Backups

Database backups can be scheduled using the included `backup.sh` script. Add a cron job to automate backups nightly at 2:00 AM:

```bash
# Open crontab editor
crontab -e

# Append the following line:
0 2 * * * /bin/bash /var/www/inkCRM/backup.sh >> /var/log/inkcrm_backup.log 2>&1
```

---

## 8. Let's Encrypt SSL Auto-Renewal

To issue and auto-renew Let's Encrypt certificates:

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d crm.company.com

# Verify automated cert renewal dry run
sudo certbot renew --dry-run
```
