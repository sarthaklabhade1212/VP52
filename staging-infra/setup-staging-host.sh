#!/usr/bin/env bash
# ==============================================================================
# VP52 Staging Host Provisioning Script
# Target: Dedicated Isolated Staging Host (NOT Production!)
# ==============================================================================
set -euo pipefail

echo "======================================================================"
echo "VP52 Isolated Staging Host Setup"
echo "======================================================================"

# 1. Safety Guard Check: Confirm this is NOT running on the production host
if grep -q "api.vp52coin.com" /etc/nginx/sites-enabled/* 2>/dev/null; then
    echo "❌ FATAL: Production Nginx configuration detected on this server!"
    echo "Per VP52 Safety Rules, Staging must run on an independent host."
    exit 1
fi

# 2. Create isolated staging user and directories
sudo useradd -r -s /bin/false -d /var/www/vp52-staging vp52staging || true
sudo mkdir -p /var/www/vp52-staging/server/public/staging_uploads
sudo mkdir -p /var/www/vp52-staging/server/db
sudo mkdir -p /var/www/certbot

# 3. Copy staging server files from isolated workspace
echo "👉 Deploy staging files to /var/www/vp52-staging/server/..."

# 4. Install Node.js dependencies
cd /var/www/vp52-staging/server
npm ci --omit=dev

# 5. Set strict file permissions
sudo chown -R vp52staging:vp52staging /var/www/vp52-staging
sudo chmod -R 750 /var/www/vp52-staging
sudo chmod 600 /var/www/vp52-staging/server/.env.staging

# 6. Install systemd service
sudo cp /path/to/vp52-staging.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable vp52-staging
sudo systemctl start vp52-staging

# 7. Configure Nginx reverse proxy
sudo cp /path/to/nginx-staging-api.conf /etc/nginx/sites-available/staging-api.vp52coin.com
sudo ln -sf /etc/nginx/sites-available/staging-api.vp52coin.com /etc/nginx/sites-enabled/

# 8. Obtain Let's Encrypt TLS Certificate
sudo certbot certonly --webroot -w /var/www/certbot \
    -d staging-api.vp52coin.com \
    --email admin@vp52coin.com \
    --agree-tos \
    --non-interactive

# 9. Test and reload Nginx
sudo nginx -t
sudo systemctl reload nginx

echo "✅ VP52 Staging Host Provisioning Complete."
