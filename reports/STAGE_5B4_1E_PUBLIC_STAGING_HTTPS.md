# VP52 Stage 5B.4.1E — Dedicated Staging Subdomain: Public HTTPS Ingress Report

**Date:** 2026-11-13  
**Project:** VP52 — Customer Rewards Application  
**Stage:** Stage 5B.4.1E — Public HTTPS Staging Ingress Infrastructure Preparation  
**Target Staging Hostname:** `staging-api.vp52coin.com`  
**Staging SSV Callback Endpoint:** `https://staging-api.vp52coin.com/api/admob/ssv`  
**Production API (Untouched):** `https://api.vp52coin.com`  
**Local Project Root:** `/Users/sarthaklabhade/FREELANCING/5257`  
**Isolated Staging Source:** `/Users/sarthaklabhade/FREELANCING/5257-staging`  
**Canonical Local Database SHA-256:** `55906fea452b2cdf8c4ccbb68bbde34cb5cfef2727491c15f68421cc920a98fa` (Verified Unchanged)  
**Final Verdict:** **PASS WITH CONDITIONS** (Architecture & Ingress Configurations Complete; Awaiting Dedicated Staging Host Allocation & GoDaddy DNS Record)

---

## 1. Executive Summary

Stage 5B.4.1E prepared the complete infrastructure, DNS specification, TLS architecture, and reverse proxy configuration required to establish a dedicated, publicly accessible HTTPS endpoint at `staging-api.vp52coin.com`. This public endpoint is specifically designed to allow Google's external AdMob cloud servers to deliver signed Server-Side Verification (SSV) callbacks into VP52's staging environment without exposing or modifying production infrastructure.

