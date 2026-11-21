// End-to-end tests for the Merchant-account + Shop-location feature (Phases 1-5).
//
// Same harness style as server/test-chat.js: no test framework, sequential
// assertions that throw on failure, driving the REAL Express app in-process via
// socket-free request injection. That exercises the full production stack — CORS +
// express.json(), the JWT authenticateToken / requireRole middleware, the actual
// auth/admin/customer/merchant route handlers, and the real better-sqlite3 DB —
// with no listening socket, so it is safe in restricted/sandboxed CI.
//
// Fixtures used (from server/db/seed.js), which must already exist in the dev DB:
//   Customer A: customer@example.com / Customer@123
//   Shop A:     shop@example.com     / Shop@123   (SHOP-001)
//   Shop B:     cityrest@example.com / Shop@123   (SHOP-002)
//   Admin:      admin@example.com    / Admin@123
//
// All accounts this suite creates use emails ending in "@merchant.test" so they can
// be safely bulk-removed before and after the run. Assertions key off the returned
// shop_code (presence/absence), never off row counts, so pre-existing data in the
// dev DB never affects the result.

const path = require('path');

// Load env (JWT_SECRET, etc.) exactly like index.js BEFORE requiring any router,
// because middleware/auth.js reads process.env.JWT_SECRET at module-load time.
require('dotenv').config({ path: path.join(__dirname, '.env') });

const http = require('http');
const { Readable, Duplex } = require('stream');
const express = require('express');
const cors = require('cors');

// Direct DB + shared password util access for cleanup, the NULL-coord insert
// (test 26), the unapproved-shop mutation (test 25) and DB-level flag assertions.
const db = require('./db/database');
const { validatePasswordStrength } = require('./utils/password');

