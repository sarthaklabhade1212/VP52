const express = require('express');
const cors = require('cors');
const http = require('http');
const { Readable, Duplex } = require('stream');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
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
        const rawBody = Buffer.concat(chunks).toString('utf8');
        let parsed = rawBody;
        try { parsed = JSON.parse(rawBody); } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.getHeaders(),
          body: parsed,
          rawBody
        });
      }
      if (cb) cb();
      return this;
    };

    app(req, res, (err) => {
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

function assert(cond, msg) {
  if (!cond) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    throw new Error(msg);
  }
}

async function runTests() {
  console.log('\n====================================================');
  console.log('VP52 PERMANENT MERCHANT QR & COIN TRANSFER TEST SUITE');
  console.log('====================================================\n');

  const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-vp52';

  // 1. Setup Test Admin
  let admin = db.prepare("SELECT * FROM admins WHERE email = 'sanketshinde.vp52@gmail.com'").get();
  if (!admin) {
    admin = db.prepare('SELECT * FROM admins LIMIT 1').get();
  }
  const adminToken = jwt.sign(
    { id: admin.id, email: admin.email, role: 'admin' },
    JWT_SECRET,
    { expiresIn: '1d' }
  );

  // 2. Setup Test Customer A (Balance 500)
  let customerA = db.prepare("SELECT * FROM users WHERE email = 'cust_a@vp52.com'").get();
  if (!customerA) {
    const hash = bcrypt.hashSync('Pass@123', 10);
    const res = db.prepare(`
      INSERT INTO users (full_name, email, password_hash, phone, status, profile_completed)
      VALUES ('Aarav Sharma', 'cust_a@vp52.com', ?, '9870000001', 'active', 1)
    `).run(hash);
    customerA = db.prepare('SELECT * FROM users WHERE id = ?').get(res.lastInsertRowid);
  }
  db.prepare('DELETE FROM wallets WHERE user_id = ?').run(customerA.id);
  db.prepare('INSERT INTO wallets (user_id, balance, total_earned, total_redeemed) VALUES (?, 500, 500, 0)').run(customerA.id);
  db.prepare('DELETE FROM coin_lots WHERE user_id = ?').run(customerA.id);
  const expiry30Days = new Date(Date.now() + 30 * 86400 * 1000).toISOString();
  db.prepare(`
    INSERT INTO coin_lots (user_id, transaction_id, source, coins_earned, coins_remaining, tier, original_amount, expires_at, status)
    VALUES (?, 'LOT-A-500', 'TEST_SETUP', 500, 500, 'Gold', 500, ?, 'ACTIVE')
  `).run(customerA.id, expiry30Days);

  const customerAToken = jwt.sign(
    { id: customerA.id, email: customerA.email, role: 'customer' },
    JWT_SECRET,
    { expiresIn: '1d' }
  );

  // 3. Setup Test Customer B (Balance 300)
  let customerB = db.prepare("SELECT * FROM users WHERE email = 'cust_b@vp52.com'").get();
  if (!customerB) {
    const hash = bcrypt.hashSync('Pass@123', 10);
    const res = db.prepare(`
      INSERT INTO users (full_name, email, password_hash, phone, status, profile_completed)
      VALUES ('Bhavna Patel', 'cust_b@vp52.com', ?, '9870000002', 'active', 1)
    `).run(hash);
    customerB = db.prepare('SELECT * FROM users WHERE id = ?').get(res.lastInsertRowid);
  }
  db.prepare('DELETE FROM wallets WHERE user_id = ?').run(customerB.id);
  db.prepare('INSERT INTO wallets (user_id, balance, total_earned, total_redeemed) VALUES (?, 300, 300, 0)').run(customerB.id);
  db.prepare('DELETE FROM coin_lots WHERE user_id = ?').run(customerB.id);
  db.prepare(`
    INSERT INTO coin_lots (user_id, transaction_id, source, coins_earned, coins_remaining, tier, original_amount, expires_at, status)
    VALUES (?, 'LOT-B-300', 'TEST_SETUP', 300, 300, 'Silver', 300, ?, 'ACTIVE')
  `).run(customerB.id, expiry30Days);

  const customerBToken = jwt.sign(
    { id: customerB.id, email: customerB.email, role: 'customer' },
    JWT_SECRET,
    { expiresIn: '1d' }
  );

  // 4. Setup Test Merchant (Omega Electronics)
  let shop = db.prepare("SELECT * FROM shops WHERE email = 'omega@vp52.com'").get();
  if (!shop) {
    const hash = bcrypt.hashSync('ShopPass@123', 10);
    const res = db.prepare(`
      INSERT INTO shops (shop_code, email, password_hash, name, category, address, phone, status, verification_status, latitude, longitude)
      VALUES ('SHOP-OMEGA', 'omega@vp52.com', ?, 'Omega Electronics', 'Electronics', 'FC Road, Pune', '9876599999', 'active', 'approved', 18.5204, 73.8567)
    `).run(hash);
    shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(res.lastInsertRowid);
  }

  // Ensure clean test state for shop & customers
  db.prepare('DELETE FROM coin_transfers WHERE merchant_id = ?').run(shop.id);
  db.prepare('DELETE FROM merchant_coin_ledger WHERE shop_id = ?').run(shop.id);
  db.prepare('DELETE FROM merchant_notifications WHERE shop_id = ?').run(shop.id);
  db.prepare('DELETE FROM merchant_wallets WHERE shop_id = ?').run(shop.id);
  db.prepare('INSERT INTO merchant_wallets (shop_id, balance, total_received, total_spent) VALUES (?, 0, 0, 0)').run(shop.id);

  const shopToken = jwt.sign(
    { id: shop.id, email: shop.email, role: 'shop', shop_id: shop.id },
    JWT_SECRET,
    { expiresIn: '1d' }
  );

  // ============================================================
  // TEST SECTION 1: MERCHANT RETRIEVES PERMANENT QR & POSTER
  // ============================================================
  console.log('[TEST 1] Merchant fetching permanent QR data via GET /api/shop/my-qr...');
  let res = await mockRequest(app, {
    method: 'GET',
    url: '/api/shop/my-qr',
    headers: { authorization: `Bearer ${shopToken}` }
  });
  assert(res.statusCode === 200, 'My QR returns 200');
  assert(res.body.success === true, 'success true');
  assert(res.body.shop.permanent_qr_code.startsWith('VP52-MCH-'), 'QR code starts with VP52-MCH-');
  assert(res.body.shop.qr_string.startsWith('VP52:MERCHANT:'), 'qr_string is formatted as VP52:MERCHANT:...');
  assert(res.body.shop.qr_status === 'active', 'QR status is active');
  assert(res.body.shop.is_active === true, 'is_active is true');

  const merchantQrCode = res.body.shop.permanent_qr_code;
  const qrString = res.body.shop.qr_string;
  console.log(`   ✓ Merchant permanent QR: ${merchantQrCode}`);
  console.log(`   ✓ Merchant printable QR string: ${qrString}`);

  // ============================================================
  // TEST SECTION 2: CUSTOMER LOOKUP OF MERCHANT QR
  // ============================================================
  console.log('\n[TEST 2] Customer A scanning merchant permanent QR (Lookup API)...');
  res = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/merchant-qr/lookup',
    headers: { authorization: `Bearer ${customerAToken}` },
    body: { qr_code: qrString }
  });
  assert(res.statusCode === 200, 'QR lookup returns 200');
  assert(res.body.success === true, 'lookup success true');
  assert(res.body.merchant.name === 'Omega Electronics', 'merchant name matches');
  assert(res.body.merchant.category === 'Electronics', 'category matches');
  assert(res.body.merchant.verification_status === 'approved', 'merchant is approved');
  assert(res.body.customer_balance === 500, 'customer balance is 500');
  console.log(`   ✓ Verified merchant: "${res.body.merchant.name}", Customer Balance: ${res.body.customer_balance} coins`);

  // Lookup also accepts raw QR code string without prefix
  res = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/merchant-qr/lookup',
    headers: { authorization: `Bearer ${customerAToken}` },
    body: { qr_code: merchantQrCode }
  });
  assert(res.statusCode === 200, 'Raw QR lookup returns 200');
  console.log('   ✓ Raw QR code format also accepted.');

  // ============================================================
  // TEST SECTION 3: CUSTOMER A PAYS 100 COINS TO MERCHANT
  // ============================================================
  console.log('\n[TEST 3] Customer A paying 100 coins (₹100 discount) to Omega Electronics...');
  const txIdempotencyA = 'IDEMP-TEST-A-' + Date.now();
  res = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/merchant-qr/pay',
    headers: { authorization: `Bearer ${customerAToken}` },
    body: {
      qr_code: qrString,
      coins_amount: 100,
      idempotency_key: txIdempotencyA
    }
  });
  assert(res.statusCode === 200, 'Payment returns 200');
  assert(res.body.success === true, 'Payment success');
  assert(res.body.transfer.coins_amount === 100, 'coins amount is 100');
  assert(res.body.transfer.discount_inr === 100, '1 coin = ₹1 discount');
  assert(res.body.transfer.customer_balance_after === 400, 'Customer balance after is 400');
  assert(res.body.transfer.status === 'COMPLETED', 'status is COMPLETED');

  const transferIdA = res.body.transfer.transfer_id;
  console.log(`   ✓ Transfer Success! TxID: ${transferIdA}`);
  console.log(`   ✓ Customer A Balance: 500 -> ${res.body.transfer.customer_balance_after}`);

  // Check Merchant Wallet in DB
  let merchWallet = db.prepare('SELECT balance, total_received FROM merchant_wallets WHERE shop_id = ?').get(shop.id);
  assert(merchWallet.balance === 100, 'Merchant wallet balance is 100');
  assert(merchWallet.total_received === 100, 'Merchant total_received is 100');
  console.log(`   ✓ Merchant Wallet Balance: 0 -> ${merchWallet.balance} coins`);

  // Check Merchant In-App Notification
  let notifs = db.prepare('SELECT * FROM merchant_notifications WHERE shop_id = ? ORDER BY id DESC').all(shop.id);
  assert(notifs.length >= 1, 'Merchant received notification');
  assert(notifs[0].title === 'VP52 COINS RECEIVED', 'Notification title is VP52 COINS RECEIVED');
  assert(notifs[0].message.includes('100 coins'), 'Notification message mentions 100 coins');
  console.log(`   ✓ Merchant in-app notification delivered: "${notifs[0].message}"`);

  // ============================================================
  // TEST SECTION 4: IDEMPOTENCY SAFETY (RE-SENDING SAME REQUEST)
  // ============================================================
  console.log('\n[TEST 4] Testing idempotency safety: resending same payment request with same idempotency_key...');
  res = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/merchant-qr/pay',
    headers: { authorization: `Bearer ${customerAToken}` },
    body: {
      qr_code: qrString,
      coins_amount: 100,
      idempotency_key: txIdempotencyA
    }
  });
  assert(res.statusCode === 200, 'Idempotent call returns 200');
  assert(res.body.transfer.transfer_id === transferIdA, 'Returns same transfer ID');
  // Check balances were NOT deducted twice
  let custWalletA = db.prepare('SELECT balance FROM wallets WHERE user_id = ?').get(customerA.id);
  merchWallet = db.prepare('SELECT balance FROM merchant_wallets WHERE shop_id = ?').get(shop.id);
  assert(custWalletA.balance === 400, 'Customer balance strictly preserved at 400');
  assert(merchWallet.balance === 100, 'Merchant balance strictly preserved at 100');
  console.log('   ✓ Idempotency protected: duplicate payment prevented, balances unchanged.');

  // ============================================================
  // TEST SECTION 5: SAME STATIC QR WORKS FOR MULTIPLE CUSTOMERS
  // ============================================================
  console.log('\n[TEST 5] Testing static QR reusability: Customer B pays 50 coins to same QR...');
  res = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/merchant-qr/pay',
    headers: { authorization: `Bearer ${customerBToken}` },
    body: {
      qr_code: qrString,
      coins_amount: 50
    }
  });
  assert(res.statusCode === 200, 'Customer B payment 200');
  assert(res.body.transfer.customer_balance_after === 250, 'Customer B balance 300 -> 250');
  merchWallet = db.prepare('SELECT balance, total_received FROM merchant_wallets WHERE shop_id = ?').get(shop.id);
  assert(merchWallet.balance === 150, 'Merchant balance 100 -> 150');
  console.log(`   ✓ Customer B paid 50 coins. Merchant balance now: ${merchWallet.balance} coins.`);

  // ============================================================
  // TEST SECTION 6: SAME STATIC QR WORKS FOR MULTIPLE TRANSACTIONS
  // ============================================================
  console.log('\n[TEST 6] Customer A makes a second sequential payment of 75 coins to same QR...');
  res = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/merchant-qr/pay',
    headers: { authorization: `Bearer ${customerAToken}` },
    body: {
      qr_code: qrString,
      coins_amount: 75
    }
  });
  assert(res.statusCode === 200, 'Customer A 2nd payment 200');
  assert(res.body.transfer.customer_balance_after === 325, 'Customer A balance 400 -> 325');
  merchWallet = db.prepare('SELECT balance, total_received FROM merchant_wallets WHERE shop_id = ?').get(shop.id);
  assert(merchWallet.balance === 225, 'Merchant balance 150 -> 225');
  console.log(`   ✓ Customer A 2nd payment: 75 coins transferred. Merchant balance: ${merchWallet.balance} coins.`);

  // ============================================================
  // TEST SECTION 7: MERCHANT SEES WALLET & HISTORY
  // ============================================================
  console.log('\n[TEST 7] Merchant fetching wallet & transactions via GET /api/shop/wallet...');
  res = await mockRequest(app, {
    method: 'GET',
    url: '/api/shop/wallet',
    headers: { authorization: `Bearer ${shopToken}` }
  });
  assert(res.statusCode === 200, 'Shop wallet 200');
  assert(res.body.wallet.balance === 225, 'Wallet balance is 225');
  assert(res.body.wallet.total_received === 225, 'Total received is 225');
  assert(res.body.recentTransactions.length >= 3, 'At least 3 recent transactions');
  console.log(`   ✓ Merchant wallet verified: Balance ${res.body.wallet.balance}, Transactions: ${res.body.recentTransactions.length}`);

  // Fetch Merchant Notifications API
  res = await mockRequest(app, {
    method: 'GET',
    url: '/api/shop/notifications',
    headers: { authorization: `Bearer ${shopToken}` }
  });
  assert(res.statusCode === 200, 'Shop notifications 200');
  assert(res.body.unread_count >= 3, 'Unread count >= 3');
  console.log(`   ✓ Merchant notifications API returned ${res.body.notifications.length} alerts.`);

  // ============================================================
  // TEST SECTION 8: CUSTOMER PAYMENT HISTORY
  // ============================================================
  console.log('\n[TEST 8] Customer A fetching merchant transfer receipts...');
  res = await mockRequest(app, {
    method: 'GET',
    url: '/api/customer/merchant-qr/transfers',
    headers: { authorization: `Bearer ${customerAToken}` }
  });
  assert(res.statusCode === 200, 'Customer transfers 200');
  assert(res.body.transfers.length >= 2, 'Customer A has at least 2 transfers');
  assert(res.body.transfers[0].merchant_name === 'Omega Electronics', 'Merchant name present');
  console.log(`   ✓ Customer A transfer history: ${res.body.transfers.length} records found with receipt metadata.`);

  // ============================================================
  // TEST SECTION 9: SECURITY GUARDS & BOUNDARY VALIDATION
  // ============================================================
  console.log('\n[TEST 9] Security Guard: Overdraft / Insufficient balance rejection...');
  res = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/merchant-qr/pay',
    headers: { authorization: `Bearer ${customerAToken}` },
    body: {
      qr_code: qrString,
      coins_amount: 99999
    }
  });
  assert(res.statusCode === 400, 'Overdraft returns 400');
  console.log('   ✓ Overdraft strictly blocked.');

  console.log('\n[TEST 10] Security Guard: Negative, Zero, or Decimal coin amounts rejection...');
  res = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/merchant-qr/pay',
    headers: { authorization: `Bearer ${customerAToken}` },
    body: { qr_code: qrString, coins_amount: -50 }
  });
  assert(res.statusCode === 400, 'Negative amount returns 400');

  res = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/merchant-qr/pay',
    headers: { authorization: `Bearer ${customerAToken}` },
    body: { qr_code: qrString, coins_amount: 0 }
  });
  assert(res.statusCode === 400, 'Zero amount returns 400');

  res = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/merchant-qr/pay',
    headers: { authorization: `Bearer ${customerAToken}` },
    body: { qr_code: qrString, coins_amount: 25.5 }
  });
  assert(res.statusCode === 400, 'Decimal amount returns 400');
  console.log('   ✓ Non-positive and decimal coin amounts strictly rejected.');

  console.log('\n[TEST 11] Security Guard: Invalid / Fake QR rejection...');
  res = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/merchant-qr/lookup',
    headers: { authorization: `Bearer ${customerAToken}` },
    body: { qr_code: 'VP52:MERCHANT:FAKE-QR-NON-EXISTENT' }
  });
  assert(res.statusCode === 404, 'Fake QR lookup returns 404');
  console.log('   ✓ Non-existent QR rejected.');

  // ============================================================
  // TEST SECTION 10: ADMIN SUSPEND / REVOKE / REGENERATE QR
  // ============================================================
  console.log('\n[TEST 12] Admin checking merchant QR list via GET /api/admin/merchants/qr...');
  res = await mockRequest(app, {
    method: 'GET',
    url: '/api/admin/merchants/qr',
    headers: { authorization: `Bearer ${adminToken}` }
  });
  assert(res.statusCode === 200, 'Admin merchants QR returns 200');
  assert(Array.isArray(res.body.merchants), 'merchants is array');
  const foundOmega = res.body.merchants.find(m => m.id === shop.id);
  assert(foundOmega && foundOmega.permanent_qr_code === merchantQrCode, 'Omega QR listed in admin');
  console.log(`   ✓ Admin QR Directory: ${res.body.merchants.length} merchants listed.`);

  console.log('\n[TEST 13] Admin suspending merchant QR (e.g. security hold)...');
  res = await mockRequest(app, {
    method: 'POST',
    url: `/api/admin/merchants/${shop.id}/qr/status`,
    headers: { authorization: `Bearer ${adminToken}` },
    body: { status: 'suspended', reason: 'Security investigation' }
  });
  assert(res.statusCode === 200, 'QR suspension 200');

  // Customer attempts lookup or payment with suspended QR
  res = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/merchant-qr/lookup',
    headers: { authorization: `Bearer ${customerAToken}` },
    body: { qr_code: qrString }
  });
  assert(res.statusCode === 403, 'Suspended QR lookup returns 403');

  res = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/merchant-qr/pay',
    headers: { authorization: `Bearer ${customerAToken}` },
    body: { qr_code: qrString, coins_amount: 10 }
  });
  assert(res.statusCode === 403, 'Suspended QR pay returns 403');
  console.log('   ✓ Suspended merchant QR strictly blocked from lookup and payments.');

  console.log('\n[TEST 14] Admin reactivating merchant QR...');
  res = await mockRequest(app, {
    method: 'POST',
    url: `/api/admin/merchants/${shop.id}/qr/status`,
    headers: { authorization: `Bearer ${adminToken}` },
    body: { status: 'active', reason: 'Investigation cleared' }
  });
  assert(res.statusCode === 200, 'QR reactivation 200');
  console.log('   ✓ Merchant QR reactivated.');

  console.log('\n[TEST 15] Admin regenerating merchant QR (Audited replacement)...');
  res = await mockRequest(app, {
    method: 'POST',
    url: `/api/admin/merchants/${shop.id}/qr/regenerate`,
    headers: { authorization: `Bearer ${adminToken}` },
    body: { reason: 'Merchant counter poster physically replaced' }
  });
  if (res.statusCode !== 200) console.log('Regenerate error body:', res.statusCode, res.body);
  assert(res.statusCode === 200, 'QR regeneration 200');
  assert(res.body.permanent_qr_code !== merchantQrCode, 'New QR code differs from old QR');
  const newQrCode = res.body.permanent_qr_code;
  console.log(`   ✓ New Permanent QR generated: ${newQrCode}`);

  // Old QR must be rejected
  res = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/merchant-qr/lookup',
    headers: { authorization: `Bearer ${customerAToken}` },
    body: { qr_code: merchantQrCode }
  });
  assert(res.statusCode === 403, 'Old revoked QR is rejected');
  console.log('   ✓ Old revoked QR is blocked.');

  // New QR works for payment
  res = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/merchant-qr/pay',
    headers: { authorization: `Bearer ${customerAToken}` },
    body: { qr_code: newQrCode, coins_amount: 25 }
  });
  assert(res.statusCode === 200, 'New QR accepts payment');
  console.log('   ✓ New permanent QR accepts payments.');

  // Verify historical records remain untouched
  const histTransfers = db.prepare('SELECT COUNT(*) AS c FROM coin_transfers WHERE merchant_id = ?').get(shop.id);
  assert(histTransfers.c >= 4, 'All historical transfers remain intact');
  console.log(`   ✓ Historical integrity preserved: ${histTransfers.c} total transfers in ledger.`);

  // ============================================================
  // TEST SECTION 11: ZERO COIN INFLATION INVARIANT
  // ============================================================
  console.log('\n[TEST 16] Auditing double-entry balance conservation (Zero Coin Inflation)...');
  const allTransfers = db.prepare('SELECT SUM(coins_amount) AS s FROM coin_transfers WHERE merchant_id = ?').get(shop.id);
  const merchLedger = db.prepare("SELECT SUM(coins) AS s FROM merchant_coin_ledger WHERE shop_id = ? AND type = 'CUSTOMER_REDEMPTION'").get(shop.id);
  assert(allTransfers.s === merchLedger.s, 'Transfers sum matches merchant ledger sum');
  console.log(`   ✓ Double-entry equality verified: ₹${allTransfers.s} debited from customers == ₹${merchLedger.s} credited to merchant.`);

  console.log('\n====================================================');
  console.log('🎉 ALL 16 PERMANENT MERCHANT QR TESTS PASSED (100%)');
  console.log('====================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
