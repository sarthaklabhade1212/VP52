# Configuration & Environments

This document explains how the Rewardify client and server are configured for
**local development** vs **production**, following the Phase 0 / B1 / B2 / B3
hardening. It is the reference for "how do I supply the secret / API URL".

> TL;DR
> - **Local dev never changed behavior**: emulator + dev server still talk to `http://10.0.2.2:5000`.
> - **Production must be explicitly configured**: no emulator URL, no default JWT secret, no demo seeding.

---

## 1. Node version

Pinned via [`.nvmrc`](.nvmrc) (`24`, current LTS line, matching the tested dev machine)
and `engines.node >= 20.19.0` in `client/package.json` and `server/package.json`.

```bash
nvm use          # picks up .nvmrc
```

---

## 2. Client API URL (B1)

The backend origin is supplied **only** through `VITE_API_URL` at build time.
There is **no** hardcoded fallback anymore. It is resolved per Vite *mode*:

| Command | Mode | Env file loaded | `VITE_API_URL` | Purpose |
|---|---|---|---|---|
| `npm run dev` | development | `.env.development` | `http://10.0.2.2:5000` | Vite dev server (browser) — uses the dev proxy |
| `npm run build:dev` | development | `.env.development` | `http://10.0.2.2:5000` | **Android emulator bundle** → `npx cap sync android` |
| `npm run build` | production | `.env.production` | *(you supply, HTTPS)* | Real production web/native bundle |

- `client/.env.development` is **tracked** (no secrets, shared dev value).
- `client/.env` and `client/.env.production` are **git-ignored** and no longer
  contain the emulator URL (the base `.env` was removed so it can't leak into prod).
- A production build (`npm run build`) **fails loudly** if `VITE_API_URL` is
  missing, not `https://`, or points at `10.0.2.2` / `localhost` / `127.0.0.1`
  (enforced in `vite.config.js` at build time and again at runtime in `src/utils/api.js`).

### Android emulator workflow (unchanged target, new build command)

```bash
cd client
npm run build:dev          # bakes http://10.0.2.2:5000 (from .env.development)
npx cap sync android
# then run from Android Studio (Pixel emulator) as before
```

`MainActivity.java`'s mixed-content setting is untouched, so the
`https://localhost` WebView keeps calling `http://10.0.2.2:5000`.

### Production build

```bash
cd client
cp .env.production.example .env.production   # then edit VITE_API_URL=https://api.yourdomain.com
npm run build
# or, without a file:
VITE_API_URL=https://api.yourdomain.com npm run build
```

---

## 3. Server JWT secret (B2)

`JWT_SECRET` comes **exclusively** from the environment. `server/middleware/auth.js`
throws at startup if it is missing — the server will not run with a default.

- **Development**: `server/.env` holds a freshly generated random secret
  (git-ignored). Created for you already; regenerate any time with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
- **Production**: set `JWT_SECRET` in the host's environment / secrets manager.
  Never commit it, never reuse the dev value.

Signing (`server/routes/auth.js`) and verification (`server/middleware/auth.js`)
both use this single required value. Token claims, roles, and expiry are unchanged.

---

## 4. Demo seeding (B3)

Demo accounts (`admin@example.com` / `Admin@123`, etc.) are **development only**:

- Auto-seed runs **only** when `NODE_ENV !== production` **and** `SEED_DEMO_DATA=true`
  **and** the users table is empty.
- Production (`NODE_ENV=production`) **never** auto-seeds and **never** prints
  credentials to the logs.
- `server/db/seed.js` additionally refuses to run at all when `NODE_ENV=production`.
- `server/.env` sets `SEED_DEMO_DATA=true` for local dev, so the emulator setup
  keeps its demo logins.

Provision the first production admin through a separate, secure, explicit process
(out of scope for this phase).

---

## 5. What is git-ignored vs tracked

Tracked (safe): `client/.env.development`, all `*.env.example`, `client/.env.production.example`.
Ignored (secret/deploy/local): `server/.env`, `client/.env`, `client/.env.production`,
`*.local`, `*.db*`, `node_modules/`, `dist/`, Android/iOS build outputs.