In accordance with strict production safety rules and explicit STOP conditions:
1. **Read-Only Discovery Completed:** Authoritative DNS for `vp52coin.com` was identified as **GoDaddy DNS** (`ns17.domaincontrol.com`, `ns18.domaincontrol.com`). Existing production (`api.vp52coin.com`) resolves directly to single origin IP `187.127.180.230` without Cloudflare proxying.
2. **STOP Condition Acknowledged:** No secondary independent staging host or cloud VPS is currently documented or provisioned. Per Section 4 & 14 ("If the only available VPS currently hosts production, do not modify it. Report the need for separate staging hosting. Stop if: The staging host cannot be independently identified"), the production VPS was **not** shared or modified as a staging shortcut.
3. **Deployment Assets Prepared & Hardened:**
   - [`staging-infra/nginx-staging-api.conf`](file:///Users/sarthaklabhade/FREELANCING/5257/staging-infra/nginx-staging-api.conf): Production-grade Nginx configuration enforcing TLS 1.2/1.3, host-header validation, sensitive file blocking, and **pristine, raw query-string preservation** required for cryptographic ECDSA signature verification.
   - [`staging-infra/vp52-staging.service`](file:///Users/sarthaklabhade/FREELANCING/5257/staging-infra/vp52-staging.service): Hardened Linux systemd service unit running under an isolated non-root service account (`vp52staging`).
   - [`staging-infra/setup-staging-host.sh`](file:///Users/sarthaklabhade/FREELANCING/5257/staging-infra/setup-staging-host.sh): Automated step-by-step staging server deployment script.
   - [`staging-infra/verify-staging-endpoint.sh`](file:///Users/sarthaklabhade/FREELANCING/5257/staging-infra/verify-staging-endpoint.sh): Ingress validation test suite for DNS, TLS handshake, health check, and unauthenticated SSV query handling.
4. **Production Isolation Confirmed:** Production VPS (`api.vp52coin.com`, `187.127.180.230`, `/var/www/vp52`), production databases, and production AdMob configurations remain 100% untouched.

---

## 2. Read-Only Infrastructure Discovery Findings

A non-invasive, read-only discovery of the domain and networking environment was conducted:

| Infrastructure Dimension | Discovery Findings | Source of Truth |
| :--- | :--- | :--- |
| **Domain** | `vp52coin.com` | Registered domain |
| **Authoritative DNS Provider** | **GoDaddy DNS** (`domaincontrol.com`) | `ns17.domaincontrol.com`, `ns18.domaincontrol.com` |
| **Cloudflare Proxy Status** | **Inactive** (No Cloudflare nameservers or proxying) | Authoritative NS records |
| **Existing Production IP** | `187.127.180.230` | `dig +short A api.vp52coin.com` |
| **Production Project Directory** | `/var/www/vp52` | Untouched, production VPS |
| **Staging Hostname Status** | `staging-api.vp52coin.com` (Unallocated) | `dig +short A staging-api.vp52coin.com` returns NULL |
| **Available Independent Staging VPS** | **None currently provisioned** | STOP Condition triggered |
| **Local Staging Implementation** | `/Users/sarthaklabhade/FREELANCING/5257-staging` | Functional on port 5001 with synthetic DB |

---

## 3. Dedicated Staging Ingress Architecture

To prevent any cross-environment contamination, the staging public ingress must adhere to the following architecture:

```
Google AdMob Cloud Servers
           │
           │ (HTTPS GET signed callback)
           ▼
[DNS: GoDaddy] staging-api.vp52coin.com ──► [Dedicated Staging Host IP]
                                                        │
                                                        ▼
                                       ┌────────────────────────────────┐
                                       │    Dedicated Staging Server    │
                                       │  - Port 80 (Redirect to 443)   │
                                       │  - Port 443 (TLS Termination)  │
                                       │  - Nginx Reverse Proxy         │
                                       └────────────────────────────────┘
                                                        │
                                                        │ (Raw query preserved:
                                                        │  proxy_pass http://127.0.0.1:5001)
                                                        ▼
                                       ┌────────────────────────────────┐
                                       │   Staging Node.js Service      │
                                       │  - User: vp52staging (non-root)│
                                       │  - Process: systemd (Port 5001)│
                                       │  - stagingGuard active         │
                                       └────────────────────────────────┘
                                                        │
                                                        ▼
                                       ┌────────────────────────────────┐
                                       │    staging_rewards.db          │
                                       │  - 0 customer PII              │
                                       │  - Synthetic test accounts     │
                                       └────────────────────────────────┘
```

---

## 4. DNS Configuration Plan (GoDaddy DNS)

Once a dedicated staging host (cloud VPS or dedicated VM) is provisioned, the hosting administrator must add a single dedicated DNS record in the **GoDaddy DNS Management Console** for `vp52coin.com`:

### Required Record Specification
- **Type:** `A`
- **Name:** `staging-api` (resolves to `staging-api.vp52coin.com`)
- **Value / Target:** `[Dedicated Staging Host Public IP]` (e.g., `203.0.113.50` — must NOT be the production IP `187.127.180.230`)
- **TTL:** `600 seconds` (10 minutes, for rapid propagation and flexibility)

### DNS Safety Rules
- **Do NOT edit** the root record (`@`) or production API record (`api.vp52coin.com`).
- **Do NOT edit** existing MX, TXT, or SPF records.
- **Do NOT share** the production IP `187.127.180.230` for staging ingress.

### Verification Command
```bash
dig +short A staging-api.vp52coin.com
```

---

## 5. Public TLS Certificate Specification (Let's Encrypt)

The staging reverse proxy terminates TLS using a publicly trusted certificate issued by Let's Encrypt:
- **Domain:** `staging-api.vp52coin.com`
- **Challenge Type:** HTTP-01 via standard webroot (`/var/www/certbot`)
- **Issuance Command:**
  ```bash
  sudo certbot certonly --webroot -w /var/www/certbot \
      -d staging-api.vp52coin.com \
      --email admin@vp52coin.com \
      --agree-tos \
      --non-interactive
  ```
- **Automated Renewal:** Handled by standard `certbot.timer` systemd unit running twice daily.
- **Security:**
  - TLS 1.2 and TLS 1.3 enforced.
  - Zero reuse or exposure of production private keys.
  - Strict-Transport-Security (HSTS) header included.

---

## 6. Reverse Proxy Configuration & Query-String Preservation

The complete Nginx configuration is located at [`staging-infra/nginx-staging-api.conf`](file:///Users/sarthaklabhade/FREELANCING/5257/staging-infra/nginx-staging-api.conf).

### Critical Query-String Preservation for Google SSV
Google's ECDSA signature verification hashes the raw, canonical query parameters:
`ad_network=...&ad_unit=...&custom_data=...&reward_amount=...&reward_item=...&timestamp=...&transaction_id=...&user_id=...`
If a reverse proxy decodes `%2F`, reorders parameters, or rewrites the URI, the cryptographic verification fails with `INVALID_SIGNATURE`.

To guarantee 100% pristine byte-identical query string preservation:
```nginx
location /api/admob/ssv {
    proxy_pass http://127.0.0.1:5001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
}
```
*Note: Specifying `proxy_pass http://127.0.0.1:5001;` without a trailing URI path instructs Nginx to pass the client's `$request_uri` completely unaltered.*

### Security & Privacy Controls
1. **Access Log Redaction:** Custom log format `staging_ssv_safe` logs `$request_method` and `$uri` but intentionally omits `$query_string`, preventing verification tokens and transaction hashes from persisting in plaintext log files.
2. **Host Header Validation:** Requests with mismatched or spoofed Host headers receive HTTP 400.
3. **Database File Shielding:** Blocks any request targeting `.db`, `.sqlite`, `.db-wal`, or `.db-shm` with HTTP 404.
4. **Environment File Shielding:** Blocks any request targeting `.env*` or hidden files.

---

## 7. Staging Backend Service Specification

The staging application runs from the isolated workspace `/Users/sarthaklabhade/FREELANCING/5257-staging` under systemd service [`staging-infra/vp52-staging.service`](file:///Users/sarthaklabhade/FREELANCING/5257/staging-infra/vp52-staging.service):

### Process Hardening
- **User / Group:** `vp52staging:vp52staging` (dedicated non-root service account)
- **Directory:** `/var/www/vp52-staging/server`
- **File Permissions:** `750` for directories, `600` for `.env.staging`
- **Security Sandboxing:** `ProtectSystem=full`, `ProtectHome=true`, `NoNewPrivileges=true`, `PrivateTmp=true`

### Environment Variables
Derived from actual staging requirements:
- `PORT=5001`
- `NODE_ENV=staging`
- `JWT_SECRET=[isolated 64-char random secret]`
- `DATABASE_PATH=/var/www/vp52-staging/server/db/staging_rewards.db`
- `UPLOAD_DIR=/var/www/vp52-staging/server/public/staging_uploads`
- `SEED_DEMO_DATA=false`
- `ADMOB_APP_ID=ca-app-pub-4004834464698326~8764285486`
- `ADMOB_REWARDED_AD_UNIT_ID=ca-app-pub-4004834464698326/8368553876` (or designated Staging Ad Unit)
- `ADMOB_SSV_CALLBACK_URL=https://staging-api.vp52coin.com/api/admob/ssv`
- `GOOGLE_WEB_CLIENT_ID=88178430326-d8h97fh3g3ofhg9t4hl0ol7oebik3ugl.apps.googleusercontent.com`

---

## 8. Network & Security Validation Plan

Once the staging host is connected to the public IP, the automated verification script [`staging-infra/verify-staging-endpoint.sh`](file:///Users/sarthaklabhade/FREELANCING/5257/staging-infra/verify-staging-endpoint.sh) will validate:
1. **DNS Resolution:** Confirms `staging-api.vp52coin.com` returns the dedicated staging IP.
2. **TLS Certificate:** Validates TLS handshake, expiration date, and SAN.
3. **Health Check:** Confirms `GET /api/health` returns HTTP 200 without exposing secrets.
4. **SSV Route Reachability:** Confirms `GET /api/admob/ssv` returns HTTP 400 (Missing Signature), proving:
   - The route is publicly reachable without customer JWT authentication.
   - The route fail-closed rejects unsigned requests.
5. **Tampered Signature Rejection:** Submits a forged callback and verifies HTTP 400 `INVALID_SIGNATURE` with 0 coins credited.

---

## 9. Staging AdMob Ad Unit & Live Callback Status

### Separate Staging Ad Unit Recommendation
- **Current Production Unit:** `ca-app-pub-4004834464698326/8368553876` (SSV callback intentionally unconfigured).
- **Recommendation:** In the Google AdMob Console, create a new Rewarded Ad Unit named `VP52_Staging_Rewarded` under App ID `ca-app-pub-4004834464698326~8764285486`.
  - Reward: 1 coin.
  - Server-Side Verification: Enabled.
  - Callback URL: `https://staging-api.vp52coin.com/api/admob/ssv`.
- **Live Callback Status:** **`LIVE GOOGLE CALLBACK: NOT TESTED`**  
  In compliance with prompt instructions ("If the infrastructure is ready but Google has not sent a real callback, mark: LIVE GOOGLE CALLBACK: NOT TESTED"), live testing is held until public DNS and host deployment are provisioned.

---

## 10. Rollback & Change Control

- **Backup Directory Created:** [`backups/stage5b4-1e-backup-2026-11-13/`](file:///Users/sarthaklabhade/FREELANCING/5257/backups/stage5b4-1e-backup-2026-11-13/) containing pre-edit staging environment templates.
- **Rollback Procedure:**
  1. Remove DNS record `staging-api` from GoDaddy DNS Management.
  2. Stop and disable `vp52-staging` systemd unit.
  3. Remove `/etc/nginx/sites-enabled/staging-api.vp52coin.com`.
  4. Decommission or shut down the dedicated staging VPS.
  5. Zero impact on production: production files, Nginx, PM2, and DNS remain untouched throughout.

---

## 11. Confirmation That Production Was Untouched

I hereby explicitly confirm that throughout Stage 5B.4.1E:
- **Zero connections** were made to the production VPS (`187.127.180.230`).
- **Zero SSH / SCP / SFTP** commands were executed.
- No production files in `/var/www/vp52` were accessed or modified.
- No production DNS records in GoDaddy were altered.
- The production database `/var/www/vp52/server/db/rewards.db` was untouched.
- Production `.env` was never modified.
- Production PM2 processes were never restarted.
- Android application ID `com.sarthak.customerrewards` and signing keys were preserved.
- Local canonical database hash verified unchanged: `55906fea452b2cdf8c4ccbb68bbde34cb5cfef2727491c15f68421cc920a98fa`.

---

## 12. Required Next Steps (Action Items for User / Infrastructure Admin)

To complete the public staging endpoint deployment:
1. **Allocate a Dedicated Staging Host:** Provision an independent cloud VPS (e.g., Ubuntu 24.04 on DigitalOcean, AWS, or Hetzner). Note its public IPv4 address.
2. **Add GoDaddy DNS Record:** In GoDaddy DNS management for `vp52coin.com`, add:
   - Type: `A`
   - Name: `staging-api`
   - Value: `[Staging Host Public IPv4]`
   - TTL: `600 seconds`
3. **Execute Host Provisioning:** Deploy `/Users/sarthaklabhade/FREELANCING/5257-staging` to the staging server and run [`staging-infra/setup-staging-host.sh`](file:///Users/sarthaklabhade/FREELANCING/5257/staging-infra/setup-staging-host.sh).
4. **Run Ingress Verification:** Execute [`staging-infra/verify-staging-endpoint.sh`](file:///Users/sarthaklabhade/FREELANCING/5257/staging-infra/verify-staging-endpoint.sh) to confirm public reachability and signature enforcement.
5. **Configure Staging AdMob Callback:** Set Callback URL in Google AdMob Console to `https://staging-api.vp52coin.com/api/admob/ssv` and send a test SSV ping.
