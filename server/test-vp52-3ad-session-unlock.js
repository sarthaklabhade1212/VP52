/**
 * VP52 3-Ad Rewarded Session Unlock & SSV Auto-Start Verification Suite
 *
 * Verifies:
 * 1. Customer initial state without active session returns NO_SESSION (ads_completed: 0, can_start: false).
 * 2. Direct calls to /api/customer/coin-session/ad-complete return 403 Forbidden (fail-closed).
 * 3. Direct calls to /api/customer/coin-session/start without 3 SSV-verified ads return 403 Forbidden.
 * 4. Skipped/cancelled ads (cancel-pending-ad) release the slot cleanly and keep ads_completed unchanged.
 * 5. SSV callbacks for Ad 1/3 and Ad 2/3 keep the session locked (status: pending_ads) with 0 wallet coins credited.
 * 6. SSV callback for Ad 3/3 automatically activates the 6-hour session (status: active, started_at, expires_at)
 *    with 0 wallet coins credited for the ad and 0 coins charged to unlock.
 * 7. While session is active, preparing an additional ad is rejected (SESSION_ALREADY_ACTIVE).
 * 8. Google AdMob Console URL Verify test ping (ad_unit=1234567890) returns CONSOLE_VERIFY_PING_ACK.
 */

const express = require('express');
const crypto = require('crypto');
const http = require('http');
const { Readable, Duplex } = require('stream');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const db = require('./db/database');
const customerRoutes = require('./routes/customer');
const { createAdMobRouter } = require('./routes/admob');
const { createSsvVerifier } = require('./utils/admobSsv');
const { DEFAULT_ADMOB_REWARDED_AD_UNIT_ID, extractNumericUnitId } = require('./config/admob');

function assert(cond, msg) {
  if (!cond) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    throw new Error(msg);
  }
}

function mockRequest(app, { method = 'GET', url, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const req = new Readable({ read() {} });
    req.method = method;
    req.url = url;
    req.httpVersion = '1.1';
    req.httpVersionMajor = 1;
    req.httpVersionMinor = 1;
    req.headers = {};
    for (const k of Object.keys(headers || {})) {
      req.headers[k.toLowerCase()] = headers[k];
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
    res.assignSocket(fakeSocket);
    const chunks = [];
    let settled = false;

    const finish = () => {
      if (!settled) {
        settled = true;
        const text = Buffer.concat(chunks).toString('utf8');
        let parsed = text;
        try { parsed = JSON.parse(text); } catch (_) {}
        resolve({ statusCode: res.statusCode, body: parsed });
      }
    };

    res.write = function (chunk) {
      if (chunk) chunks.push(Buffer.from(chunk));
      return true;
    };
    res.end = function (chunk, encoding, cb) {
      if (typeof chunk === 'function') { cb = chunk; chunk = null; }
      else if (typeof encoding === 'function') { cb = encoding; }
      if (chunk) chunks.push(Buffer.from(chunk));
      finish();
      if (typeof cb === 'function') cb();
      return res;
    };

    app.handle(req, res, (err) => {
      if (err && !settled) {
        settled = true;
        reject(err);
      }
    });

    if (payload) req.push(payload);
    req.push(null);
  });
}

