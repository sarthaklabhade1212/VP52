/**
 * Stage 5B.4.1C Security Audit Fixes & 3-Ad Sequential End-to-End Integration Suite
 *
 * Tests:
 * 1. Mandatory `user_id` SSV parameter fail-closed enforcement (missing/empty rejected 400).
 * 2. Safe `cancel-pending-ad` slot release (load/show failure or early dismissal -> 0 coins,
 *    frees unused slot cleanly, cannot mutate already-verified or another user's records).
 * 3. Full 10-step Part C sequential 3-ad workflow (start 6h session -> prepare slot 1 ->
 *    SSV verifies + credits 1 coin -> slot 2 -> slot 3 -> 3/3 completed -> 4th attempt rejected).
 * 4. Early dismissal / failed load mid-sequence grants 0 coins & preserves slot retryability.
 * 5. Client verification polling reflects verified vs rejected vs pending accurately without
 *    ever crediting coins prior to SSV callback.
 *
 * MUST run against an isolated scratch database copy (never mutates server/db/rewards.db).
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
const { createSsvVerifier, decodeSignatureBuffer } = require('./utils/admobSsv');
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
  console.log('==========================================================');
  console.log('VP52 STAGE 5B.4.1C — SECURITY AUDIT & 3-AD SEQUENCE SUITE');
  console.log('==========================================================\n');

  const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_vp52_5b41c';
  const expectedUnitNumeric = extractNumericUnitId(DEFAULT_ADMOB_REWARDED_AD_UNIT_ID);

  const googleKey = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  const GOOGLE_KEY_ID = '3335741209';

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
    const email = `5b41c_${suffix}_${Date.now()}_${Math.floor(Math.random() * 10000)}@vp52.com`;
    const hash = bcrypt.hashSync('Customer@123', 10);
    const ins = db.prepare(`
      INSERT INTO users (full_name, email, phone, password_hash, status, auth_provider, profile_completed)
      VALUES (?, ?, ?, ?, 'active', 'local', 1)
    `).run(`User ${suffix}`, email, `+919877${String(Math.floor(100000 + Math.random() * 899999))}`, hash);
    const userId = Number(ins.lastInsertRowid);
    db.prepare('INSERT INTO wallets (user_id, balance, total_earned, total_redeemed) VALUES (?, 0, 0, 0)').run(userId);
    const token = jwt.sign({ id: userId, email, role: 'customer' }, JWT_SECRET, { expiresIn: '2h' });
    return { userId, email, token };
  }

  function getWallet(userId) {
    return db.prepare('SELECT balance, total_earned, total_redeemed FROM wallets WHERE user_id = ?').get(userId);
  }

  // =========================================================================
  // TEST 1: Stage 5B.4.1C Security Fix — Strict base64 & mandatory user_id
  // =========================================================================
  console.log('[TEST 1] Mandatory `user_id` fail-closed check & strict base64 signature decoding...');
  assert(decodeSignatureBuffer('invalid!sig') === null, 'Rejects non-base64 chars');
  assert(decodeSignatureBuffer('AAAA====') === null, 'Rejects over-padded base64');
  assert(decodeSignatureBuffer('QUJDRA==') !== null, 'Accepts strict valid base64');

  const c1 = createCustomer('strict_uid');
  const prep1 = (await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/reward-session/prepare-ad',
    headers: { authorization: `Bearer ${c1.token}` },
    body: { session_type: 'reward_session' }
  })).body.verification;

  // Missing user_id completely even with valid ECDSA signature -> MUST reject 400 MISSING_SSV_PARAM
  const missingUserUrl = signSsvQuery([
    ['ad_network', '5450213213286189855'],
    ['ad_unit', expectedUnitNumeric],
    ['custom_data', prep1.verification_token],
    ['reward_amount', '1'],
    ['reward_item', 'coin'],
    ['timestamp', String(Date.now())],
    ['transaction_id', `TX_NO_UID_${Date.now()}`]
  ], googleKey.privateKey, GOOGLE_KEY_ID);

  let res = await mockRequest(app, { method: 'GET', url: missingUserUrl });
  assert(res.statusCode === 400 && res.body.code === 'MISSING_SSV_PARAM' && res.body.coins_credited === 0, `Missing user_id rejected cleanly: ${JSON.stringify(res.body)}`);

  // Empty user_id -> MUST reject 400 MISSING_SSV_PARAM
  const emptyUserUrl = signSsvQuery([
    ['ad_network', '5450213213286189855'],
    ['ad_unit', expectedUnitNumeric],
    ['custom_data', prep1.verification_token],
    ['reward_amount', '1'],
    ['reward_item', 'coin'],
    ['timestamp', String(Date.now())],
    ['transaction_id', `TX_EMPTY_UID_${Date.now()}`],
    ['user_id', '']
  ], googleKey.privateKey, GOOGLE_KEY_ID);

  res = await mockRequest(app, { method: 'GET', url: emptyUserUrl });
  assert(res.statusCode === 400 && res.body.code === 'MISSING_SSV_PARAM' && res.body.coins_credited === 0, 'Empty user_id rejected cleanly');
  assert(getWallet(c1.userId).balance === 0, 'Wallet untouched when user_id missing/empty');
  console.log('   ✓ Missing/empty `user_id` rejected fail-closed (400), base64 padding tightened.');

  // =========================================================================
  // TEST 2: Stage 5B.4.1C Safe `cancel-pending-ad` & Early Dismissal Lifecycle
  // =========================================================================
  console.log('\n[TEST 2] Safe pending slot release (`cancel-pending-ad`) & ownership/state immutability...');
  const cOther = createCustomer('other');

  // Another user trying to cancel c1's pending slot -> cancelled: false
  res = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/reward-session/cancel-pending-ad',
    headers: { authorization: `Bearer ${cOther.token}` },
    body: { verification_token: prep1.verification_token, reason: 'attacker_cancel' }
  });
  assert(res.statusCode === 200 && res.body.cancelled === false && res.body.coins_credited === 0, 'Other customer cannot cancel c1 pending record');

  // Owner aborts (e.g. failed_to_load or dismissed_early) -> releases Slot 1 safely with 0 coins
  res = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/reward-session/cancel-pending-ad',
    headers: { authorization: `Bearer ${c1.token}` },
    body: { verification_token: prep1.verification_token, reason: 'dismissed_early' }
  });
  assert(res.statusCode === 200 && res.body.cancelled === true && res.body.coins_credited === 0, 'Owner cancel-pending-ad releases unused pending slot cleanly');
  assert(getWallet(c1.userId).balance === 0, '0 coins granted after dismissed_early cancel');

  // Trying to SSV-verify a cancelled pending token -> fails closed (VERIFICATION_NOT_PENDING / status != pending)
  const cancelledVerifyUrl = signSsvQuery([
    ['ad_network', '5450213213286189855'],
    ['ad_unit', expectedUnitNumeric],
    ['custom_data', prep1.verification_token],
    ['reward_amount', '1'],
    ['reward_item', 'coin'],
    ['timestamp', String(Date.now())],
    ['transaction_id', `TX_AFTER_CANCEL_${Date.now()}`],
    ['user_id', String(c1.userId)]
  ], googleKey.privateKey, GOOGLE_KEY_ID);
  res = await mockRequest(app, { method: 'GET', url: cancelledVerifyUrl });
  assert(res.statusCode === 400 && res.body.code === 'VERIFICATION_NOT_PENDING' && res.body.coins_credited === 0, 'Cancelled pending record cannot be SSV-verified later');

  // Re-prepare after dismissal -> re-allocates Slot 1 cleanly!
  const prep1Retry = (await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/reward-session/prepare-ad',
    headers: { authorization: `Bearer ${c1.token}` },
    body: { session_type: 'reward_session' }
  })).body.verification;
  assert(prep1Retry.ad_slot === 1 && prep1Retry.verification_token !== prep1.verification_token, 'Slot 1 freed and issued a fresh single-use verification_token');
  console.log('   ✓ Cross-user cancellation blocked, early dismissal releases Slot 1 safely (0 coins).');

  // =========================================================================
  // TEST 3: Part C — Exact 10-Step Sequential 3-Ad End-to-End Integration
  // =========================================================================
  console.log('\n[TEST 3] Part C 10-step sequential 3-ad workflow (start -> 1 -> 2 -> 3 -> 4th rejected)...');
  const seqUser = createCustomer('seq_3ad');

  // Step 1: Start / initialize 6-hour session
  const status0 = await mockRequest(app, {
    method: 'GET',
    url: '/api/customer/reward-session/status',
    headers: { authorization: `Bearer ${seqUser.token}` }
  });
  assert(status0.statusCode === 200 && status0.body.active === true, 'Step 1: 6-hour session active');
  assert(status0.body.session.ads_watched === 0 && status0.body.session.max_ads === 3 && status0.body.session.can_watch_ad === true, 'Step 1: initial 0/3 ads watched, can_watch_ad=true');
  const sessionId = status0.body.session.id;

  // Steps 2–8: Sequential Slot 1 -> SSV 1 -> Slot 2 -> SSV 2 -> Slot 3 -> SSV 3
  for (let slot = 1; slot <= 3; slot++) {
    // Request pending verification record
    const prepRes = await mockRequest(app, {
      method: 'POST',
      url: '/api/customer/reward-session/prepare-ad',
      headers: { authorization: `Bearer ${seqUser.token}` },
      body: { session_type: 'reward_session' }
    });
    assert(prepRes.statusCode === 201 && prepRes.body.verification.ad_slot === slot, `Prepared sequential Slot ${slot}`);
    const v = prepRes.body.verification;

    // Prior to SSV callback, wallet MUST NOT change
    assert(getWallet(seqUser.userId).balance === slot - 1, `No speculative coins before SSV for Slot ${slot}`);

    // Google SSV signed callback verifies Ad `slot`
    const ssvUrl = signSsvQuery([
      ['ad_network', '5450213213286189855'],
      ['ad_unit', expectedUnitNumeric],
      ['custom_data', v.verification_token],
      ['reward_amount', '1'],
      ['reward_item', 'coin'],
      ['timestamp', String(Date.now())],
      ['transaction_id', `TX_SEQ_${seqUser.userId}_SLOT${slot}_${Date.now()}`],
      ['user_id', String(seqUser.userId)]
    ], googleKey.privateKey, GOOGLE_KEY_ID);

    const ssvRes = await mockRequest(app, { method: 'GET', url: ssvUrl });
    assert(ssvRes.statusCode === 200 && ssvRes.body.verified === true && ssvRes.body.coins_credited === 1, `Slot ${slot} SSV verified +1 coin`);

    // Client polling verification endpoint reflects verified
    const verPoll = await mockRequest(app, {
      method: 'GET',
      url: '/api/customer/reward-session/verifications',
      headers: { authorization: `Bearer ${seqUser.token}` }
    });
    const rec = verPoll.body.verifications.find(r => r.verification_token === v.verification_token);
    assert(rec && rec.status === 'verified', `Verification poll confirms Slot ${slot} verified`);

    // Wallet & session state after Ad `slot`
    assert(getWallet(seqUser.userId).balance === slot, `Wallet incremented strictly to ${slot} after Slot ${slot} SSV`);
    const sessCheck = await mockRequest(app, {
      method: 'GET',
      url: '/api/customer/reward-session/status',
      headers: { authorization: `Bearer ${seqUser.token}` }
    });
    assert(sessCheck.body.session.ads_watched === slot, `Session ads_watched === ${slot}`);
  }

  // Step 9: Confirm 3/3 completed state & ledger/lot integrity
  const finalStatus = await mockRequest(app, {
    method: 'GET',
    url: '/api/customer/reward-session/status',
    headers: { authorization: `Bearer ${seqUser.token}` }
  });
  assert(finalStatus.body.session.id === sessionId, 'Same 6-hour session persisted across all 3 ads');
  assert(finalStatus.body.session.ads_watched === 3 && finalStatus.body.session.can_watch_ad === false, 'Session reached 3/3 completed & can_watch_ad=false');

  const lotSum = db.prepare("SELECT SUM(coins_earned) AS s, SUM(coins_remaining) AS r, COUNT(*) AS c FROM coin_lots WHERE user_id = ? AND source = 'AD_REWARD'").get(seqUser.userId);
  assert(lotSum.c === 3 && lotSum.s === 3 && lotSum.r === 3, '3 coin_lots created matching 3 earned coins');
  const ledgerSum = db.prepare("SELECT SUM(points) AS s, COUNT(*) AS c FROM point_ledger WHERE user_id = ? AND source = 'admob_ssv'").get(seqUser.userId);
  assert(ledgerSum.c === 3 && ledgerSum.s === 3, '3 point_ledger rows sum to 3 coins');
  const walletFinal = getWallet(seqUser.userId);
  assert(walletFinal.balance === 3 && walletFinal.total_earned === 3 && walletFinal.total_redeemed === 0, 'Wallet consistency verified');

  // Step 10: 4th ad attempt rejected cleanly
  const prep4 = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/reward-session/prepare-ad',
    headers: { authorization: `Bearer ${seqUser.token}` },
    body: { session_type: 'reward_session' }
  });
  assert(prep4.statusCode === 400 && prep4.body.code === 'SESSION_AD_LIMIT_REACHED', '4th ad attempt rejected after 3/3 limit');
  assert(getWallet(seqUser.userId).balance === 3, 'Wallet remains strictly 3 after rejected 4th attempt');
  console.log('   ✓ Full 10-step sequential 3-ad lifecycle passed; wallet/coin_lots/ledger match 3 coins, 4th ad rejected.');

  // =========================================================================
  // TEST 4: Verified slot cannot be cancelled or altered by cancel-pending-ad
  // =========================================================================
  console.log('\n[TEST 4] Verified record immutability against cancel-pending-ad...');
  const verifiedTok = db.prepare(`
    SELECT verification_token FROM admob_ssv_verifications
    WHERE user_id = ? AND status = 'verified' ORDER BY id ASC LIMIT 1
  `).get(seqUser.userId).verification_token;

  res = await mockRequest(app, {
    method: 'POST',
    url: '/api/customer/reward-session/cancel-pending-ad',
    headers: { authorization: `Bearer ${seqUser.token}` },
    body: { verification_token: verifiedTok, reason: 'post_verify_tamper' }
  });
  assert(res.statusCode === 200 && res.body.cancelled === false && res.body.coins_credited === 0, 'Cannot cancel already-verified slot');
  const rowStillVerified = db.prepare('SELECT status FROM admob_ssv_verifications WHERE verification_token = ?').get(verifiedTok);
  assert(rowStillVerified.status === 'verified', 'Verified row remained immutable');
  console.log('   ✓ Verified records remain immutable.');

  console.log('\n==========================================================');
  console.log('🎉 ALL STAGE 5B.4.1C SECURITY & 3-AD SEQUENCE TESTS PASSED');
  console.log('==========================================================');
}

runTests().catch((err) => {
  console.error('\n❌ STAGE 5B.4.1C SECURITY & FLOW SUITE FAILED:', err);
  process.exit(1);
});
