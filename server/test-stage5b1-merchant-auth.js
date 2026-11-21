/**
 * VP52 Stage 5B.1 — OTP Removal, Merchant Password Auth & Approval Enforcement Suite
 *
 * Strictly offline / in-process HTTP tests (no TCP port binding required).
 * Designed to run against an isolated database copy.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'dev_jwt_secret_vp52_secure_local_key_min_32_chars';
}

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const { Readable, Duplex } = require('stream');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const db = require('./db/database');
const { _clearRateLimitStoreForTest } = require('./middleware/rateLimiter');
const { JWT_SECRET } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customer');
const adminRoutes = require('./routes/admin');
const shopRoutes = require('./routes/shop');
const merchantRoutes = require('./routes/merchant');
const uploadRoutes = require('./routes/upload');

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use('/api/auth', authRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/merchant', merchantRoutes);
app.use('/api/upload', uploadRoutes);

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = new Readable({ read() {} });
    req.method = options.method || 'GET';
    req.url = options.path;
    req.httpVersion = '1.1';
    req.httpVersionMajor = 1;
    req.httpVersionMinor = 1;
    req.headers = {};
    for (const k of Object.keys(options.headers || {})) {
      req.headers[k.toLowerCase()] = options.headers[k];
    }

    const fakeSocket = new Duplex({ read() {}, write(chunk, enc, cb) { cb(); } });
    fakeSocket.remoteAddress = options.ip || '127.0.0.1';
    fakeSocket.encrypted = false;
    req.socket = req.connection = fakeSocket;

    let payload = null;
    if (body !== undefined && body !== null) {
      payload = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
      if (!req.headers['content-type']) req.headers['content-type'] = 'application/json';
      req.headers['content-length'] = String(payload.length);
    }

    const res = new http.ServerResponse(req);
    const chunks = [];
    let settled = false;

    res.write = function (chunk) {
      if (chunk) chunks.push(Buffer.from(chunk));
      return true;
    };
    res.end = function (chunk, encoding, cb) {
      if (typeof chunk === 'function') { cb = chunk; chunk = null; }
      else if (typeof encoding === 'function') { cb = encoding; }
      if (chunk) chunks.push(Buffer.from(chunk));
      if (!settled) {
        settled = true;
        const text = Buffer.concat(chunks).toString('utf8');
        let parsed = text;
        try { parsed = JSON.parse(text); } catch (_) {}
        resolve({ status: res.statusCode, headers: res.getHeaders ? res.getHeaders() : {}, body: parsed });
      }
      if (typeof cb === 'function') cb();
      return res;
    };

    try {
      app(req, res);
    } catch (err) {
      reject(err);
      return;
    }

    if (payload) req.push(payload);
    req.push(null);
  });
}

const jsonHeaders = { 'Content-Type': 'application/json' };
const authHeaders = (token) => ({ ...jsonHeaders, Authorization: `Bearer ${token}` });

const SAMPLE_PNG_1X1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function runTests() {
  console.log('==========================================================');
  console.log('VP52 STAGE 5B.1 — OTP REMOVAL & MERCHANT AUTH TEST SUITE');
  console.log('==========================================================\n');

  _clearRateLimitStoreForTest();

  const createdShopIds = [];
  const createdUserIds = [];
  const createdFiles = [];

  const originalVerifyIdToken = OAuth2Client.prototype.verifyIdToken;
  let mockGooglePayload = null;

  try {
    // ------------------------------------------------------------
    // 1. OTP REMOVAL TESTS
    // ------------------------------------------------------------
    const sendOtpRes = await request(
      { path: '/api/auth/send-otp', method: 'POST', headers: jsonHeaders },
      { mobile: '+919822001122' }
    );
    assert.strictEqual(sendOtpRes.status, 410, 'POST /send-otp must return 410 Gone');
    assert.strictEqual(sendOtpRes.body.success, false);
    assert.strictEqual(sendOtpRes.body.otp_code, undefined, 'Must never return otp_code');

    const verifyOtpRes1 = await request(
      { path: '/api/auth/verify-otp', method: 'POST', headers: jsonHeaders },
      { mobile: '+919822001122', otp_code: '123456' }
    );
    assert.strictEqual(verifyOtpRes1.status, 410, 'POST /verify-otp with 123456 must return 410 Gone');
    assert.notStrictEqual(verifyOtpRes1.body.verified, true);

    const verifyOtpRes2 = await request(
      { path: '/api/auth/verify-otp', method: 'POST', headers: jsonHeaders },
      { mobile: '+919822001122', otp_code: 'abcdef' }
    );
    assert.strictEqual(verifyOtpRes2.status, 410, 'POST /verify-otp with 6-char string must return 410 Gone');

    const loginMobileRes1 = await request(
      { path: '/api/auth/shop/login-mobile', method: 'POST', headers: jsonHeaders },
      { mobile: 'shop@example.com', otp_code: '123456' }
    );
    assert.strictEqual(loginMobileRes1.status, 410, 'POST /shop/login-mobile with 123456 must return 410 Gone');
    assert.strictEqual(loginMobileRes1.body.token, undefined, 'Must never issue token');

    const loginMobileRes2 = await request(
      { path: '/api/auth/shop/login-mobile', method: 'POST', headers: jsonHeaders },
      { mobile: '+91 20 2567 8900', otp_code: '999999' }
    );
    assert.strictEqual(loginMobileRes2.status, 410, 'POST /shop/login-mobile with arbitrary 6 digits must return 410 Gone');
    assert.strictEqual(loginMobileRes2.body.token, undefined);
    console.log('✅ [1] OTP endpoints permanently removed (410 Gone, zero bypasses)');

    // ------------------------------------------------------------
    // 2. ADMIN TOKEN SETUP & MERCHANT PASSWORD AUTHENTICATION
    // ------------------------------------------------------------
    const superAdmin = db.prepare("SELECT id, email, role FROM admins WHERE status = 'active' LIMIT 1").get();
    assert.ok(superAdmin, 'Active admin must exist in test DB');
    const adminToken = jwt.sign(
      { id: superAdmin.id, email: superAdmin.email, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const ts = Date.now();
    const pendingEmail = `pending_${ts}@vp52test.com`;
    const pendingPhone = `+919871${String(ts).slice(-6)}`;
    const strongPw = 'MerchantStrong@2026';

    // Missing password on shop login -> 400
    const missingPwRes = await request(
      { path: '/api/auth/shop/login', method: 'POST', headers: jsonHeaders },
      { email: pendingEmail }
    );
    assert.strictEqual(missingPwRes.status, 400, 'Missing password must return 400');

    // Unknown merchant -> generic 401
    const unknownRes = await request(
      { path: '/api/auth/shop/login', method: 'POST', headers: jsonHeaders },
      { email: `nonexistent_${ts}@vp52test.com`, password: strongPw }
    );
    assert.strictEqual(unknownRes.status, 401, 'Unknown merchant must return 401');

    // Merchant without password_hash -> generic 401 (no passwordless bypass, no enumeration)
    const noPwShopRes = db.prepare(`
      INSERT INTO shops (shop_code, email, password_hash, name, category, address, phone, status, verification_status, owner_name)
      VALUES (?, ?, NULL, 'No Password Legacy Shop', 'Retail', 'Pune', ?, 'active', 'approved', 'Legacy Owner')
    `).run(`SHOP-NPW-${ts}`, `nopw_${ts}@vp52test.com`, `+919870${String(ts).slice(-6)}`);
    createdShopIds.push(noPwShopRes.lastInsertRowid);

    const noPwLogin = await request(
      { path: '/api/auth/shop/login', method: 'POST', headers: jsonHeaders },
      { email: `nopw_${ts}@vp52test.com`, password: 'any_password' }
    );
    assert.strictEqual(noPwLogin.status, 401, 'Shop lacking password_hash must return generic 401');
    assert.strictEqual(noPwLogin.body.error, unknownRes.body.error, 'Generic error must match unknown account');
    console.log('✅ [2] Unknown, missing-password, and null-hash merchants safely return generic 401');

    // ------------------------------------------------------------
    // 3. SELF-REGISTRATION + PENDING APPROVAL ENFORCEMENT
    // ------------------------------------------------------------
    const selfRegRes = await request(
      { path: '/api/auth/merchant/self-register', method: 'POST', headers: jsonHeaders },
      {
        name: 'Stage 5B1 Pending Store',
        owner_name: 'Suresh Kulkarni',
        email: pendingEmail,
        password: strongPw,
        phone: pendingPhone,
        category: 'Retail',
        subcategory: 'General Store',
        address: 'FC Road, Pune',
        latitude: 18.5204,
        longitude: 73.8567
      }
    );
    assert.strictEqual(selfRegRes.status, 201, 'Self-registration must return 201');
    assert.strictEqual(selfRegRes.body.user.status, 'pending');
    assert.strictEqual(selfRegRes.body.user.verification_status, 'pending');
    assert.strictEqual(selfRegRes.body.user.role, 'merchant_onboarding', 'Pending self-register must receive onboarding role, NOT shop');
    const onboardingToken = selfRegRes.body.token;
    const shopId = selfRegRes.body.user.id;
    createdShopIds.push(shopId);

    const shopDbRow = db.prepare('SELECT password_hash, qr_status FROM shops WHERE id = ?').get(shopId);
    assert.ok(shopDbRow.password_hash && shopDbRow.password_hash.startsWith('$2'), 'Password stored as bcrypt hash');
    assert.notStrictEqual(shopDbRow.password_hash, strongPw, 'Plaintext password must never be stored');
    assert.strictEqual(shopDbRow.qr_status, 'pending', 'Pending shop must NOT have active QR');

    // Wrong password against pending shop -> generic 401 (never reveal pending status on invalid credentials!)
    const pendingWrongPw = await request(
      { path: '/api/auth/shop/login', method: 'POST', headers: jsonHeaders },
      { email: pendingEmail, password: 'WrongPassword123' }
    );
    assert.strictEqual(pendingWrongPw.status, 401, 'Invalid password on pending shop must return generic 401');
    assert.strictEqual(pendingWrongPw.body.error, unknownRes.body.error, 'Must not enumerate pending status without valid password');

    // Valid password on pending shop -> 403 pending approval
    const pendingLogin = await request(
      { path: '/api/auth/shop/login', method: 'POST', headers: jsonHeaders },
      { email: pendingEmail, password: strongPw }
    );
    assert.strictEqual(pendingLogin.status, 403, 'Pending merchant must be blocked from login (403)');
    assert.strictEqual(pendingLogin.body.token, undefined);

    // Explicitly permitted onboarding routes work for pending onboarding token:
    const onboardingStatusRes = await request({
      path: '/api/merchant/onboarding/status',
      method: 'GET',
      headers: authHeaders(onboardingToken)
    });
    assert.strictEqual(onboardingStatusRes.status, 200, 'Pending merchant can view own onboarding status');
    assert.strictEqual(onboardingStatusRes.body.onboarding.status, 'pending');

    const badUploadTypeRes = await request(
      { path: '/api/upload/image', method: 'POST', headers: authHeaders(onboardingToken) },
      { image: SAMPLE_PNG_1X1, type: 'product_photo' }
    );
    assert.strictEqual(badUploadTypeRes.status, 403, 'Onboarding token cannot upload non-onboarding image types');

    const onboardingUploadRes = await request(
      { path: '/api/upload/image', method: 'POST', headers: authHeaders(onboardingToken) },
      { image: SAMPLE_PNG_1X1, type: 'shop_logo' }
    );
    assert.strictEqual(onboardingUploadRes.status, 200, 'Onboarding token can upload shop_logo');
    createdFiles.push(onboardingUploadRes.body.filename);

    const attachPhotoRes = await request(
      { path: '/api/merchant/onboarding/photos', method: 'PUT', headers: authHeaders(onboardingToken) },
      { logo_url: onboardingUploadRes.body.url }
    );
    assert.strictEqual(attachPhotoRes.status, 200, 'Pending merchant can attach uploaded onboarding photo');
    assert.strictEqual(attachPhotoRes.body.shop.logo_url, onboardingUploadRes.body.url);

    // Pending token (AND even a forged/pre-existing shop JWT while status=pending!) blocked from ALL protected operational APIs:
    const forgedPendingShopToken = jwt.sign(
      { id: shopId, shop_id: shopId, email: pendingEmail, role: 'shop' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const protectedMerchantEndpoints = [
      ['GET', '/api/shop/dashboard'],
      ['GET', '/api/shop/my-qr'],
      ['GET', '/api/shop/wallet'],
      ['GET', '/api/shop/offers'],
      ['GET', '/api/shop/history'],
      ['GET', '/api/shop/redemptions/history'],
      ['GET', '/api/shop/notifications'],
      ['GET', '/api/merchant/my-shop'],
      ['PUT', '/api/merchant/my-shop'],
      ['GET', '/api/merchant/products'],
      ['POST', '/api/merchant/products'],
      ['GET', '/api/merchant/photos'],
      ['GET', '/api/merchant/offers'],
      ['GET', '/api/merchant/orders'],
      ['GET', '/api/merchant/reviews'],
      ['GET', '/api/merchant/conversations'],
      ['POST', '/api/merchant/create-bill'],
      ['POST', '/api/shop/redemption/confirm'],
      ['POST', '/api/auth/shop/change-password'],
      ['GET', '/api/auth/me']
    ];

    for (const tok of [onboardingToken, forgedPendingShopToken]) {
      for (const [method, endpoint] of protectedMerchantEndpoints) {
        if (tok === onboardingToken && endpoint === '/api/auth/me') continue; // /auth/me returns safe onboarding profile
        const blockedRes = await request(
          { path: endpoint, method, headers: authHeaders(tok) },
          method === 'POST' || method === 'PUT' ? { current_password: strongPw, new_password: 'NewStrong@2027' } : undefined
        );
        assert.strictEqual(
          blockedRes.status,
          403,
          `Pending merchant must receive 403 on ${method} ${endpoint} (got ${blockedRes.status})`
        );
      }
    }
    console.log('✅ [3] Self-registration, onboarding photo upload, and strict pending merchant isolation (20 routes) verified');

    // ------------------------------------------------------------
    // 4. ADMIN APPROVAL -> ACTIVE LOGIN + STALE JWT SUSPENSION/REJECTION BLOCK
    // ------------------------------------------------------------
    const approveRes = await request({
      path: `/api/admin/shops/${shopId}/approve`,
      method: 'PUT',
      headers: authHeaders(adminToken)
    });
    assert.strictEqual(approveRes.status, 200, 'Admin approval succeeds');

    // Verify phone login with 10-digit national form AND email login both work after approval
    const nationalPhone = pendingPhone.replace('+91', '');
    const approvedLoginPhone = await request(
      { path: '/api/auth/shop/login', method: 'POST', headers: jsonHeaders },
      { email: nationalPhone, password: strongPw }
    );
    assert.strictEqual(approvedLoginPhone.status, 200, 'Approved merchant can sign in with 10-digit mobile + password');
    assert.strictEqual(approvedLoginPhone.body.user.role, 'shop');
    const activeToken = approvedLoginPhone.body.token;

    const dashAllowed = await request({ path: '/api/shop/dashboard', method: 'GET', headers: authHeaders(activeToken) });
    assert.strictEqual(dashAllowed.status, 200, 'Approved merchant accesses /api/shop/dashboard');
    assert.strictEqual(dashAllowed.body.shop.qr_status, 'active', 'QR activated upon admin approval');

    const myShopAllowed = await request({ path: '/api/merchant/my-shop', method: 'GET', headers: authHeaders(activeToken) });
    assert.strictEqual(myShopAllowed.status, 200, 'Approved merchant accesses /api/merchant/my-shop');

    // Password change works cleanly for approved merchant
    const updatedPw = 'MerchantUpdated@2027';
    const pwChangeRes = await request(
      { path: '/api/auth/shop/change-password', method: 'POST', headers: authHeaders(activeToken) },
      { current_password: strongPw, new_password: updatedPw }
    );
    assert.strictEqual(pwChangeRes.status, 200, 'Approved merchant can change password');

    // Old password rejected, new password accepted
    const oldPwRes = await request(
      { path: '/api/auth/shop/login', method: 'POST', headers: jsonHeaders },
      { email: pendingEmail, password: strongPw }
    );
    assert.strictEqual(oldPwRes.status, 401, 'Old password rejected after change');

    const newPwRes = await request(
      { path: '/api/auth/shop/login', method: 'POST', headers: jsonHeaders },
      { email: pendingEmail, password: updatedPw }
    );
    assert.strictEqual(newPwRes.status, 200, 'New password accepted');

    // Stale JWT must immediately fail once suspended!
    const suspendRes = await request({
      path: `/api/admin/shops/${shopId}/suspend`,
      method: 'PUT',
      headers: authHeaders(adminToken)
    });
    assert.strictEqual(suspendRes.status, 200);

    for (const [method, endpoint] of [
      ['GET', '/api/shop/dashboard'],
      ['GET', '/api/merchant/my-shop'],
      ['GET', '/api/merchant/orders'],
      ['POST', '/api/merchant/create-bill'],
      ['GET', '/api/auth/me']
    ]) {
      const staleRes = await request({ path: endpoint, method, headers: authHeaders(activeToken) }, {});
      assert.strictEqual(staleRes.status, 403, `Previously valid JWT blocked on ${method} ${endpoint} after suspension`);
    }

    // Rejected status via /merchants/:id/verify also syncs status & blocks stale JWT
    await request({ path: `/api/admin/shops/${shopId}/approve`, method: 'PUT', headers: authHeaders(adminToken) });
    const rejectVerifyRes = await request(
      { path: `/api/admin/merchants/${shopId}/verify`, method: 'PUT', headers: authHeaders(adminToken) },
      { action: 'rejected' }
    );
    assert.strictEqual(rejectVerifyRes.status, 200);
    const rejectedBlockedRes = await request({ path: '/api/shop/dashboard', method: 'GET', headers: authHeaders(activeToken) });
    assert.strictEqual(rejectedBlockedRes.status, 403, 'Rejected merchant blocked even with previously active JWT');
    const rejectedLoginRes = await request(
      { path: '/api/auth/shop/login', method: 'POST', headers: jsonHeaders },
      { email: pendingEmail, password: updatedPw }
    );
    assert.strictEqual(rejectedLoginRes.status, 403, 'Rejected merchant blocked on password login');
    console.log('✅ [4] Approval lifecycle, password change, and immediate stale-JWT suspension/rejection enforcement verified');

    // ------------------------------------------------------------
    // 5. GOOGLE MERCHANT ONBOARDING & CUSTOMER GOOGLE LOGIN ISOLATION
    // ------------------------------------------------------------
    OAuth2Client.prototype.verifyIdToken = async () => ({
      getPayload: () => mockGooglePayload
    });

    const gEmail = `gmerchant_${ts}@vp52test.com`;
    const gPhone = `+919872${String(ts).slice(-6)}`;
    mockGooglePayload = {
      sub: `gsub_merchant_${ts}`,
      email: gEmail,
      email_verified: true,
      name: 'Google Shop Owner'
    };

    // Step A: Prefill check
    const gPrefillRes = await request(
      { path: '/api/auth/merchant/google', method: 'POST', headers: jsonHeaders },
      { idToken: 'mock.google.merchant.token' }
    );
    assert.strictEqual(gPrefillRes.status, 200);
    assert.strictEqual(gPrefillRes.body.onboardingRequired, true);

    // Step B: Complete Google onboarding -> creates PENDING merchant + onboarding-only token
    const gOnboardRes = await request(
      { path: '/api/auth/merchant/google', method: 'POST', headers: jsonHeaders },
      {
        idToken: 'mock.google.merchant.token',
        complete_onboarding: true,
        name: 'Google Cafe VP52',
        owner_name: 'Google Shop Owner',
        phone: gPhone,
        category: 'Hotels & Food Services',
        subcategory: 'Cafe',
        address: 'Kothrud, Pune'
      }
    );
    assert.strictEqual(gOnboardRes.status, 201);
    assert.strictEqual(gOnboardRes.body.user.status, 'pending');
    assert.strictEqual(gOnboardRes.body.user.role, 'merchant_onboarding');
    const gShopId = gOnboardRes.body.user.id;
    createdShopIds.push(gShopId);

    const gBlockedDash = await request({
      path: '/api/shop/dashboard',
      method: 'GET',
      headers: authHeaders(gOnboardRes.body.token)
    });
    assert.strictEqual(gBlockedDash.status, 403, 'Google onboarding token cannot bypass approval');

    // Pending Google sign-in attempt returns 403 MERCHANT_PENDING
    const gPendingSignIn = await request(
      { path: '/api/auth/merchant/google', method: 'POST', headers: jsonHeaders },
      { idToken: 'mock.google.merchant.token' }
    );
    assert.strictEqual(gPendingSignIn.status, 403);
    assert.strictEqual(gPendingSignIn.body.code, 'MERCHANT_PENDING');

    // Customer Google Sign-In stays untouched and creates/logs in customer cleanly
    const cEmail = `gcust_${ts}@vp52test.com`;
    mockGooglePayload = {
      sub: `gsub_cust_${ts}`,
      email: cEmail,
      email_verified: true,
      name: 'Google Customer'
    };
    const gCustRes = await request(
      { path: '/api/auth/customer/google', method: 'POST', headers: jsonHeaders },
      { idToken: 'mock.google.cust.token' }
    );
    assert.strictEqual(gCustRes.status, 200);
    assert.strictEqual(gCustRes.body.user.role, 'customer');
    const gCustId = gCustRes.body.user.id;
    const gCustToken = gCustRes.body.token;
    createdUserIds.push(gCustId);

    // Role isolation checks
    const custHitsMerchant = await request({ path: '/api/merchant/onboarding/status', method: 'GET', headers: authHeaders(gCustToken) });
    assert.strictEqual(custHitsMerchant.status, 403, 'Customer cannot access merchant onboarding endpoint');

    const custHitsShopDash = await request({ path: '/api/shop/dashboard', method: 'GET', headers: authHeaders(gCustToken) });
    assert.strictEqual(custHitsShopDash.status, 403, 'Customer cannot access /api/shop/dashboard');

    // Existing customer email cannot onboard as Google merchant (role isolation)
    const crossRoleRes = await request(
      { path: '/api/auth/merchant/google', method: 'POST', headers: jsonHeaders },
      { idToken: 'mock.google.cust.token' }
    );
    assert.strictEqual(crossRoleRes.status, 409, 'Customer Google account cannot register as merchant');

    // Approved merchant cannot access customer or admin endpoints
    await request({ path: `/api/admin/shops/${shopId}/approve`, method: 'PUT', headers: authHeaders(adminToken) });
    const merchHitsAdmin = await request({ path: '/api/admin/shops', method: 'GET', headers: authHeaders(activeToken) });
    assert.strictEqual(merchHitsAdmin.status, 403, 'Approved merchant cannot access /api/admin/*');
    const merchHitsCust = await request({ path: '/api/customer/wallet', method: 'GET', headers: authHeaders(activeToken) });
    assert.strictEqual(merchHitsCust.status, 403, 'Approved merchant cannot access /api/customer/*');
    console.log('✅ [5] Google merchant onboarding, customer Google login, and strict role isolation verified');

    // ------------------------------------------------------------
    // 6. RATE LIMITING ON MERCHANT PASSWORD LOGIN
    // ------------------------------------------------------------
    _clearRateLimitStoreForTest();
    let saw429 = false;
    for (let i = 0; i < 20; i++) {
      const attempt = await request(
        { path: '/api/auth/shop/login', method: 'POST', headers: jsonHeaders, ip: '203.0.113.55' },
        { email: pendingEmail, password: 'WrongPasswordAttempt1!' }
      );
      if (attempt.status === 429) {
        saw429 = true;
        break;
      }
      assert.strictEqual(attempt.status, 401, 'Pre-limit failed attempts return 401');
    }
    assert.ok(saw429, 'Repeated failed merchant login attempts must trigger 429 Too Many Requests');
    console.log('✅ [6] Merchant login rate limiting (429) verified');

    console.log('\n🎉 ALL STAGE 5B.1 SECURITY & AUTH TESTS PASSED!\n');
  } finally {
    OAuth2Client.prototype.verifyIdToken = originalVerifyIdToken;
    _clearRateLimitStoreForTest();

    for (const fname of createdFiles) {
      try {
        const fpath = path.join(__dirname, 'public', 'uploads', fname);
        if (fs.existsSync(fpath)) fs.unlinkSync(fpath);
      } catch (_) {}
    }
    if (createdShopIds.length > 0) {
      const ph = createdShopIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM merchant_wallets WHERE shop_id IN (${ph})`).run(...createdShopIds);
      db.prepare(`DELETE FROM shops WHERE id IN (${ph})`).run(...createdShopIds);
    }
    if (createdUserIds.length > 0) {
      const ph = createdUserIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM wallets WHERE user_id IN (${ph})`).run(...createdUserIds);
      db.prepare(`DELETE FROM users WHERE id IN (${ph})`).run(...createdUserIds);
    }
  }
}

runTests().catch((err) => {
  console.error('❌ Stage 5B.1 Test Failure:', err);
  process.exit(1);
});