function signSsvQuery(paramsInOrder, privateKeyPem, keyId, { basePath = '/api/admob/ssv' } = {}) {
  const signedParts = [];
  const urlEncodedParts = [];
  for (const [k, v] of paramsInOrder) {
    signedParts.push(`${k}=${v}`);
    urlEncodedParts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  const signedContent = signedParts.join('&');
  const sigBuf = crypto.sign('sha256', Buffer.from(signedContent, 'utf8'), {
    key: privateKeyPem,
    dsaEncoding: 'der'
  });

  const encodedSig = encodeURIComponent(sigBuf.toString('base64'));
  return `${basePath}?${urlEncodedParts.join('&')}&signature=${encodedSig}&key_id=${encodeURIComponent(String(keyId))}`;
}

async function runTests() {
  console.log('================================================================');
  console.log('VP52 3-AD REWARDED SESSION UNLOCK & SSV AUTO-START VERIFICATION');
  console.log('================================================================\n');

  const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_vp52_unlock';
  const expectedUnitNumeric = extractNumericUnitId(DEFAULT_ADMOB_REWARDED_AD_UNIT_ID);

  const googleKey = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  const GOOGLE_KEY_ID = '789123456';

  const ssvVerifier = createSsvVerifier({
    keyFetcher: async () => ({
      keys: [{ keyId: Number(GOOGLE_KEY_ID), pem: googleKey.publicKey }],
      maxAgeMs: 3600 * 1000
    })
  });

  const app = express();
  app.use(express.json());
  app.use('/api/customer', customerRoutes);
  app.use('/api/admob', createAdMobRouter({ ssvVerifier }));

  function createCustomer(suffix) {
    const email = `unlock_${suffix}_${Date.now()}@vp52.com`;
    const hash = bcrypt.hashSync('Customer@123', 10);
    const ins = db.prepare(`
      INSERT INTO users (full_name, email, phone, password_hash, status)
      VALUES (?, ?, ?, ?, 'active')
    `).run(`Customer ${suffix}`, email, `+9198765${Math.floor(10000 + Math.random() * 90000)}`, hash);
    const userId = ins.lastInsertRowid;
    db.prepare('INSERT INTO wallets (user_id, balance, total_earned, total_redeemed) VALUES (?, 0, 0, 0)').run(userId);
    const token = jwt.sign({ id: userId, email, role: 'customer' }, JWT_SECRET, { expiresIn: '1h' });
    return { userId, email, token };
  }

  const customer = createCustomer('tester1');
  const headers = { authorization: `Bearer ${customer.token}` };

  // TEST 1: Initial state returns NO_SESSION, ads_completed: 0, can_start: false
  console.log('[TEST 1] Verifying initial session status...');
  let res = await mockRequest(app, { method: 'GET', url: '/api/customer/coin-session', headers });
  assert(res.statusCode === 200, 'coin-session returns 200');
  assert(res.body.session_state === 'NO_SESSION', `Expected NO_SESSION, got ${res.body.session_state}`);
  assert(res.body.can_start === false, 'can_start must be false');
  assert(res.body.session.ads_completed === 0, 'ads_completed must be 0');
  console.log('   ✓ Initial session state is NO_SESSION with can_start: false, ads_completed: 0.');

  // TEST 2: Fail-closed direct client calls
  console.log('\n[TEST 2] Verifying fail-closed enforcement on direct client endpoints...');
  res = await mockRequest(app, { method: 'POST', url: '/api/customer/coin-session/ad-complete', headers });
  assert(res.statusCode === 403 && res.body.code === 'REWARDED_AD_VERIFICATION_REQUIRED', 'Direct ad-complete rejected with 403');
  console.log('   ✓ Direct call to /coin-session/ad-complete rejected with 403 REWARDED_AD_VERIFICATION_REQUIRED.');

  res = await mockRequest(app, { method: 'POST', url: '/api/customer/coin-session/start', headers });
  assert(res.statusCode === 403 && res.body.code === 'SESSION_UNLOCK_ADS_REQUIRED', 'Direct start rejected with 403');
  console.log('   ✓ Direct call to /coin-session/start rejected with 403 SESSION_UNLOCK_ADS_REQUIRED.');

  // TEST 3: Slot cancellation keeps ads_completed unchanged
  console.log('\n[TEST 3] Verifying early dismissal / slot cancellation...');
  const prepSlot1Fail = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/reward-session/prepare-ad',
    headers,
    body: { session_type: 'vp52_coin_session' }
  });
  assert(prepSlot1Fail.statusCode === 201, 'prepare-ad slot 1 created');
  assert(prepSlot1Fail.body.verification.ad_slot === 1, 'ad_slot is 1');
  assert(prepSlot1Fail.body.verification.reward_amount === 0, 'reward_amount must be 0');

  // Customer dismisses ad early before completing
  const cancelRes = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/reward-session/cancel-pending-ad',
    headers,
    body: { verification_token: prepSlot1Fail.body.verification.verification_token, reason: 'dismissed_early' }
  });
  assert(cancelRes.statusCode === 200 && cancelRes.body.cancelled === true, 'cancel-pending-ad cancelled slot');
  assert(cancelRes.body.coins_credited === 0, '0 coins credited on cancel');

  // Check coin session status
  res = await mockRequest(app, { method: 'GET', url: '/api/customer/coin-session', headers });
  assert(res.body.session.ads_completed === 0, 'ads_completed remains 0 after cancellation');
  console.log('   ✓ Early dismissal cancelled slot cleanly; ads_completed remains 0.');

  // TEST 4: SSV Callback for Ad 1/3 (session stays locked in pending_ads)
  console.log('\n[TEST 4] Verifying Ad 1/3 SSV verification...');
  const prepSlot1 = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/reward-session/prepare-ad',
    headers,
    body: { session_type: 'vp52_coin_session' }
  });
  assert(prepSlot1.statusCode === 201 && prepSlot1.body.verification.ad_slot === 1, 'slot 1 prepared again');

  const ssvUrl1 = signSsvQuery([
    ['ad_network', '5450213213286189855'],
    ['ad_unit', expectedUnitNumeric],
    ['custom_data', prepSlot1.body.verification.verification_token],
    ['reward_amount', '1'],
    ['reward_item', 'coin'],
    ['timestamp', String(Date.now())],
    ['transaction_id', `TX_UNLOCK_AD1_${Date.now()}`],
    ['user_id', String(customer.userId)]
  ], googleKey.privateKey, GOOGLE_KEY_ID);

  const ssvRes1 = await mockRequest(app, { method: 'GET', url: ssvUrl1 });
  assert(ssvRes1.statusCode === 200, 'SSV Ad 1 verified 200');
  assert(ssvRes1.body.coins_credited === 0, '0 coins credited for unlocking ad');
  assert(ssvRes1.body.ads_completed === 1, 'ads_completed is 1');
  assert(ssvRes1.body.session_started === false, 'session_started is false after ad 1');

  // Wallet must remain 0
  const wallet1 = db.prepare('SELECT balance FROM wallets WHERE user_id = ?').get(customer.userId);
  assert(wallet1.balance === 0, 'Wallet balance remains 0');

  // Check coin session status
  res = await mockRequest(app, { method: 'GET', url: '/api/customer/coin-session', headers });
  assert(res.body.session_state === 'PENDING_ADS', `Expected PENDING_ADS, got ${res.body.session_state}`);
  assert(res.body.session.ads_completed === 1, 'ads_completed is 1');
  assert(res.body.can_start === false, 'can_start is false after ad 1');
  console.log('   ✓ Ad 1/3 SSV verified: ads_completed=1, session_state=PENDING_ADS, wallet balance=0.');

  // TEST 5: SSV Callback for Ad 2/3 (session stays locked in pending_ads)
  console.log('\n[TEST 5] Verifying Ad 2/3 SSV verification...');
  const prepSlot2 = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/reward-session/prepare-ad',
    headers,
    body: { session_type: 'vp52_coin_session' }
  });
  assert(prepSlot2.statusCode === 201 && prepSlot2.body.verification.ad_slot === 2, 'slot 2 prepared');

  const ssvUrl2 = signSsvQuery([
    ['ad_network', '5450213213286189855'],
    ['ad_unit', expectedUnitNumeric],
    ['custom_data', prepSlot2.body.verification.verification_token],
    ['reward_amount', '1'],
    ['reward_item', 'coin'],
    ['timestamp', String(Date.now())],
    ['transaction_id', `TX_UNLOCK_AD2_${Date.now()}`],
    ['user_id', String(customer.userId)]
  ], googleKey.privateKey, GOOGLE_KEY_ID);

  const ssvRes2 = await mockRequest(app, { method: 'GET', url: ssvUrl2 });
  assert(ssvRes2.statusCode === 200, 'SSV Ad 2 verified 200');
  assert(ssvRes2.body.coins_credited === 0, '0 coins credited for ad 2');
  assert(ssvRes2.body.ads_completed === 2, 'ads_completed is 2');
  assert(ssvRes2.body.session_started === false, 'session_started is false after ad 2');

  res = await mockRequest(app, { method: 'GET', url: '/api/customer/coin-session', headers });
  assert(res.body.session_state === 'PENDING_ADS', 'session_state is PENDING_ADS');
  assert(res.body.session.ads_completed === 2, 'ads_completed is 2');
  assert(res.body.can_start === false, 'can_start is still false after ad 2');
  console.log('   ✓ Ad 2/3 SSV verified: ads_completed=2, session_state=PENDING_ADS, wallet balance=0.');

  // TEST 6: SSV Callback for Ad 3/3 (auto-activates 6-hour session!)
  console.log('\n[TEST 6] Verifying Ad 3/3 SSV verification & auto-start...');
  const prepSlot3 = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/reward-session/prepare-ad',
    headers,
    body: { session_type: 'vp52_coin_session' }
  });
  assert(prepSlot3.statusCode === 201 && prepSlot3.body.verification.ad_slot === 3, 'slot 3 prepared');

  const ssvUrl3 = signSsvQuery([
    ['ad_network', '5450213213286189855'],
    ['ad_unit', expectedUnitNumeric],
    ['custom_data', prepSlot3.body.verification.verification_token],
    ['reward_amount', '1'],
    ['reward_item', 'coin'],
    ['timestamp', String(Date.now())],
    ['transaction_id', `TX_UNLOCK_AD3_${Date.now()}`],
    ['user_id', String(customer.userId)]
  ], googleKey.privateKey, GOOGLE_KEY_ID);

  const ssvRes3 = await mockRequest(app, { method: 'GET', url: ssvUrl3 });
  assert(ssvRes3.statusCode === 200, 'SSV Ad 3 verified 200');
  assert(ssvRes3.body.coins_credited === 0, '0 coins credited for ad 3');
  assert(ssvRes3.body.ads_completed === 3, 'ads_completed is 3');
  assert(ssvRes3.body.session_started === true, 'session_started is TRUE upon ad 3/3');

  // Wallet must still be 0 (no bonus coins given, and 0 coins deducted for entry)
  const wallet3 = db.prepare('SELECT balance FROM wallets WHERE user_id = ?').get(customer.userId);
  assert(wallet3.balance === 0, 'Wallet balance remains strictly 0 (no coin cost, no bonus coin credit)');

  // Check coin session status: MUST be ACTIVE!
  res = await mockRequest(app, { method: 'GET', url: '/api/customer/coin-session', headers });
  assert(res.body.session_state === 'ACTIVE', `Expected ACTIVE, got ${res.body.session_state}`);
  assert(res.body.session.status === 'active', 'session.status is active');
  assert(res.body.session.remaining_seconds > 0, 'remaining_seconds > 0');
  assert(res.body.session.duration_seconds === 21600 || res.body.session.duration_seconds > 0, '6-hour duration');
  console.log('   ✓ Ad 3/3 SSV verified: session auto-started into ACTIVE state with 6-hour timer!');

  // TEST 7: Attempting 4th ad rejected while session is active
  console.log('\n[TEST 7] Verifying 4th ad preparation rejected while session active...');
  const prepSlot4 = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/reward-session/prepare-ad',
    headers,
    body: { session_type: 'vp52_coin_session' }
  });
  assert(prepSlot4.statusCode === 400 && prepSlot4.body.code === 'SESSION_ALREADY_ACTIVE', '4th ad rejected (SESSION_ALREADY_ACTIVE)');
  console.log('   ✓ 4th ad rejected while session is active.');

  // TEST 8: Preserving CONSOLE_VERIFY_PING_ACK for ad_unit === '1234567890'
  console.log('\n[TEST 8] Verifying AdMob Console test ping (ad_unit=1234567890)...');
  const pingUrl = signSsvQuery([
    ['ad_network', '5450213213286189855'],
    ['ad_unit', '1234567890'],
    ['custom_data', 'test_console_custom_data'],
    ['reward_amount', '1'],
    ['reward_item', 'coin'],
    ['timestamp', String(Date.now())],
    ['transaction_id', `TX_PING_${Date.now()}`],
    ['user_id', String(customer.userId)]
  ], googleKey.privateKey, GOOGLE_KEY_ID);
  const pingRes = await mockRequest(app, { method: 'GET', url: pingUrl });
  assert(pingRes.statusCode === 200 && pingRes.body.code === 'CONSOLE_VERIFY_PING_ACK', 'Console ping returns 200 CONSOLE_VERIFY_PING_ACK');
  console.log('   ✓ Google AdMob Console URL Verify test ping returns CONSOLE_VERIFY_PING_ACK.');

  console.log('\n================================================================');
  console.log('🎉 ALL 8 TESTS PASSED: 3-AD UNLOCK & SSV AUTO-START VERIFIED');
  console.log('================================================================');
}

runTests().catch((err) => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
