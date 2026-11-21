/**
 * Test Suite: Admin Authentication & Management
 * 
 * Verifies:
 * 1. Admin login with sanketshinde.vp52@gmail.com
 * 2. JWT token issuance and role claims
 * 3. Protected admin route access (/api/admin/analytics)
 * 4. Rejection of invalid credentials (401)
 * 5. Rejection of customer tokens on admin endpoints (403)
 * 6. Password reset via management CLI
 * 7. Verification that customer data, wallets, coins, and transactions remain intact
 */

const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const http = require('http');
const { Readable, Duplex } = require('stream');
const express = require('express');
const cors = require('cors');

const db = require('./db/database');
const { createOrResetAdmin, listAdmins } = require('./scripts/manage-admin');

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/customer', require('./routes/customer'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/shop', require('./routes/shop'));
app.use('/api/merchant', require('./routes/merchant'));

// In-process fetch helper to run cleanly in sandboxed test environments
async function fetch(url, options = {}) {
  const parsedUrl = new URL(url);
  const pathWithQuery = parsedUrl.pathname + parsedUrl.search;
  
  return new Promise((resolve, reject) => {
    const req = new Readable({ read() {} });
    req.method = options.method || 'GET';
    req.url = pathWithQuery;
    req.httpVersion = '1.1';
    req.httpVersionMajor = 1;
    req.httpVersionMinor = 1;
    req.headers = {};
    for (const key of Object.keys(options.headers || {})) {
      req.headers[key.toLowerCase()] = options.headers[key];
    }
    const fakeSocket = new Duplex({ read() {}, write(chunk, enc, cb) { cb(); } });
    fakeSocket.remoteAddress = '127.0.0.1';
    fakeSocket.encrypted = false;
    req.socket = req.connection = fakeSocket;

    let payload = null;
    if (options.body !== undefined && options.body !== null) {
      payload = Buffer.from(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
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
        try { parsed = JSON.parse(text); } catch (e) {}
        resolve({
          status: res.statusCode,
          ok: res.statusCode >= 200 && res.statusCode < 300,
          headers: res.getHeaders ? res.getHeaders() : {},
          json: async () => parsed,
          text: async () => text
        });
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

const BASE_URL = 'http://127.0.0.1:5000';

async function runTests() {
  console.log('🧪 Starting Admin Authentication & Management Test Suite...\n');

  // Baseline data counts
  const usersBefore = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const shopsBefore = db.prepare('SELECT COUNT(*) as count FROM shops').get().count;
  const walletsBefore = db.prepare('SELECT COUNT(*) as count FROM wallets').get().count;
  const txBefore = db.prepare('SELECT COUNT(*) as count FROM reward_transactions').get().count;

  // TEST 1: Admin login with sanketshinde.vp52@gmail.com
  console.log('Test 1: Admin login with valid credentials (sanketshinde.vp52@gmail.com)');
  const loginRes = await fetch(`${BASE_URL}/api/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'sanketshinde.vp52@gmail.com',
      password: 'Admin@VP52#2026'
    })
  });
  const loginData = await loginRes.json();
  assert.strictEqual(loginRes.status, 200, `Expected 200, got ${loginRes.status}`);
  assert.strictEqual(loginData.success, true);
  assert.ok(loginData.token, 'Token should be returned');
  assert.strictEqual(loginData.user.email, 'sanketshinde.vp52@gmail.com');
  assert.strictEqual(loginData.user.role, 'admin');
  const adminToken = loginData.token;
  console.log('✅ TEST 1 PASSED: Admin login successful with valid token');

  // TEST 2: GET /api/auth/me with admin token
  console.log('\nTest 2: GET /api/auth/me with admin token');
  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const meData = await meRes.json();
  assert.strictEqual(meRes.status, 200);
  assert.strictEqual(meData.user.role, 'admin');
  assert.strictEqual(meData.user.email, 'sanketshinde.vp52@gmail.com');
  console.log('✅ TEST 2 PASSED: Admin profile correctly retrieved via /api/auth/me');

  // TEST 3: Access protected admin route (/api/admin/analytics)
  console.log('\nTest 3: Access protected route (/api/admin/analytics)');
  const analyticsRes = await fetch(`${BASE_URL}/api/admin/analytics`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const analyticsData = await analyticsRes.json();
  assert.strictEqual(analyticsRes.status, 200);
  assert.strictEqual(analyticsData.success, true);
  assert.ok(analyticsData.stats.totalCustomers >= 0);
  console.log('✅ TEST 3 PASSED: Admin granted access to protected admin route');

  // TEST 4: Invalid password rejected
  console.log('\nTest 4: Admin login with invalid password rejected');
  const badPwRes = await fetch(`${BASE_URL}/api/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'sanketshinde.vp52@gmail.com',
      password: 'IncorrectPassword!99'
    })
  });
  assert.strictEqual(badPwRes.status, 401);
  const badPwData = await badPwRes.json();
  assert.strictEqual(badPwData.error, 'Invalid admin credentials');
  console.log('✅ TEST 4 PASSED: Invalid password rejected with 401');

  // TEST 5: Non-existent email rejected
  console.log('\nTest 5: Non-existent admin email rejected');
  const badEmailRes = await fetch(`${BASE_URL}/api/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'nonexistent.admin@example.com',
      password: 'Admin@VP52#2026'
    })
  });
  assert.strictEqual(badEmailRes.status, 401);
  console.log('✅ TEST 5 PASSED: Unknown admin email rejected with 401');

  // TEST 6: Customer token rejected on admin routes (Role isolation)
  console.log('\nTest 6: Role isolation - Customer token rejected on admin routes');
  const customerLoginRes = await fetch(`${BASE_URL}/api/auth/customer/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'customer@example.com',
      password: 'Customer@123'
    })
  });
  const customerData = await customerLoginRes.json();
  assert.strictEqual(customerLoginRes.status, 200);
  const customerToken = customerData.token;

  const forbiddenRes = await fetch(`${BASE_URL}/api/admin/analytics`, {
    headers: { Authorization: `Bearer ${customerToken}` }
  });
  assert.strictEqual(forbiddenRes.status, 403, 'Customer token must be rejected with 403 on admin routes');
  console.log('✅ TEST 6 PASSED: Customer token denied access to admin endpoints (403)');

  // TEST 7: Password update via createOrResetAdmin
  console.log('\nTest 7: Password update via admin management CLI utility');
  const newPassword = 'NewAdminPassword#2026';
  createOrResetAdmin({
    email: 'sanketshinde.vp52@gmail.com',
    password: newPassword,
    mode: 'reset'
  });

  // Verify login with new password
  const newLoginRes = await fetch(`${BASE_URL}/api/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'sanketshinde.vp52@gmail.com',
      password: newPassword
    })
  });
  assert.strictEqual(newLoginRes.status, 200, 'Login with updated password should succeed');
  console.log('✅ TEST 7 PASSED: Admin password successfully reset and authenticated');

  // Reset back to standard password for user
  createOrResetAdmin({
    email: 'sanketshinde.vp52@gmail.com',
    password: 'Admin@VP52#2026',
    mode: 'reset'
  });

  // TEST 8: Data integrity check
  console.log('\nTest 8: Data integrity check');
  const usersAfter = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const shopsAfter = db.prepare('SELECT COUNT(*) as count FROM shops').get().count;
  const walletsAfter = db.prepare('SELECT COUNT(*) as count FROM wallets').get().count;
  const txAfter = db.prepare('SELECT COUNT(*) as count FROM reward_transactions').get().count;

  assert.strictEqual(usersAfter, usersBefore, 'Users count must remain identical');
  assert.strictEqual(shopsAfter, shopsBefore, 'Shops count must remain identical');
  assert.strictEqual(walletsAfter, walletsBefore, 'Wallets count must remain identical');
  assert.strictEqual(txAfter, txBefore, 'Transactions count must remain identical');
  console.log(`✅ TEST 8 PASSED: Data completely preserved (Users: ${usersAfter}, Shops: ${shopsAfter}, Wallets: ${walletsAfter}, Transactions: ${txAfter})`);

  console.log('\n====================================================');
  console.log('🎉 ALL 8 ADMIN TESTS PASSED SUCCESSFULLY (100%)');
  console.log('====================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
