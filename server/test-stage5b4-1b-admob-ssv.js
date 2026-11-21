/**
 * Stage 5B.4.1B Isolated Test Suite — Google AdMob SSV Callback Preparation
 *
 * Tests cryptographic ECDSA verification, pending verification records (3 ads per
 * 6-hour session), atomic 1-coin ledger crediting, replay protection, safe duplicate
 * Google retries, expired records, wrong ad units, simultaneous callbacks, key
 * rotation refresh, and client-side fail-closed guards.
 *
 * Run against an isolated scratch copy (never mutates server/db/rewards.db).
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
const adminRoutes = require('./routes/admin');
const { createAdMobRouter } = require('./routes/admob');
const { createSsvVerifier } = require('./utils/admobSsv');
const { DEFAULT_ADMOB_APP_ID, DEFAULT_ADMOB_REWARDED_AD_UNIT_ID, extractNumericUnitId } = require('./config/admob');

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

function signSsvQuery(paramsInOrder, privateKeyPem, keyId, { urlSafeBase64 = false, basePath = '/api/admob/ssv' } = {}) {
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

  const encodedSig = urlSafeBase64
    ? sigBuf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    : encodeURIComponent(sigBuf.toString('base64'));

  return `${basePath}?${urlEncodedParts.join('&')}&signature=${encodedSig}&key_id=${encodeURIComponent(String(keyId))}`;
}

async function runTests() {
  console.log('====================================================');
  console.log('VP52 STAGE 5B.4.1B — ADMOB SSV CALLBACK TEST SUITE');
  console.log('====================================================\n');

  const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_vp52_5b41b';
  const expectedUnitNumeric = extractNumericUnitId(DEFAULT_ADMOB_REWARDED_AD_UNIT_ID);
  assert(expectedUnitNumeric === '8368553876', `Expected numeric unit 8368553876, got ${expectedUnitNumeric}`);
  assert(DEFAULT_ADMOB_APP_ID === 'ca-app-pub-4004834464698326~8764285486', 'Configured App ID matches');

  // Generate two real ECDSA P-256 keypairs (Google active key + rotated/rogue keys)
  const googleKey1 = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  const googleKey2 = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  const attackerKey = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  const GOOGLE_KEY_ID_1 = '3335741209';
  const GOOGLE_KEY_ID_2 = '3335749999';
  let includeRotatedKey = false;

  const ssvVerifier = createSsvVerifier({
    keyFetcher: async () => {
      const keys = [{ keyId: Number(GOOGLE_KEY_ID_1), pem: googleKey1.publicKey }];
      if (includeRotatedKey) {
        // Test SPKI DER base64 parsing path on key rotation
        keys.push({ keyId: Number(GOOGLE_KEY_ID_2), base64: googleKey2.publicKey.toString('base64') });
      }
      return { keys, maxAgeMs: 3600 * 1000 };
    }
  });

  const app = express();
  app.use(express.json());
  app.use('/api/customer', customerRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/admob', createAdMobRouter({ ssvVerifier }));

  // Helper to provision fresh active test customer
  function createTestCustomer(suffix) {
    const email = `ssv_cust_${suffix}_${Date.now()}@vp52.com`;
    const hash = bcrypt.hashSync('Customer@123', 10);
    const ins = db.prepare(`
      INSERT INTO users (full_name, email, phone, password_hash, status, auth_provider, profile_completed)
      VALUES (?, ?, ?, ?, 'active', 'local', 1)
    `).run(`SSV User ${suffix}`, email, `+919899${String(Math.floor(100000 + Math.random() * 899999))}`, hash);
    const userId = Number(ins.lastInsertRowid);
    db.prepare('INSERT INTO wallets (user_id, balance, total_earned, total_redeemed) VALUES (?, 0, 0, 0)').run(userId);
    const token = jwt.sign({ id: userId, email, role: 'customer' }, JWT_SECRET, { expiresIn: '2h' });
    return { userId, email, token };
  }

  function getWalletBalance(userId) {
    return db.prepare('SELECT balance, total_earned FROM wallets WHERE user_id = ?').get(userId);
  }

  // =========================================================================
  // TEST 1: Client-side callback endpoints MUST fail closed & 0 coins credited
  // =========================================================================
  console.log('[TEST 1] Client-side ad callbacks rejected without crediting coins...');
  const cust1 = createTestCustomer('c1');
  let res = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/watch-ad',
    headers: { authorization: `Bearer ${cust1.token}` },
    body: { watch_duration_seconds: 10 }
  });
  assert(res.statusCode === 403 && res.body.code === 'REWARDED_AD_VERIFICATION_REQUIRED', 'POST /watch-ad fails closed 403');

  res = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/reward-session/watch-ad',
    headers: { authorization: `Bearer ${cust1.token}` },
    body: {}
  });
  assert(res.statusCode === 403 && res.body.code === 'REWARDED_AD_VERIFICATION_REQUIRED', 'POST /reward-session/watch-ad fails closed 403');
  assert(getWalletBalance(cust1.userId).balance === 0, 'Balance remains 0 after client callback attempts');
  console.log('   ✓ Client-side callbacks rejected (403), balance stays 0.');

  // =========================================================================
  // TEST 2: Prepare 3 separate pending verification records & verify valid SSV
  // =========================================================================
  console.log('\n[TEST 2] Preparing 3 separate pending records (6h session) & validating official ECDSA SSV...');
  res = await mockRequest(app, {
    method: 'GET',
    url: '/api/customer/reward-session/status',
    headers: { authorization: `Bearer ${cust1.token}` }
  });
  assert(res.statusCode === 200 && res.body.session.max_ads === 3 && res.body.session.coins_per_ad === 1, '6h session initialized with max_ads=3 and coins_per_ad=1');

  const pendingSlots = [];
  for (let slot = 1; slot <= 3; slot++) {
    const prep = await mockRequest(app, {
      method: 'POST',
      url: '/api/customer/reward-session/prepare-ad',
      headers: { authorization: `Bearer ${cust1.token}` },
      body: { session_type: 'reward_session' }
    });
    assert(prep.statusCode === 201 && prep.body.success === true, `Prepared pending record for ad slot ${slot}`);
    assert(prep.body.verification.ad_slot === slot, `Assigned slot ${slot}`);
    assert(prep.body.verification.reward_amount === 1 && prep.body.verification.reward_item === 'coin', 'Reward fixed to 1 coin');
    assert(prep.body.verification.ad_unit_id === DEFAULT_ADMOB_REWARDED_AD_UNIT_ID, 'Uses real rewarded ad unit ID');
    pendingSlots.push(prep.body.verification);
  }

  // Preparing creates pending records only — ZERO coins credited before Google callback
  assert(getWalletBalance(cust1.userId).balance === 0, 'Preparing pending records credits 0 coins');

  // Attempt 4th prepare while 3 slots are active -> blocked
  const prep4 = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/reward-session/prepare-ad',
    headers: { authorization: `Bearer ${cust1.token}` },
    body: { session_type: 'reward_session' }
  });
  assert(prep4.statusCode === 400 && prep4.body.code === 'ALL_SLOTS_ALLOCATED', '4th ad slot blocked');

  // Verify each of the 3 ads with valid Google ECDSA signatures (testing standard base64 + base64url + /ssv-callback alias)
  for (let i = 0; i < 3; i++) {
    const slotRec = pendingSlots[i];
    const txId = `GOOGLE_TX_${cust1.userId}_${i + 1}_${Date.now()}`;
    const url = signSsvQuery([
      ['ad_network', '5450213213286189855'],
      ['ad_unit', expectedUnitNumeric],
      ['custom_data', slotRec.verification_token],
      ['reward_amount', '1'],
      ['reward_item', 'coin'],
      ['timestamp', String(Date.now())],
      ['transaction_id', txId],
      ['user_id', String(cust1.userId)]
    ], googleKey1.privateKey, GOOGLE_KEY_ID_1, {
      urlSafeBase64: i === 1, // test base64url on slot 2
      basePath: i === 2 ? '/api/admob/ssv-callback' : '/api/admob/ssv'
    });

    const ssvRes = await mockRequest(app, { method: 'GET', url });
    assert(ssvRes.statusCode === 200 && ssvRes.body.verified === true, `Slot ${i + 1} SSV callback verified (200)`);
    assert(ssvRes.body.coins_credited === 1, `Slot ${i + 1} credited exactly 1 coin`);
    assert(ssvRes.body.newBalance === i + 1, `Wallet balance incremented to ${i + 1}`);
  }

  const walletAfter3 = getWalletBalance(cust1.userId);
  assert(walletAfter3.balance === 3 && walletAfter3.total_earned === 3, 'Total wallet balance and total_earned equal 3');

  // Check coin_lots, point_ledger, reward_transactions, reward_sessions consistency
  const lots = db.prepare("SELECT * FROM coin_lots WHERE user_id = ? AND source = 'AD_REWARD'").all(cust1.userId);
  assert(lots.length === 3 && lots.every(l => l.coins_earned === 1 && l.coins_remaining === 1 && l.tier === 'Bronze'), '3 separate Bronze 1-coin lots created');
  const ledgerRows = db.prepare("SELECT * FROM point_ledger WHERE user_id = ? AND source = 'admob_ssv'").all(cust1.userId);
  assert(ledgerRows.length === 3 && ledgerRows.every(r => r.points === 1), '3 atomic point_ledger rows created with points=1');
  const rewardSessionRow = db.prepare('SELECT * FROM reward_sessions WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(cust1.userId);
  assert(rewardSessionRow.ads_watched === 3 && rewardSessionRow.coins_earned === 3 && rewardSessionRow.status === 'completed', 'reward_session recorded 3/3 ads & completed');

  // Ensure another prepare-ad in the SAME 6-hour session is blocked
  const prepAfter3 = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/reward-session/prepare-ad',
    headers: { authorization: `Bearer ${cust1.token}` },
    body: { session_type: 'reward_session' }
  });
  assert(prepAfter3.statusCode === 400 && prepAfter3.body.code === 'SESSION_AD_LIMIT_REACHED', 'Blocked >3 ads in same 6-hour session');
  console.log('   ✓ 3 separate pending records prepared, verified via ECDSA, and credited 1 coin each atomically (max 3/6h enforced).');

  // =========================================================================
  // TEST 3: Invalid signatures, unknown key_id, tampered query & HTTP smuggling
  // =========================================================================
  console.log('\n[TEST 3] Invalid signature, tampered payload, unknown key_id & param pollution rejection...');
  const cust2 = createTestCustomer('c2');
  const prepC2 = (await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/reward-session/prepare-ad',
    headers: { authorization: `Bearer ${cust2.token}` }
  })).body.verification;

  // 3a. Signed with wrong (attacker) private key
  const wrongKeyUrl = signSsvQuery([
    ['ad_network', '5450213213286189855'],
    ['ad_unit', expectedUnitNumeric],
    ['custom_data', prepC2.verification_token],
    ['reward_amount', '1'],
    ['reward_item', 'coin'],
    ['timestamp', String(Date.now())],
    ['transaction_id', 'TX_ATTACKER_KEY'],
    ['user_id', String(cust2.userId)]
  ], attackerKey.privateKey, GOOGLE_KEY_ID_1);
  res = await mockRequest(app, { method: 'GET', url: wrongKeyUrl });
  assert(res.statusCode === 403 && res.body.code === 'INVALID_SSV_SIGNATURE' && res.body.coins_credited === 0, 'Wrong key signature rejected (403)');

  // 3b. Valid signature then tampered parameter
  const validC2Url = signSsvQuery([
    ['ad_network', '5450213213286189855'],
    ['ad_unit', expectedUnitNumeric],
    ['custom_data', prepC2.verification_token],
    ['reward_amount', '1'],
    ['reward_item', 'coin'],
    ['timestamp', String(Date.now())],
    ['transaction_id', 'TX_TAMPER_ORIG'],
    ['user_id', String(cust2.userId)]
  ], googleKey1.privateKey, GOOGLE_KEY_ID_1);
  const tamperedUrl = validC2Url.replace('reward_amount=1', 'reward_amount=999');
  res = await mockRequest(app, { method: 'GET', url: tamperedUrl });
  assert(res.statusCode === 403 && res.body.code === 'INVALID_SSV_SIGNATURE' && res.body.coins_credited === 0, 'Tampered query parameter rejected (403)');

  // 3c. Unknown key_id
  const unknownKeyUrl = validC2Url.replace(`key_id=${GOOGLE_KEY_ID_1}`, 'key_id=999999999');
  res = await mockRequest(app, { method: 'GET', url: unknownKeyUrl });
  assert(res.statusCode === 403 && res.body.code === 'UNKNOWN_KEY_ID' && res.body.coins_credited === 0, 'Unknown key_id rejected (403)');

  // 3d. Duplicate parameter smuggling / missing signature
  res = await mockRequest(app, { method: 'GET', url: `${validC2Url}&ad_unit=evil` });
  assert(res.statusCode === 400 && res.body.code === 'DUPLICATE_QUERY_PARAM' && res.body.coins_credited === 0, 'Parameter pollution rejected (400)');

  res = await mockRequest(app, { method: 'GET', url: `/api/admob/ssv?ad_unit=${expectedUnitNumeric}&custom_data=${prepC2.verification_token}&key_id=${GOOGLE_KEY_ID_1}` });
  assert(res.statusCode === 400 && res.body.code === 'MISSING_SIGNATURE' && res.body.coins_credited === 0, 'Missing signature rejected (400)');

  // Confirm pending record was NOT poisoned by invalid attacker requests!
  const stillPending = db.prepare('SELECT status FROM admob_ssv_verifications WHERE verification_token = ?').get(prepC2.verification_token);
  assert(stillPending.status === 'pending', 'Invalid SSV attacks do not poison valid pending record');
  assert(getWalletBalance(cust2.userId).balance === 0, 'Balance remains 0 after all invalid signature checks');
  console.log('   ✓ Wrong key, tampered payload, unknown key_id, duplicate params & missing signature all rejected cleanly.');

  // =========================================================================
  // TEST 4: Duplicate callbacks (safe retry) & transaction_id replay protection
  // =========================================================================
  console.log('\n[TEST 4] Duplicate Google callback retries (safe idempotent 200) & replay protection...');
  const txC2 = `TX_C2_SLOT1_${Date.now()}`;
  const validC2RealUrl = signSsvQuery([
    ['ad_network', '5450213213286189855'],
    ['ad_unit', expectedUnitNumeric],
    ['custom_data', prepC2.verification_token],
    ['reward_amount', '1'],
    ['reward_item', 'coin'],
    ['timestamp', String(Date.now())],
    ['transaction_id', txC2],
    ['user_id', String(cust2.userId)]
  ], googleKey1.privateKey, GOOGLE_KEY_ID_1);

  const firstCall = await mockRequest(app, { method: 'GET', url: validC2RealUrl });
  assert(firstCall.statusCode === 200 && firstCall.body.coins_credited === 1, 'First valid callback credits 1 coin');

  // Exact Google retry (same transaction_id & token)
  const retryCall1 = await mockRequest(app, { method: 'GET', url: validC2RealUrl });
  assert(retryCall1.statusCode === 200 && retryCall1.body.duplicate === true && retryCall1.body.coins_credited === 0, 'Duplicate Google retry returns HTTP 200 with 0 extra coins');
  assert(getWalletBalance(cust2.userId).balance === 1, 'Balance unchanged at 1 coin after duplicate retry');

  // Prepare 2nd slot for cust2 and try replaying txC2 against 2nd slot -> MUST REJECT (409)!
  const prepC2Slot2 = (await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/reward-session/prepare-ad',
    headers: { authorization: `Bearer ${cust2.token}` }
  })).body.verification;

  const replayedTxOnSlot2Url = signSsvQuery([
    ['ad_network', '5450213213286189855'],
    ['ad_unit', expectedUnitNumeric],
    ['custom_data', prepC2Slot2.verification_token],
    ['reward_amount', '1'],
    ['reward_item', 'coin'],
    ['timestamp', String(Date.now())],
    ['transaction_id', txC2],
    ['user_id', String(cust2.userId)]
  ], googleKey1.privateKey, GOOGLE_KEY_ID_1);

  const replayCrossRes = await mockRequest(app, { method: 'GET', url: replayedTxOnSlot2Url });
  assert(replayCrossRes.statusCode === 409 && replayCrossRes.body.code === 'TRANSACTION_ID_ALREADY_USED' && replayCrossRes.body.coins_credited === 0, 'Reused transaction_id on 2nd pending record rejected (409)');

  // Try using a new transaction_id against the already-verified Slot 1 token -> MUST REJECT (409)!
  const newTxOldTokenUrl = signSsvQuery([
    ['ad_network', '5450213213286189855'],
    ['ad_unit', expectedUnitNumeric],
    ['custom_data', prepC2.verification_token],
    ['reward_amount', '1'],
    ['reward_item', 'coin'],
    ['timestamp', String(Date.now())],
    ['transaction_id', 'TX_NEW_FOR_OLD_SLOT1'],
    ['user_id', String(cust2.userId)]
  ], googleKey1.privateKey, GOOGLE_KEY_ID_1);
  const oldTokRes = await mockRequest(app, { method: 'GET', url: newTxOldTokenUrl });
  assert(oldTokRes.statusCode === 409 && oldTokRes.body.code === 'VERIFICATION_ALREADY_USED' && oldTokRes.body.coins_credited === 0, 'Consumed verification_token rejected with new transaction_id (409)');
  assert(getWalletBalance(cust2.userId).balance === 1, 'Balance remains 1 coin after all replay attempts');
  console.log('   ✓ Google retries handled idempotently (200, +0 coins); cross-record/token replays blocked (409).');

  // =========================================================================
  // TEST 5: Wrong ad unit IDs & tampered reward_amount/reward_item
  // =========================================================================
  console.log('\n[TEST 5] Wrong ad units (test unit, wrong pub, wrong unit) & reward config validation...');
  const wrongAdUnits = [
    '5224354917', // Google sample rewarded unit ID
    'ca-app-pub-3940256099942544/5224354917',
    `ca-app-pub-9999999999999999/${expectedUnitNumeric}`,
    '9999999999'
  ];

  for (let i = 0; i < wrongAdUnits.length; i++) {
    const badUnitUrl = signSsvQuery([
      ['ad_network', '5450213213286189855'],
      ['ad_unit', wrongAdUnits[i]],
      ['custom_data', prepC2Slot2.verification_token],
      ['reward_amount', '1'],
      ['reward_item', 'coin'],
      ['timestamp', String(Date.now())],
      ['transaction_id', `TX_BAD_UNIT_${i}`],
      ['user_id', String(cust2.userId)]
    ], googleKey1.privateKey, GOOGLE_KEY_ID_1);
    const badRes = await mockRequest(app, { method: 'GET', url: badUnitUrl });
    assert(badRes.statusCode === 400 && badRes.body.code === 'INVALID_AD_UNIT' && badRes.body.coins_credited === 0, `Wrong ad_unit rejected: ${wrongAdUnits[i]}`);
  }

  // Wrong reward_amount (2) or reward_item ('gold') even with valid signature
  const wrongRewardAmtUrl = signSsvQuery([
    ['ad_network', '5450213213286189855'],
    ['ad_unit', expectedUnitNumeric],
    ['custom_data', prepC2Slot2.verification_token],
    ['reward_amount', '2'],
    ['reward_item', 'coin'],
    ['timestamp', String(Date.now())],
    ['transaction_id', 'TX_BAD_AMT'],
    ['user_id', String(cust2.userId)]
  ], googleKey1.privateKey, GOOGLE_KEY_ID_1);
  res = await mockRequest(app, { method: 'GET', url: wrongRewardAmtUrl });
  assert(res.statusCode === 400 && res.body.code === 'INVALID_REWARD_CONFIG' && res.body.coins_credited === 0, 'Wrong reward_amount rejected (400)');

  const wrongRewardItemUrl = signSsvQuery([
    ['ad_network', '5450213213286189855'],
    ['ad_unit', expectedUnitNumeric],
    ['custom_data', prepC2Slot2.verification_token],
    ['reward_amount', '1'],
    ['reward_item', 'diamond'],
    ['timestamp', String(Date.now())],
    ['transaction_id', 'TX_BAD_ITEM'],
    ['user_id', String(cust2.userId)]
  ], googleKey1.privateKey, GOOGLE_KEY_ID_1);
  res = await mockRequest(app, { method: 'GET', url: wrongRewardItemUrl });
  assert(res.statusCode === 400 && res.body.code === 'INVALID_REWARD_CONFIG' && res.body.coins_credited === 0, 'Wrong reward_item rejected (400)');
  assert(getWalletBalance(cust2.userId).balance === 1, 'Balance unchanged after wrong ad_unit & reward checks');
  console.log('   ✓ Wrong ad units (including sample test unit & wrong publisher) and altered rewards rejected (400).');

  // =========================================================================
  // TEST 6: Expired pending verification record & expired 6-hour session
  // =========================================================================
  console.log('\n[TEST 6] Expired pending verification records & expired 6-hour sessions...');
  db.prepare(`
    UPDATE admob_ssv_verifications
    SET expires_at = datetime('now', '-5 minutes')
    WHERE verification_token = ?
  `).run(prepC2Slot2.verification_token);

  const expiredPendingUrl = signSsvQuery([
    ['ad_network', '5450213213286189855'],
    ['ad_unit', expectedUnitNumeric],
    ['custom_data', prepC2Slot2.verification_token],
    ['reward_amount', '1'],
    ['reward_item', 'coin'],
    ['timestamp', String(Date.now())],
    ['transaction_id', `TX_EXPIRED_PENDING_${Date.now()}`],
    ['user_id', String(cust2.userId)]
  ], googleKey1.privateKey, GOOGLE_KEY_ID_1);
  res = await mockRequest(app, { method: 'GET', url: expiredPendingUrl });
  assert(res.statusCode === 400 && res.body.code === 'VERIFICATION_EXPIRED' && res.body.coins_credited === 0, 'Expired pending verification rejected (400)');
  const expiredRow = db.prepare('SELECT status FROM admob_ssv_verifications WHERE verification_token = ?').get(prepC2Slot2.verification_token);
  assert(expiredRow.status === 'expired', 'Expired pending record transitioned to expired');

  // Slot 2 should now be re-preparable within the active 6h session since it expired unused
  const prepC2Slot2Again = (await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/reward-session/prepare-ad',
    headers: { authorization: `Bearer ${cust2.token}` }
  }));
  assert(prepC2Slot2Again.statusCode === 201 && prepC2Slot2Again.body.verification.ad_slot === 2, 'Freed slot 2 can be re-prepared after expiration');

  // Expire the parent 6h session itself
  db.prepare('UPDATE reward_sessions SET end_time = datetime(\'now\', \'-1 minute\') WHERE user_id = ?').run(cust2.userId);
  const expiredSessionUrl = signSsvQuery([
    ['ad_network', '5450213213286189855'],
    ['ad_unit', expectedUnitNumeric],
    ['custom_data', prepC2Slot2Again.body.verification.verification_token],
    ['reward_amount', '1'],
    ['reward_item', 'coin'],
    ['timestamp', String(Date.now())],
    ['transaction_id', `TX_EXPIRED_SESS_${Date.now()}`],
    ['user_id', String(cust2.userId)]
  ], googleKey1.privateKey, GOOGLE_KEY_ID_1);
  res = await mockRequest(app, { method: 'GET', url: expiredSessionUrl });
  assert(res.statusCode === 400 && res.body.code === 'SESSION_EXPIRED' && res.body.coins_credited === 0, 'Expired 6h session rejected (400)');
  assert(getWalletBalance(cust2.userId).balance === 1, 'Balance remained 1 coin on expired record/session checks');
  console.log('   ✓ Expired pending records & expired 6-hour sessions rejected without crediting.');

  // =========================================================================
  // TEST 7: Key rotation cache refresh & simultaneous callbacks concurrency test
  // =========================================================================
  console.log('\n[TEST 7] Simultaneous concurrent callbacks & key rotation refresh...');
  const cust3 = createTestCustomer('c3');
  includeRotatedKey = true; // Simulate Google rotating in GOOGLE_KEY_ID_2 (DER base64 SPKI)

  // Prepare all 3 slots upfront concurrently
  const [p1Res, p2Res, p3Res] = await Promise.all([
    mockRequest(app, { method: 'POST', url: '/api/customer/reward-session/prepare-ad', headers: { authorization: `Bearer ${cust3.token}` } }),
    mockRequest(app, { method: 'POST', url: '/api/customer/reward-session/prepare-ad', headers: { authorization: `Bearer ${cust3.token}` } }),
    mockRequest(app, { method: 'POST', url: '/api/customer/reward-session/prepare-ad', headers: { authorization: `Bearer ${cust3.token}` } })
  ]);
  assert(p1Res.statusCode === 201 && p2Res.statusCode === 201 && p3Res.statusCode === 201, 'All 3 distinct ad slots prepared');
  const assignedSlots = [p1Res.body.verification.ad_slot, p2Res.body.verification.ad_slot, p3Res.body.verification.ad_slot].sort();
  assert(assignedSlots.join(',') === '1,2,3', `Assigned distinct slots 1,2,3 concurrently: got ${assignedSlots.join(',')}`);

  // 7a. Simultaneous identical duplicate callbacks on Slot 1 using rotated key_id_2
  const dupConcurrentUrl = signSsvQuery([
    ['ad_network', '5450213213286189855'],
    ['ad_unit', DEFAULT_ADMOB_REWARDED_AD_UNIT_ID], // Also verifies full app-id/unit-id format
    ['custom_data', p1Res.body.verification.verification_token],
    ['reward_amount', '1'],
    ['reward_item', 'coin'],
    ['timestamp', String(Date.now())],
    ['transaction_id', `TX_CONC_DUP_${Date.now()}`],
    ['user_id', String(cust3.userId)]
  ], googleKey2.privateKey, GOOGLE_KEY_ID_2);

  const dupBurst = await Promise.all(
    Array.from({ length: 5 }, () => mockRequest(app, { method: 'GET', url: dupConcurrentUrl }))
  );
  assert(dupBurst.every(r => r.statusCode === 200), 'All 5 simultaneous duplicate retries returned HTTP 200');
  const dupCreditedSum = dupBurst.reduce((sum, r) => sum + (r.body.coins_credited || 0), 0);
  assert(dupCreditedSum === 1, `Simultaneous duplicate burst credited total 1 coin (got ${dupCreditedSum})`);
  assert(getWalletBalance(cust3.userId).balance === 1, 'Cust3 balance is exactly 1 after 5 simultaneous duplicate callbacks');

  // 7b. Simultaneous conflicting transaction_ids racing on Slot 2
  const raceSlot2Results = await Promise.all([1, 2, 3].map((n) => {
    const raceUrl = signSsvQuery([
      ['ad_network', '5450213213286189855'],
      ['ad_unit', expectedUnitNumeric],
      ['custom_data', p2Res.body.verification.verification_token],
      ['reward_amount', '1'],
      ['reward_item', 'coin'],
      ['timestamp', String(Date.now())],
      ['transaction_id', `TX_RACE_SLOT2_${n}_${Date.now()}`],
      ['user_id', String(cust3.userId)]
    ], googleKey2.privateKey, GOOGLE_KEY_ID_2);
    return mockRequest(app, { method: 'GET', url: raceUrl });
  }));
  const raceSlot2Wins = raceSlot2Results.filter(r => r.statusCode === 200 && r.body.coins_credited === 1);
  const raceSlot2Conflicts = raceSlot2Results.filter(r => r.statusCode === 409 && r.body.coins_credited === 0);
  assert(raceSlot2Wins.length === 1 && raceSlot2Conflicts.length === 2, `Slot 2 race: exactly 1 winner and 2 conflicts (got wins=${raceSlot2Wins.length}, conflicts=${raceSlot2Conflicts.length})`);
  assert(getWalletBalance(cust3.userId).balance === 2, 'Cust3 balance is exactly 2 after Slot 2 race');

  // 7c. Verify Slot 3 completes cleanly -> total 3 coins
  const slot3Url = signSsvQuery([
    ['ad_network', '5450213213286189855'],
    ['ad_unit', expectedUnitNumeric],
    ['custom_data', p3Res.body.verification.verification_token],
    ['reward_amount', '1'],
    ['reward_item', 'coin'],
    ['timestamp', String(Date.now())],
    ['transaction_id', `TX_SLOT3_${Date.now()}`],
    ['user_id', String(cust3.userId)]
  ], googleKey1.privateKey, GOOGLE_KEY_ID_1);
  const slot3Res = await mockRequest(app, { method: 'GET', url: slot3Url });
  assert(slot3Res.statusCode === 200 && slot3Res.body.coins_credited === 1 && slot3Res.body.newBalance === 3, 'Slot 3 verified cleanly -> balance 3');

  // =========================================================================
  // TEST 8: vp52_coin_session integration & user mismatch protection
  // =========================================================================
  console.log('\n[TEST 8] Active vp52_coin_session SSV binding & user mismatch guard...');
  const cust4 = createTestCustomer('c4');
  res = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/coin-session/start',
    headers: { authorization: `Bearer ${cust4.token}` }
  });
  assert(res.statusCode === 200 && res.body.ad_experience.rewarded_ad_unit_id === DEFAULT_ADMOB_REWARDED_AD_UNIT_ID, '6h vp52_coin_session started with configured rewarded ad unit');

  const prepCoinSess = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/reward-session/prepare-ad',
    headers: { authorization: `Bearer ${cust4.token}` },
    body: { session_type: 'vp52_coin_session' }
  });
  assert(prepCoinSess.statusCode === 201 && prepCoinSess.body.verification.session_type === 'vp52_coin_session', 'Pending record bound to active vp52_coin_session');

  // Mismatched user_id must reject 403
  const mismatchUserUrl = signSsvQuery([
    ['ad_network', '5450213213286189855'],
    ['ad_unit', expectedUnitNumeric],
    ['custom_data', prepCoinSess.body.verification.verification_token],
    ['reward_amount', '1'],
    ['reward_item', 'coin'],
    ['timestamp', String(Date.now())],
    ['transaction_id', `TX_USER_MISMATCH_${Date.now()}`],
    ['user_id', String(cust1.userId)] // wrong user!
  ], googleKey1.privateKey, GOOGLE_KEY_ID_1);
  res = await mockRequest(app, { method: 'GET', url: mismatchUserUrl });
  assert(res.statusCode === 403 && res.body.code === 'USER_MISMATCH' && res.body.coins_credited === 0, 'Mismatched user_id rejected (403)');

  // Correct user_id verifies and credits 1 coin
  const validCoinSessUrl = signSsvQuery([
    ['ad_network', '5450213213286189855'],
    ['ad_unit', expectedUnitNumeric],
    ['custom_data', prepCoinSess.body.verification.verification_token],
    ['reward_amount', '1'],
    ['reward_item', 'coin'],
    ['timestamp', String(Date.now())],
    ['transaction_id', `TX_COIN_SESS_OK_${Date.now()}`],
    ['user_id', String(cust4.userId)]
  ], googleKey1.privateKey, GOOGLE_KEY_ID_1);
  res = await mockRequest(app, { method: 'GET', url: validCoinSessUrl });
  assert(res.statusCode === 200 && res.body.coins_credited === 1 && res.body.newBalance === 1, 'vp52_coin_session SSV verified and credited 1 coin');

  console.log('   ✓ Simultaneous callbacks, key rotation, vp52_coin_session SSV & user binding verified.');

  console.log('\n====================================================');
  console.log('🎉 ALL STAGE 5B.4.1B ADMOB SSV TESTS PASSED (8/8)');
  console.log('====================================================');
}

runTests().catch((err) => {
  console.error('\n❌ STAGE 5B.4.1B TEST SUITE FAILED:', err);
  process.exit(1);
});
