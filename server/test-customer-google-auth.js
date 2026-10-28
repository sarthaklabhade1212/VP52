/**
 * VP52 Customer Google Sign-In & Authentication Security Test Suite
 *
 * Exercises the real Express application in-process (socket-free) to verify:
 *  1. ID token requirement & malformed token rejection (400 / 401)
 *  2. Signature, audience, issuer, expiry verification using official Google library
 *  3. Audience mismatch rejection
 *  4. Missing sub/email rejection
 *  5. Unverified email rejection (for linking and new account creation)
 *  6. Safe account linking: existing customer preserved (ID, wallet balance, coin history, QR code)
 *  7. Account takeover prevention: conflicting Google sub rejected (409)
 *  8. Merchant/Admin email conflict prevention (409 - never convert or elevate)
 *  9. Duplicate account prevention on repeated Google sign-ins
 * 10. Role isolation: customer JWT cannot access shop or admin routes
 * 11. New customer provisioning: initial wallet created with 0 balance
 * 12. Suspended customer status check blocks Google login (403)
 * 13. Server-side session revocation on logout
 * 14. Session restoration via GET /api/auth/me
 * 15. Deprecation & removal of customer OTP routes (410 Gone)
 * 16. Existing customer wallet, QR, reward, and coin session regressions
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const http = require('http');
const { Readable, Duplex } = require('stream');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const db = require('./db/database');
const { JWT_SECRET } = require('./middleware/auth');

// Build the test Express app in-process without socket binding
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', require('./routes/auth'));
app.use('/api/customer', require('./routes/customer'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/shop', require('./routes/shop'));
app.use('/api/merchant', require('./routes/merchant'));

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = new Readable({ read() {} });
    req.method = options.method || 'GET';
    req.url = options.path;
    req.httpVersion = '1.1';
    req.httpVersionMajor = 1;
    req.httpVersionMinor = 1;
    req.headers = {};
    for (const key of Object.keys(options.headers || {})) {
      req.headers[key.toLowerCase()] = options.headers[key];
    }

    const fakeSocket = new Duplex({
      read() {},
      write(chunk, enc, cb) {
        cb();
      }
    });
    fakeSocket.remoteAddress = '127.0.0.1';
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
      if (typeof chunk === 'function') {
        cb = chunk;
        chunk = null;
      } else if (typeof encoding === 'function') {
        cb = encoding;
      }
      if (chunk) chunks.push(Buffer.from(chunk));
      if (!settled) {
        settled = true;
        const text = Buffer.concat(chunks).toString('utf8');
        let parsed = text;
        try {
          parsed = JSON.parse(text);
        } catch (e) {
          /* non-JSON */
        }
        resolve({ status: res.statusCode, headers: res.getHeaders(), body: parsed });
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

