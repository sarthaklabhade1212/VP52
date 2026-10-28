# VP52 — Google Play Store Policy Audit, Data Safety Declarations & Compliance Report

**Application Name:** VP52  
**Public Operator / Developer:** Sanket Shinde (Individual Independent Developer)  
**Support Contact Email:** [shindesanket.vp52@gmail.com](mailto:shindesanket.vp52@gmail.com)  
**Production Website:** [https://vp52coin.com](https://vp52coin.com)  
**Production API Base:** [https://api.vp52coin.com](https://api.vp52coin.com)  
**Live Privacy Policy URL:** [https://vp52coin.com/privacy](https://vp52coin.com/privacy)  
**Public Account Deletion URL:** [https://vp52coin.com/delete-account](https://vp52coin.com/delete-account)  
**Audit Date:** October 2026  

---

## 1. Executive Summary & Google Play Compliance Verification

A thorough audit of the VP52 codebase, database schema, API routes, frontend React views, and Android native wrapper has been completed. All critical Google Play Developer Policy rejection risks have been resolved:

| Policy Area | Pre-Audit Risk | Resolution & Current State | Status |
| :--- | :--- | :--- | :--- |
| **Account Deletion (May 2024 Policy)** | Critical Rejection: No in-app deletion button; no public web deletion link existed. | Implemented both: (1) Immediate in-app deletion (`DELETE /api/customer/account` in Profile with confirmation modal), and (2) unauthenticated public web portal at `/delete-account`. | ✅ COMPLIANT |
| **Privacy Policy Accuracy** | Missing public URL; unclear operator entity; missing disclosures. | Created public unauthenticated `/privacy` route identifying individual developer Sanket Shinde with contact `shindesanket.vp52@gmail.com`. | ✅ COMPLIANT |
| **Cleartext Traffic** | Manifest had `usesCleartextTraffic="true"` globally without scoping. | Replaced global cleartext flag with dedicated `network_security_config.xml` enforcing HTTPS everywhere while scoping local emulator debug domains (`10.0.2.2`, `localhost`). | ✅ COMPLIANT |
| **Reward Economics & Valuation** | Displayed direct coin-to-rupee valuations in customer UI (e.g. `(₹6,000)` / `Value: ₹1/coin`). | Removed all coin-to-rupee valuations from customer UI while preserving server-authoritative reward economics. | ✅ COMPLIANT |
| **Branding & Launcher Assets** | Inconsistent logo resolutions and 8.4MB HEVC splash video failing on older WebViews. | Unified branding with official 1024x1024 `vp52-logo.png`, generated all Android mipmaps + iOS AppIcon, converted splash to fast-start 720p H.264 MP4 with tap-to-skip. | ✅ COMPLIANT |
| **Localization Completeness** | Missing Marathi and Hindi strings across multiple pages. | Built complete 320-key i18n matrix in `translations.js` across EN, HI, MR and integrated LanguageSwitcher on landing + dashboards. | ✅ COMPLIANT |

---

## 2. Google Play Console Data Safety Questionnaire (Field-by-Field Answers)

When filling out the **Data Safety form** in Google Play Console, use the exact answers below based on the verified codebase audit:

### A. Data Collection and Security
- **Does your app collect or share any of the required user data types?**  
  👉 **Yes**
- **Is all of the user data collected by your app encrypted in transit?**  
  👉 **Yes** (All network requests use TLS / HTTPS).
- **Do you provide a way for users to request that their data be deleted?**  
  👉 **Yes** (Provide URL: `https://vp52coin.com/delete-account`).

---

### B. Data Types Collected

#### 1. Location
- **Approximate location (Network-based):** Collected? **Yes**  
  - *Shared?* **No**  
  - *Processed ephemerally?* **No** (Stored with last known session for distance sorting)  
  - *Required or Optional?* **Optional** (User can browse without GPS)  
  - *Purpose:* **App functionality** (Shows nearby partner merchants and calculates distance to shops).
- **Precise location (GPS):** Collected? **Yes**  
  - *Shared?* **No**  
  - *Processed ephemerally?* **No**  
  - *Required or Optional?* **Optional**  
  - *Purpose:* **App functionality** (Calculates accurate driving/walking distance to partner stores).

#### 2. Personal Info
- **Name:** Collected? **Yes**  
  - *Shared?* **No** (Visible only to merchant upon explicit QR scan verification)  
  - *Purpose:* **App functionality, Account management**  
- **Email address:** Collected? **Yes**  
  - *Shared?* **No**  
  - *Purpose:* **App functionality, Account management**  
- **Phone number:** Collected? **Yes**  
  - *Shared?* **No**  
  - *Purpose:* **App functionality, Account management**  

#### 3. Financial Info
- **Credit card, debit card, or bank account numbers:** Collected? **No**  
- **Purchase history:** Collected? **Yes** (Redemption vouchers and merchant store discount receipts)  
  - *Shared?* **No**  
  - *Purpose:* **App functionality, Fraud prevention** (To apply discount caps and prevent duplicate redemptions).

#### 4. Messages
- **In-app messages (Customer-Merchant chat):** Collected? **Yes**  
  - *Shared?* **No**  
  - *Purpose:* **App functionality** (Allows customer to message partner store regarding offers).

#### 5. App Activity
- **App interactions (Ad session views, offer redemptions):** Collected? **Yes**  
  - *Shared?* **No**  
  - *Purpose:* **App functionality, Analytics, Fraud prevention** (To calculate reward progression across 12 coin tiers).

#### 6. Device or Other Identifiers
- **Device IDs / Advertising IDs:** Collected? **No** (No third-party ad tracking SDK or data brokers bundled in this build).

---

## 3. Permissions Declared in `AndroidManifest.xml`

| Permission | Protection Level | Purpose & Justification |
| :--- | :--- | :--- |
| `android.permission.INTERNET` | Normal | Required for backend REST API communication (`api.vp52coin.com`). |
| `android.permission.CAMERA` | Dangerous / Runtime | Required for merchants to scan customer QR discount vouchers using device camera. Prompted at runtime. |
| `android.permission.ACCESS_FINE_LOCATION` | Dangerous / Runtime | Required to show nearby physical partner merchants within a radius. Prompted at runtime. |
| `android.permission.ACCESS_COARSE_LOCATION` | Dangerous / Runtime | Fallback location for approximate distance calculation. |

---

## 4. Account & Data Deletion Architecture

### In-App Deletion Flow
1. Customer navigates to **Profile** (`/customer/profile`).
2. Taps **"Delete Account"** (`t('deleteAccountBtn')`).
3. Confirmation modal displays permanent warning: *"This action is permanent and cannot be undone..."*
4. Confirming triggers `DELETE /api/customer/account`:
   - Anonymizes past commercial store bills (`UPDATE bills SET customer_id = NULL WHERE customer_id = ?`) to preserve store tax/accounting records without user PII.
   - Cascades and permanently deletes: `coin_lots`, `wallets`, `point_ledger`, `reward_sessions`, `vp52_coin_sessions`, `redemptions`, `reviews`, `complaints`, `favorites`, `conversations`, `messages`, and `users`.
   - Clears JWT session, resets state, and redirects to `/customer/login`.

### Public Web Deletion Flow
1. Any user (including those who uninstalled the app) visits `https://vp52coin.com/delete-account`.
2. Enters registered email address or phone number + optional reason.
3. Submits to `POST /api/auth/request-account-deletion`.
4. Stored in `account_deletion_requests` queue for automated/administrative execution within 30 days.

---

## 5. Live Production Deployment Checklist

> [!IMPORTANT]
> In adherence with instructions, live production deployment requires explicit user review and confirmation.

- [x] Backend 12-tier coin progression system passes 20/20 test points (`server/test-vp52-tier-system.js`).
- [x] Client production build succeeds cleanly (`npm run build --prefix client`).
- [x] Removed UI coin-to-rupee valuations from `CustomerProfile.jsx` and `CustomerWallet.jsx`.
- [x] Added public `/privacy` page with verified operator details (Sanket Shinde, `shindesanket.vp52@gmail.com`).
- [x] Added public `/delete-account` page and backend `DELETE /api/customer/account` endpoint.
- [x] Converted splash video to fast-start 720p H.264 MP4 with tap-to-skip.
- [x] Generated unified launcher icons for Web, Android, and iOS from official 1024x1024 `vp52-logo.png`.
- [x] Replaced cleartext traffic in `AndroidManifest.xml` with scoped `network_security_config.xml`.
- [x] Full i18n matrix expanded to 320 keys across English, Hindi, and Marathi.
- [ ] **Ready for User Approval to deploy frontend build (`client/dist`) to Hostinger VPS (`/var/www/vp52/client/dist`).**
