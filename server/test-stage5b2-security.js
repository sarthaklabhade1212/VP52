/**
 * VP52 Stage 5B.2 — Admin RBAC, Lifecycle, Merchant Sync, Rate Limiting & Upload Security Suite
 *
 * Strictly offline / in-process HTTP tests (no TCP port binding required).
 * Run ONLY against an isolated workspace & database copy.
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
app.set('trust proxy', 'loopback');
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
    fakeSocket.remoteAddress = options.ip || '198.51.100.10';
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
const authHeaders = (token, extra = {}) => ({ ...jsonHeaders, Authorization: `Bearer ${token}`, ...extra });

// Valid 1x1 PNG (>24 bytes)
const VALID_PNG_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// Minimal valid JPEG SOI + APP0 + EOI (>= 12 bytes)
const VALID_JPEG_URI = 'data:image/jpeg;base64,' + Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
  0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0xff, 0xd9
]).toString('base64');

// Minimal valid WebP RIFF + WEBP + VP8 chunk (>= 20 bytes)
const VALID_WEBP_URI = 'data:image/webp;base64,' + Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
  0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
]).toString('base64');

async function runTests() {
  console.log('\n=== VP52 Stage 5B.2 — Admin RBAC & API Security Suite ===\n');
  const uploadedFilenames = [];
  const unique = Date.now();
  const strongPw = 'StrongAdmin#2026';

  try {
    _clearRateLimitStoreForTest();

    // Ensure a test super_admin login exists cleanly in this isolated DB copy
    const superAdminEmail = 'sanketshinde.vp52@gmail.com';
    const superHash = bcrypt.hashSync(strongPw, 10);
    const existingSuper = db.prepare('SELECT id FROM admins WHERE email = ?').get(superAdminEmail);
    if (existingSuper) {
      db.prepare("UPDATE admins SET password_hash = ?, role = 'super_admin', permissions = '[\"*\"]', status = 'active' WHERE id = ?").run(superHash, existingSuper.id);
    } else {
      db.prepare("INSERT INTO admins (full_name, email, password_hash, role, permissions, status) VALUES ('Super Admin', ?, ?, 'super_admin', '[\"*\"]', 'active')").run(superAdminEmail, superHash);
    }

    // ------------------------------------------------------------------
    // SECTION 1: Admin Login, Lifecycle & Granular RBAC
    // ------------------------------------------------------------------
    console.log('[1/5] Testing Admin login, lifecycle, privilege escalation & granular RBAC...');

    const superLoginRes = await request(
      { path: '/api/auth/admin/login', method: 'POST', headers: jsonHeaders, ip: '198.51.100.11' },
      { email: superAdminEmail, password: strongPw }
    );
    assert.strictEqual(superLoginRes.status, 200, 'Super admin login succeeds');
    const superToken = superLoginRes.body.token;
    assert.strictEqual(superLoginRes.body.user.admin_role, 'super_admin');

    // Super admin accesses previously unguarded legacy routes
    assert.strictEqual((await request({ path: '/api/admin/analytics', headers: authHeaders(superToken) })).status, 200);
    assert.strictEqual((await request({ path: '/api/admin/audit-logs', headers: authHeaders(superToken) })).status, 200);
    assert.strictEqual((await request({ path: '/api/admin/reward-settings', headers: authHeaders(superToken) })).status, 200);
    assert.strictEqual((await request({ path: '/api/admin/admins', headers: authHeaders(superToken) })).status, 200);

    // Role isolation: customer & merchant tokens blocked from admin routes
    const custEmail = `sec_cust_${unique}@example.com`;
    const custInsert = db.prepare(`
      INSERT INTO users (full_name, email, phone, password_hash, status, profile_completed)
      VALUES ('Sec Customer', ?, ?, ?, 'active', 1)
    `).run(custEmail, `99887${String(unique).slice(-5)}`, bcrypt.hashSync(strongPw, 10));
    const custId = custInsert.lastInsertRowid;
    db.prepare('INSERT OR IGNORE INTO wallets (user_id, balance, total_earned, total_redeemed) VALUES (?, 500, 500, 0)').run(custId);
    const expiresFuture = new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare(`
      INSERT INTO coin_lots (user_id, transaction_id, source, coins_earned, coins_remaining, original_amount, next_transition_at, expires_at, status, tier)
      VALUES (?, ?, 'ADMIN_ADJUSTMENT', 500, 500, 500, ?, ?, 'ACTIVE', 'Bronze')
    `).run(custId, `SEC-LOT-${unique}`, expiresFuture, expiresFuture);

    const custToken = jwt.sign({ id: custId, email: custEmail, role: 'customer' }, JWT_SECRET, { expiresIn: '2h' });
    const shop1 = db.prepare("SELECT id, email, shop_code FROM shops WHERE status = 'active' AND verification_status = 'approved' LIMIT 1").get();
    const shopToken = shop1
      ? jwt.sign({ id: shop1.id, shop_id: shop1.id, shop_code: shop1.shop_code, email: shop1.email, role: 'shop' }, JWT_SECRET, { expiresIn: '2h' })
      : null;

    for (const adminEndpoint of [
      '/api/admin/analytics',
      '/api/admin/audit-logs',
      '/api/admin/reward-settings',
      '/api/admin/admins',
      '/api/admin/shops'
    ]) {
      assert.strictEqual((await request({ path: adminEndpoint, headers: authHeaders(custToken) })).status, 403, `Customer blocked on ${adminEndpoint}`);
      if (shopToken) {
        assert.strictEqual((await request({ path: adminEndpoint, headers: authHeaders(shopToken) })).status, 403, `Shop blocked on ${adminEndpoint}`);
      }
    }

    // Weak password rejected on POST /api/admin/admins
    const weakAdminRes = await request(
      { path: '/api/admin/admins', method: 'POST', headers: authHeaders(superToken), ip: '198.51.100.12' },
      { full_name: 'Weak Admin', email: `weak_${unique}@vp52.com`, password: 'weak', role: 'support_admin' }
    );
    assert.strictEqual(weakAdminRes.status, 400, 'Weak admin password rejected');

    // Invalid role / wildcard on non-superadmin / unknown permission rejected
    assert.strictEqual(
      (await request(
        { path: '/api/admin/admins', method: 'POST', headers: authHeaders(superToken), ip: '198.51.100.12' },
        { full_name: 'Bad Role', email: `badrole_${unique}@vp52.com`, password: strongPw, role: 'god_mode' }
      )).status,
      400,
      'Invalid admin role rejected'
    );
    assert.strictEqual(
      (await request(
        { path: '/api/admin/admins', method: 'POST', headers: authHeaders(superToken), ip: '198.51.100.12' },
        { full_name: 'Wildcard Ops', email: `wild_${unique}@vp52.com`, password: strongPw, role: 'operations_admin', permissions: ['*'] }
      )).status,
      400,
      'Wildcard permission rejected for non-super_admin'
    );
    assert.strictEqual(
      (await request(
        { path: '/api/admin/admins', method: 'POST', headers: authHeaders(superToken), ip: '198.51.100.12' },
        { full_name: 'Bad Perm', email: `badperm_${unique}@vp52.com`, password: strongPw, role: 'support_admin', permissions: ['nuke:database'] }
      )).status,
      400,
      'Unknown permission string rejected'
    );
    assert.strictEqual(
      (await request(
        { path: '/api/admin/admins', method: 'POST', headers: authHeaders(superToken), ip: '198.51.100.12' },
        { full_name: 'Dup Cust Email', email: custEmail, password: strongPw, role: 'support_admin' }
      )).status,
      409,
      'Admin email colliding with existing customer rejected'
    );

    // Create Support Admin with omitted permissions -> gets least-privilege defaults (NEVER ['*'])
    // Note also sending `name` instead of `full_name` (UI compatibility) works cleanly
    const supportEmail = `support_${unique}@vp52.com`;
    const createSupportRes = await request(
      { path: '/api/admin/admins', method: 'POST', headers: authHeaders(superToken), ip: '198.51.100.12' },
      { name: 'Support Moderator', email: supportEmail, password: strongPw, role: 'support_admin' }
    );
    assert.strictEqual(createSupportRes.status, 201, 'Support admin created with least-privilege defaults');
    assert.ok(!createSupportRes.body.admin.permissions.includes('*'), 'Omitted permissions never default to wildcard');
    const supportAdminId = createSupportRes.body.adminId;

    const supportLoginRes = await request(
      { path: '/api/auth/admin/login', method: 'POST', headers: jsonHeaders, ip: '198.51.100.13' },
      { email: supportEmail, password: strongPw }
    );
    assert.strictEqual(supportLoginRes.status, 200);
    const supportToken = supportLoginRes.body.token;

    // Support admin allowed on support:view / dashboard:view / customers:view
    assert.strictEqual((await request({ path: '/api/admin/dashboard-stats', headers: authHeaders(supportToken) })).status, 200);
    assert.strictEqual((await request({ path: '/api/admin/complaints', headers: authHeaders(supportToken) })).status, 200);
    assert.strictEqual((await request({ path: '/api/admin/customers', headers: authHeaders(supportToken) })).status, 200);

    // Support admin blocked (403) on unpermitted legacy & module routes
    for (const forbidden of [
      { method: 'GET', path: '/api/admin/audit-logs' },
      { method: 'GET', path: '/api/admin/shops' },
      { method: 'GET', path: '/api/admin/reward-settings' },
      { method: 'PUT', path: '/api/admin/reward-settings', body: { settings: { points_per_ad: 10 } } },
      { method: 'PUT', path: '/api/admin/settings', body: { points_per_ad: 10 } },
      { method: 'GET', path: '/api/admin/admins' },
      { method: 'POST', path: '/api/admin/admins', body: { full_name: 'X', email: `x_${unique}@vp52.com`, password: strongPw } },
      { method: 'GET', path: '/api/admin/offers' },
      { method: 'GET', path: '/api/admin/categories' },
      { method: 'GET', path: '/api/admin/levels' },
      { method: 'GET', path: '/api/admin/transactions/rewards' },
      { method: 'PUT', path: '/api/admin/shops/1/approve' },
      { method: 'POST', path: `/api/admin/customers/${custId}/coin-adjustment`, body: { amount: 10, reason: 'test' } }
    ]) {
      const r = await request({ path: forbidden.path, method: forbidden.method, headers: authHeaders(supportToken) }, forbidden.body);
      assert.strictEqual(r.status, 403, `Support admin must get 403 on ${forbidden.method} ${forbidden.path} (got ${r.status})`);
    }

    // Even if DB row for non-super_admin somehow contains ['*'], middleware refuses wildcard bypass
    db.prepare("UPDATE admins SET permissions = '[\"*\"]' WHERE id = ?").run(supportAdminId);
    const wildcardSpoofTry = await request({ path: '/api/admin/audit-logs', headers: authHeaders(supportToken) });
    assert.strictEqual(wildcardSpoofTry.status, 403, 'Stored wildcard [*] ignored for non-super_admin roles');
    db.prepare("UPDATE admins SET permissions = ? WHERE id = ?").run(JSON.stringify(['dashboard:view', 'customers:view', 'support:view', 'orders:view']), supportAdminId);

    // Create a delegated admin manager (role: operations_admin, permissions: ['dashboard:view', 'admins:manage'])
    // and prove they CANNOT create super_admin, grant unheld permissions, or modify/deactivate a super_admin!
    const mgrEmail = `adminmgr_${unique}@vp52.com`;
    const createMgrRes = await request(
      { path: '/api/admin/admins', method: 'POST', headers: authHeaders(superToken), ip: '198.51.100.12' },
      { full_name: 'Delegated Admin Mgr', email: mgrEmail, password: strongPw, role: 'operations_admin', permissions: ['dashboard:view', 'admins:manage'] }
    );
    assert.strictEqual(createMgrRes.status, 201);
    const mgrId = createMgrRes.body.adminId;
    const mgrLoginRes = await request(
      { path: '/api/auth/admin/login', method: 'POST', headers: jsonHeaders, ip: '198.51.100.14' },
      { email: mgrEmail, password: strongPw }
    );
    assert.strictEqual(mgrLoginRes.status, 200);
    const mgrToken = mgrLoginRes.body.token;

    // Escalation attempts blocked with 403
    assert.strictEqual(
      (await request(
        { path: '/api/admin/admins', method: 'POST', headers: authHeaders(mgrToken), ip: '198.51.100.14' },
        { full_name: 'Rogue Super', email: `roguesuper_${unique}@vp52.com`, password: strongPw, role: 'super_admin' }
      )).status,
      403,
      'Non-superadmin cannot create super_admin'
    );
    assert.strictEqual(
      (await request(
        { path: '/api/admin/admins', method: 'POST', headers: authHeaders(mgrToken), ip: '198.51.100.14' },
        { full_name: 'Escalated Finance', email: `esc_${unique}@vp52.com`, password: strongPw, role: 'finance_admin', permissions: ['coins:adjust'] }
      )).status,
      403,
      'Admin cannot grant permissions they do not possess'
    );
    assert.strictEqual(
      (await request(
        { path: `/api/admin/admins/${existingSuper ? existingSuper.id : 1}`, method: 'PUT', headers: authHeaders(mgrToken), ip: '198.51.100.14' },
        { full_name: 'Tampered Super' }
      )).status,
      403,
      'Non-superadmin cannot modify super_admin'
    );
    assert.strictEqual(
      (await request(
        { path: `/api/admin/admins/${existingSuper ? existingSuper.id : 1}/deactivate`, method: 'PUT', headers: authHeaders(mgrToken), ip: '198.51.100.14' }
      )).status,
      403,
      'Non-superadmin cannot deactivate super_admin'
    );

    // Self deactivation blocked via both /deactivate and PUT /admins/:id
    assert.strictEqual(
      (await request({ path: `/api/admin/admins/${mgrId}/deactivate`, method: 'PUT', headers: authHeaders(mgrToken), ip: '198.51.100.14' })).status,
      400,
      'Admin cannot self-deactivate via /deactivate'
    );
    assert.strictEqual(
      (await request({ path: `/api/admin/admins/${mgrId}`, method: 'PUT', headers: authHeaders(mgrToken), ip: '198.51.100.14' }, { status: 'inactive' })).status,
      400,
      'Admin cannot self-deactivate via PUT /admins/:id'
    );

    // Super admin password change endpoint
    const newSupportPw = 'NewSupport#2026Pass';
    assert.strictEqual(
      (await request(
        { path: '/api/auth/admin/change-password', method: 'POST', headers: authHeaders(supportToken), ip: '198.51.100.15' },
        { current_password: 'wrong-password', new_password: newSupportPw }
      )).status,
      401,
      'Wrong current admin password returns 401'
    );
    assert.strictEqual(
      (await request(
        { path: '/api/auth/admin/change-password', method: 'POST', headers: authHeaders(supportToken), ip: '198.51.100.15' },
        { current_password: strongPw, new_password: 'weak' }
      )).status,
      400,
      'Weak new admin password returns 400'
    );
    assert.strictEqual(
      (await request(
        { path: '/api/auth/admin/change-password', method: 'POST', headers: authHeaders(supportToken), ip: '198.51.100.15' },
        { current_password: strongPw, new_password: strongPw }
      )).status,
      400,
      'Reusing current admin password returns 400'
    );
    assert.strictEqual(
      (await request(
        { path: '/api/auth/admin/change-password', method: 'POST', headers: authHeaders(supportToken), ip: '198.51.100.15' },
        { current_password: strongPw, new_password: newSupportPw }
      )).status,
      200,
      'Strong new admin password accepted'
    );

    // Deactivated admin immediately blocked from login, /me, and /api/admin/* even with valid JWT
    const toggleRes = await request({ path: `/api/admin/admins/${supportAdminId}/deactivate`, method: 'PUT', headers: authHeaders(superToken), ip: '198.51.100.12' });
    assert.strictEqual(toggleRes.status, 200);
    assert.strictEqual((await request({ path: '/api/admin/dashboard-stats', headers: authHeaders(supportToken) })).status, 403, 'Deactivated admin JWT rejected on /api/admin/*');
    assert.strictEqual((await request({ path: '/api/auth/me', headers: authHeaders(supportToken) })).status, 403, 'Deactivated admin JWT rejected on /api/auth/me');
    assert.strictEqual(
      (await request({ path: '/api/auth/admin/login', method: 'POST', headers: jsonHeaders, ip: '198.51.100.16' }, { email: supportEmail, password: newSupportPw })).status,
      403,
      'Deactivated admin rejected on login with correct password'
    );
    assert.strictEqual(
      (await request({ path: '/api/auth/admin/login', method: 'POST', headers: jsonHeaders, ip: '198.51.100.16' }, { email: supportEmail, password: 'WrongPassword123' })).status,
      401,
      'Deactivated admin still gets 401 on wrong password (non-enumerating)'
    );

    console.log('   ✓ Admin login, lifecycle, RBAC & escalation guards verified.');

    // ------------------------------------------------------------------
    // SECTION 2: Merchant Approval, QR Status Sync & Permanent QR Blocking
    // ------------------------------------------------------------------
    console.log('[2/5] Testing Merchant status / verification_status / qr_status sync...');

    const createPendingShopRes = await request(
      { path: '/api/admin/shops', method: 'POST', headers: authHeaders(superToken) },
      {
        name: `Sync Shop ${unique}`,
        owner_name: 'Sync Owner',
        phone: `91234${String(unique).slice(-5)}`,
        email: `syncshop_${unique}@example.com`,
        address: '100 Sync Street, Pune',
        category: 'Retail',
        status: 'pending',
        latitude: 18.5204,
        longitude: 73.8567
      }
    );
    assert.strictEqual(createPendingShopRes.status, 201, 'Admin created pending shop');
    const syncShopId = createPendingShopRes.body.credentials.shopId;
    let syncShop = db.prepare('SELECT * FROM shops WHERE id = ?').get(syncShopId);
    assert.strictEqual(syncShop.status, 'pending');
    assert.strictEqual(syncShop.verification_status, 'pending');
    assert.strictEqual(syncShop.qr_status, 'pending', 'Pending shop must NOT get active qr_status');
    assert.ok(syncShop.permanent_qr_code, 'Permanent QR generated and retained');
    const permanentQr = syncShop.permanent_qr_code;

    // Customer cannot lookup or pay pending shop QR
    assert.strictEqual(
      (await request({ path: '/api/customer/merchant-qr/lookup', method: 'POST', headers: authHeaders(custToken) }, { qr_code: permanentQr })).status,
      403,
      'Pending merchant QR lookup blocked'
    );
    assert.strictEqual(
      (await request({ path: '/api/customer/merchant-qr/pay', method: 'POST', headers: authHeaders(custToken) }, { qr_code: permanentQr, coins_amount: 10 })).status,
      403,
      'Pending merchant QR payment blocked'
    );

    // Editing shop details without passing status MUST preserve pending state (fixes status||'active' bug)
    const editWithoutStatusRes = await request(
      { path: `/api/admin/shops/${syncShopId}`, method: 'PUT', headers: authHeaders(superToken) },
      { name: `Sync Shop Edited ${unique}`, latitude: 18.521, longitude: 73.857 }
    );
    assert.strictEqual(editWithoutStatusRes.status, 200);
    syncShop = db.prepare('SELECT * FROM shops WHERE id = ?').get(syncShopId);
    assert.strictEqual(syncShop.status, 'pending', 'PUT /shops/:id without status must keep pending status');
    assert.strictEqual(syncShop.verification_status, 'pending');
    assert.strictEqual(syncShop.qr_status, 'pending');

    // Approve -> all three sync to active / approved / active, preserving permanent_qr_code
    assert.strictEqual(
      (await request({ path: `/api/admin/shops/${syncShopId}/approve`, method: 'PUT', headers: authHeaders(superToken) })).status,
      200
    );
    syncShop = db.prepare('SELECT * FROM shops WHERE id = ?').get(syncShopId);
    assert.strictEqual(syncShop.status, 'active');
    assert.strictEqual(syncShop.verification_status, 'approved');
    assert.strictEqual(syncShop.qr_status, 'active');
    assert.strictEqual(syncShop.permanent_qr_code, permanentQr);

    // Approved merchant QR lookup & payment now succeed
    assert.strictEqual(
      (await request({ path: '/api/customer/merchant-qr/lookup', method: 'POST', headers: authHeaders(custToken) }, { qr_code: permanentQr })).status,
      200,
      'Approved merchant QR lookup succeeds'
    );
    const payOkRes = await request(
      { path: '/api/customer/merchant-qr/pay', method: 'POST', headers: authHeaders(custToken) },
      { qr_code: permanentQr, coins_amount: 15, idempotency_key: `SYNC-PAY-${unique}` }
    );
    assert.strictEqual(payOkRes.status, 200, 'Approved merchant QR pay succeeds');

    // Suspend -> qr_status synced to suspended, permanent_qr_code preserved, lookup/pay blocked
    assert.strictEqual(
      (await request({ path: `/api/admin/shops/${syncShopId}/suspend`, method: 'PUT', headers: authHeaders(superToken) })).status,
      200
    );
    syncShop = db.prepare('SELECT * FROM shops WHERE id = ?').get(syncShopId);
    assert.strictEqual(syncShop.status, 'suspended');
    assert.strictEqual(syncShop.verification_status, 'suspended');
    assert.strictEqual(syncShop.qr_status, 'suspended');
    assert.strictEqual(syncShop.permanent_qr_code, permanentQr);
    assert.strictEqual(
      (await request({ path: '/api/customer/merchant-qr/pay', method: 'POST', headers: authHeaders(custToken) }, { qr_code: permanentQr, coins_amount: 5 })).status,
      403,
      'Suspended merchant QR payment blocked'
    );

    // Regenerating QR while suspended must NOT mark new qr_status as active
    assert.strictEqual(
      (await request({ path: `/api/admin/merchants/${syncShopId}/qr/regenerate`, method: 'POST', headers: authHeaders(superToken) }, { reason: 'Audit test while suspended' })).status,
      200
    );
    syncShop = db.prepare('SELECT * FROM shops WHERE id = ?').get(syncShopId);
    assert.strictEqual(syncShop.qr_status, 'suspended', 'Regenerating QR for suspended merchant preserves suspended qr_status');
    const secondQr = syncShop.permanent_qr_code;

    // Reactivate -> status/verification_status/qr_status all return active
    assert.strictEqual(
      (await request({ path: `/api/admin/shops/${syncShopId}/reactivate`, method: 'PUT', headers: authHeaders(superToken) })).status,
      200
    );
    syncShop = db.prepare('SELECT * FROM shops WHERE id = ?').get(syncShopId);
    assert.strictEqual(syncShop.status, 'active');
    assert.strictEqual(syncShop.verification_status, 'approved');
    assert.strictEqual(syncShop.qr_status, 'active');

    // Reject via /verify -> verification_status rejected, status inactive, qr_status suspended, lookup/pay blocked
    assert.strictEqual(
      (await request({ path: `/api/admin/merchants/${syncShopId}/verify`, method: 'PUT', headers: authHeaders(superToken) }, { action: 'rejected', reason: 'Docs failed' })).status,
      200
    );
    syncShop = db.prepare('SELECT * FROM shops WHERE id = ?').get(syncShopId);
    assert.strictEqual(syncShop.status, 'inactive');
    assert.strictEqual(syncShop.verification_status, 'rejected');
    assert.strictEqual(syncShop.qr_status, 'suspended');
    assert.strictEqual(
      (await request({ path: '/api/customer/merchant-qr/lookup', method: 'POST', headers: authHeaders(custToken) }, { qr_code: secondQr })).status,
      403,
      'Rejected merchant QR lookup blocked'
    );

    // Revoked QR status is preserved even across status reactivation
    db.prepare("UPDATE shops SET qr_status = 'revoked' WHERE id = ?").run(syncShopId);
    assert.strictEqual(
      (await request({ path: `/api/admin/shops/${syncShopId}/status`, method: 'PUT', headers: authHeaders(superToken) }, { status: 'active' })).status,
      200
    );
    syncShop = db.prepare('SELECT * FROM shops WHERE id = ?').get(syncShopId);
    assert.strictEqual(syncShop.qr_status, 'revoked', 'Explicitly revoked QR status must remain revoked on reactivation');

    // Verify historical coin_transfer & merchant wallet intact
    const transferCount = db.prepare('SELECT COUNT(*) AS c FROM coin_transfers WHERE merchant_id = ?').get(syncShopId).c;
    assert.strictEqual(transferCount, 1, 'Historical merchant transfer preserved across status/QR transitions');

    console.log('   ✓ Merchant status/verification/QR synchronization & permanent QR blocking verified.');

    // ------------------------------------------------------------------
    // SECTION 3: Rate Limiting & Anti-IP-Spoofing
    // ------------------------------------------------------------------
    console.log('[3/5] Testing rate limiting on admin login, password change, deletion, credentials & financial mutations...');
    _clearRateLimitStoreForTest();

    // Admin login limiter: 12 allowed, 13th returns 429 even when spoofing X-Forwarded-For from non-loopback IP
    const attackerIp = '198.51.100.77';
    for (let i = 1; i <= 12; i++) {
      const r = await request(
        {
          path: '/api/auth/admin/login',
          method: 'POST',
          headers: { ...jsonHeaders, 'X-Forwarded-For': `203.0.113.${i}` },
          ip: attackerIp
        },
        { email: superAdminEmail, password: 'WrongPassword123!' }
      );
      assert.strictEqual(r.status, 401, `Admin login attempt ${i}/12 should be 401, got ${r.status}`);
    }
    const adminBlocked = await request(
      {
        path: '/api/auth/admin/login',
        method: 'POST',
        headers: { ...jsonHeaders, 'X-Forwarded-For': '203.0.113.250' },
        ip: attackerIp
      },
      { email: superAdminEmail, password: strongPw }
    );
    assert.strictEqual(adminBlocked.status, 429, '13th admin login blocked with 429 despite spoofed X-Forwarded-For');
    assert.ok(!JSON.stringify(adminBlocked.body).includes(attackerIp), '429 response does not leak IP or internal store keys');

    // Public account deletion request limiter: 6 allowed, 7th returns 429
    const delIp = '198.51.100.88';
    for (let i = 1; i <= 6; i++) {
      const r = await request(
        { path: '/api/auth/request-account-deletion', method: 'POST', headers: jsonHeaders, ip: delIp },
        { identifier: `user${i}@example.com`, reason: 'test' }
      );
      assert.strictEqual(r.status, 200);
    }
    assert.strictEqual(
      (await request(
        { path: '/api/auth/request-account-deletion', method: 'POST', headers: jsonHeaders, ip: delIp },
        { identifier: 'user7@example.com', reason: 'test' }
      )).status,
      429,
      '7th public account deletion request returns 429'
    );

    // Parameterized credential reset limiter shares bucket across different :id params (15 allowed, 16th returns 429)
    const credIp = '198.51.100.89';
    for (let i = 1; i <= 15; i++) {
      const r = await request(
        { path: `/api/admin/shops/${i === 1 ? syncShopId : 999990 + i}/reset-credentials`, method: 'PUT', headers: authHeaders(superToken), ip: credIp }
      );
      assert.ok(r.status === 200 || r.status === 404, `Reset cred ${i}/15 returned unexpected ${r.status}`);
    }
    assert.strictEqual(
      (await request({ path: `/api/admin/shops/${syncShopId}/reset-credentials`, method: 'PUT', headers: authHeaders(superToken), ip: credIp })).status,
      429,
      '16th credential reset across varied :id returns 429'
    );

    // Customer DELETE /api/customer/account limiter: 5 allowed, 6th returns 429
    const custDelIp = '198.51.100.90';
    const ghostCustToken = jwt.sign({ id: 9999988, email: 'ghost@example.com', role: 'customer' }, JWT_SECRET, { expiresIn: '1h' });
    // Note: requireCompletedProfile blocks non-existent customer with 403 BEFORE DELETE /account route handler, so use existing user ID or test limiter via valid active user check
    const tempDelUser = db.prepare(`
      INSERT INTO users (full_name, email, phone, password_hash, status, profile_completed)
      VALUES ('Rate Cust', ?, ?, ?, 'active', 1)
    `).run(`ratecust_${unique}@example.com`, `98888${String(unique).slice(-5)}`, bcrypt.hashSync(strongPw, 10)).lastInsertRowid;
    const tempDelToken = jwt.sign({ id: tempDelUser, email: `ratecust_${unique}@example.com`, role: 'customer' }, JWT_SECRET, { expiresIn: '1h' });
    // First call deletes the user (200), subsequent calls fail profile lookup because user deleted — wait: let's insert fresh active user? Better: test rate limit BEFORE deleting or re-insert so all 5 hit handler:
    for (let i = 1; i <= 5; i++) {
      const uId = db.prepare(`
        INSERT INTO users (full_name, email, phone, password_hash, status, profile_completed)
        VALUES ('Rate Cust', ?, ?, ?, 'active', 1)
      `).run(`ratecust_${i}_${unique}@example.com`, `9777${i}${String(unique).slice(-5)}`, bcrypt.hashSync(strongPw, 10)).lastInsertRowid;
      const t = jwt.sign({ id: uId, email: `ratecust_${i}_${unique}@example.com`, role: 'customer' }, JWT_SECRET, { expiresIn: '1h' });
      const r = await request({ path: '/api/customer/account', method: 'DELETE', headers: authHeaders(t), ip: custDelIp });
      assert.strictEqual(r.status, 200);
    }
    const u6 = db.prepare(`
      INSERT INTO users (full_name, email, phone, password_hash, status, profile_completed)
      VALUES ('Rate Cust 6', ?, ?, ?, 'active', 1)
    `).run(`ratecust_6_${unique}@example.com`, `97776${String(unique).slice(-5)}`, bcrypt.hashSync(strongPw, 10)).lastInsertRowid;
    const t6 = jwt.sign({ id: u6, email: `ratecust_6_${unique}@example.com`, role: 'customer' }, JWT_SECRET, { expiresIn: '1h' });
    assert.strictEqual(
      (await request({ path: '/api/customer/account', method: 'DELETE', headers: authHeaders(t6), ip: custDelIp })).status,
      429,
      '6th DELETE /api/customer/account blocked with 429'
    );
    assert.ok(ghostCustToken.length > 0);
    assert.ok(tempDelToken.length > 0);

    // Admin password change limiter (10 allowed, 11th returns 429)
    const pwChIp = '198.51.100.91';
    for (let i = 1; i <= 10; i++) {
      const r = await request(
        { path: '/api/auth/admin/change-password', method: 'POST', headers: authHeaders(superToken), ip: pwChIp },
        { current_password: 'wrong', new_password: strongPw }
      );
      assert.strictEqual(r.status, 401);
    }
    assert.strictEqual(
      (await request(
        { path: '/api/auth/admin/change-password', method: 'POST', headers: authHeaders(superToken), ip: pwChIp },
        { current_password: 'wrong', new_password: strongPw }
      )).status,
      429,
      '11th admin password change blocked with 429'
    );

    console.log('   ✓ Rate limiting, anti-IP-spoofing & parameterized bucket sharing verified.');

    // ------------------------------------------------------------------
    // SECTION 4: Upload Security Hardening
    // ------------------------------------------------------------------
    console.log('[4/5] Testing upload authentication, magic bytes, SVG/spoofed MIME rejection & onboarding limits...');
    _clearRateLimitStoreForTest();

    // Unauthenticated rejected 401
    assert.strictEqual(
      (await request({ path: '/api/upload/image', method: 'POST', headers: jsonHeaders }, { image: VALID_PNG_URI, type: 'customer_profile' })).status,
      401
    );

    // Valid JPEG, PNG, WEBP succeed
    for (const [label, uri] of [['PNG', VALID_PNG_URI], ['JPEG', VALID_JPEG_URI], ['WEBP', VALID_WEBP_URI]]) {
      const r = await request({ path: '/api/upload/image', method: 'POST', headers: authHeaders(custToken) }, { image: uri, type: 'customer_profile' });
      assert.strictEqual(r.status, 200, `${label} valid upload should succeed (got ${r.status}: ${JSON.stringify(r.body)})`);
      uploadedFilenames.push(r.body.filename);
    }

    // Legacy omitted-type caller ({ image, folder }) remains compatible for merchant & review flows
    if (shopToken) {
      const rFolder = await request({ path: '/api/upload/image', method: 'POST', headers: authHeaders(shopToken) }, { image: VALID_PNG_URI, folder: 'merchant' });
      assert.strictEqual(rFolder.status, 200, 'Merchant folder upload remains compatible');
      uploadedFilenames.push(rFolder.body.filename);
    }

    // SVG MIME rejected
    const svgUri = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString('base64');
    assert.strictEqual(
      (await request({ path: '/api/upload/image', method: 'POST', headers: authHeaders(custToken) }, { image: svgUri, type: 'customer_profile' })).status,
      400,
      'SVG MIME rejected'
    );

    // Spoofed PNG MIME containing SVG / HTML / MZ exe / plain text rejected
    for (const fakePayload of [
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>',
      '<html><script>alert(1)</script></html>',
      Buffer.concat([Buffer.from([0x4d, 0x5a]), Buffer.alloc(32)]),
      'not a real png image at all'
    ]) {
      const spoofedUri = 'data:image/png;base64,' + Buffer.from(fakePayload).toString('base64');
      assert.strictEqual(
        (await request({ path: '/api/upload/image', method: 'POST', headers: authHeaders(custToken) }, { image: spoofedUri, type: 'customer_profile' })).status,
        400,
        'Spoofed PNG payload must be rejected with 400'
      );
    }

    // Truncated PNG magic bytes (only first 4 bytes valid, missing bytes 4..7) rejected
    const partialPngUri = 'data:image/png;base64,' + Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00, ...new Array(20).fill(0)]).toString('base64');
    assert.strictEqual(
      (await request({ path: '/api/upload/image', method: 'POST', headers: authHeaders(custToken) }, { image: partialPngUri, type: 'customer_profile' })).status,
      400,
      'Partial PNG header must be rejected'
    );

    // Invalid upload type (including non-string type object injection) cleanly returns 400 (never 500)
    assert.strictEqual(
      (await request({ path: '/api/upload/image', method: 'POST', headers: authHeaders(custToken) }, { image: VALID_PNG_URI, type: { bad: 1 } })).status,
      400,
      'Object injection in upload type cleanly rejected 400'
    );
    assert.strictEqual(
      (await request({ path: '/api/upload/image', method: 'POST', headers: authHeaders(custToken) }, { image: VALID_PNG_URI, type: 'unknown_type' })).status,
      400,
      'Unknown upload type rejected 400'
    );
    assert.strictEqual(
      (await request({ path: '/api/upload/image', method: 'POST', headers: authHeaders(custToken) }, { image: VALID_PNG_URI, type: 'shop_logo' })).status,
      403,
      'Customer cannot upload shop_logo type'
    );

    // Oversized base64 rejected (>10MB) without allocating huge output
    const hugeFakeB64 = 'data:image/png;base64,' + 'A'.repeat(14 * 1024 * 1024);
    assert.strictEqual(
      (await request({ path: '/api/upload/image', method: 'POST', headers: authHeaders(custToken) }, { image: hugeFakeB64, type: 'customer_profile' })).status,
      400,
      'Oversized >10MB upload rejected'
    );

    // Pending merchant onboarding token can ONLY upload shop_logo / shop_photo while pending
    const onbToken = jwt.sign(
      { id: syncShopId, shop_id: syncShopId, shop_code: syncShop.shop_code, email: syncShop.email, role: 'merchant_onboarding', scope: 'onboarding' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    // Currently syncShop is active/approved -> onboarding upload blocked
    assert.strictEqual(
      (await request({ path: '/api/upload/image', method: 'POST', headers: authHeaders(onbToken) }, { image: VALID_PNG_URI, type: 'shop_logo' })).status,
      403,
      'Onboarding token blocked after approval'
    );
    // Reset to pending and check onboarding restriction
    db.prepare("UPDATE shops SET status = 'pending', verification_status = 'pending', qr_status = 'pending' WHERE id = ?").run(syncShopId);
    assert.strictEqual(
      (await request({ path: '/api/upload/image', method: 'POST', headers: authHeaders(onbToken) }, { image: VALID_PNG_URI, type: 'product_photo' })).status,
      403,
      'Pending onboarding token blocked from product_photo'
    );
    const onbOk = await request({ path: '/api/upload/image', method: 'POST', headers: authHeaders(onbToken) }, { image: VALID_PNG_URI, type: 'shop_logo' });
    assert.strictEqual(onbOk.status, 200, 'Pending onboarding token allowed shop_logo');
    uploadedFilenames.push(onbOk.body.filename);

    console.log('   ✓ Upload security, magic bytes, SVG/spoofed MIME & role constraints verified.');

    // ------------------------------------------------------------------
    // SECTION 5: Audit log IP sanitization check
    // ------------------------------------------------------------------
    console.log('[5/5] Verifying audit log records trusted client IP without trusting arbitrary spoofed headers...');
    const latestAdminLog = db.prepare('SELECT ip_address FROM admin_activity_logs ORDER BY id DESC LIMIT 1').get();
    assert.ok(latestAdminLog, 'Admin activity log recorded');
    assert.ok(!String(latestAdminLog.ip_address).includes('203.0.113.'), 'Untrusted X-Forwarded-For ignored in audit logs');
    console.log('   ✓ Audit log IP hygiene verified.');

    console.log('\n🎉 ALL STAGE 5B.2 SECURITY TESTS PASSED (5/5 SECTIONS)!\n');
  } finally {
    const uploadsDir = path.join(__dirname, 'public', 'uploads');
    for (const fn of uploadedFilenames) {
      try {
        const p = path.join(uploadsDir, path.basename(fn));
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch (_) {}
    }
  }
}

runTests().catch((err) => {
  console.error('\n❌ STAGE 5B.2 TEST FAILED:', err);
  process.exit(1);
});
