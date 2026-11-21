/**
 * Google AdMob Server-Side Verification (SSV) Callback Routes
 *
 * Mounted at `/api/admob` WITHOUT customer bearer authentication because Google's
 * SSV servers call this endpoint directly via HTTP GET with cryptographic ECDSA signatures.
 *
 * Endpoints:
 * - GET /api/admob/ssv
 * - GET /api/admob/ssv-callback (alias)
 */

const express = require('express');
const crypto = require('crypto');
const db = require('../db/database');
const { createRateLimiter, getClientIp } = require('../middleware/rateLimiter');
const { getAdMobConfig, isExpectedRewardedAdUnit, SSV_REWARD_AMOUNT, SSV_REWARD_ITEM, MAX_ADS_PER_SESSION } = require('../config/admob');
const { createSsvVerifier } = require('../utils/admobSsv');

const ssvRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 300,
  message: 'Too many SSV callback requests.',
  keyGenerator: (req) => `admob_ssv:${getClientIp(req)}`
});

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function logSsvAudit({ eventType, code, transactionId = null, verificationToken = null, userId = null, adUnitId = null, keyId = null, details = null }) {
  try {
    db.prepare(`
      INSERT INTO admob_ssv_audit_logs (
        event_type, code, transaction_id, verification_token, user_id, ad_unit_id, key_id, details
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      eventType,
      code,
      transactionId,
      verificationToken,
      userId,
      adUnitId,
      keyId,
      details ? String(details).slice(0, 500) : null
    );
  } catch (_) {}
}

function createAdMobRouter(options = {}) {
  const router = express.Router();
  const ssvVerifier = options.ssvVerifier || createSsvVerifier();

  async function handleSsvCallback(req, res) {
    const config = getAdMobConfig();
    const rawUrl = req.originalUrl || req.url || '';

    // 1. Cryptographic signature + key_id + canonical query verification
    const verification = await ssvVerifier.verifyCallbackUrl(rawUrl);
    if (!verification.ok) {
      logSsvAudit({
        eventType: 'rejected',
        code: verification.code || 'INVALID_SSV_SIGNATURE',
        transactionId: verification.params ? verification.params.transaction_id : null,
        verificationToken: verification.params ? verification.params.custom_data : null,
        adUnitId: verification.params ? verification.params.ad_unit : null,
        keyId: verification.keyId || null,
        details: verification.error
      });

      const status = verification.code === 'VERIFIER_KEY_FETCH_FAILED' ? 503
        : (verification.code === 'INVALID_SSV_SIGNATURE' || verification.code === 'UNKNOWN_KEY_ID') ? 403
        : 400;

      return res.status(status).json({
        success: false,
        verified: false,
        coins_credited: 0,
        code: verification.code || 'INVALID_SSV_SIGNATURE',
        error: verification.error || 'AdMob SSV signature verification failed'
      });
    }

    const { params, keyId, signedContent, signatureBuffer, rawQuery } = verification;

    // 2. Strictly validate configured rewarded ad unit
    if (!isExpectedRewardedAdUnit(params.ad_unit, config.rewardedAdUnitId)) {
      logSsvAudit({
        eventType: 'rejected',
        code: 'INVALID_AD_UNIT',
        transactionId: params.transaction_id,
        verificationToken: params.custom_data,
        adUnitId: params.ad_unit,
        keyId,
        details: `Expected ${config.rewardedAdUnitId}, got ${params.ad_unit}`
      });

      return res.status(400).json({
        success: false,
        verified: false,
        coins_credited: 0,
        code: 'INVALID_AD_UNIT',
        error: 'Ad unit ID does not match configured VP52 rewarded ad unit'
      });
    }

    // 3. Strictly validate reward item & reward amount (exact 1 coin)
    const parsedAmount = Number(params.reward_amount);
    const normalizedItem = String(params.reward_item || '').trim().toLowerCase();
    if (!Number.isInteger(parsedAmount) || parsedAmount !== SSV_REWARD_AMOUNT || normalizedItem !== SSV_REWARD_ITEM) {
      logSsvAudit({
        eventType: 'rejected',
        code: 'INVALID_REWARD_CONFIG',
        transactionId: params.transaction_id,
        verificationToken: params.custom_data,
        adUnitId: params.ad_unit,
        keyId,
        details: `Expected ${SSV_REWARD_AMOUNT} ${SSV_REWARD_ITEM}, got ${params.reward_amount} ${params.reward_item}`
      });

      return res.status(400).json({
        success: false,
        verified: false,
        coins_credited: 0,
        code: 'INVALID_REWARD_CONFIG',
        error: `Invalid reward specification: expected ${SSV_REWARD_AMOUNT} ${SSV_REWARD_ITEM}`
      });
    }

    // 4. Atomic database claim, replay protection, session/slot limit enforcement & 1-coin ledger credit
    const nowMs = Date.now();
    const signatureHash = sha256Hex(signatureBuffer);
    const payloadHash = sha256Hex(signedContent);

    const atomicProcess = db.transaction(() => {
      // 4a. Check transaction_id replay / safe Google retry FIRST
      const existingByTx = db.prepare(`
        SELECT * FROM admob_ssv_verifications WHERE transaction_id = ?
      `).get(params.transaction_id);

      if (existingByTx) {
        const sameToken = existingByTx.verification_token === params.custom_data;
        const sameUser = Boolean(params.user_id) && String(existingByTx.user_id) === String(params.user_id);
        const sameUnit = isExpectedRewardedAdUnit(existingByTx.ad_unit_id, config.rewardedAdUnitId);

        if (existingByTx.status === 'verified' && sameToken && sameUser && sameUnit) {
          return {
            status: 200,
            audit: {
              eventType: 'duplicate_retry',
              code: 'DUPLICATE_CALLBACK_ACK',
              userId: existingByTx.user_id
            },
            body: {
              success: true,
              verified: true,
              duplicate: true,
              already_processed: true,
              coins_credited: 0,
              ad_slot: existingByTx.ad_slot,
              transaction_id: params.transaction_id,
              message: 'Duplicate AdMob SSV callback acknowledged safely without double-crediting'
            }
          };
        }

        return {
          status: 409,
          audit: {
            eventType: 'rejected',
            code: 'TRANSACTION_ID_ALREADY_USED',
            userId: existingByTx.user_id,
            details: `transaction_id reused across differing verification record`
          },
          body: {
            success: false,
            verified: false,
            coins_credited: 0,
            code: 'TRANSACTION_ID_ALREADY_USED',
            error: 'AdMob transaction_id has already been consumed'
          }
        };
      }

      // 4b. Lookup pending verification record by custom_data
      const pending = db.prepare(`
        SELECT * FROM admob_ssv_verifications WHERE verification_token = ?
      `).get(params.custom_data);

      if (!pending) {
        return {
          status: 404,
          audit: {
            eventType: 'rejected',
            code: 'VERIFICATION_RECORD_NOT_FOUND',
            details: 'No pending verification record found for custom_data'
          },
          body: {
            success: false,
            verified: false,
            coins_credited: 0,
            code: 'VERIFICATION_RECORD_NOT_FOUND',
            error: 'Pending ad verification record not found'
          }
        };
      }

      // Strictly enforce customer identity binding via user_id
      if (!params.user_id || String(pending.user_id) !== String(params.user_id)) {
        return {
          status: 403,
          audit: {
            eventType: 'rejected',
            code: 'USER_MISMATCH',
            userId: pending.user_id,
            details: `Expected user ${pending.user_id}, got ${params.user_id}`
          },
          body: {
            success: false,
            verified: false,
            coins_credited: 0,
            code: 'USER_MISMATCH',
            error: 'SSV user_id does not match pending verification owner'
          }
        };
      }

      if (pending.status === 'verified') {
        return {
          status: 409,
          audit: {
            eventType: 'rejected',
            code: 'VERIFICATION_ALREADY_USED',
            userId: pending.user_id,
            details: `Verification token already consumed by transaction ${pending.transaction_id}`
          },
          body: {
            success: false,
            verified: false,
            coins_credited: 0,
            code: 'VERIFICATION_ALREADY_USED',
            error: 'Verification record already used by another transaction'
          }
        };
      }

      if (pending.status !== 'pending') {
        return {
          status: 400,
          audit: {
            eventType: 'rejected',
            code: 'VERIFICATION_NOT_PENDING',
            userId: pending.user_id,
            details: `Record status is ${pending.status}`
          },
          body: {
            success: false,
            verified: false,
            coins_credited: 0,
            code: 'VERIFICATION_NOT_PENDING',
            error: `Pending verification record is ${pending.status}`
          }
        };
      }

      const pendingExpiresMs = new Date(pending.expires_at).getTime();
      if (!Number.isFinite(pendingExpiresMs) || nowMs >= pendingExpiresMs) {
        db.prepare(`
          UPDATE admob_ssv_verifications
          SET status = 'expired', rejection_reason = 'Pending verification record expired', updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND status = 'pending'
        `).run(pending.id);

        return {
          status: 400,
          audit: {
            eventType: 'rejected',
            code: 'VERIFICATION_EXPIRED',
            userId: pending.user_id,
            details: `Expired at ${pending.expires_at}`
          },
          body: {
            success: false,
            verified: false,
            coins_credited: 0,
            code: 'VERIFICATION_EXPIRED',
            error: 'Pending ad verification record has expired'
          }
        };
      }

      // 4c. Enforce active customer account + 6-hour session & 3-ad limit
      const user = db.prepare('SELECT id, status FROM users WHERE id = ?').get(pending.user_id);
      if (!user || user.status !== 'active') {
        return {
          status: 403,
          audit: {
            eventType: 'rejected',
            code: 'CUSTOMER_INACTIVE',
            userId: pending.user_id,
            details: 'Customer not found or suspended'
          },
          body: {
            success: false,
            verified: false,
            coins_credited: 0,
            code: 'CUSTOMER_INACTIVE',
            error: 'Customer account is not active'
          }
        };
      }

      if (pending.session_type === 'reward_session') {
        const session = db.prepare('SELECT * FROM reward_sessions WHERE id = ? AND user_id = ?').get(pending.session_id, pending.user_id);
        if (!session) {
          return {
            status: 404,
            audit: { eventType: 'rejected', code: 'SESSION_NOT_FOUND', userId: pending.user_id },
            body: { success: false, verified: false, coins_credited: 0, code: 'SESSION_NOT_FOUND', error: 'Reward session not found' }
          };
        }
        const sessionEndMs = new Date(session.end_time).getTime();
        if (!Number.isFinite(sessionEndMs) || nowMs >= sessionEndMs) {
          return {
            status: 400,
            audit: { eventType: 'rejected', code: 'SESSION_EXPIRED', userId: pending.user_id },
            body: { success: false, verified: false, coins_credited: 0, code: 'SESSION_EXPIRED', error: '6-hour customer reward session has expired' }
          };
        }
      } else if (pending.session_type === 'vp52_coin_session') {
        const session = db.prepare('SELECT * FROM vp52_coin_sessions WHERE id = ? AND user_id = ?').get(pending.session_id, pending.user_id);
        if (!session || session.status !== 'active') {
          return {
            status: 400,
            audit: { eventType: 'rejected', code: 'SESSION_NOT_ACTIVE', userId: pending.user_id },
            body: { success: false, verified: false, coins_credited: 0, code: 'SESSION_NOT_ACTIVE', error: '6-hour customer coin session is not active' }
          };
        }
        const sessionEndMs = new Date(session.expires_at).getTime();
        if (!Number.isFinite(sessionEndMs) || nowMs >= sessionEndMs) {
          return {
            status: 400,
            audit: { eventType: 'rejected', code: 'SESSION_EXPIRED', userId: pending.user_id },
            body: { success: false, verified: false, coins_credited: 0, code: 'SESSION_EXPIRED', error: '6-hour customer coin session has expired' }
          };
        }
      }

      const verifiedCountRow = db.prepare(`
        SELECT COUNT(*) AS c FROM admob_ssv_verifications
        WHERE session_type = ? AND session_id = ? AND status = 'verified'
      `).get(pending.session_type, pending.session_id);

      if ((verifiedCountRow ? verifiedCountRow.c : 0) >= MAX_ADS_PER_SESSION) {
        return {
          status: 400,
          audit: {
            eventType: 'rejected',
            code: 'SESSION_AD_LIMIT_REACHED',
            userId: pending.user_id,
            details: `Maximum ${MAX_ADS_PER_SESSION} rewarded ads per 6-hour session reached`
          },
          body: {
            success: false,
            verified: false,
            coins_credited: 0,
            code: 'SESSION_AD_LIMIT_REACHED',
            error: `Maximum of ${MAX_ADS_PER_SESSION} rewarded ads per 6-hour session already verified`
          }
        };
      }

      // 4d. Atomically claim pending verification record
      const claimRes = db.prepare(`
        UPDATE admob_ssv_verifications
        SET status = 'verified',
            transaction_id = ?,
            key_id = ?,
            ssv_timestamp = ?,
            ad_network = ?,
            signature_hash = ?,
            payload_hash = ?,
            ssv_raw_query = ?,
            verified_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'pending'
      `).run(
        params.transaction_id,
        keyId,
        params.timestamp,
        params.ad_network,
        signatureHash,
        payloadHash,
        rawQuery,
        pending.id
      );

      if (claimRes.changes !== 1) {
        return {
          status: 409,
          audit: {
            eventType: 'rejected',
            code: 'CLAIM_CONFLICT',
            userId: pending.user_id,
            details: 'Concurrent claim conflict on verification record'
          },
          body: {
            success: false,
            verified: false,
            coins_credited: 0,
            code: 'CLAIM_CONFLICT',
            error: 'Verification record already claimed'
          }
        };
      }

      // 4e. Credit EXACTLY 1 coin using existing atomic coin-ledger logic
      const coinsToCredit = SSV_REWARD_AMOUNT; // Always 1 coin
      const ledgerTxId = `ADMOB-SSV-${params.transaction_id}`;
      const existingLot = db.prepare('SELECT id FROM coin_lots WHERE transaction_id = ?').get(ledgerTxId);
      if (existingLot) {
        throw new Error(`Duplicate ledger transaction_id detected: ${ledgerTxId}`);
      }

      db.prepare('INSERT OR IGNORE INTO wallets (user_id, balance, total_earned, total_redeemed) VALUES (?, 0, 0, 0)').run(pending.user_id);
      const walletBefore = db.prepare('SELECT balance, total_earned FROM wallets WHERE user_id = ?').get(pending.user_id) || { balance: 0, total_earned: 0 };
      const prevBal = walletBefore.balance;
      const newBal = prevBal + coinsToCredit;
      const newLifetime = walletBefore.total_earned + coinsToCredit;

      db.prepare(`
        UPDATE wallets
        SET balance = ?,
            total_earned = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(newBal, newLifetime, pending.user_id);

      const lotExpiresAt = new Date(nowMs + config.coinExpiryDays * 86400 * 1000).toISOString();
      db.prepare(`
        INSERT INTO coin_lots (
          user_id, transaction_id, source, coins_earned, coins_remaining,
          tier, original_amount, next_transition_at, expires_at, status
        )
        VALUES (?, ?, 'AD_REWARD', ?, ?, 'Bronze', ?, ?, ?, 'ACTIVE')
      `).run(pending.user_id, ledgerTxId, coinsToCredit, coinsToCredit, coinsToCredit, lotExpiresAt, lotExpiresAt);

      db.prepare(`
        INSERT INTO reward_transactions (user_id, activity_type, points)
        VALUES (?, 'AdMob Rewarded Ad (SSV)', ?)
      `).run(pending.user_id, coinsToCredit);

      db.prepare(`
        INSERT INTO point_ledger (
          user_id, transaction_id, type, points, previous_balance, new_balance,
          source, reference_id, reason
        )
        VALUES (?, ?, 'AD_REWARD', ?, ?, ?, 'admob_ssv', ?, ?)
      `).run(
        pending.user_id,
        ledgerTxId,
        coinsToCredit,
        prevBal,
        newBal,
        params.transaction_id,
        `Google AdMob SSV Verified Rewarded Ad (Slot ${pending.ad_slot}/3)`
      );

      if (pending.session_type === 'reward_session') {
        db.prepare(`
          UPDATE reward_sessions
          SET ads_watched = COALESCE(ads_watched, 0) + 1,
              coins_earned = COALESCE(coins_earned, 0) + ?,
              status = CASE WHEN COALESCE(ads_watched, 0) + 1 >= ? THEN 'completed' ELSE 'active' END
          WHERE id = ? AND user_id = ?
        `).run(coinsToCredit, MAX_ADS_PER_SESSION, pending.session_id, pending.user_id);
      }

      db.prepare(`
        INSERT INTO ad_event_logs (user_id, ad_format, event_type, ad_unit_id, provider, metadata)
        VALUES (?, 'rewarded', 'reward_completed', ?, 'Google AdMob SSV', ?)
      `).run(
        pending.user_id,
        config.rewardedAdUnitId,
        JSON.stringify({
          verification_id: pending.id,
          ad_slot: pending.ad_slot,
          session_type: pending.session_type,
          session_id: pending.session_id,
          transaction_id: params.transaction_id,
          coins_credited: coinsToCredit
        })
      );

      return {
        status: 200,
        audit: {
          eventType: 'verified',
          code: 'SSV_REWARD_CREDITED',
          userId: pending.user_id,
          details: `Credited 1 coin for slot ${pending.ad_slot}/3 (balance ${prevBal} -> ${newBal})`
        },
        body: {
          success: true,
          verified: true,
          duplicate: false,
          coins_credited: coinsToCredit,
          reward_item: SSV_REWARD_ITEM,
          ad_slot: pending.ad_slot,
          session_type: pending.session_type,
          session_id: pending.session_id,
          transaction_id: params.transaction_id,
          newBalance: newBal,
          totalEarned: newLifetime,
          message: 'AdMob rewarded ad verified via SSV and 1 coin credited'
        }
      };
    });

    try {
      // `.immediate()` acquires SQLite write lock up-front, cleanly serializing concurrent callbacks
      const outcome = atomicProcess.immediate();
      logSsvAudit({
        eventType: outcome.audit.eventType,
        code: outcome.audit.code,
        transactionId: params.transaction_id,
        verificationToken: params.custom_data,
        userId: outcome.audit.userId || null,
        adUnitId: params.ad_unit,
        keyId,
        details: outcome.audit.details || null
      });
      return res.status(outcome.status).json(outcome.body);
    } catch (err) {
      // Handle SQLite UNIQUE constraint race defensively if ever triggered
      if (err && String(err.message || '').includes('UNIQUE constraint failed')) {
        logSsvAudit({
          eventType: 'rejected',
          code: 'UNIQUE_CONSTRAINT_CONFLICT',
          transactionId: params.transaction_id,
          verificationToken: params.custom_data,
          adUnitId: params.ad_unit,
          keyId,
          details: err.message
        });
        return res.status(409).json({
          success: false,
          verified: false,
          coins_credited: 0,
          code: 'TRANSACTION_ID_ALREADY_USED',
          error: 'Transaction or verification slot already processed'
        });
      }
      console.error('AdMob SSV processing error:', err);
      return res.status(500).json({
        success: false,
        verified: false,
        coins_credited: 0,
        error: 'Internal error processing AdMob SSV callback'
      });
    }
  }

  router.get('/ssv', ssvRateLimiter, handleSsvCallback);
  router.get('/ssv-callback', ssvRateLimiter, handleSsvCallback);

  return router;
}

module.exports = createAdMobRouter();
module.exports.createAdMobRouter = createAdMobRouter;