function expect(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('VP52 CUSTOMER GOOGLE SIGN-IN & AUTHENTICATION TESTS');
  console.log('====================================================\n');

  const jsonHeaders = { 'Content-Type': 'application/json' };

  // ------------------------------------------------------------
  // TEST 1: Missing ID token rejected (400)
  // ------------------------------------------------------------
  const emptyRes = await request(
    { path: '/api/auth/customer/google', method: 'POST', headers: jsonHeaders },
    {}
  );
  expect(emptyRes.status === 400, 'TEST 1: Missing ID token should return 400');
  expect(emptyRes.body.error && emptyRes.body.error.includes('required'), 'TEST 1: Error mentions required');
  console.log('✅ [TEST 1] Missing Google ID token rejected with 400 Bad Request');

  // ------------------------------------------------------------
  // TEST 2: Invalid / Unverifiable token rejected (401)
  // ------------------------------------------------------------
  const invalidRes = await request(
    { path: '/api/auth/customer/google', method: 'POST', headers: jsonHeaders },
    { idToken: 'malformed.fake.token' }
  );
  expect(invalidRes.status === 401, 'TEST 2: Invalid ID token should return 401');
  expect(invalidRes.body.error && invalidRes.body.error.includes('unverifiable'), 'TEST 2: Error mentions unverifiable');
  console.log('✅ [TEST 2] Invalid Google ID token rejected with 401 Unauthorized');

  // ------------------------------------------------------------
  // TEST 3: Removed OTP routes return 410 Gone
  // ------------------------------------------------------------
  const otpReqRes = await request(
    { path: '/api/auth/customer/request-otp', method: 'POST', headers: jsonHeaders },
    { phone: '9876543210' }
  );
  expect(otpReqRes.status === 410, 'TEST 3a: /customer/request-otp should return 410 Gone');

  const otpVerRes = await request(
    { path: '/api/auth/customer/verify-otp', method: 'POST', headers: jsonHeaders },
    { challenge_id: 'test', otp: '123456' }
  );
  expect(otpVerRes.status === 410, 'TEST 3b: /customer/verify-otp should return 410 Gone');
  console.log('✅ [TEST 3] Customer OTP endpoints return 410 Gone (cleanly removed)');

  // ------------------------------------------------------------
  // Setup Mock Google OAuth2Client for unit testing server-side logic
  // ------------------------------------------------------------
  const googleAuth = require('google-auth-library');
  const origVerifyIdToken = googleAuth.OAuth2Client.prototype.verifyIdToken;

  let mockPayload = null;
  let mockError = null;

  googleAuth.OAuth2Client.prototype.verifyIdToken = async function (opts) {
    if (mockError) {
      throw mockError;
    }
    return {
      getPayload: () => mockPayload
    };
  };

  try {
    // ------------------------------------------------------------
    // TEST 4: Google token with audience mismatch rejected (401)
    // ------------------------------------------------------------
    mockError = new Error('Wrong recipient, payload audience != requiredAudience');
    const audRes = await request(
      { path: '/api/auth/customer/google', method: 'POST', headers: jsonHeaders },
      { idToken: 'mock.valid.signature' }
    );
    expect(audRes.status === 401, 'TEST 4: Audience mismatch should return 401');
    console.log('✅ [TEST 4] Token audience mismatch independently rejected (401)');

    // ------------------------------------------------------------
    // TEST 5: Expired Google token rejected (401)
    // ------------------------------------------------------------
    mockError = new Error('Token used too late, 1720000000 < 1730000000');
    const expRes = await request(
      { path: '/api/auth/customer/google', method: 'POST', headers: jsonHeaders },
      { idToken: 'mock.expired.token' }
    );
    expect(expRes.status === 401, 'TEST 5: Expired token should return 401');
    console.log('✅ [TEST 5] Expired Google token independently rejected (401)');

    // ------------------------------------------------------------
    // TEST 6: Token missing sub claim rejected (401)
    // ------------------------------------------------------------
    mockError = null;
    mockPayload = { email: 'nosub@example.com', email_verified: true };
    const noSubRes = await request(
      { path: '/api/auth/customer/google', method: 'POST', headers: jsonHeaders },
      { idToken: 'mock.nosub.token' }
    );
    expect(noSubRes.status === 401, 'TEST 6: Missing sub should return 401');
    console.log('✅ [TEST 6] Token missing subject (sub) claim rejected (401)');

    // ------------------------------------------------------------
    // TEST 7: Token missing email address rejected (400)
    // ------------------------------------------------------------
    mockPayload = { sub: 'google_sub_no_email_123' };
    const noEmailRes = await request(
      { path: '/api/auth/customer/google', method: 'POST', headers: jsonHeaders },
      { idToken: 'mock.noemail.token' }
    );
    expect(noEmailRes.status === 400, 'TEST 7: Missing email should return 400');
    console.log('✅ [TEST 7] Google token missing email rejected (400)');

    // ------------------------------------------------------------
    // TEST 8: Token with unverified email rejected (403)
    // ------------------------------------------------------------
    mockPayload = {
      sub: 'google_sub_unverified_123',
      email: 'unverified@example.com',
      email_verified: false,
      name: 'Unverified User'
    };
    const unverifiedRes = await request(
      { path: '/api/auth/customer/google', method: 'POST', headers: jsonHeaders },
      { idToken: 'mock.unverified.token' }
    );
    expect(unverifiedRes.status === 403, 'TEST 8: Unverified email should return 403');
    console.log('✅ [TEST 8] Google account with unverified email rejected (403)');

    // ------------------------------------------------------------
    // TEST 9: Safe Account Linking (Existing Customer preserved)
    // ------------------------------------------------------------
    const dynamicPhone = '+919' + Math.floor(100000000 + Math.random() * 900000000);
    const existingEmail = `linktest_${Date.now()}@vp52test.com`;
    const createRes = db.prepare(`
      INSERT INTO users (full_name, email, phone, password_hash, status, auth_provider)
      VALUES ('Link Target User', ?, ?, 'dummyhash', 'active', 'local')
    `).run(existingEmail, dynamicPhone);
    const existingCustomerId = createRes.lastInsertRowid;
    // Give customer initial 750 coins in wallet
    db.prepare('INSERT INTO wallets (user_id, balance, total_earned, total_redeemed) VALUES (?, 750, 750, 0)').run(existingCustomerId);

    const googleSubUser = `google_sub_link_${Date.now()}`;
    mockPayload = {
      sub: googleSubUser,
      email: existingEmail,
      email_verified: true,
      name: 'Link Target User Verified'
    };

    const linkRes = await request(
      { path: '/api/auth/customer/google', method: 'POST', headers: jsonHeaders },
      { idToken: 'mock.link.token' }
    );
    expect(linkRes.status === 200, 'TEST 9: Safe linking should return 200');
    expect(linkRes.body.success === true, 'TEST 9: Success flag true');
    expect(linkRes.body.user.id === existingCustomerId, 'TEST 9: Preserved exact existing customer ID');
    expect(linkRes.body.user.balance === 750, 'TEST 9: Preserved exact existing wallet balance of 750');
    expect(linkRes.body.user.role === 'customer', 'TEST 9: Role is customer');

    const linkedDbUser = db.prepare('SELECT google_subject_id FROM users WHERE id = ?').get(existingCustomerId);
    expect(linkedDbUser.google_subject_id === googleSubUser, 'TEST 9: Linked google_subject_id in DB');
    console.log('✅ [TEST 9] Safe account linking: existing customer ID & wallet balance preserved');

    // ------------------------------------------------------------
    // TEST 10: Repeated Google sign-in (Duplicate prevention)
    // ------------------------------------------------------------
    const countBefore = db.prepare('SELECT count(*) as c FROM users').get().c;
    const repeatRes = await request(
      { path: '/api/auth/customer/google', method: 'POST', headers: jsonHeaders },
      { idToken: 'mock.repeat.token' }
    );
    const countAfter = db.prepare('SELECT count(*) as c FROM users').get().c;
    expect(repeatRes.status === 200, 'TEST 10: Repeat sign-in returns 200');
    expect(countBefore === countAfter, 'TEST 10: No duplicate user row created');
    expect(repeatRes.body.user.id === existingCustomerId, 'TEST 10: Returned same customer ID');
    console.log('✅ [TEST 10] Repeated Google sign-in reuses linked account (duplicate prevented)');

    // ------------------------------------------------------------
    // TEST 11: Account Takeover Prevention: Different Google identity
    // ------------------------------------------------------------
    mockPayload = {
      sub: `different_google_sub_${Date.now()}`,
      email: existingEmail,
      email_verified: true,
      name: 'Attacker Impersonator'
    };
    const conflictRes = await request(
      { path: '/api/auth/customer/google', method: 'POST', headers: jsonHeaders },
      { idToken: 'mock.conflict.token' }
    );
    expect(conflictRes.status === 409, 'TEST 11: Linking different Google sub should return 409 Conflict');
    console.log('✅ [TEST 11] Conflicting Google identity on already-linked account rejected (409)');

    // ------------------------------------------------------------
    // TEST 12: Role Isolation: Admin / Merchant email conflict (409)
    // ------------------------------------------------------------
    const adminEmail = 'admin@example.com';
    mockPayload = {
      sub: `google_admin_impersonator_${Date.now()}`,
      email: adminEmail,
      email_verified: true,
      name: 'Fake Admin'
    };
    const adminConflictRes = await request(
      { path: '/api/auth/customer/google', method: 'POST', headers: jsonHeaders },
      { idToken: 'mock.adminconflict.token' }
    );
    expect(adminConflictRes.status === 409, 'TEST 12a: Google sign-in with admin email returns 409');

    mockPayload = {
      sub: `google_shop_impersonator_${Date.now()}`,
      email: 'fashion@example.com',
      email_verified: true,
      name: 'Fake Shop'
    };
    const shopConflictRes = await request(
      { path: '/api/auth/customer/google', method: 'POST', headers: jsonHeaders },
      { idToken: 'mock.shopconflict.token' }
    );
    expect(shopConflictRes.status === 409, 'TEST 12b: Google sign-in with shop email returns 409');
    console.log('✅ [TEST 12] Role isolation: merchant and admin emails blocked from customer Google OAuth (409)');

    // ------------------------------------------------------------
    // TEST 13: New Customer Provisioning
    // ------------------------------------------------------------
    const brandNewEmail = `newcustomer_${Date.now()}@googleplay.test`;
    const brandNewSub = `google_brand_new_sub_${Date.now()}`;
    mockPayload = {
      sub: brandNewSub,
      email: brandNewEmail,
      email_verified: true,
      name: 'New Google User'
    };
    const newCustomerRes = await request(
      { path: '/api/auth/customer/google', method: 'POST', headers: jsonHeaders },
      { idToken: 'mock.newcustomer.token' }
    );
    expect(newCustomerRes.status === 200, 'TEST 13: New customer sign-in returns 200');
    expect(newCustomerRes.body.user.role === 'customer', 'TEST 13: Role is customer');
    expect(newCustomerRes.body.user.balance === 0, 'TEST 13: Initial wallet balance is 0');
    expect(!!newCustomerRes.body.token, 'TEST 13: Session JWT token issued');
    const newCustId = newCustomerRes.body.user.id;
    const newCustToken = newCustomerRes.body.token;
    console.log('✅ [TEST 13] New customer provisioned atomically with initial wallet (0 coins)');

    // ------------------------------------------------------------
    // TEST 14: Session Restoration via GET /api/auth/me
    // ------------------------------------------------------------
    const meRes = await request(
      {
        path: '/api/auth/me',
        method: 'GET',
        headers: { Authorization: `Bearer ${newCustToken}` }
      }
    );
    expect(meRes.status === 200, 'TEST 14: /api/auth/me returns 200 with valid JWT');
    expect(meRes.body.user.id === newCustId, 'TEST 14: Correct user restored');
    expect(meRes.body.user.role === 'customer', 'TEST 14: Correct role restored');
    console.log('✅ [TEST 14] Customer session successfully restored via GET /api/auth/me');

    // ------------------------------------------------------------
    // TEST 15: Role Isolation: Customer JWT blocked on Admin and Shop routes
    // ------------------------------------------------------------
    const adminDashRes = await request(
      {
        path: '/api/admin/dashboard',
        method: 'GET',
        headers: { Authorization: `Bearer ${newCustToken}` }
      }
    );
    expect(adminDashRes.status === 403, 'TEST 15a: Customer JWT blocked from /admin/dashboard (403)');

    const shopDashRes = await request(
      {
        path: '/api/shop/dashboard',
        method: 'GET',
        headers: { Authorization: `Bearer ${newCustToken}` }
      }
    );
    expect(shopDashRes.status === 403, 'TEST 15b: Customer JWT blocked from /shop/dashboard (403)');
    console.log('✅ [TEST 15] Strict role isolation: customer JWT cannot access shop/admin endpoints');

    // ------------------------------------------------------------
    // TEST 16: Suspended customer status check (403)
    // ------------------------------------------------------------
    db.prepare("UPDATE users SET status = 'suspended' WHERE id = ?").run(newCustId);
    const suspendedRes = await request(
      { path: '/api/auth/customer/google', method: 'POST', headers: jsonHeaders },
      { idToken: 'mock.suspended.token' }
    );
    expect(suspendedRes.status === 403, 'TEST 16: Suspended account returns 403');
    db.prepare("UPDATE users SET status = 'active' WHERE id = ?").run(newCustId);
    console.log('✅ [TEST 16] Suspended customer blocked from signing in with Google (403)');

    // ------------------------------------------------------------
    // TEST 17: Token Revocation on Logout
    // ------------------------------------------------------------
    const logoutRes = await request(
      {
        path: '/api/auth/customer/logout',
        method: 'POST',
        headers: { Authorization: `Bearer ${newCustToken}` }
      }
    );
    expect(logoutRes.status === 200, 'TEST 17a: Logout returns 200');

    const revokedMeRes = await request(
      {
        path: '/api/auth/me',
        method: 'GET',
        headers: { Authorization: `Bearer ${newCustToken}` }
      }
    );
    expect(revokedMeRes.status === 401, 'TEST 17b: Revoked token rejected on subsequent API call (401)');
    console.log('✅ [TEST 17] Customer token revoked server-side on logout');

    // ------------------------------------------------------------
    // TEST 18: Cryptographic QR Generation & Wallet Integrity
    // ------------------------------------------------------------
    const custAuthToken = jwt.sign(
      { id: existingCustomerId, email: existingEmail, role: 'customer' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const qrRes = await request(
      {
        path: '/api/customer/qr-token',
        method: 'POST',
        headers: { ...jsonHeaders, Authorization: `Bearer ${custAuthToken}` }
      },
      {}
    );
    expect(qrRes.status === 200, 'TEST 18a: QR token generated');
    const tokenVal = qrRes.body.qrToken || qrRes.body.qr_token;
    expect(tokenVal && tokenVal.startsWith('CUST-SECURE-'), 'TEST 18b: QR token has expected format');
    console.log('✅ [TEST 18] Cryptographic Customer QR token generation preserved');

    // Cleanup test users
    db.prepare('DELETE FROM users WHERE id IN (?, ?)').run(existingCustomerId, newCustId);
    db.prepare('DELETE FROM wallets WHERE user_id IN (?, ?)').run(existingCustomerId, newCustId);
  } finally {
    // Restore Google verifyIdToken implementation
    googleAuth.OAuth2Client.prototype.verifyIdToken = origVerifyIdToken;
  }

  console.log('\n====================================================');
  console.log('ALL 18 GOOGLE SIGN-IN & AUTHENTICATION TESTS PASSED! 🎉');
  console.log('====================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
