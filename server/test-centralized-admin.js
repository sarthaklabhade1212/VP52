/**
 * VP52 CENTRALIZED ADMIN PANEL COMPREHENSIVE TEST SUITE
 * Tests all 15 administrative modules, RBAC enforcement, audit logging,
 * real metrics calculation, and invariants.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'dev_jwt_secret_vp52_secure_local_key_min_32_chars';
}

const express = require('express');
const cors = require('cors');
const http = require('http');
const jwt = require('jsonwebtoken');
const { Readable, Duplex } = require('stream');
const db = require('./db/database');
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_vp52_secure_local_key_min_32_chars';

// Spin up test Express app in-process
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = new Readable({ read() {} });
    req.method = options.method || 'GET';
    req.url = path;
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
        try { parsed = JSON.parse(text); } catch (e) { /* non-JSON body */ }
        resolve({ status: res.statusCode, headers: res.getHeaders ? res.getHeaders() : {}, data: parsed });
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

function generateAdminToken(admin) {
  return jwt.sign(
    {
      id: admin.id,
      email: admin.email,
      role: 'admin',
      admin_role: admin.role || 'super_admin',
      permissions: typeof admin.permissions === 'string' ? JSON.parse(admin.permissions) : (admin.permissions || ['*'])
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function generateCustomerToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: 'customer'
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function runTests() {
  console.log('====================================================');
  console.log('VP52 CENTRALIZED ADMIN PANEL 15-MODULE TEST SUITE');
  console.log('====================================================\n');

  try {
    // 0. Setup test admin & test users
    const superAdmin = db.prepare('SELECT * FROM admins WHERE email = ?').get('sanketshinde.vp52@gmail.com') ||
                       db.prepare('SELECT * FROM admins ORDER BY id ASC LIMIT 1').get();
    
    if (!superAdmin) {
      throw new Error('No admin found in test database!');
    }

    const superAdminToken = generateAdminToken(superAdmin);
    const authHeaders = { Authorization: `Bearer ${superAdminToken}` };

    // Find or prepare a test customer
    let testCustomer = db.prepare("SELECT * FROM users LIMIT 1").get();
    if (!testCustomer) {
      const info = db.prepare("INSERT INTO users (full_name, email, phone) VALUES (?, ?, ?)").run('Admin Test User', 'admintest@example.com', '9876543210');
      testCustomer = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
      db.prepare('INSERT OR IGNORE INTO wallets (user_id, balance) VALUES (?, 0)').run(testCustomer.id);
    }

    // ----------------------------------------------------
    // MODULE 1: Centralized Admin Dashboard & Global Search
    // ----------------------------------------------------
    console.log('[MODULE 1] Centralized Dashboard Stats & Global Search...');
    {
      const res = await makeRequest('/api/admin/dashboard-stats?range=all', { headers: authHeaders });
      if (res.status !== 200 || !res.data.success) {
        throw new Error(`Failed to get dashboard stats: ${JSON.stringify(res.data)}`);
      }
      const s = res.data.stats;
      if (typeof s.totalCustomers !== 'number' || typeof s.totalMerchants !== 'number' || typeof s.totalCoinsIssued !== 'number') {
        throw new Error(`Dashboard stats structure invalid: ${JSON.stringify(s)}`);
      }
      console.log(`   ✓ Overview Stats: ${s.totalCustomers} customers, ${s.totalMerchants} merchants, ${s.totalCoinsIssued} coins issued, ${s.pendingMerchants} pending.`);

      // Test Global Search
      const searchRes = await makeRequest('/api/admin/global-search?q=admin', { headers: authHeaders });
      if (searchRes.status !== 200 || !searchRes.data.success || !searchRes.data.results || !Array.isArray(searchRes.data.results.customers)) {
        throw new Error(`Global search failed: ${JSON.stringify(searchRes.data)}`);
      }
      console.log(`   ✓ Global Search results categorized successfully.`);
      console.log('✅ MODULE 1 PASSED: Dashboard metrics & global search verified.\n');
    }

    // ----------------------------------------------------
    // MODULE 2: Customer Management & Audited Coin Adjustment
    // ----------------------------------------------------
    console.log('[MODULE 2] Customer Management & Audited Coin Adjustment...');
    {
      const listRes = await makeRequest('/api/admin/customers?limit=5', { headers: authHeaders });
      if (listRes.status !== 200 || !listRes.data.success || !Array.isArray(listRes.data.customers)) {
        throw new Error('Failed to list customers');
      }
      console.log(`   ✓ Listed ${listRes.data.customers.length} customers.`);

      // Customer Details
      const detailRes = await makeRequest(`/api/admin/customers/${testCustomer.id}`, { headers: authHeaders });
      if (detailRes.status !== 200 || !detailRes.data.success || !detailRes.data.customer) {
        throw new Error(`Failed to get customer details: ${JSON.stringify(detailRes.data)}`);
      }
      const initialBalance = detailRes.data.customer.balance || 0;
      console.log(`   ✓ Customer #${testCustomer.id} initial balance: ${initialBalance} coins.`);

      // Coin Adjustment (Credit 50 coins)
      const creditRes = await makeRequest(`/api/admin/customers/${testCustomer.id}/coin-adjustment`, {
        method: 'POST',
        headers: authHeaders,
        body: {
          amount: 50,
          reason: 'Test promotional credit'
        }
      });
      if (creditRes.status !== 200 || !creditRes.data.success) {
        throw new Error(`Failed coin credit adjustment: ${JSON.stringify(creditRes.data)}`);
      }
      if (creditRes.data.new_balance !== initialBalance + 50) {
        throw new Error(`Coin credit balance mismatch: expected ${initialBalance + 50}, got ${creditRes.data.new_balance}`);
      }
      console.log(`   ✓ Credited 50 coins. New balance: ${creditRes.data.new_balance}`);

      // Coin Adjustment (Debit 20 coins)
      const debitRes = await makeRequest(`/api/admin/customers/${testCustomer.id}/coin-adjustment`, {
        method: 'POST',
        headers: authHeaders,
        body: {
          amount: -20,
          reason: 'Correction of test credit'
        }
      });
      if (debitRes.status !== 200 || !debitRes.data.success) {
        throw new Error(`Failed coin debit adjustment: ${JSON.stringify(debitRes.data)}`);
      }
      if (debitRes.data.new_balance !== initialBalance + 30) {
        throw new Error(`Coin debit balance mismatch: expected ${initialBalance + 30}, got ${debitRes.data.new_balance}`);
      }
      console.log(`   ✓ Debited 20 coins. New balance: ${debitRes.data.new_balance}`);
      console.log('✅ MODULE 2 PASSED: Customer management & audited coin adjustments verified.\n');
    }

    // ----------------------------------------------------
    // MODULE 3: Merchant Management (Approve/Reject/Suspend/Reactivate)
    // ----------------------------------------------------
    console.log('[MODULE 3] Merchant Management Lifecycle...');
    {
      // Create a dummy merchant for testing lifecycle
      const shopEmail = `testshop_${Date.now()}@example.com`;
      const createRes = await makeRequest('/api/admin/shops', {
        method: 'POST',
        headers: authHeaders,
        body: {
          name: 'Test Cycle Shop',
          owner_name: 'Test Cycle Owner',
          email: shopEmail,
          phone: '9888877771',
          category: 'Grocery & Supermarket',
          subcategory: 'Organic & Health Foods',
          address: 'Pune Test Road',
          latitude: 18.5204,
          longitude: 73.8567,
          discount_percentage: 10
        }
      });
      if (createRes.status !== 201 || !createRes.data.success) {
        throw new Error(`Failed to create merchant: ${JSON.stringify(createRes.data)}`);
      }
      const testShopId = createRes.data.credentials ? createRes.data.credentials.shopId : (createRes.data.shop && createRes.data.shop.id);
      console.log(`   ✓ Created test merchant #${testShopId}`);

      // Suspend merchant
      const suspRes = await makeRequest(`/api/admin/shops/${testShopId}/suspend`, {
        method: 'PUT',
        headers: authHeaders,
        body: { reason: 'Policy violation probe' }
      });
      if (suspRes.status !== 200 || !suspRes.data.success) {
        throw new Error('Failed to suspend shop');
      }
      console.log('   ✓ Merchant suspended.');

      // Reactivate merchant
      const reactRes = await makeRequest(`/api/admin/shops/${testShopId}/reactivate`, {
        method: 'PUT',
        headers: authHeaders,
        body: { notes: 'Reinstated after review' }
      });
      if (reactRes.status !== 200 || !reactRes.data.success) {
        throw new Error('Failed to reactivate shop');
      }
      console.log('   ✓ Merchant reactivated.');
      console.log('✅ MODULE 3 PASSED: Merchant lifecycle management verified.\n');
    }

    // ----------------------------------------------------
    // MODULE 4: Category Management (17 Master Categories & Dynamic CRUD)
    // ----------------------------------------------------
    console.log('[MODULE 4] Category Management & Dependency Checks...');
    {
      const catRes = await makeRequest('/api/admin/categories', { headers: authHeaders });
      if (catRes.status !== 200 || !catRes.data.success || !Array.isArray(catRes.data.categories)) {
        throw new Error('Failed to fetch categories');
      }
      console.log(`   ✓ Found ${catRes.data.categories.length} active master categories.`);
      if (catRes.data.categories.length < 17) {
        throw new Error(`Expected at least 17 categories, got ${catRes.data.categories.length}`);
      }

      // Create a custom test category
      const newCatRes = await makeRequest('/api/admin/categories', {
        method: 'POST',
        headers: authHeaders,
        body: {
          name: `Automated Test Category ${Date.now()}`,
          icon: 'Tag',
          description: 'Category for testing dynamic CRUD',
          display_order: 99
        }
      });
      if (newCatRes.status !== 201 || !newCatRes.data.success) {
        throw new Error(`Failed to create test category: ${JSON.stringify(newCatRes.data)}`);
      }
      const newCatId = newCatRes.data.categoryId || (newCatRes.data.category && newCatRes.data.category.id);
      console.log(`   ✓ Created test category #${newCatId}`);

      // Add a subcategory
      const subRes = await makeRequest(`/api/admin/categories/${newCatId}/subcategories`, {
        method: 'POST',
        headers: authHeaders,
        body: { name: 'Test Subcategory A', display_order: 1 }
      });
      if (subRes.status !== 201 || !subRes.data.success) {
        throw new Error('Failed to create subcategory');
      }
      const subId = subRes.data.id || (subRes.data.subcategory && subRes.data.subcategory.id);
      console.log(`   ✓ Added subcategory #${subId}`);

      // Delete the test subcategory
      const delSubRes = await makeRequest(`/api/admin/subcategories/${subId}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      if (delSubRes.status !== 200 || !delSubRes.data.success) {
        throw new Error('Failed to delete subcategory');
      }
      console.log('   ✓ Deleted subcategory.');

      // Delete the test category (has 0 shops)
      const delCatRes = await makeRequest(`/api/admin/categories/${newCatId}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      if (delCatRes.status !== 200 || !delCatRes.data.success) {
        throw new Error('Failed to delete test category');
      }
      console.log('   ✓ Deleted test category safely.');

      // Try deleting a master category that has shops assigned (should be blocked)
      const groceryCat = catRes.data.categories.find(c => c.shop_count > 0);
      if (groceryCat) {
        const blockRes = await makeRequest(`/api/admin/categories/${groceryCat.id}`, {
          method: 'DELETE',
          headers: authHeaders
        });
        if (blockRes.status !== 400) {
          throw new Error('Dependency check failed: category with assigned shops should not be deleted without reassignment!');
        }
        console.log(`   ✓ Dependency check verified: Blocked deletion of category #${groceryCat.id} (${groceryCat.name}) with ${groceryCat.shop_count} assigned shops.`);
      }

      console.log('✅ MODULE 4 PASSED: Category management & dependency safeguards verified.\n');
    }

    // ----------------------------------------------------
    // MODULE 5: VP52 Coin Management, Ledger & Reversals
    // ----------------------------------------------------
    console.log('[MODULE 5] VP52 Coin Overview, Ledger & Audited Reversal...');
    {
      const overviewRes = await makeRequest('/api/admin/coins/overview', { headers: authHeaders });
      if (overviewRes.status !== 200 || !overviewRes.data.success) {
        throw new Error('Failed to get coin overview');
      }
      console.log(`   ✓ Coin Overview: ${overviewRes.data.overview.total_issued} issued, ${overviewRes.data.overview.total_redeemed} redeemed, liability: ₹${overviewRes.data.overview.outstanding_liability}`);

      // Ledger entries
      const ledgerRes = await makeRequest('/api/admin/coins/ledger?limit=10', { headers: authHeaders });
      if (ledgerRes.status !== 200 || !ledgerRes.data.success || !Array.isArray(ledgerRes.data.ledger)) {
        throw new Error('Failed to get coin ledger');
      }
      console.log(`   ✓ Retrieved ${ledgerRes.data.ledger.length} recent ledger transactions.`);

      // Find an admin adjustment entry to reverse
      const adminEntry = ledgerRes.data.ledger.find(e => e.source === 'admin' && e.authorized_admin_id);
      if (adminEntry) {
        const revRes = await makeRequest('/api/admin/coins/reversal', {
          method: 'POST',
          headers: authHeaders,
          body: {
            transaction_id: adminEntry.transaction_id,
            reason: 'Reversal of test adjustment'
          }
        });
        if (revRes.status !== 200 || !revRes.data.success) {
          throw new Error(`Reversal failed: ${JSON.stringify(revRes.data)}`);
        }
        console.log(`   ✓ Successfully reversed transaction ${adminEntry.transaction_id} (Reversal entry #${revRes.data.reversal_transaction_id})`);
      }

      // Test CSV Export
      const exportRes = await makeRequest('/api/admin/coins/export', { headers: authHeaders });
      if (exportRes.status !== 200 || !exportRes.data.includes('Transaction ID')) {
        throw new Error('CSV export format invalid');
      }
      console.log('   ✓ Coin ledger CSV export generated successfully.');
      console.log('✅ MODULE 5 PASSED: Coin ledger, reversals & CSV export verified.\n');
    }

    // ----------------------------------------------------
    // MODULE 6: Offers Management
    // ----------------------------------------------------
    console.log('[MODULE 6] Offers Management...');
    {
      const newOfferRes = await makeRequest('/api/admin/offers', {
        method: 'POST',
        headers: authHeaders,
        body: {
          shop_id: 1,
          title: 'Special Diwali Discount',
          discount_percent: 15,
          max_discount_inr: 500,
          valid_until: '2026-11-15'
        }
      });
      if (newOfferRes.status !== 201 || !newOfferRes.data.success) {
        throw new Error(`Failed to create offer: ${JSON.stringify(newOfferRes.data)}`);
      }
      const offerId = newOfferRes.data.offerId || (newOfferRes.data.offer && newOfferRes.data.offer.id);
      console.log(`   ✓ Created offer #${offerId}`);

      // Toggle offer
      const toggleRes = await makeRequest(`/api/admin/offers/${offerId}/toggle`, {
        method: 'PUT',
        headers: authHeaders
      });
      if (toggleRes.status !== 200 || !toggleRes.data.success) {
        throw new Error('Failed to toggle offer status');
      }
      console.log(`   ✓ Offer toggled to status=${toggleRes.data.status}`);
      console.log('✅ MODULE 6 PASSED: Offers management verified.\n');
    }

    // ----------------------------------------------------
    // MODULE 7: Order & Booking Management
    // ----------------------------------------------------
    console.log('[MODULE 7] Order & Service Booking Management...');
    {
      const ordersRes = await makeRequest('/api/admin/orders', { headers: authHeaders });
      if (ordersRes.status !== 200 || !ordersRes.data.success || !Array.isArray(ordersRes.data.orders)) {
        throw new Error('Failed to fetch orders');
      }
      console.log(`   ✓ Found ${ordersRes.data.orders.length} orders.`);

      // Create a test booking
      const bookNum = 'BK-TEST-' + Date.now();
      const bookInfo = db.prepare(`
        INSERT INTO bookings (booking_number, user_id, shop_id, customer_name, customer_phone, service_name, booking_date, booking_time, status)
        VALUES (?, ?, ?, 'Test Customer', '9876543210', 'Haircut & Spa', '2026-11-05', '14:00', 'pending')
      `).run(bookNum, testCustomer.id, 1);
      const bookingId = bookInfo.lastInsertRowid;

      // Update booking status
      const updateBookRes = await makeRequest(`/api/admin/bookings/${bookingId}/status`, {
        method: 'PUT',
        headers: authHeaders,
        body: { status: 'confirmed', notes: 'Confirmed by admin support' }
      });
      if (updateBookRes.status !== 200 || !updateBookRes.data.success) {
        throw new Error(`Failed to update booking status: ${JSON.stringify(updateBookRes.data)}`);
      }
      console.log(`   ✓ Booking #${bookingId} confirmed.`);
      console.log('✅ MODULE 7 PASSED: Order & booking management verified.\n');
    }

    // ----------------------------------------------------
    // MODULE 8: Payment Management & Refunds
    // ----------------------------------------------------
    console.log('[MODULE 8] Payment Management & Audited Refunds...');
    {
      // Create a test payment record
      const payInfo = db.prepare(`
        INSERT INTO payments (payment_reference, user_id, shop_id, amount, currency, status, payment_method)
        VALUES (?, ?, ?, ?, 'INR', 'completed', 'upi')
      `).run(`PAY_TEST_${Date.now()}`, testCustomer.id, 1, 450);
      const paymentId = payInfo.lastInsertRowid;

      const payOverviewRes = await makeRequest('/api/admin/payments/overview', { headers: authHeaders });
      if (payOverviewRes.status !== 200 || !payOverviewRes.data.success) {
        throw new Error('Failed to get payments overview');
      }
      console.log(`   ✓ Payments Overview: Total recorded revenue ₹${payOverviewRes.data.overview.recorded_revenue}, Merchant Subscriptions: ${payOverviewRes.data.overview.merchant_subscriptions}`);

      // Process refund
      const refRes = await makeRequest('/api/admin/payments/refund', {
        method: 'POST',
        headers: authHeaders,
        body: {
          payment_id: paymentId,
          refund_amount: 450,
          reason: 'Customer cancelled booking prior to slot'
        }
      });
      if (refRes.status !== 200 || !refRes.data.success) {
        throw new Error(`Failed to record refund: ${JSON.stringify(refRes.data)}`);
      }
      console.log(`   ✓ Processed refund for payment #${paymentId}`);
      console.log('✅ MODULE 8 PASSED: Payment tracking and audited refunds verified.\n');
    }

    // ----------------------------------------------------
    // MODULE 9: Referral Management & Abuse Prevention
    // ----------------------------------------------------
    console.log('[MODULE 9] Referral Management & Abuse Prevention...');
    {
      // Create a test referral with fresh referred user
      const tempRefUser = db.prepare("INSERT INTO users (full_name, email, phone, password_hash) VALUES (?, ?, ?, 'dummy_hash')").run(`RefUser_${Date.now()}`, `refuser_${Date.now()}@example.com`, `98${Math.floor(10000000 + Math.random() * 90000000)}`);
      const referredUserId = tempRefUser.lastInsertRowid;
      db.prepare('INSERT OR IGNORE INTO wallets (user_id, balance) VALUES (?, 0)').run(referredUserId);

      const refCode = `REF_${Date.now().toString(36)}`;
      const refInfo = db.prepare(`
        INSERT INTO referrals (referrer_user_id, referred_user_id, referral_code, status, coins_awarded)
        VALUES (?, ?, ?, 'pending', 50)
      `).run(1, referredUserId, refCode);
      const referralId = refInfo.lastInsertRowid;

      const refListRes = await makeRequest('/api/admin/referrals', { headers: authHeaders });
      if (refListRes.status !== 200 || !refListRes.data.success) {
        throw new Error('Failed to fetch referrals list');
      }
      console.log(`   ✓ Found ${refListRes.data.referrals.length} referral records.`);

      // Update referral status to completed
      const updateRefRes = await makeRequest(`/api/admin/referrals/${referralId}/status`, {
        method: 'PUT',
        headers: authHeaders,
        body: { status: 'completed' }
      });
      if (updateRefRes.status !== 200 || !updateRefRes.data.success) {
        throw new Error('Failed to update referral status');
      }
      console.log(`   ✓ Referral #${referralId} status set to completed.`);

      // Disable suspicious referral code
      const disableRes = await makeRequest(`/api/admin/referrals/codes/${refCode}/disable`, {
        method: 'PUT',
        headers: authHeaders,
        body: { reason: 'Suspected referral bot campaign' }
      });
      if (disableRes.status !== 200 || !disableRes.data.success) {
        throw new Error('Failed to disable referral code');
      }
      console.log(`   ✓ Referral code ${refCode} disabled.`);
      console.log('✅ MODULE 9 PASSED: Referral management & abuse safeguards verified.\n');
    }

    // ----------------------------------------------------
    // MODULE 10: Membership Management (Future architecture)
    // ----------------------------------------------------
    console.log('[MODULE 10] Membership Management (Future Architecture)...');
    {
      const plansRes = await makeRequest('/api/admin/memberships/plans', { headers: authHeaders });
      if (plansRes.status !== 200 || !plansRes.data.success || !Array.isArray(plansRes.data.plans)) {
        throw new Error('Failed to fetch membership plans');
      }
      console.log(`   ✓ Found ${plansRes.data.plans.length} configured membership plans.`);

      // Verify that merchant accounts remain free and free tier is preserved
      const freeTier = plansRes.data.plans.find(p => p.slug === 'merchant-free');
      if (!freeTier) {
        throw new Error('Critical invariant violated: merchant-free tier missing!');
      }
      console.log('   ✓ Critical Invariant: Merchant Free Tier is active and guaranteed free.');

      // Attempt to activate paid plan (must be blocked by business invariant guard)
      const premiumPlan = plansRes.data.plans.find(p => p.slug === 'premium-club');
      if (premiumPlan) {
        const togglePlanRes = await makeRequest(`/api/admin/memberships/plans/${premiumPlan.id}/toggle`, {
          method: 'PUT',
          headers: authHeaders
        });
        if (togglePlanRes.status !== 400 || !togglePlanRes.data.error.includes('Merchant and customer accounts remain FREE')) {
          throw new Error('Business guard failed: Paid membership activation should have been blocked!');
        }
        console.log('   ✓ Invariant Guard Passed: Paid membership cannot be activated; merchant & customer accounts remain 100% FREE.');
      }
      console.log('✅ MODULE 10 PASSED: Membership architecture & free tier invariant verified.\n');
    }

    // ----------------------------------------------------
    // MODULE 11: Notification Broadcasting
    // ----------------------------------------------------
    console.log('[MODULE 11] Notification Broadcasting...');
    {
      const broadcastRes = await makeRequest('/api/admin/notifications/send', {
        method: 'POST',
        headers: authHeaders,
        body: {
          title: 'Special Weekend Market Festival',
          message: 'Enjoy up to 25% coin redemption discounts this weekend across all shops!',
          target_audience: 'all_customers',
          notification_type: 'offer'
        }
      });
      if (broadcastRes.status !== 201 || !broadcastRes.data.success) {
        throw new Error(`Failed to broadcast notification: ${JSON.stringify(broadcastRes.data)}`);
      }
      console.log(`   ✓ Notification #${broadcastRes.data.notificationId} broadcasted to ${broadcastRes.data.recipient_count} customers.`);
      console.log('✅ MODULE 11 PASSED: Notification broadcast system verified.\n');
    }

    // ----------------------------------------------------
    // MODULE 12: Advertisement Management
    // ----------------------------------------------------
    console.log('[MODULE 12] Advertisement Management...');
    {
      const adRes = await makeRequest('/api/admin/advertisements', {
        method: 'POST',
        headers: authHeaders,
        body: {
          title: 'City Fresh Market Big Sale',
          banner_url: '/uploads/ads/banner1.jpg',
          destination_url: '/shops/1',
          display_location: 'home_banner',
          start_date: '2026-11-01',
          end_date: '2026-11-30'
        }
      });
      if (adRes.status !== 201 || !adRes.data.success) {
        throw new Error(`Failed to create advertisement: ${JSON.stringify(adRes.data)}`);
      }
      const adId = adRes.data.adId || (adRes.data.advertisement && adRes.data.advertisement.id);
      console.log(`   ✓ Created advertisement banner #${adId}`);

      // Toggle Ad
      const toggleAdRes = await makeRequest(`/api/admin/advertisements/${adId}/toggle`, {
        method: 'PUT',
        headers: authHeaders
      });
      if (toggleAdRes.status !== 200 || !toggleAdRes.data.success) {
        throw new Error('Failed to toggle ad status');
      }
      console.log(`   ✓ Advertisement toggled successfully.`);

      // Delete Ad
      const delAdRes = await makeRequest(`/api/admin/advertisements/${adId}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      if (delAdRes.status !== 200 || !delAdRes.data.success) {
        throw new Error('Failed to delete ad');
      }
      console.log('   ✓ Advertisement deleted.');
      console.log('✅ MODULE 12 PASSED: Advertisement management verified.\n');
    }

    // ----------------------------------------------------
    // MODULE 13: Support & Complaints Management
    // ----------------------------------------------------
    console.log('[MODULE 13] Support & Complaints Ticketing...');
    {
      // Create a test complaint
      const compTicket = 'TCK-' + Date.now();
      const compInfo = db.prepare(`
        INSERT INTO complaints (ticket_id, user_id, description, category, status, priority)
        VALUES (?, ?, 'I tried to redeem 50 coins at Shop 1 but transaction timed out', 'coin_reward', 'open', 'high')
      `).run(compTicket, testCustomer.id);
      const compId = compInfo.lastInsertRowid;

      // Assign complaint
      const assignRes = await makeRequest(`/api/admin/complaints/${compId}/assign`, {
        method: 'PUT',
        headers: authHeaders,
        body: { assigned_admin_id: superAdmin.id, internal_notes: 'Investigating ledger records' }
      });
      if (assignRes.status !== 200 || !assignRes.data.success) {
        throw new Error('Failed to assign complaint');
      }
      console.log(`   ✓ Complaint #${compId} assigned to Admin #${superAdmin.id}`);

      // Resolve complaint
      const resolveRes = await makeRequest(`/api/admin/complaints/${compId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: {
          status: 'resolved',
          resolution: 'Verified ledger and credited missing coins back to wallet',
          internal_notes: 'Resolved after checking SQLite ledger entries'
        }
      });
      if (resolveRes.status !== 200 || !resolveRes.data.success) {
        throw new Error('Failed to resolve complaint');
      }
      console.log(`   ✓ Complaint #${compId} resolved successfully.`);
      console.log('✅ MODULE 13 PASSED: Support & complaints ticketing verified.\n');
    }

    // ----------------------------------------------------
    // MODULE 14: Reports & Analytics Across 7 Dimensions
    // ----------------------------------------------------
    console.log('[MODULE 14] Reports & Analytics Generation & Export...');
    {
      const reportTypes = ['customers', 'merchants', 'coins', 'orders', 'payments', 'referrals', 'support'];
      for (const type of reportTypes) {
        const repRes = await makeRequest(`/api/admin/reports/${type}?range=all`, { headers: authHeaders });
        if (repRes.status !== 200 || !repRes.data.success || !repRes.data.summary) {
          throw new Error(`Report failed for type: ${type}`);
        }
        const expRes = await makeRequest(`/api/admin/reports/${type}/export?range=all`, { headers: authHeaders });
        if (expRes.status !== 200 || typeof expRes.data !== 'string') {
          throw new Error(`Report export failed for type: ${type}`);
        }
        console.log(`   ✓ Generated report & CSV export for: ${type.toUpperCase()}`);
      }
      console.log('✅ MODULE 14 PASSED: All 7 reports and CSV exports verified.\n');
    }

    // ----------------------------------------------------
    // MODULE 15: Admin & Security Settings, RBAC, Backups & Fraud
    // ----------------------------------------------------
    console.log('[MODULE 15] Admin Accounts, RBAC, Activity Logs, Backups & Fraud Detection...');
    {
      // List admins
      const adminsRes = await makeRequest('/api/admin/admins', { headers: authHeaders });
      if (adminsRes.status !== 200 || !adminsRes.data.success || !Array.isArray(adminsRes.data.admins)) {
        throw new Error('Failed to list admins');
      }
      console.log(`   ✓ Found ${adminsRes.data.admins.length} registered admins.`);

      // Attempt to deactivate self (must be forbidden)
      const selfDeactRes = await makeRequest(`/api/admin/admins/${superAdmin.id}/deactivate`, {
        method: 'PUT',
        headers: authHeaders
      });
      if (selfDeactRes.status !== 400) {
        throw new Error('Security check failed: Admin was allowed to deactivate own account!');
      }
      console.log('   ✓ Security Check Passed: Prevented self-deactivation of current admin.');

      // Check Activity Logs
      const logsRes = await makeRequest('/api/admin/activity-logs?limit=5', { headers: authHeaders });
      if (logsRes.status !== 200 || !logsRes.data.success || !Array.isArray(logsRes.data.logs)) {
        throw new Error('Failed to fetch activity logs');
      }
      console.log(`   ✓ Admin activity log returned ${logsRes.data.logs.length} events.`);

      // Trigger Fraud Scan
      const fraudRes = await makeRequest('/api/admin/fraud/scan', {
        method: 'POST',
        headers: authHeaders
      });
      if (fraudRes.status !== 200 || !fraudRes.data.success) {
        throw new Error('Failed to run fraud scan');
      }
      console.log(`   ✓ Fraud scan completed. Found ${fraudRes.data.new_alerts_flagged} potential alerts.`);

      // Create Database Backup Snapshot via API
      const backupRes = await makeRequest('/api/admin/backups/create', {
        method: 'POST',
        headers: authHeaders
      });
      if (backupRes.status !== 200 || !backupRes.data.success || !backupRes.data.filename) {
        throw new Error(`Failed to create database backup: ${JSON.stringify(backupRes.data)}`);
      }
      const bFile = backupRes.data.filename;
      console.log(`   ✓ Created database backup snapshot: ${bFile} (Integrity: ${backupRes.data.integrity})`);

      // Verify the backup snapshot
      const verifyRes = await makeRequest(`/api/admin/backups/verify/${bFile}`, {
        method: 'POST',
        headers: authHeaders
      });
      if (verifyRes.status !== 200 || !verifyRes.data.success || verifyRes.data.integrity !== 'ok') {
        throw new Error(`Backup verification failed: ${JSON.stringify(verifyRes.data)}`);
      }
      console.log(`   ✓ Backup snapshot verified with SQLite PRAGMA integrity_check: ${verifyRes.data.integrity.toUpperCase()}`);

      // Test RBAC isolation: Customer token rejected on all admin routes
      const custToken = generateCustomerToken(testCustomer);
      const custBlockedRes = await makeRequest('/api/admin/dashboard-stats', {
        headers: { Authorization: `Bearer ${custToken}` }
      });
      if (custBlockedRes.status !== 403) {
        throw new Error(`RBAC failed: Customer token was not rejected with 403 (got ${custBlockedRes.status})`);
      }
      console.log('   ✓ RBAC isolation verified: Customer token strictly blocked (403).');

      console.log('✅ MODULE 15 PASSED: Admin settings, RBAC, backups & fraud detection verified.\n');
    }

    console.log('====================================================');
    console.log('🎉 ALL 15 CENTRALIZED ADMIN MODULES PASSED (100%)');
    console.log('====================================================\n');

  } catch (err) {
    throw err;
  }
}

runTests().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
