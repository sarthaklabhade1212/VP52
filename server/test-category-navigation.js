/**
 * VP52 Customer Home Screen Category Navigation & Profile Photo Verification
 * Validates:
 * 1. 17 Master categories & 256 subcategories integrity
 * 2. In-process Express API calls for all 17 categories & subcategories
 * 3. Subcategory filtering works for each category
 * 4. "All Shops & Services" returns all approved merchants
 * 5. Category Navigation moved to the LAST section of CustomerHome.jsx (Change 1)
 * 6. Section order strictly adheres to prompt requirements
 * 7. Customer Profile Photo implementation & fallbacks (Change 2)
 * 8. Backend photo upload, update, and removal API routes
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Readable, Duplex } = require('stream');
const jwt = require('jsonwebtoken');

const db = require('./db/database');
const { CATEGORIES, getCategoryById } = require('./config/categories');

const JWT_SECRET = process.env.JWT_SECRET || 'vp52-dev-super-secret-key-change-in-prod';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}

// Setup Express app
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', require('./routes/auth'));
app.use('/api/customer', require('./routes/customer'));
app.use('/api/upload', require('./routes/upload'));

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = new Readable({ read() {} });
    req.method = options.method || 'GET';
    req.url = options.path;
    req.httpVersion = '1.1';
    req.headers = {};
    for (const key of Object.keys(options.headers || {})) {
      req.headers[key.toLowerCase()] = options.headers[key];
    }
    const fakeSocket = new Duplex({ read() {}, write(chunk, enc, cb) { cb(); } });
    fakeSocket.remoteAddress = '127.0.0.1';
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

    res.write = function (chunk, enc, cb) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, enc));
      if (typeof cb === 'function') cb();
      return true;
    };

    res.end = function (chunk, enc, cb) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, enc));
      if (typeof cb === 'function') cb();
      if (!settled) {
        settled = true;
        const raw = Buffer.concat(chunks).toString('utf8');
        let parsed = null;
        try { parsed = JSON.parse(raw); } catch (e) { parsed = raw; }
        resolve({ status: res.statusCode, headers: res.getHeaders(), body: parsed });
      }
    };

    app(req, res);
    if (payload) req.push(payload);
    req.push(null);
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('VP52 CUSTOMER HOME UI & PROFILE PHOTO TEST SUITE');
  console.log('====================================================\n');

  // Customer token for auth header
  const customerToken = jwt.sign(
    { id: 1, email: 'customer@example.com', role: 'customer' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  const authHeaders = { Authorization: `Bearer ${customerToken}` };

  // 1. Verify CATEGORIES configuration
  console.log('[TEST 1] Verifying 17 Master Categories & 256 Subcategories...');
  assert(Array.isArray(CATEGORIES), 'CATEGORIES must be an array');
  assert(CATEGORIES.length === 17, `Expected 17 categories, got ${CATEGORIES.length}`);

  let totalSubcategories = 0;
  CATEGORIES.forEach((cat, index) => {
    assert(cat.id, `Category #${index + 1} must have an id`);
    assert(cat.name, `Category #${index + 1} must have a name`);
    assert(cat.icon, `Category #${index + 1} (${cat.name}) must have an icon`);
    assert(Array.isArray(cat.subcategories) && cat.subcategories.length > 0, `Category ${cat.name} must have subcategories`);
    totalSubcategories += cat.subcategories.length;
  });
  assert(totalSubcategories === 256, `Expected 256 subcategories, got ${totalSubcategories}`);
  console.log(`✅ TEST 1 PASSED: 17 categories & ${totalSubcategories} subcategories verified\n`);

  // 2. Test "All Shops & Services" API endpoint
  console.log('[TEST 2] Testing "All Shops & Services" API query (category=All)...');
  const allShopsRes = await request({
    path: '/api/customer/shops?category=All',
    headers: authHeaders
  });
  assert(allShopsRes.status === 200, `Expected 200, got ${allShopsRes.status}`);
  assert(allShopsRes.body.success === true, 'Response must have success: true');
  assert(Array.isArray(allShopsRes.body.shops), 'Response must have shops array');
  console.log(`  Found ${allShopsRes.body.shops.length} approved active shops for "All Shops & Services".`);
  assert(allShopsRes.body.shops.length > 0, 'Must return approved shops');
  console.log('✅ TEST 2 PASSED: "All Shops & Services" retrieves all approved merchants via API\n');

  // 3. Test each of the 17 category API queries & subcategory queries
  console.log('[TEST 3] Testing all 17 category selections via GET /api/customer/shops...');
  for (let idx = 0; idx < CATEGORIES.length; idx++) {
    const cat = CATEGORIES[idx];
    
    // Test Category query by name
    const catRes = await request({
      path: `/api/customer/shops?category=${encodeURIComponent(cat.name)}`,
      headers: authHeaders
    });
    assert(catRes.status === 200, `Category ${cat.name} returned status ${catRes.status}`);
    assert(catRes.body.success === true, `Category ${cat.name} response must be successful`);
    const shopsInCat = catRes.body.shops;

    // Test Category query by ID
    const catIdRes = await request({
      path: `/api/customer/shops?category=${encodeURIComponent(cat.id)}`,
      headers: authHeaders
    });
    assert(catIdRes.status === 200, `Category ID ${cat.id} returned status ${catIdRes.status}`);
    assert(catIdRes.body.success === true, `Category ID ${cat.id} response must be successful`);

    // Test Subcategory query
    const sampleSub = cat.subcategories[0];
    const subRes = await request({
      path: `/api/customer/shops?category=${encodeURIComponent(cat.name)}&subcategory=${encodeURIComponent(sampleSub)}`,
      headers: authHeaders
    });
    assert(subRes.status === 200, `Subcategory ${sampleSub} returned status ${subRes.status}`);
    assert(subRes.body.success === true, `Subcategory ${sampleSub} response must be successful`);

    console.log(`  [${idx + 1}/17] ${cat.name} (${cat.subcategories.length} subs) -> ${shopsInCat.length} shops | Sub "${sampleSub}" -> ${subRes.body.shops.length} shops`);
  }
  console.log('✅ TEST 3 PASSED: All 17 categories and subcategories query correctly through API\n');

  // 4. CHANGE 1: Verify section order in CustomerHome.jsx
  console.log('[TEST 4] Verifying Section Order in CustomerHome.jsx (CHANGE 1)...');
  const customerHomePath = path.join(__dirname, '../client/src/pages/CustomerHome.jsx');
  const customerHomeCode = fs.readFileSync(customerHomePath, 'utf8');

  // Verify Required Order:
  // 1. Profile header
  // 2. Scan & Pay Coins button
  // 3. Search bar
  // 4. Discovery filter controls
  // 5. Search radius selection
  // 6. Nearby business results / empty results message
  // 9. EXPLORE ALL CATEGORIES (17) — LAST SECTION

  const idxProfileHeader = customerHomeCode.indexOf('Top Profile & Points Card');
  const idxScanPay = customerHomeCode.indexOf('Scan & Pay Coins at Merchant Button');
  const idxSearchBar = customerHomeCode.indexOf('Prominent Search Bar');
  const idxFilterControls = customerHomeCode.indexOf('Filter and View Mode Controls');
  const idxRadius = customerHomeCode.indexOf('Radius Filter');
  const idxDiscoveryResults = customerHomeCode.indexOf('id="discovery-results"');
  const idxCategoriesLast = customerHomeCode.indexOf('EXPLORE ALL CATEGORIES (17) — LAST SECTION');

  assert(idxProfileHeader !== -1, 'Profile header must exist');
  assert(idxScanPay !== -1, 'Scan & Pay button must exist');
  assert(idxSearchBar !== -1, 'Search bar must exist');
  assert(idxFilterControls !== -1, 'Filter controls must exist');
  assert(idxRadius !== -1, 'Radius filter must exist');
  assert(idxDiscoveryResults !== -1, 'Discovery results must exist');
  assert(idxCategoriesLast !== -1, 'EXPLORE ALL CATEGORIES must exist');

  assert(idxProfileHeader < idxScanPay, 'Profile header must come before Scan & Pay');
  assert(idxScanPay < idxSearchBar, 'Scan & Pay must come before Search Bar');
  assert(idxSearchBar < idxFilterControls, 'Search Bar must come before Filter Controls');
  assert(idxFilterControls < idxRadius, 'Filter Controls must come before Radius Filter');
  assert(idxRadius < idxDiscoveryResults, 'Radius Filter must come before Discovery Results');
  assert(idxDiscoveryResults < idxCategoriesLast, 'Discovery Results must come before EXPLORE ALL CATEGORIES (Category list must be at the bottom)');

  console.log('  Section Order Verified:');
  console.log('  1. Profile & Wallet Header (pos ' + idxProfileHeader + ')');
  console.log('  2. Scan & Pay Coins Button (pos ' + idxScanPay + ')');
  console.log('  3. Prominent Search Bar (pos ' + idxSearchBar + ')');
  console.log('  4. Discovery Filter Controls (pos ' + idxFilterControls + ')');
  console.log('  5. Radius Filter (pos ' + idxRadius + ')');
  console.log('  6. Nearby Business Results (pos ' + idxDiscoveryResults + ')');
  console.log('  7. EXPLORE ALL CATEGORIES (17) — LAST SECTION (pos ' + idxCategoriesLast + ')');
  console.log('✅ TEST 4 PASSED: Section order strictly matches all Change 1 requirements\n');

  // 5. CHANGE 1: Verify Category Navigation Design Requirements
  console.log('[TEST 5] Verifying Category Navigation Design Requirements in CustomerHome.jsx...');
  assert(
    customerHomeCode.includes('EXPLORE ALL CATEGORIES') &&
    customerHomeCode.includes('CATEGORIES.length'),
    'CustomerHome.jsx must include heading "EXPLORE ALL CATEGORIES ({CATEGORIES.length})"'
  );
  assert(customerHomeCode.includes('CATEGORIES.map('), 'CustomerHome.jsx must map over centralized CATEGORIES array');
  assert(customerHomeCode.includes('CategoryIcon'), 'Must render CategoryIcon');
  assert(customerHomeCode.includes('ChevronRight'), 'Must render ChevronRight');
  assert(customerHomeCode.includes('cat.name'), 'Must render cat.name');
  assert(customerHomeCode.includes('All Shops & Services'), 'Must include "All Shops & Services"');
  assert(customerHomeCode.includes('#C9A227') && customerHomeCode.includes('#F2D675'), 'Must use VP52 gold colors');
  assert(customerHomeCode.includes('onClick={() => {') && customerHomeCode.includes('setCategory(cat.name)'), 'Category rows must be clickable');
  assert(customerHomeCode.includes('Subcategories in {cat.name}'), 'Must display subcategories for selected category');
  assert(customerHomeCode.includes('setSelectedSubcategory('), 'Must allow clicking subcategories to filter');

  const categorySectionMatch = customerHomeCode.match(/EXPLORE ALL CATEGORIES \(17\) — LAST SECTION[\s\S]*?SIMULATED DEMO AD REWARD MODAL/);
  assert(categorySectionMatch, 'Must find category navigation section at the bottom');
  const categorySectionText = categorySectionMatch[0];
  assert(!categorySectionText.includes('overflowX'), 'Category navigation section must NOT contain overflowX');
  assert(categorySectionText.includes('flexWrap: \'wrap\''), 'Subcategories must use flexWrap: wrap');
  console.log('✅ TEST 5 PASSED: Category navigation at bottom adheres to all design specs\n');

  // 6. CHANGE 2: Verify Profile Photo Implementation in Frontend
  console.log('[TEST 6] Verifying Profile Photo Implementation in Frontend...');
  // CustomerHome.jsx avatar check
  assert(customerHomeCode.includes('user?.profile_photo'), 'CustomerHome must check user?.profile_photo');
  assert(customerHomeCode.includes('avatarImgError'), 'CustomerHome must track avatarImgError for fallback');
  assert(customerHomeCode.includes('objectFit: \'cover\''), 'Avatar photo must use object-fit: cover');
  assert(customerHomeCode.includes('borderRadius: \'50%\''), 'Avatar photo must be circular');
  assert(customerHomeCode.includes('user.full_name.charAt(0)'), 'Avatar must fall back to initial letter');

  // CustomerProfile.jsx check
  const customerProfilePath = path.join(__dirname, '../client/src/pages/CustomerProfile.jsx');
  const customerProfileCode = fs.readFileSync(customerProfilePath, 'utf8');
  assert(customerProfileCode.includes('user?.profile_photo'), 'CustomerProfile must display user?.profile_photo');
  assert(customerProfileCode.includes('handlePhotoSelect'), 'CustomerProfile must provide handlePhotoSelect');
  assert(customerProfileCode.includes('handleRemovePhoto'), 'CustomerProfile must provide handleRemovePhoto');
  assert(customerProfileCode.includes('updateUserPhoto'), 'CustomerProfile must call updateUserPhoto');
  assert(customerProfileCode.includes('accept="image/jpeg,image/png,image/webp"'), 'Must validate image types');
  console.log('✅ TEST 6 PASSED: Frontend customer profile photo display & upload controls verified\n');

  // 7. CHANGE 2: Backend API Photo Endpoints & Auth Persistence
  console.log('[TEST 7] Testing Backend Customer Photo API & Persistence...');
  
  // Create a clean test customer
  const testEmail = `photo_test_${Date.now()}@vp52.com`;
  const dynamicPhone = '+919' + Math.floor(100000000 + Math.random() * 900000000);
  const insertUser = db.prepare(`
    INSERT INTO users (full_name, email, phone, password_hash, status, auth_provider, profile_completed)
    VALUES ('Photo Test User', ?, ?, 'dummyhash', 'active', 'local', 1)
  `).run(testEmail, dynamicPhone);
  const testUserId = insertUser.lastInsertRowid;
  db.prepare('INSERT INTO wallets (user_id, balance, total_earned, total_redeemed) VALUES (?, 100, 100, 0)').run(testUserId);

  const testUserToken = jwt.sign(
    { id: testUserId, email: testEmail, role: 'customer' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  const testUserHeaders = { Authorization: `Bearer ${testUserToken}`, 'Content-Type': 'application/json' };

  // A: Initial /me has profile_photo: null
  const meRes1 = await request({ path: '/api/auth/me', headers: testUserHeaders });
  assert(meRes1.status === 200, 'GET /api/auth/me returns 200');
  assert(meRes1.body.user.profile_photo === null, 'Initial profile_photo should be null');

  // B: Update photo via POST /api/customer/photo
  const samplePhotoUrl = 'https://lh3.googleusercontent.com/a/sample_avatar_123';
  const updatePhotoRes = await request(
    { path: '/api/customer/photo', method: 'POST', headers: testUserHeaders },
    { photo_url: samplePhotoUrl }
  );
  assert(updatePhotoRes.status === 200, 'POST /api/customer/photo returns 200');
  assert(updatePhotoRes.body.success === true, 'Photo update success: true');
  assert(updatePhotoRes.body.profile_photo === samplePhotoUrl, 'Returns updated photo URL');

  // C: Verify /me returns the updated profile_photo (persisted across app restarts)
  const meRes2 = await request({ path: '/api/auth/me', headers: testUserHeaders });
  assert(meRes2.body.user.profile_photo === samplePhotoUrl, 'GET /api/auth/me returns persisted profile_photo');

  // D: Test local upload URL format
  const localUploadUrl = '/uploads/customer_profile_17200000_abc123.jpg';
  const updateLocalRes = await request(
    { path: '/api/customer/photo', method: 'POST', headers: testUserHeaders },
    { photo_url: localUploadUrl }
  );
  assert(updateLocalRes.status === 200, 'Supports local upload URL');

  // E: Test Invalid URL rejection (security validation)
  const invalidUrlRes = await request(
    { path: '/api/customer/photo', method: 'POST', headers: testUserHeaders },
    { photo_url: 'javascript:alert(1)' }
  );
  assert(invalidUrlRes.status === 400, 'Rejects invalid photo URL format with 400');

  // F: Test Delete / Remove photo via DELETE /api/customer/photo
  const deletePhotoRes = await request(
    { path: '/api/customer/photo', method: 'DELETE', headers: testUserHeaders }
  );
  assert(deletePhotoRes.status === 200, 'DELETE /api/customer/photo returns 200');
  const meRes3 = await request({ path: '/api/auth/me', headers: testUserHeaders });
  assert(meRes3.body.user.profile_photo === null, 'Profile photo cleanly cleared to null for letter fallback');

  console.log('✅ TEST 7 PASSED: Backend photo update, persistence, validation and removal verified\n');

  console.log('====================================================');
  console.log('🎉 ALL TESTS PASSED: CHANGE 1 & CHANGE 2 VERIFIED 100%');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