// Build the same app index.js builds — same middleware order, same routers —
// but without app.listen() (no socket bind).
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', require('./routes/auth'));
app.use('/api/customer', require('./routes/customer'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/shop', require('./routes/shop'));
app.use('/api/merchant', require('./routes/merchant'));

// Inject a request straight into the Express app and capture the response without
// any TCP/UNIX socket. Keeps the exact { status, body } contract the assertions use.
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

const H = {};
const jsonHeaders = { 'Content-Type': 'application/json' };
const auth = (token) => ({ Authorization: `Bearer ${token}` });

let passCount = 0;
function expect(cond, msg) {
  if (!cond) throw new Error('❌ ' + msg);
  passCount++;
  console.log('✅ ' + msg);
}

async function login(loginPath, creds) {
  const res = await request({ ...H, path: loginPath, method: 'POST', headers: jsonHeaders }, creds);
  if (res.status !== 200 || !res.body.token) {
    throw new Error(`Login failed for ${loginPath}: ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

const TEST_EMAIL_SUFFIX = '@merchant.test';
function cleanup() {
  // Remove only accounts this suite creates. Keyed on the reserved email suffix so
  // seeded/real shops are never touched. No child rows reference these test shops
  // (this suite creates conversations only against seeded Shop A), so a plain delete
  // is safe under foreign_keys = ON.
  db.prepare(`DELETE FROM shops WHERE email LIKE '%${TEST_EMAIL_SUFFIX}'`).run();
}

// Customer sits here; every distance marker is placed due north (same longitude) so
// its great-circle distance is a pure function of the latitude offset:
//   km = dLatDeg * 111.1949  (verified against the server's Haversine, R = 6371).
const CUST_LAT = 19.0;
const CUST_LNG = 72.8;
const KM_PER_DEG = 111.1949;
const latForKm = (km) => CUST_LAT + km / KM_PER_DEG;

let phoneSeq = 9700000000;
function nextPhone() { return String(++phoneSeq); }

async function createShopViaAdmin(adminToken, overrides = {}) {
  const body = {
    name: overrides.name || 'Test Merchant',
    owner_name: overrides.owner_name || 'Test Owner',
    category: overrides.category || 'Retail',
    address: overrides.address || '1 Test Street',
    phone: overrides.phone || nextPhone(),
    email: overrides.email,
    status: overrides.status || 'active',
    latitude: overrides.latitude,
    longitude: overrides.longitude
  };
  return request(
    { ...H, path: '/api/admin/shops', method: 'POST', headers: { ...jsonHeaders, ...auth(adminToken) } },
    body
  );
}

// Create a shop while capturing everything written to the console, so test 13 can
// prove the generated temporary password is never logged. expect() must run OUTSIDE
// this (it logs), so we only wrap the single create call.
async function createShopCapturingLogs(adminToken, overrides) {
  const orig = { log: console.log, error: console.error, warn: console.warn, info: console.info };
  const buf = [];
  const sink = (...a) => { buf.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')); };
  console.log = sink; console.error = sink; console.warn = sink; console.info = sink;
  let res;
  try {
    res = await createShopViaAdmin(adminToken, overrides);
  } finally {
    Object.assign(console, orig);
  }
  return { res, output: buf.join('\n') };
}

async function fetchCustomerShops(custToken, query) {
  const qs = new URLSearchParams(query).toString();
  const res = await request(
    { ...H, path: `/api/customer/shops?${qs}`, method: 'GET', headers: auth(custToken) }
  );
  if (res.status !== 200 || !res.body || !Array.isArray(res.body.shops)) {
    throw new Error(`Customer /shops failed: ${JSON.stringify(res.body)}`);
  }
  return res.body.shops;
}
const hasCode = (shops, code) => shops.some((s) => s.shop_code === code);
const findByCode = (shops, code) => shops.find((s) => s.shop_code === code);

async function run() {
  console.log('🚀 Merchant-account + shop-location verification (Phases 1-5)\n');
  cleanup();

  // --- Logins ---
  const admin = await login('/api/auth/admin/login', { email: 'admin@example.com', password: 'Admin@123' });
  const shopA = await login('/api/auth/shop/login', { email: 'shop@example.com', password: 'Shop@123' });
  const shopAId = shopA.user.shop_id || shopA.user.id;
  const cust = await login('/api/auth/customer/login', { email: 'customer@example.com', password: 'Customer@123' });
  console.log(`   (admin ok, shopA id=${shopAId}, customer ok)\n`);

  // ============================================================
  // PHASE 1 — Merchant self-registration is disabled
  // ============================================================
  const reg = await request(
    { ...H, path: '/api/auth/merchant/register', method: 'POST', headers: jsonHeaders },
    { name: 'Rogue Shop', email: `rogue${TEST_EMAIL_SUFFIX}`, password: 'Whatever@123', phone: nextPhone() }
  );
  expect(reg.status === 410 && reg.body && reg.body.success === false,
    '1. POST /api/auth/merchant/register returns 410 Gone');
  expect(/created by/i.test(reg.body.error || ''),
    '1b. 410 response carries the admin-only explanation message');

  const rogue = db.prepare(`SELECT id FROM shops WHERE email = ?`).get(`rogue${TEST_EMAIL_SUFFIX}`);
  expect(!rogue, '2. Disabled self-registration creates NO shop row');

  // ============================================================
  // PHASE 2 — Admin creates merchant + exact shop location
  // ============================================================
  const createRes = await createShopViaAdmin(admin.token, {
    name: 'Admin Made Shop', owner_name: 'Owner One',
    email: `made${TEST_EMAIL_SUFFIX}`,
    latitude: latForKm(3), longitude: CUST_LNG
  });
  expect(createRes.status === 201 && createRes.body.success && createRes.body.credentials,
    '3. Admin CAN create a merchant + shop (201)');
  const made = createRes.body.credentials;
  const madeId = made.shopId;
  const madeCode = made.shopCode;
  const madeTempPw = made.temporaryPassword;

  // 4. Non-admins cannot create merchant accounts.
  const shopCreate = await createShopViaAdmin(shopA.token, { email: `nope1${TEST_EMAIL_SUFFIX}`, latitude: 19, longitude: 72.8 });
  expect(shopCreate.status === 403, '4. Merchant (shop role) cannot create a shop (403)');
  const custCreate = await createShopViaAdmin(cust.token, { email: `nope2${TEST_EMAIL_SUFFIX}`, latitude: 19, longitude: 72.8 });
  expect(custCreate.status === 403, '4b. Customer cannot create a shop (403)');
  const anonCreate = await request({ ...H, path: '/api/admin/shops', method: 'POST', headers: jsonHeaders },
    { name: 'X', owner_name: 'X', phone: nextPhone(), address: 'X', latitude: 19, longitude: 72.8 });
  expect(anonCreate.status === 401, '4c. Unauthenticated create is rejected (401)');

  // 5/6. Coordinates are REQUIRED.
  const noLat = await request(
    { ...H, path: '/api/admin/shops', method: 'POST', headers: { ...jsonHeaders, ...auth(admin.token) } },
    { name: 'No Lat', owner_name: 'O', phone: nextPhone(), address: 'A', email: `nolat${TEST_EMAIL_SUFFIX}`, longitude: CUST_LNG }
  );
  expect(noLat.status === 400 && /latitude/i.test(noLat.body.error || ''), '5. Missing latitude is rejected (400)');
  const noLng = await request(
    { ...H, path: '/api/admin/shops', method: 'POST', headers: { ...jsonHeaders, ...auth(admin.token) } },
    { name: 'No Lng', owner_name: 'O', phone: nextPhone(), address: 'A', email: `nolng${TEST_EMAIL_SUFFIX}`, latitude: CUST_LAT }
  );
  expect(noLng.status === 400 && /longitude/i.test(noLng.body.error || ''), '6. Missing longitude is rejected (400)');

  // 7/8. Out-of-range coordinates are rejected.
  const badLat = await createShopViaAdmin(admin.token, { email: `badlat${TEST_EMAIL_SUFFIX}`, latitude: 120, longitude: CUST_LNG });
  expect(badLat.status === 400 && /latitude/i.test(badLat.body.error || ''), '7. Invalid latitude (120) is rejected (400)');
  const badLng = await createShopViaAdmin(admin.token, { email: `badlng${TEST_EMAIL_SUFFIX}`, latitude: CUST_LAT, longitude: 999 });
  expect(badLng.status === 400 && /longitude/i.test(badLng.body.error || ''), '8. Invalid longitude (999) is rejected (400)');

  // 9. Confirmed coordinates are persisted exactly.
  const madeRow = db.prepare('SELECT latitude, longitude FROM shops WHERE id = ?').get(madeId);
  expect(madeRow && Math.abs(madeRow.latitude - latForKm(3)) < 1e-9 && Math.abs(madeRow.longitude - CUST_LNG) < 1e-9,
    '9. Created shop persists the exact confirmed coordinates');

  // ============================================================
  // PHASE 2B — Admin edits shop location; merchant cannot
  // ============================================================
  const editLat = latForKm(8);
  const editRes = await request(
    { ...H, path: `/api/admin/shops/${madeId}`, method: 'PUT', headers: { ...jsonHeaders, ...auth(admin.token) } },
    { name: made.shopName, owner_name: made.ownerName, category: 'Retail', description: 'd',
      address: '1 Test Street', phone: made.mobileNumber, email: made.email, image_url: '',
      status: 'active', latitude: editLat, longitude: CUST_LNG }
  );
  expect(editRes.status === 200 && editRes.body.success, '10. Admin CAN edit shop location (200)');
  const editedRow = db.prepare('SELECT latitude, longitude FROM shops WHERE id = ?').get(madeId);
  expect(editedRow && Math.abs(editedRow.latitude - editLat) < 1e-9,
    '10b. Edited coordinates are persisted');

  // 11. Merchant cannot reach the admin edit route at all (role gate → 403), and the
  //     coordinates are unchanged afterward.
  const merchEdit = await request(
    { ...H, path: `/api/admin/shops/${madeId}`, method: 'PUT', headers: { ...jsonHeaders, ...auth(shopA.token) } },
    { name: 'Hijack', owner_name: 'x', address: 'x', phone: '1', status: 'active', latitude: 10, longitude: 10 }
  );
  expect(merchEdit.status === 403, '11. Merchant cannot edit shop coordinates via admin route (403)');
  const afterMerch = db.prepare('SELECT latitude, longitude FROM shops WHERE id = ?').get(madeId);
  expect(afterMerch && Math.abs(afterMerch.latitude - editLat) < 1e-9,
    '11b. Coordinates unchanged after merchant edit attempt');

  // ============================================================
  // PHASE 3 — Strong, auto-generated, never-logged temporary password
  // ============================================================
  const createRes2 = await createShopViaAdmin(admin.token, {
    name: 'Second Shop', email: `second${TEST_EMAIL_SUFFIX}`, latitude: 19.5, longitude: CUST_LNG
  });
  expect(createRes2.status === 201, '12-setup. Second shop created for password comparison');
  const tempPw2 = createRes2.body.credentials.temporaryPassword;
  expect(typeof madeTempPw === 'string' && madeTempPw.length >= 12,
    '12. Temporary password is server-generated and >= 12 chars');
  expect(validatePasswordStrength(madeTempPw).ok,
    '12b. Temporary password satisfies the strength policy (upper/lower/digit)');
  expect(madeTempPw !== tempPw2,
    '12c. Temporary passwords differ across creations (crypto-random, not fixed)');

  // 13. The plaintext password is never logged and never written to the audit trail.
  const cap = await createShopCapturingLogs(admin.token, {
    name: 'Log Probe Shop', email: `logprobe${TEST_EMAIL_SUFFIX}`, latitude: 19.6, longitude: CUST_LNG
  });
  expect(cap.res.status === 201, '13-setup. Log-probe shop created');
  const probePw = cap.res.body.credentials.temporaryPassword;
  expect(!cap.output.includes(probePw),
    '13. Plaintext temporary password is NOT written to the console/logs');
  const auditRows = db.prepare("SELECT activity_type FROM reward_transactions WHERE points = 0").all();
  const leaked = auditRows.some((r) => typeof r.activity_type === 'string' && r.activity_type.includes(probePw));
  expect(!leaked, '13b. Plaintext temporary password is NOT written to the audit trail');

  // ============================================================
  // PHASE 4 — Forced merchant password change
  // ============================================================
  const flagRow = db.prepare('SELECT must_change_password FROM shops WHERE id = ?').get(madeId);
  expect(flagRow && flagRow.must_change_password === 1,
    '14. Newly created merchant has must_change_password = 1');

  // 15. Password login surfaces the flag so the client can force the change screen.
  const firstLogin = await login('/api/auth/shop/login', { email: made.email, password: madeTempPw });
  expect(firstLogin.user.must_change_password === 1,
    '15. First password login reports must_change_password = 1');
  const madeToken = firstLogin.token;

  // 16. The OTP (mobile) login path respects the same flag.
  const otpLogin = await request(
    { ...H, path: '/api/auth/shop/login-mobile', method: 'POST', headers: jsonHeaders },
    { mobile: made.mobileNumber, otp_code: '123456' }
  );
  expect(otpLogin.status === 200 && otpLogin.body.user.must_change_password === 1,
    '16. OTP login path also reports must_change_password = 1');

  // 17. Changing the password clears the flag; identity comes from the JWT only.
  const weakChange = await request(
    { ...H, path: '/api/auth/shop/change-password', method: 'POST', headers: { ...jsonHeaders, ...auth(madeToken) } },
    { current_password: madeTempPw, new_password: 'weak' }
  );
  expect(weakChange.status === 400, '17-pre. Weak new password is rejected (400)');
  const newStrongPw = 'NewMerchant@2027';
  const change = await request(
    { ...H, path: '/api/auth/shop/change-password', method: 'POST', headers: { ...jsonHeaders, ...auth(madeToken) } },
    { current_password: madeTempPw, new_password: newStrongPw }
  );
  expect(change.status === 200 && change.body.success && change.body.must_change_password === 0,
    '17. Merchant changes password → flag cleared in response');
  const clearedRow = db.prepare('SELECT must_change_password FROM shops WHERE id = ?').get(madeId);
  expect(clearedRow && clearedRow.must_change_password === 0,
    '17b. must_change_password persisted as 0 in the database');
  const meAfter = await request({ ...H, path: '/api/auth/me', method: 'GET', headers: auth(madeToken) });
  expect(meAfter.status === 200 && meAfter.body.user.must_change_password === 0,
    '17c. GET /me reports the cleared flag');
  // Cross-shop isolation: changing the created shop's password did NOT touch seeded
  // Shop A (identity is taken from the JWT, never from the request body).
  const shopAStillWorks = await request(
    { ...H, path: '/api/auth/shop/login', method: 'POST', headers: jsonHeaders },
    { email: 'shop@example.com', password: 'Shop@123' }
  );
  expect(shopAStillWorks.status === 200 && shopAStillWorks.body.token,
    '17d. A merchant password change is scoped to that merchant only (Shop A unaffected)');

  // ============================================================
  // PHASE 5 — Customer location, radius filter, backend distance
  // ============================================================
  // Distance markers due north of the customer at 0.5 / 3 / 8 / 18 / 40 / 90 km.
  const markerKm = [0.5, 3, 8, 18, 40, 90];
  const markers = [];
  for (const km of markerKm) {
    const r = await createShopViaAdmin(admin.token, {
      name: `Marker ${km}km`, owner_name: 'Marker Owner',
      email: `marker-${String(km).replace('.', '_')}${TEST_EMAIL_SUFFIX}`,
      latitude: latForKm(km), longitude: CUST_LNG
    });
    if (r.status !== 201) throw new Error(`Marker ${km}km create failed: ${JSON.stringify(r.body)}`);
    markers.push({ km, code: r.body.credentials.shopCode, lat: latForKm(km), lng: CUST_LNG });
  }
  const codeFor = (km) => markers.find((m) => m.km === km).code;

  // 18. Distance is returned (server-computed) when the customer shares location.
  const withLoc = await fetchCustomerShops(cust.token, { lat: CUST_LAT, lng: CUST_LNG, maxDistance: 'all' });
  const m3 = findByCode(withLoc, codeFor(3));
  expect(m3 && typeof m3.distance_km === 'number' && Math.abs(m3.distance_km - 3) < 0.2,
    '18. Response includes a server-computed distance_km (~3.0 for the 3km marker)');

  // 19-23. Radius filter actually changes the result set.
  const r1 = await fetchCustomerShops(cust.token, { lat: CUST_LAT, lng: CUST_LNG, maxDistance: '1' });
  expect(hasCode(r1, codeFor(0.5)) && !hasCode(r1, codeFor(3)) && !hasCode(r1, codeFor(8)),
    '19. Radius 1km includes the 0.5km shop, excludes the 3km and 8km shops');
  const r5 = await fetchCustomerShops(cust.token, { lat: CUST_LAT, lng: CUST_LNG, maxDistance: '5' });
  expect(hasCode(r5, codeFor(3)) && !hasCode(r5, codeFor(8)),
    '20. Radius 5km includes the 3km shop, excludes the 8km shop');
  const r10 = await fetchCustomerShops(cust.token, { lat: CUST_LAT, lng: CUST_LNG, maxDistance: '10' });
  expect(hasCode(r10, codeFor(8)) && !hasCode(r10, codeFor(18)),
    '21. Radius 10km includes the 8km shop, excludes the 18km shop');
  const r25 = await fetchCustomerShops(cust.token, { lat: CUST_LAT, lng: CUST_LNG, maxDistance: '25' });
  expect(hasCode(r25, codeFor(18)) && !hasCode(r25, codeFor(40)),
    '22. Radius 25km includes the 18km shop, excludes the 40km shop');
  const r50 = await fetchCustomerShops(cust.token, { lat: CUST_LAT, lng: CUST_LNG, maxDistance: '50' });
  expect(hasCode(r50, codeFor(40)) && !hasCode(r50, codeFor(90)),
    '23. Radius 50km includes the 40km shop, excludes the 90km shop');

  // 24. Results are sorted nearest → farthest.
  const distances = withLoc.map((s) => s.distance_km).filter((d) => d !== null && d !== undefined);
  let sorted = true;
  for (let i = 1; i < distances.length; i++) if (distances[i] < distances[i - 1] - 1e-9) sorted = false;
  const mineInOrder = withLoc.filter((s) => markers.some((m) => m.code === s.shop_code)).map((s) => s.shop_code);
  const expectedOrder = [...markers].sort((a, b) => a.km - b.km).map((m) => m.code);
  expect(sorted && JSON.stringify(mineInOrder) === JSON.stringify(expectedOrder),
    '24. Shops are returned sorted nearest → farthest');

  // 25. Unapproved / inactive shops never appear in customer results.
  const pending = await createShopViaAdmin(admin.token, {
    name: 'Pending Shop', email: `pending${TEST_EMAIL_SUFFIX}`, latitude: latForKm(2), longitude: CUST_LNG
  });
  const pendingCode = pending.body.credentials.shopCode;
  db.prepare("UPDATE shops SET verification_status = 'pending' WHERE id = ?").run(pending.body.credentials.shopId);
  const afterPending = await fetchCustomerShops(cust.token, { lat: CUST_LAT, lng: CUST_LNG, maxDistance: '5' });
  expect(!hasCode(afterPending, pendingCode),
    '25. Unapproved shop is excluded from customer results even within radius');

  // 26. A shop with missing coordinates stays in the DB but never appears.
  db.prepare(`
    INSERT INTO shops (shop_code, email, password_hash, name, category, description, address, phone, status, verification_status, owner_name, latitude, longitude, must_change_password)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', 'approved', ?, NULL, NULL, 0)
  `).run('SHOP-NULLCOORD-T', `nullcoord${TEST_EMAIL_SUFFIX}`, 'x', 'NullCoord Shop', 'Retail', 'd', '1 St', nextPhone(), 'Owner');
  const nullRow = db.prepare('SELECT id FROM shops WHERE shop_code = ?').get('SHOP-NULLCOORD-T');
  expect(!!nullRow, '26-setup. No-coordinate shop is stored in the DB');
  const withNull = await fetchCustomerShops(cust.token, { lat: CUST_LAT, lng: CUST_LNG, maxDistance: 'all' });
  expect(!hasCode(withNull, 'SHOP-NULLCOORD-T'),
    '26. Shop with NULL coordinates is hidden from nearby results (location-verification gate)');

  // 27. A client-supplied distance_km cannot spoof the real distance.
  const spoof = await fetchCustomerShops(cust.token, { lat: CUST_LAT, lng: CUST_LNG, maxDistance: 'all', distance_km: '0.1' });
  const spoofM3 = findByCode(spoof, codeFor(3));
  expect(spoofM3 && Math.abs(spoofM3.distance_km - 3) < 0.2 && spoofM3.distance_km !== 0.1,
    '27. Server ignores a spoofed distance_km and uses its own computed distance');

  // 28. Directions URL is built correctly from the returned coordinates.
  const dm = findByCode(withLoc, codeFor(8));
  const dirUrl = `https://www.google.com/maps/dir/?api=1&destination=${dm.latitude},${dm.longitude}`;
  expect(dm && /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(dirUrl)
    && dirUrl.includes(`${dm.latitude},${dm.longitude}`),
    '28. Google Maps directions URL uses the exact destination LAT,LNG');

  // 29. Customer ↔ Merchant chat still works (not removed by the location work).
  const chat = await request(
    { ...H, path: '/api/customer/conversations', method: 'POST', headers: { ...jsonHeaders, ...auth(cust.token) } },
    { shop_id: shopAId }
  );
  expect(chat.status === 200 && chat.body.success && chat.body.conversation && chat.body.conversation.id,
    '29. Customer can still start a chat with a merchant (chat preserved)');

  console.log(`\n🎉 All ${passCount} merchant-location assertions passed!`);
}

run()
  .then(() => { cleanup(); process.exit(0); })
  .catch((err) => {
    try { cleanup(); } catch (_) { /* best-effort */ }
    console.error('\n' + (err && err.message ? err.message : err));
    process.exit(1);
  });
