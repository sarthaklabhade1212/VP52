const express = require('express');
const cors = require('cors');
const http = require('http');
const { Readable, Duplex } = require('stream');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const db = require('./db/database');
const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customer');
const shopRoutes = require('./routes/shop');
const adminRoutes = require('./routes/admin');

// Spin up test Express app in-process
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/admin', adminRoutes);

function mockRequest(app, { method, url, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const req = new Readable({ read() {} });
    req.method = method || 'GET';
    req.url = url;
    req.httpVersion = '1.1';
    req.httpVersionMajor = 1;
    req.httpVersionMinor = 1;
    req.headers = {};
    for (const key of Object.keys(headers || {})) {
      req.headers[key.toLowerCase()] = headers[key];
    }
    const fakeSocket = new Duplex({ read() {}, write(chunk, enc, cb) { cb(); } });
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
      if (typeof chunk === 'function') { cb = chunk; chunk = null; }
      else if (typeof encoding === 'function') { cb = encoding; }
      if (chunk) chunks.push(Buffer.from(chunk));
      if (!settled) {
        settled = true;
        const text = Buffer.concat(chunks).toString('utf8');
        let parsed = text;
        try { parsed = JSON.parse(text); } catch (e) { /* non-JSON body */ }
        resolve({ statusCode: res.statusCode, headers: res.getHeaders ? res.getHeaders() : {}, body: parsed });
      }
      if (typeof cb === 'function') cb();
      return res;
    };

    app.handle(req, res, (err) => {
      if (err && !settled) {
        settled = true;
        reject(err);
      }
    });

    if (payload) {
      req.push(payload);
    }
    req.push(null);
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('VP52 UNLIMITED SESSIONS, ADMOB & REDEMPTION TEST SUITE');
  console.log('====================================================\n');

  const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_vp52_development_2026';

  // 1. Setup Test Customer
  let testCustomer = db.prepare("SELECT * FROM users WHERE email = 'sessionuser@vp52.com'").get();
  if (!testCustomer) {
    const hash = bcrypt.hashSync('Password@123', 10);
    const res = db.prepare(`
      INSERT INTO users (full_name, email, password_hash, phone, status, profile_completed)
      VALUES ('Aarav Patel', 'sessionuser@vp52.com', ?, '9876500001', 'active', 1)
    `).run(hash);
    testCustomer = db.prepare('SELECT * FROM users WHERE id = ?').get(res.lastInsertRowid);
  }
  // Reset customer wallet to 500 coins for clean test
  db.prepare('DELETE FROM wallets WHERE user_id = ?').run(testCustomer.id);
  db.prepare('INSERT INTO wallets (user_id, balance, total_earned, total_redeemed) VALUES (?, 500, 500, 0)').run(testCustomer.id);
  // Add a 30-day FIFO coin lot
  db.prepare('DELETE FROM coin_lots WHERE user_id = ?').run(testCustomer.id);
  const lotExpiry = new Date(Date.now() + 30 * 86400 * 1000).toISOString();
  db.prepare(`
    INSERT INTO coin_lots (user_id, transaction_id, source, coins_earned, coins_remaining, tier, original_amount, expires_at, status)
    VALUES (?, 'LOT-INIT-500', 'TEST_SETUP', 500, 500, 'Bronze', 500, ?, 'ACTIVE')
  `).run(testCustomer.id, lotExpiry);

  const customerToken = jwt.sign(
    { id: testCustomer.id, email: testCustomer.email, role: 'customer' },
    JWT_SECRET,
    { expiresIn: '1d' }
  );

  // 2. Setup Test Merchant A
  let testShopA = db.prepare("SELECT * FROM shops WHERE email = 'shopalpha@vp52.com'").get();
  if (!testShopA) {
    const hash = bcrypt.hashSync('ShopPass@123', 10);
    const res = db.prepare(`
      INSERT INTO shops (shop_code, email, password_hash, name, category, address, phone, status, verification_status, latitude, longitude)
      VALUES ('SHOP-ALPHA', 'shopalpha@vp52.com', ?, 'Alpha Supermarket', 'Groceries', 'Main St', '9876500002', 'active', 'approved', 18.5204, 73.8567)
    `).run(hash);
    testShopA = db.prepare('SELECT * FROM shops WHERE id = ?').get(res.lastInsertRowid);
  }
  db.prepare('INSERT OR IGNORE INTO merchant_wallets (shop_id, balance, total_received, total_spent) VALUES (?, 0, 0, 0)').run(testShopA.id);
  db.prepare('UPDATE merchant_wallets SET balance = 50, total_received = 50 WHERE shop_id = ?').run(testShopA.id);

  const shopAToken = jwt.sign(
    { id: testShopA.id, email: testShopA.email, role: 'shop', shop_id: testShopA.id },
    JWT_SECRET,
    { expiresIn: '1d' }
  );

  // 3. Setup Test Merchant B (for wrong shop security checks)
  let testShopB = db.prepare("SELECT * FROM shops WHERE email = 'shopbeta@vp52.com'").get();
  if (!testShopB) {
    const hash = bcrypt.hashSync('ShopPass@123', 10);
    const res = db.prepare(`
      INSERT INTO shops (shop_code, email, password_hash, name, category, address, phone, status, verification_status, latitude, longitude)
      VALUES ('SHOP-BETA', 'shopbeta@vp52.com', ?, 'Beta Electronics', 'Electronics', 'Tech Ave', '9876500003', 'active', 'approved', 18.5204, 73.8567)
    `).run(hash);
    testShopB = db.prepare('SELECT * FROM shops WHERE id = ?').get(res.lastInsertRowid);
  }
  db.prepare('INSERT OR IGNORE INTO merchant_wallets (shop_id, balance, total_received, total_spent) VALUES (?, 0, 0, 0)').run(testShopB.id);

  const shopBToken = jwt.sign(
    { id: testShopB.id, email: testShopB.email, role: 'shop', shop_id: testShopB.id },
    JWT_SECRET,
    { expiresIn: '1d' }
  );

  // Clean old test sessions for customer
  db.prepare('DELETE FROM vp52_coin_sessions WHERE user_id = ?').run(testCustomer.id);
  db.prepare('DELETE FROM coin_transfers WHERE customer_id = ?').run(testCustomer.id);
  db.prepare('DELETE FROM merchant_coin_ledger WHERE customer_id = ?').run(testCustomer.id);
  db.prepare('DELETE FROM coin_redemption_requests WHERE user_id = ?').run(testCustomer.id);

  // ============================================================
  // TEST A: UNLIMITED 6-HOUR SESSIONS & ADMOB INTEGRATION
  // ============================================================
  console.log('[TEST A1] Checking initial session status...');
  let res = await mockRequest(app, {
    method: 'GET',
    url: '/api/customer/coin-session',
    headers: { authorization: `Bearer ${customerToken}` }
  });
  assert(res.statusCode === 200, 'Session status 200');
  assert(res.body.can_start === true, 'can_start must be true when no session is active');
  console.log('   ✓ can_start is true when no active session.');

  console.log('\n[TEST A2] Starting Session 1 (Instant activation without blocking on ads)...');
  res = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/coin-session/start',
    headers: { authorization: `Bearer ${customerToken}` }
  });
  assert(res.statusCode === 200, 'Start session returned 200');
  assert(res.body.session.status === 'active', 'Session 1 is immediately active');
  assert(res.body.session.duration_seconds === 21600, 'Session 1 duration is 6 hours (21600s)');
  assert(res.body.ad_experience && res.body.ad_experience.max_native_ads === 3, 'AdMob native ad experience configured');
  const session1Id = res.body.session.id;
  console.log(`   ✓ Session 1 #${session1Id} activated immediately for 6 hours.`);

  console.log('\n[TEST A3] Overlapping Session Prevention...');
  res = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/coin-session/start',
    headers: { authorization: `Bearer ${customerToken}` }
  });
  assert(res.statusCode === 200, 'Duplicate request returned 200 with existing session');
  assert(res.body.session.id === session1Id, 'Returned identical active session (prevented overlapping session)');
  console.log('   ✓ Overlapping session successfully prevented.');

  console.log('\n[TEST A4] Ad Event Diagnostics (Recording impressions and clicks without blocking)...');
  res = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/ad-event',
    headers: { authorization: `Bearer ${customerToken}` },
    body: {
      ad_format: 'native',
      event_type: 'impression',
      ad_unit_id: 'ca-app-pub-3940256099942544/2247696110',
      metadata: { placement: 'session_start', slot: 1 }
    }
  });
  assert(res.statusCode === 200 && res.body.recorded === true, 'Ad impression recorded cleanly');
  console.log('   ✓ AdMob impression event recorded successfully.');

  console.log('\n[TEST A5] Simulating Session 1 completion & claiming 100 coins...');
  // Fast-forward session 1 expiry
  db.prepare("UPDATE vp52_coin_sessions SET started_at = datetime('now', '-7 hours'), expires_at = datetime('now', '-1 hour') WHERE id = ?").run(session1Id);
  res = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/coin-session/complete',
    headers: { authorization: `Bearer ${customerToken}` }
  });
  assert(res.statusCode === 200, 'Claim session 1 returned 200');
  assert(res.body.coins_awarded === 100, 'Awarded 100 coins for completing 6-hour session');
  const balAfterSession1 = db.prepare('SELECT balance FROM wallets WHERE user_id = ?').get(testCustomer.id).balance;
  assert(balAfterSession1 === 600, `Balance is 600 coins (500 + 100), got ${balAfterSession1}`);
  console.log(`   ✓ Session 1 completed and 100 coins credited. New balance: ${balAfterSession1}`);

  console.log('\n[TEST A6] Starting Session 2 immediately on same day (Unlimited Sequential Sessions Rule)...');
  res = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/coin-session/start',
    headers: { authorization: `Bearer ${customerToken}` }
  });
  assert(res.statusCode === 200, 'Start Session 2 returned 200');
  assert(res.body.session.status === 'active', 'Session 2 is active');
  assert(res.body.session.id !== session1Id, 'Session 2 has a distinct ID');
  const session2Id = res.body.session.id;
  console.log(`   ✓ Session 2 #${session2Id} started immediately without midnight wait!`);

  console.log('\n[TEST A7] Fast-forward Session 2 and start Session 3 immediately (3rd session on same day)...');
  db.prepare("UPDATE vp52_coin_sessions SET started_at = datetime('now', '-7 hours'), expires_at = datetime('now', '-1 hour') WHERE id = ?").run(session2Id);
  await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/coin-session/complete',
    headers: { authorization: `Bearer ${customerToken}` }
  });
  res = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/coin-session/start',
    headers: { authorization: `Bearer ${customerToken}` }
  });
  assert(res.statusCode === 200, 'Start Session 3 returned 200');
  assert(res.body.session.status === 'active', 'Session 3 is active');
  console.log('   ✓ Session 3 started immediately! Unlimited sequential 6-hour sessions confirmed.');
  console.log('✅ TEST A PASSED: Unlimited sessions & AdMob integration verified.\n');

  // ============================================================
  // TEST B: CUSTOMER COIN SELECTION & REDEMPTION REQUEST
  // ============================================================
  console.log('[TEST B1] Customer selecting 100 coins for redemption...');
  const customerBalanceBefore = db.prepare('SELECT balance FROM wallets WHERE user_id = ?').get(testCustomer.id).balance;
  res = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/redemption/create',
    headers: { authorization: `Bearer ${customerToken}` },
    body: {
      coins_amount: 100,
      merchant_id: testShopA.id
    }
  });
  assert(res.statusCode === 200, 'Create redemption returned 200');
  assert(res.body.redemption.coins_amount === 100, 'Redemption coins amount is 100');
  assert(res.body.redemption.discount_inr === 100, '1 coin = ₹1 discount (₹100 discount)');
  assert(res.body.redemption.secure_token.startsWith('VP52-RED-'), 'Generated secure random token');
  const secureToken = res.body.redemption.secure_token;
  const redemptionId = res.body.redemption.redemption_id;

  // Crucial invariant check: generating the QR must NOT deduct coins!
  const customerBalanceAfterQR = db.prepare('SELECT balance FROM wallets WHERE user_id = ?').get(testCustomer.id).balance;
  assert(customerBalanceAfterQR === customerBalanceBefore, 'Generating QR did NOT deduct coins (balance unchanged)');
  console.log(`   ✓ QR Token generated: ${secureToken}`);
  console.log(`   ✓ Customer balance NOT deducted before scan (${customerBalanceAfterQR} coins preserved).`);

  console.log('\n[TEST B2] Customer checking active pending redemption...');
  res = await mockRequest(app, {
    method: 'GET',
    url: '/api/customer/redemption/active',
    headers: { authorization: `Bearer ${customerToken}` }
  });
  assert(res.statusCode === 200 && res.body.has_active === true, 'Active pending redemption found');
  assert(res.body.redemption.secure_token === secureToken, 'Matching active token returned');
  console.log('   ✓ Customer active redemption query verified.');

  // ============================================================
  // TEST C: MERCHANT SCAN & COLLECT & ATOMIC WALLET TRANSFER
  // ============================================================
  console.log('\n[TEST C1] Merchant scanning customer QR (Lookup & Token Validation)...');
  res = await mockRequest(app, {
    method: 'POST',
    url: '/api/shop/redemption/lookup',
    headers: { authorization: `Bearer ${shopAToken}` },
    body: { secure_token: secureToken }
  });
  assert(res.statusCode === 200, 'Lookup returned 200');
  assert(res.body.redemption.coins_amount === 100, 'Merchant sees 100 coins');
  assert(res.body.redemption.discount_inr === 100, 'Merchant sees ₹100 discount');
  assert(res.body.redemption.customer_name.startsWith('Aarav'), 'Customer privacy-safe identifier displayed');
  console.log('   ✓ Merchant verified customer name, 100 coins, and ₹100 discount.');

  console.log('\n[TEST C2] Merchant confirming collection (Atomic Double-Entry Transfer)...');
  const merchantBalanceBefore = db.prepare('SELECT balance FROM merchant_wallets WHERE shop_id = ?').get(testShopA.id).balance;
  res = await mockRequest(app, {
    method: 'POST',
    url: '/api/shop/redemption/confirm',
    headers: { authorization: `Bearer ${shopAToken}` },
    body: { secure_token: secureToken }
  });
  assert(res.statusCode === 200, 'Confirm returned 200');
  assert(res.body.success === true, 'Confirm reported success');
  assert(res.body.outcome.coinsCollected === 100, '100 coins collected');

  const customerBalanceFinal = db.prepare('SELECT balance FROM wallets WHERE user_id = ?').get(testCustomer.id).balance;
  const merchantBalanceFinal = db.prepare('SELECT balance FROM merchant_wallets WHERE shop_id = ?').get(testShopA.id).balance;

  assert(customerBalanceFinal === customerBalanceBefore - 100, `Customer balance deducted by 100: ${customerBalanceBefore} -> ${customerBalanceFinal}`);
  assert(merchantBalanceFinal === merchantBalanceBefore + 100, `Merchant balance credited by 100: ${merchantBalanceBefore} -> ${merchantBalanceFinal}`);

  console.log(`   ✓ Customer: ${customerBalanceBefore} - 100 = ${customerBalanceFinal} coins`);
  console.log(`   ✓ Merchant: ${merchantBalanceBefore} + 100 = ${merchantBalanceFinal} coins`);
  console.log('   ✓ Zero coin inflation: Customer debit == Merchant credit.');
  console.log('✅ TEST B & C PASSED: Customer coin selection & merchant collection verified.\n');

  // ============================================================
  // TEST D: SECURITY CHECKS & REJECTION GUARDS
  // ============================================================
  console.log('[TEST D1] Re-scanning already-collected QR must be rejected (Anti-replay)...');
  res = await mockRequest(app, {
    method: 'POST',
    url: '/api/shop/redemption/lookup',
    headers: { authorization: `Bearer ${shopAToken}` },
    body: { secure_token: secureToken }
  });
  assert(res.statusCode === 400 && res.body.status === 'completed', 'Rejected already collected token');
  console.log('   ✓ Re-scan rejected with status=completed.');

  console.log('\n[TEST D2] Wrong merchant protection (Restricted shop check)...');
  // Generate a new QR restricted to Shop A
  const resRestricted = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/redemption/create',
    headers: { authorization: `Bearer ${customerToken}` },
    body: { coins_amount: 50, merchant_id: testShopA.id }
  });
  const restrictedToken = resRestricted.body.redemption.secure_token;

  // Attempt scan by Shop B
  res = await mockRequest(app, {
    method: 'POST',
    url: '/api/shop/redemption/lookup',
    headers: { authorization: `Bearer ${shopBToken}` },
    body: { secure_token: restrictedToken }
  });
  assert(res.statusCode === 403, 'Rejected wrong merchant with 403 Forbidden');
  console.log('   ✓ Wrong merchant scan strictly blocked.');

  console.log('\n[TEST D3] Expired QR rejection...');
  db.prepare("UPDATE coin_redemption_requests SET expires_at = datetime('now', '-5 minutes') WHERE secure_token = ?").run(restrictedToken);
  res = await mockRequest(app, {
    method: 'POST',
    url: '/api/shop/redemption/lookup',
    headers: { authorization: `Bearer ${shopAToken}` },
    body: { secure_token: restrictedToken }
  });
  assert(res.statusCode === 400 && res.body.status === 'expired', 'Expired QR rejected');
  console.log('   ✓ Expired QR code rejected.');

  console.log('\n[TEST D4] Cancelled QR rejection...');
  const resCancelReq = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/redemption/create',
    headers: { authorization: `Bearer ${customerToken}` },
    body: { coins_amount: 50 }
  });
  const cancelToken = resCancelReq.body.redemption.secure_token;
  // Customer cancels
  await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/redemption/cancel',
    headers: { authorization: `Bearer ${customerToken}` }
  });
  res = await mockRequest(app, {
    method: 'POST',
    url: '/api/shop/redemption/lookup',
    headers: { authorization: `Bearer ${shopAToken}` },
    body: { secure_token: cancelToken }
  });
  assert(res.statusCode === 400 && res.body.status === 'cancelled', 'Cancelled QR rejected');
  console.log('   ✓ Cancelled QR code rejected.');

  console.log('\n[TEST D5] Insufficient balance request rejection...');
  res = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/redemption/create',
    headers: { authorization: `Bearer ${customerToken}` },
    body: { coins_amount: 999999 }
  });
  assert(res.statusCode === 400, 'Excessive amount rejected');
  console.log('   ✓ Insufficient balance request rejected.');
  console.log('✅ TEST D PASSED: All security guards verified.\n');

  // ============================================================
  // TEST E: MERCHANT WALLET & HISTORY
  // ============================================================
  console.log('[TEST E1] Merchant wallet endpoint...');
  res = await mockRequest(app, {
    method: 'GET',
    url: '/api/shop/wallet',
    headers: { authorization: `Bearer ${shopAToken}` }
  });
  assert(res.statusCode === 200, 'Merchant wallet returned 200');
  assert(res.body.wallet.balance >= 100, 'Merchant wallet balance reflects collected coins');
  assert(res.body.recentTransactions.length > 0, 'Merchant ledger transactions returned');
  console.log(`   ✓ Merchant wallet balance: ${res.body.wallet.balance} coins, transactions: ${res.body.recentTransactions.length}.`);

  console.log('\n[TEST E2] Customer redemption history endpoint...');
  res = await mockRequest(app, {
    method: 'GET',
    url: '/api/customer/redemptions/history',
    headers: { authorization: `Bearer ${customerToken}` }
  });
  assert(res.statusCode === 200, 'Customer redemption history returned 200');
  assert(res.body.redemptions.length > 0, 'Customer redemptions history returned');
  console.log(`   ✓ Customer redemptions history: ${res.body.redemptions.length} records.`);
  console.log('✅ TEST E PASSED: Merchant wallet and customer histories verified.\n');

  console.log('====================================================');
  console.log('🎉 ALL 5 TEST SUITES PASSED (100%)');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
