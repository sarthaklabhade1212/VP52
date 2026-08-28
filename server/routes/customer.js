const express = require('express');
const crypto = require('crypto');
const db = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Apply Customer Authentication Middleware to all customer routes
router.use(authenticateToken);
router.use(requireRole('customer'));

// Helper: is a stored coordinate pair usable? Treats NULL/undefined (missing),
// non-numeric, and out-of-range values as invalid. Note Number(null) === 0, so the
// null/undefined checks MUST run before any numeric coercion.
function isValidCoord(lat, lng) {
  if (lat === null || lat === undefined || lat === '' || lng === null || lng === undefined || lng === '') {
    return false;
  }
  const la = Number(lat);
  const lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return false;
  if (la < -90 || la > 90 || lo < -180 || lo > 180) return false;
  return true;
}

// Helper to calculate great-circle distance using the Haversine formula (in km).
// Returns null (NOT a fabricated fallback) when any coordinate is missing/invalid,
// so callers can decide how to present "distance unknown".
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!isValidCoord(lat1, lon1) || !isValidCoord(lat2, lon2)) return null;
  const la1 = Number(lat1), lo1 = Number(lon1), la2 = Number(lat2), lo2 = Number(lon2);
  const R = 6371; // Radius of Earth in km
  const dLat = (la2 - la1) * Math.PI / 180;
  const dLon = (lo2 - lo1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// Helper to get reward setting with fallback
function getRewardSetting(key, defaultValue) {
  const row = db.prepare('SELECT value FROM reward_settings WHERE key = ?').get(key);
  if (row) return row.value;
  const legacyRow = db.prepare('SELECT value FROM admin_settings WHERE key = ?').get(key);
  return legacyRow ? legacyRow.value : defaultValue;
}

// Auto-Expiry Helper: Marks expired coin lots as EXPIRED
function autoExpireCoinLots(userId) {
  try {
    const expiredLots = db.prepare(`
      SELECT id, coins_remaining FROM coin_lots
      WHERE user_id = ? AND status IN ('ACTIVE', 'PARTIALLY_USED') AND datetime(expires_at) <= datetime('now')
    `).all(userId);

    if (expiredLots.length > 0) {
      db.prepare(`
        UPDATE coin_lots
        SET status = 'EXPIRED'
        WHERE user_id = ? AND status IN ('ACTIVE', 'PARTIALLY_USED') AND datetime(expires_at) <= datetime('now')
      `).run(userId);

      // Recalculate active wallet balance
      const activeSumRow = db.prepare(`
        SELECT SUM(coins_remaining) AS active_coins FROM coin_lots
        WHERE user_id = ? AND status IN ('ACTIVE', 'PARTIALLY_USED') AND datetime(expires_at) > datetime('now')
      `).get(userId);

      const activeCoins = activeSumRow ? (activeSumRow.active_coins || 0) : 0;
      db.prepare('UPDATE wallets SET balance = ? WHERE user_id = ?').run(activeCoins, userId);
    }
  } catch (e) {
    console.error('Auto expire coin lots error:', e.message);
  }
}

// Get Available Non-Expired Coins Balance
function getAvailableCoins(userId) {
  autoExpireCoinLots(userId);
  const row = db.prepare(`
    SELECT SUM(coins_remaining) AS active_coins FROM coin_lots
    WHERE user_id = ? AND status IN ('ACTIVE', 'PARTIALLY_USED') AND datetime(expires_at) > datetime('now')
  `).get(userId);
  if (row && row.active_coins !== null) {
    return row.active_coins;
  }
  // Fallback to wallet balance if no lots exist yet
  const w = db.prepare('SELECT balance FROM wallets WHERE user_id = ?').get(userId);
  return w ? w.balance : 0;
}

// 1. Get Wallet Balance & Transaction Summary (with Expiry Breakdown)
router.get('/wallet', (req, res) => {
  try {
    const userId = req.user.id;
    autoExpireCoinLots(userId);

    const wallet = db.prepare('SELECT balance, total_earned, total_redeemed FROM wallets WHERE user_id = ?').get(userId) || { balance: 0, total_earned: 0, total_redeemed: 0 };
    const availableCoins = getAvailableCoins(userId);

    const expiredCoinsRow = db.prepare(`
      SELECT SUM(coins_remaining) AS total_expired FROM coin_lots
      WHERE user_id = ? AND status = 'EXPIRED'
    `).get(userId);
    const totalExpired = expiredCoinsRow ? (expiredCoinsRow.total_expired || 0) : 0;

    const earnedTodayRow = db.prepare(`
      SELECT SUM(coins_earned) AS total FROM coin_lots
      WHERE user_id = ? AND date(earned_at) = date('now')
    `).get(userId);
    const earnedToday = earnedTodayRow ? (earnedTodayRow.total || 0) : 0;

    const earnedThisMonthRow = db.prepare(`
      SELECT SUM(coins_earned) AS total FROM coin_lots
      WHERE user_id = ? AND date(earned_at) >= date('now', 'start of month')
    `).get(userId);
    const earnedThisMonth = earnedThisMonthRow ? (earnedThisMonthRow.total || 0) : 0;

    // Expiring soon lots (7 days, 3 days, 1 day)
    const expiringSoonLots = db.prepare(`
      SELECT id, coins_remaining, expires_at,
             CAST((julianday(expires_at) - julianday('now')) * 24 AS INTEGER) AS hours_left
      FROM coin_lots
      WHERE user_id = ? AND status IN ('ACTIVE', 'PARTIALLY_USED') AND datetime(expires_at) > datetime('now')
        AND datetime(expires_at) <= datetime('now', '+7 days')
      ORDER BY expires_at ASC
    `).all(userId);

    const expire3DaysRow = db.prepare(`
      SELECT SUM(coins_remaining) AS total FROM coin_lots
      WHERE user_id = ? AND status IN ('ACTIVE', 'PARTIALLY_USED') AND datetime(expires_at) > datetime('now')
        AND datetime(expires_at) <= datetime('now', '+3 days')
    `).get(userId);
    const expire3Days = expire3DaysRow ? (expire3DaysRow.total || 0) : 0;

    const rewardHistory = db.prepare(`
      SELECT id, activity_type, points, created_at
      FROM reward_transactions
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(userId);

    const redemptionHistory = db.prepare(`
      SELECT r.id, r.redemption_code, r.points_deducted, r.discount_percent, r.max_discount_inr, r.status, r.created_at, r.redeemed_at,
             s.name AS shop_name, s.category AS shop_category, o.title AS offer_title
      FROM redemptions r
      JOIN shops s ON r.shop_id = s.id
      JOIN offers o ON r.offer_id = o.id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
      LIMIT 50
    `).all(userId);

    return res.json({
      success: true,
      wallet: {
        ...wallet,
        available_coins: availableCoins,
        discount_value_inr: availableCoins, // 1 Coin = ₹1
        total_expired: totalExpired,
        earned_today: earnedToday,
        earned_this_month: earnedThisMonth,
        expiring_soon_3_days: expire3Days
      },
      expiringSoonLots,
      rewardHistory,
      redemptionHistory
    });
  } catch (error) {
    console.error('Fetch wallet error:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve wallet information' });
  }
});

// 2. Watch Simulated Ad & Earn Points (Calculated from watch duration seconds)
router.post('/watch-ad', (req, res) => {
  try {
    const userId = req.user.id;
    const adDurationSec = parseInt(getRewardSetting('ad_duration_seconds', '10'), 10);
    const pointsPerAdConfig = parseInt(getRewardSetting('points_per_ad', '100'), 10);
    const pointsPerSecond = pointsPerAdConfig / Math.max(1, adDurationSec);

    // Watch duration in seconds sent by client (clamped between 0 and adDurationSec)
    const rawWatchSeconds = req.body ? req.body.watch_duration_seconds : undefined;
    const watchDurationSeconds = (rawWatchSeconds !== undefined && rawWatchSeconds !== null && !isNaN(parseInt(rawWatchSeconds, 10)))
      ? Math.min(adDurationSec, Math.max(0, parseInt(rawWatchSeconds, 10)))
      : adDurationSec;

    const pointsAwarded = Math.min(pointsPerAdConfig, Math.floor(watchDurationSeconds * pointsPerSecond));

    if (pointsAwarded <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Watch duration too short to earn points.'
      });
    }

    console.log(`[Ads] Customer ${userId} watch-ad request: watched ${watchDurationSeconds}/${adDurationSec}s -> Awarding ${pointsAwarded} points.`);

    // Atomic transaction for awarding points + point_ledger
    const rewardTx = db.transaction(() => {
      const walletBefore = db.prepare('SELECT balance, total_earned FROM wallets WHERE user_id = ?').get(userId) || { balance: 0, total_earned: 0 };
      const prevBal = walletBefore.balance;
      const newBal = prevBal + pointsAwarded;

      db.prepare(`
        UPDATE wallets
        SET balance = ?,
            total_earned = total_earned + ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(newBal, pointsAwarded, userId);

      const result = db.prepare(`
        INSERT INTO reward_transactions (user_id, activity_type, points)
        VALUES (?, 'Sponsored Content Reward', ?)
      `).run(userId, pointsAwarded);

      const txId = `AD-REWARD-${result.lastInsertRowid}`;

      // Insert into point_ledger
      db.prepare(`
        INSERT INTO point_ledger (user_id, transaction_id, type, points, previous_balance, new_balance, reason)
        VALUES (?, ?, 'AD_REWARD', ?, ?, ?, ?)
      `).run(userId, txId, pointsAwarded, prevBal, newBal, `Simulated Ad Watch (${watchDurationSeconds}s watched)`);

      const freshWallet = db.prepare('SELECT balance, total_earned FROM wallets WHERE user_id = ?').get(userId);

      return {
        transactionId: result.lastInsertRowid,
        pointsAwarded: pointsAwarded,
        newBalance: freshWallet.balance,
        totalEarned: freshWallet.total_earned
      };
    });

    const result = rewardTx();
    console.log(`[Ads] Reward successfully credited for Customer ${userId}: +${result.pointsAwarded} points.`);

    return res.json({
      success: true,
      message: `Congratulations! +${result.pointsAwarded} Points Earned`,
      pointsAwarded: result.pointsAwarded,
      newBalance: result.newBalance,
      totalEarned: result.totalEarned,
      transactionId: result.transactionId
    });
  } catch (error) {
    console.error('Watch ad reward error:', error);
    return res.status(500).json({ success: false, error: 'Failed to process ad reward' });
  }
});

// 2.5 Generate Cryptographically Secure Customer QR Token
router.post('/qr-token', (req, res) => {
  try {
    const userId = req.user.id;
    const { rotate } = req.body;

    const user = db.prepare('SELECT qr_token, qr_token_created_at FROM users WHERE id = ?').get(userId);

    let tokenToUse = user ? user.qr_token : null;

    if (!tokenToUse || rotate) {
      // Cryptographically secure 64-char hex token
      const secureRandomHex = crypto.randomBytes(32).toString('hex');
      tokenToUse = `CUST-SECURE-${secureRandomHex}`;

      db.prepare(`
        UPDATE users
        SET qr_token = ?, qr_token_created_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(tokenToUse, userId);
    }

    return res.json({
      success: true,
      qrToken: tokenToUse,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Customer QR token error:', error);
    return res.status(500).json({ success: false, error: 'Failed to generate secure customer QR token' });
  }
});

// 3. Get Active Approved Shops & Offers (Strict Public Discoverability Filter)
router.get('/shops', (req, res) => {
  try {
    const { search, category, maxDistance, lat, lng } = req.query;

    // Customer location is OPTIONAL and never persisted. It is used only to compute
    // and sort by distance and to apply the radius filter. Distance is ALWAYS
    // computed server-side from stored shop coordinates; any client-supplied
    // distance (e.g. a spoofed distance_km query param) is ignored entirely.
    const hasUserLocation = isValidCoord(lat, lng);
    const userLat = hasUserLocation ? Number(lat) : null;
    const userLng = hasUserLocation ? Number(lng) : null;

    // Strict Discoverability: ONLY APPROVED AND ACTIVE SHOPS
    let query = `
      SELECT id, shop_code, name, category, description, address, phone, image_url, status, verification_status, latitude, longitude, rating
      FROM shops
      WHERE LOWER(status) = 'active' AND LOWER(verification_status) = 'approved'
    `;

    const params = [];

    if (search) {
      query += ` AND (name LIKE ? OR category LIKE ? OR description LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    if (category && category !== 'All') {
      query += ` AND category = ?`;
      params.push(category.trim());
    }

    query += ` ORDER BY name ASC`;

    let shops = db.prepare(query).all(...params);

    // Location-verification gate: a shop is shown to customers ONLY if it has valid
    // coordinates. Legacy shops with missing/invalid coordinates stay in the DB (an
    // admin can correct them) but never appear in customer results until fixed.
    shops = shops.filter(s => isValidCoord(s.latitude, s.longitude));

    // Attach server-computed distance (null when the customer has not shared location).
    shops = shops.map(s => ({
      ...s,
      distance_km: hasUserLocation ? calculateDistance(userLat, userLng, s.latitude, s.longitude) : null,
      is_open: true
    }));

    if (hasUserLocation) {
      // Radius filter (server-authoritative). 'all' or absent => no distance limit.
      if (maxDistance && maxDistance !== 'all') {
        const maxDistKm = parseFloat(maxDistance);
        if (Number.isFinite(maxDistKm)) {
          shops = shops.filter(s => s.distance_km !== null && s.distance_km <= maxDistKm);
        }
      }
      // Sort nearest -> farthest (unknown distances, if any, sink to the end).
      shops.sort((a, b) => {
        if (a.distance_km === null) return 1;
        if (b.distance_km === null) return -1;
        return a.distance_km - b.distance_km;
      });
    }

    const offers = db.prepare(`
      SELECT o.id, o.shop_id, o.title, o.discount_percent, o.required_points, o.max_discount_inr, o.valid_until, o.status,
             s.name AS shop_name, s.category AS shop_category, s.image_url AS shop_image, s.address AS shop_address
      FROM offers o
      JOIN shops s ON o.shop_id = s.id
      WHERE LOWER(o.status) = 'active' AND LOWER(s.status) = 'active' AND LOWER(s.verification_status) = 'approved'
      ORDER BY o.required_points ASC
    `).all();

    return res.json({
      success: true,
      shops,
      offers
    });
  } catch (error) {
    console.error('Fetch customer shops error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch available offers' });
  }
});

// 4. Redeem Offer (Deduct Points & Generate Unique Redemption QR Code)
router.post('/redeem', (req, res) => {
  try {
    const userId = req.user.id;
    const { offer_id } = req.body;

    if (!offer_id) {
      return res.status(400).json({ success: false, error: 'Offer ID is required' });
    }

    const offer = db.prepare(`
      SELECT o.*, s.name AS shop_name, s.category AS shop_category
      FROM offers o
      JOIN shops s ON o.shop_id = s.id
      WHERE o.id = ? AND o.status = 'active' AND s.status = 'active'
    `).get(offer_id);

    if (!offer) {
      return res.status(404).json({ success: false, error: 'Offer is inactive or unavailable' });
    }

    const wallet = db.prepare('SELECT balance FROM wallets WHERE user_id = ?').get(userId);
    if (!wallet || wallet.balance < offer.required_points) {
      return res.status(400).json({
        success: false,
        error: `Insufficient point balance. You need ${offer.required_points} points, but currently have ${wallet ? wallet.balance : 0} points.`
      });
    }

    let redemptionCode;
    let codeExists = true;
    while (codeExists) {
      const randNum = Math.floor(100000 + Math.random() * 900000);
      redemptionCode = `RW-2026-${randNum}`;
      const check = db.prepare('SELECT id FROM redemptions WHERE redemption_code = ?').get(redemptionCode);
      if (!check) codeExists = false;
    }

    const redeemTx = db.transaction(() => {
      db.prepare(`
        UPDATE wallets
        SET balance = balance - ?,
            total_redeemed = total_redeemed + ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND balance >= ?
      `).run(offer.required_points, offer.required_points, userId, offer.required_points);

      const result = db.prepare(`
        INSERT INTO redemptions (redemption_code, user_id, offer_id, shop_id, points_deducted, discount_percent, max_discount_inr, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
      `).run(
        redemptionCode,
        userId,
        offer.id,
        offer.shop_id,
        offer.required_points,
        offer.discount_percent,
        offer.max_discount_inr
      );

      const updatedWallet = db.prepare('SELECT balance FROM wallets WHERE user_id = ?').get(userId);

      return {
        redemptionId: result.lastInsertRowid,
        redemptionCode,
        newBalance: updatedWallet.balance
      };
    });

    const result = redeemTx();

    return res.status(201).json({
      success: true,
      message: 'Discount Offer Redeemed Successfully!',
      redemption: {
        id: result.redemptionId,
        redemption_code: result.redemptionCode,
        offer_title: offer.title,
        shop_name: offer.shop_name,
        shop_category: offer.shop_category,
        discount_percent: offer.discount_percent,
        max_discount_inr: offer.max_discount_inr,
        points_deducted: offer.required_points,
        valid_until: offer.valid_until,
        status: 'ACTIVE'
      },
      newBalance: result.newBalance
    });
  } catch (error) {
    console.error('Redeem offer error:', error);
    return res.status(500).json({ success: false, error: 'Failed to process offer redemption' });
  }
});

// 5. Get User Redemptions History
router.get('/redemptions', (req, res) => {
  try {
    const userId = req.user.id;
    const redemptions = db.prepare(`
      SELECT r.id, r.redemption_code, r.points_deducted, r.discount_percent, r.max_discount_inr, r.status, r.created_at, r.redeemed_at,
             s.name AS shop_name, s.category AS shop_category, s.address AS shop_address, o.title AS offer_title, o.valid_until
      FROM redemptions r
      JOIN shops s ON r.shop_id = s.id
      JOIN offers o ON r.offer_id = o.id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
    `).all(userId);

    return res.json({
      success: true,
      redemptions
    });
  } catch (error) {
    console.error('Fetch customer redemptions error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch redemption history' });
  }
});

// ============================================================
// VP52 6-HOUR COIN SESSION SYSTEM API
// ============================================================

const GET_TEST_SESSION_DURATION = () => {
  if (process.env.TEST_SESSION_DURATION_SECONDS) {
    const parsed = parseInt(process.env.TEST_SESSION_DURATION_SECONDS, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 21600; // 6 hours = 21,600 seconds
};

// GET /api/customer/coin-session — Status & timestamp-based live progress
router.get('/coin-session', (req, res) => {
  try {
    const userId = req.user.id;
    const now = Date.now();
    const DURATION_SECONDS = GET_TEST_SESSION_DURATION();

    // 1. Check for active session
    const activeSession = db.prepare(`
      SELECT * FROM vp52_coin_sessions
      WHERE user_id = ? AND status = 'active'
      ORDER BY id DESC LIMIT 1
    `).get(userId);

    if (activeSession) {
      const startedMs = new Date(activeSession.started_at).getTime();
      const expiresMs = new Date(activeSession.expires_at).getTime();
      const durationSec = activeSession.duration_seconds || DURATION_SECONDS;
      const elapsedSec = Math.max(0, (now - startedMs) / 1000);
      const remainingSec = Math.max(0, Math.ceil((expiresMs - now) / 1000));
      const coinsEarned = Math.min(100.0, Math.max(0.0, (elapsedSec / durationSec) * 100.0));
      const isExpired = remainingSec <= 0 || now >= expiresMs;

      return res.json({
        success: true,
        session_state: isExpired ? 'COMPLETED_PENDING_CLAIM' : 'ACTIVE',
        session: {
          id: activeSession.id,
          status: isExpired ? 'completed_pending_claim' : 'active',
          ads_completed: activeSession.ads_completed || 3,
          started_at: activeSession.started_at,
          expires_at: activeSession.expires_at,
          duration_seconds: durationSec,
          remaining_seconds: remainingSec,
          coins_earned: coinsEarned,
          reward_claimed: activeSession.reward_claimed || 0,
          is_expired: isExpired
        }
      });
    }

    // 2. Check for completed session pending reward claim
    const completedPending = db.prepare(`
      SELECT * FROM vp52_coin_sessions
      WHERE user_id = ? AND status = 'completed' AND reward_claimed = 0
      ORDER BY id DESC LIMIT 1
    `).get(userId);

    if (completedPending) {
      return res.json({
        success: true,
        session_state: 'COMPLETED_PENDING_CLAIM',
        session: {
          id: completedPending.id,
          status: 'completed_pending_claim',
          ads_completed: 3,
          coins_earned: 100.0,
          reward_claimed: 0,
          is_expired: true,
          remaining_seconds: 0
        }
      });
    }

    // 3. Check for pending session (ads in progress or ready to start)
    const pendingSession = db.prepare(`
      SELECT * FROM vp52_coin_sessions
      WHERE user_id = ? AND status IN ('pending_ads', 'ready_to_start')
      ORDER BY id DESC LIMIT 1
    `).get(userId);

    if (pendingSession) {
      return res.json({
        success: true,
        session_state: pendingSession.ads_completed >= 3 ? 'READY_TO_START' : 'ADS_IN_PROGRESS',
        session: {
          id: pendingSession.id,
          status: pendingSession.status,
          ads_completed: pendingSession.ads_completed,
          can_start: pendingSession.ads_completed >= 3
        }
      });
    }

    // 4. Default: No session
    return res.json({
      success: true,
      session_state: 'NO_SESSION',
      session: {
        ads_completed: 0,
        can_start: false,
        status: 'no_session'
      }
    });
  } catch (error) {
    console.error('Fetch VP52 coin session error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch coin session' });
  }
});

// POST /api/customer/coin-session/ad-complete — Increment ad completion (0/3 -> 1/3 -> 2/3 -> 3/3)
router.post('/coin-session/ad-complete', (req, res) => {
  try {
    const userId = req.user.id;

    // Check if active session already running
    const active = db.prepare(`
      SELECT id FROM vp52_coin_sessions
      WHERE user_id = ? AND status = 'active' AND datetime(expires_at) > datetime('now')
    `).get(userId);

    if (active) {
      return res.status(400).json({ success: false, error: 'A 6-hour earning session is currently active.' });
    }

    let session = db.prepare(`
      SELECT * FROM vp52_coin_sessions
      WHERE user_id = ? AND status IN ('pending_ads', 'ready_to_start')
      ORDER BY id DESC LIMIT 1
    `).get(userId);

    if (!session) {
      const resIns = db.prepare(`
        INSERT INTO vp52_coin_sessions (user_id, ads_completed, status)
        VALUES (?, 1, 'pending_ads')
      `).run(userId);
      session = db.prepare('SELECT * FROM vp52_coin_sessions WHERE id = ?').get(resIns.lastInsertRowid);
    } else {
      const newCount = Math.min(3, (session.ads_completed || 0) + 1);
      const newStatus = newCount >= 3 ? 'ready_to_start' : 'pending_ads';
      db.prepare(`
        UPDATE vp52_coin_sessions
        SET ads_completed = ?, status = ?
        WHERE id = ?
      `).run(newCount, newStatus, session.id);
      session.ads_completed = newCount;
      session.status = newStatus;
    }

    return res.json({
      success: true,
      ads_completed: session.ads_completed,
      can_start: session.ads_completed >= 3,
      message: session.ads_completed >= 3
        ? 'All 3 ads completed! Click "Start 6-Hour Session" to begin.'
        : `Ad ${session.ads_completed}/3 completed successfully!`
    });
  } catch (error) {
    console.error('Ad completion error:', error);
    return res.status(500).json({ success: false, error: 'Failed to record ad completion' });
  }
});

// POST /api/customer/coin-session/start — Start 6-Hour Session after 3 ads completed
router.post('/coin-session/start', (req, res) => {
  try {
    const userId = req.user.id;
    const now = Date.now();
    const DURATION_SECONDS = GET_TEST_SESSION_DURATION();

    // Duplicate session protection: check if active session exists
    const existingActive = db.prepare(`
      SELECT * FROM vp52_coin_sessions
      WHERE user_id = ? AND status = 'active'
    `).get(userId);

    if (existingActive) {
      const expiresMs = new Date(existingActive.expires_at).getTime();
      if (now < expiresMs) {
        return res.json({
          success: true,
          message: 'Existing active session returned',
          session: existingActive
        });
      }
    }

    // Fetch pending session with at least 3 ads completed
    let pending = db.prepare(`
      SELECT * FROM vp52_coin_sessions
      WHERE user_id = ? AND status IN ('ready_to_start', 'pending_ads') AND ads_completed >= 3
      ORDER BY id DESC LIMIT 1
    `).get(userId);

    if (!pending) {
      return res.status(400).json({
        success: false,
        error: 'You must complete 3 advertisements before starting a 6-Hour Earning Session.'
      });
    }

    const durationSec = DURATION_SECONDS;
    const startTime = new Date(now).toISOString();
    const endTime = new Date(now + durationSec * 1000).toISOString();

    db.prepare(`
      UPDATE vp52_coin_sessions
      SET started_at = ?, expires_at = ?, duration_seconds = ?, status = 'active', coins_earned = 0, reward_claimed = 0
      WHERE id = ?
    `).run(startTime, endTime, durationSec, pending.id);

    const startedSession = db.prepare('SELECT * FROM vp52_coin_sessions WHERE id = ?').get(pending.id);

    return res.json({
      success: true,
      message: '6-Hour Earning Session started! Earning 100 VP52 Coins.',
      session: {
        id: startedSession.id,
        started_at: startTime,
        expires_at: endTime,
        duration_seconds: durationSec,
        remaining_seconds: durationSec,
        coins_earned: 0,
        status: 'active'
      }
    });
  } catch (error) {
    console.error('Start coin session error:', error);
    return res.status(500).json({ success: false, error: 'Failed to start coin session' });
  }
});

// POST /api/customer/coin-session/complete — Finalize 6-Hour Session and credit 100 coins (Idempotent)
router.post('/coin-session/complete', (req, res) => {
  try {
    const userId = req.user.id;
    const now = Date.now();

    const session = db.prepare(`
      SELECT * FROM vp52_coin_sessions
      WHERE user_id = ?
      ORDER BY id DESC LIMIT 1
    `).get(userId);

    if (!session) {
      return res.status(404).json({ success: false, error: 'No coin session found' });
    }

    // Idempotent protection: check if 100 coins already claimed
    if (session.reward_claimed === 1) {
      const wallet = db.prepare('SELECT balance, total_earned FROM wallets WHERE user_id = ?').get(userId);
      return res.json({
        success: true,
        already_claimed: true,
        message: '100 VP52 Coins were already credited to your wallet!',
        coins_awarded: 100,
        newBalance: wallet ? wallet.balance : 0
      });
    }

    // Verify session time has elapsed
    const expiresMs = new Date(session.expires_at || Date.now()).getTime();
    if (now < expiresMs && session.status === 'active') {
      return res.status(400).json({
        success: false,
        error: 'Session is still in progress. Please wait until the session duration completes.'
      });
    }

    // Atomic Completion Transaction: Credit 100 coins to coin_lots, wallets, transactions, ledger
    const completeTx = db.transaction(() => {
      db.prepare(`
        UPDATE vp52_coin_sessions
        SET status = 'completed', completed_at = CURRENT_TIMESTAMP, reward_claimed = 1, coins_earned = 100
        WHERE id = ? AND reward_claimed = 0
      `).run(session.id);

      const txId = `VP52-SESSION-${session.id}`;
      const expiresAt = new Date(Date.now() + 30 * 86400 * 1000).toISOString();

      db.prepare(`
        INSERT INTO coin_lots (user_id, transaction_id, source, coins_earned, coins_remaining, expires_at, status)
        VALUES (?, ?, 'VP52_6HR_SESSION', 100, 100, ?, 'ACTIVE')
      `).run(userId, txId, expiresAt);

      const walletBefore = db.prepare('SELECT balance, total_earned FROM wallets WHERE user_id = ?').get(userId) || { balance: 0, total_earned: 0 };
      const prevBal = walletBefore.balance;
      const newBal = prevBal + 100;
      const newLifetime = walletBefore.total_earned + 100;

      db.prepare(`
        UPDATE wallets
        SET balance = ?, total_earned = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(newBal, newLifetime, userId);

      db.prepare(`
        INSERT INTO reward_transactions (user_id, activity_type, points)
        VALUES (?, 'VP52 6-Hour Session Completion', 100)
      `).run(userId);

      db.prepare(`
        INSERT INTO point_ledger (user_id, transaction_id, type, points, previous_balance, new_balance, reason)
        VALUES (?, ?, 'AD_REWARD', 100, ?, ?, 'Completed VP52 6-Hour Earning Session (100 Coins)')
      `).run(userId, txId, prevBal, newBal);

      return {
        newBalance: newBal,
        totalEarned: newLifetime
      };
    });

    const result = completeTx();

    return res.json({
      success: true,
      message: '🎉 Congratulations! 100 VP52 Coins Credited to your Wallet!',
      coins_awarded: 100,
      newBalance: result.newBalance,
      totalEarned: result.totalEarned
    });
  } catch (error) {
    console.error('Complete coin session error:', error);
    return res.status(500).json({ success: false, error: 'Failed to complete session' });
  }
});

// 6. SERVER-CONTROLLED 6-HOUR REWARD SESSION API (Legacy Fallback)
router.get('/reward-session/status', (req, res) => {
  try {
    const userId = req.user.id;
    const durationHours = parseInt(getRewardSetting('session_duration_hours', '6'), 10);
    const adsPerSession = parseInt(getRewardSetting('ads_per_session', '3'), 10);
    const maxSessionsPerDay = parseInt(getRewardSetting('max_sessions_per_day', '2'), 10);
    const coinsPerAd = parseInt(getRewardSetting('coins_per_ad', '2'), 10);

    // Fetch active non-expired session
    let session = db.prepare(`
      SELECT * FROM reward_sessions
      WHERE user_id = ? AND status = 'active' AND datetime(end_time) > datetime('now')
      ORDER BY id DESC LIMIT 1
    `).get(userId);

    // If no active session or expired, check if eligible to start a new 6-hour session
    if (!session) {
      // Count sessions completed today
      const todayCountRow = db.prepare(`
        SELECT COUNT(*) AS count FROM reward_sessions
        WHERE user_id = ? AND date(start_time) = date('now')
      `).get(userId);
      const sessionsToday = todayCountRow ? todayCountRow.count : 0;

      if (sessionsToday >= maxSessionsPerDay) {
        return res.json({
          success: true,
          active: false,
          daily_limit_reached: true,
          message: `Daily session limit reached (${maxSessionsPerDay} sessions per 24 hours). Next session available tomorrow.`,
          sessions_today: sessionsToday,
          max_sessions_today: maxSessionsPerDay
        });
      }

      // Auto-start new session
      const startTime = new Date().toISOString();
      const endTime = new Date(Date.now() + durationHours * 3600 * 1000).toISOString();
      const nextSessionNum = sessionsToday + 1;

      const result = db.prepare(`
        INSERT INTO reward_sessions (user_id, start_time, end_time, status, session_number_for_day, ads_watched, coins_earned)
        VALUES (?, ?, ?, 'active', ?, 0, 0)
      `).run(userId, startTime, endTime, nextSessionNum);

      session = db.prepare('SELECT * FROM reward_sessions WHERE id = ?').get(result.lastInsertRowid);
    }

    const now = new Date().getTime();
    const end = new Date(session.end_time).getTime();
    const remainingSeconds = Math.max(0, Math.floor((end - now) / 1000));
    const adsWatched = session.ads_watched || 0;
    const canWatchAd = adsWatched < adsPerSession && remainingSeconds > 0;

    return res.json({
      success: true,
      active: true,
      session: {
        ...session,
        remaining_seconds: remainingSeconds,
        ads_watched: adsWatched,
        max_ads: adsPerSession,
        coins_earned: session.coins_earned || 0,
        can_watch_ad: canWatchAd,
        coins_per_ad: coinsPerAd
      }
    });
  } catch (error) {
    console.error('Reward session status error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch reward session status' });
  }
});

// Watch Ad in Active 6-Hour Session
router.post('/reward-session/watch-ad', (req, res) => {
  try {
    const userId = req.user.id;
    const adsPerSession = parseInt(getRewardSetting('ads_per_session', '3'), 10);
    const coinsPerAd = parseInt(getRewardSetting('coins_per_ad', '2'), 10);
    const expiryDays = parseInt(getRewardSetting('coin_expiry_days', '30'), 10);

    const session = db.prepare(`
      SELECT * FROM reward_sessions
      WHERE user_id = ? AND status = 'active' AND datetime(end_time) > datetime('now')
      ORDER BY id DESC LIMIT 1
    `).get(userId);

    if (!session) {
      return res.status(400).json({ success: false, error: 'No active reward session. Please wait for next session.' });
    }

    if ((session.ads_watched || 0) >= adsPerSession) {
      return res.status(400).json({ success: false, error: `Session complete! You have already watched ${adsPerSession}/${adsPerSession} ads in this session.` });
    }

    const newAdsWatched = (session.ads_watched || 0) + 1;
    const newCoinsEarned = (session.coins_earned || 0) + coinsPerAd;
    const newStatus = newAdsWatched >= adsPerSession ? 'completed' : 'active';

    // Atomic reward transaction: update session, insert 30-day coin lot, credit wallet
    const watchAdTx = db.transaction(() => {
      // 1. Update session
      db.prepare(`
        UPDATE reward_sessions
        SET ads_watched = ?, coins_earned = ?, status = ?
        WHERE id = ?
      `).run(newAdsWatched, newCoinsEarned, newStatus, session.id);

      // 2. Insert into coin_lots (30-day expiry)
      const txId = `AD-REWARD-${session.id}-${newAdsWatched}`;
      const expiresAt = new Date(Date.now() + expiryDays * 86400 * 1000).toISOString();

      db.prepare(`
        INSERT INTO coin_lots (user_id, transaction_id, source, coins_earned, coins_remaining, expires_at, status)
        VALUES (?, ?, 'AD_REWARD', ?, ?, ?, 'ACTIVE')
      `).run(userId, txId, coinsPerAd, coinsPerAd, expiresAt);

      // 3. Update Wallet balance & lifetime earned
      const walletBefore = db.prepare('SELECT balance, total_earned FROM wallets WHERE user_id = ?').get(userId) || { balance: 0, total_earned: 0 };
      const prevBal = walletBefore.balance;
      const newBal = prevBal + coinsPerAd;
      const newLifetime = walletBefore.total_earned + coinsPerAd;

      db.prepare(`
        UPDATE wallets
        SET balance = ?,
            total_earned = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(newBal, newLifetime, userId);

      // 4. Insert into point_ledger
      db.prepare(`
        INSERT INTO point_ledger (user_id, transaction_id, type, points, previous_balance, new_balance, reason)
        VALUES (?, ?, 'AD_REWARD', ?, ?, ?, 'Demo Reward Advertisement Completion')
      `).run(userId, txId, coinsPerAd, prevBal, newBal);

      db.prepare(`
        INSERT INTO reward_transactions (user_id, activity_type, points)
        VALUES (?, 'Demo Reward Advertisement', ?)
      `).run(userId, coinsPerAd);

      return {
        adsWatched: newAdsWatched,
        sessionCompleted: newStatus === 'completed',
        coinsAwarded: coinsPerAd,
        newBalance: newBal,
        lifetimeCoins: newLifetime
      };
    });

    const result = watchAdTx();

    return res.json({
      success: true,
      message: `🎉 DEMO REWARD ADVERTISEMENT COMPLETED! +${result.coinsAwarded} Coins (₹${result.coinsAwarded} Value) Earned!`,
      coinsAwarded: result.coinsAwarded,
      adsWatched: result.adsWatched,
      maxAds: adsPerSession,
      sessionCompleted: result.sessionCompleted,
      newBalance: result.newBalance,
      lifetimeCoins: result.lifetimeCoins
    });
  } catch (error) {
    console.error('Watch reward ad error:', error);
    return res.status(500).json({ success: false, error: 'Failed to process ad reward' });
  }
});

// 7. CUSTOMER LEVEL PROGRESSION & ENGINE (Level != Coins)
router.get('/level', (req, res) => {
  try {
    const userId = req.user.id;
    const wallet = db.prepare('SELECT total_earned FROM wallets WHERE user_id = ?').get(userId) || { total_earned: 0 };
    const lifetimePoints = wallet.total_earned;

    const levels = db.prepare('SELECT * FROM reward_levels ORDER BY min_points ASC').all();

    let currentLevel = 'Basic';
    let nextLevel = 'Silver';
    let minForNext = 100;
    let benefits = 'Standard Membership & Access to local shop offers';
    let discountCapPercent = 5;

    for (let i = 0; i < levels.length; i++) {
      if (lifetimePoints >= levels[i].min_points) {
        currentLevel = levels[i].level_name;
        benefits = levels[i].benefits;
        discountCapPercent = levels[i].discount_cap_percent || 5;

        if (i < levels.length - 1) {
          nextLevel = levels[i + 1].level_name;
          minForNext = levels[i + 1].min_points;
        } else {
          nextLevel = 'Max Level';
          minForNext = levels[i].min_points;
        }
      }
    }

    const progressPercent = nextLevel === 'Max Level' ? 100 : Math.min(100, Math.floor((lifetimePoints / minForNext) * 100));

    return res.json({
      success: true,
      currentLevel,
      nextLevel,
      lifetimeCoins: lifetimePoints,
      minForNext,
      progressPercent,
      benefits,
      discountCapPercent
    });
  } catch (error) {
    console.error('Fetch customer level error:', error);
    return res.status(500).json({ success: false, error: 'Failed to compute reward level' });
  }
});

// 8. SUBMIT COMPLAINT
router.post('/complaints', (req, res) => {
  try {
    const userId = req.user.id;
    const { category, description, transaction_id } = req.body;

    if (!category || !description) {
      return res.status(400).json({ success: false, error: 'Category and description are required' });
    }

    const ticketId = `TICKET-${Math.floor(100000 + Math.random() * 900000)}`;

    const result = db.prepare(`
      INSERT INTO complaints (ticket_id, user_id, category, description, transaction_id, status)
      VALUES (?, ?, ?, ?, ?, 'open')
    `).run(ticketId, userId, category.trim(), description.trim(), transaction_id ? transaction_id.trim() : null);

    return res.status(201).json({
      success: true,
      message: `Support complaint submitted! Ticket ID: ${ticketId}`,
      ticketId
    });
  } catch (error) {
    console.error('Submit complaint error:', error);
    return res.status(500).json({ success: false, error: 'Failed to submit complaint' });
  }
});

router.get('/complaints', (req, res) => {
  try {
    const userId = req.user.id;
    const complaints = db.prepare('SELECT * FROM complaints WHERE user_id = ? ORDER BY created_at DESC').all(userId);
    return res.json({ success: true, complaints });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch complaints' });
  }
});

// ============================================================
// Customer <-> Merchant Chat
//
// SECURITY MODEL (read before editing):
//  * The customer identity is ALWAYS taken from the verified JWT (req.user.id).
//    customer_id is NEVER read from the request body, params, or query — a
//    customer can therefore only ever touch their own conversations.
//  * Every conversation lookup is filtered by "customer_id = <jwt id>". A
//    conversation that exists but belongs to someone else returns 404 (not 403)
//    so conversation IDs cannot be enumerated by probing.
//  * Message text is validated (trimmed, non-empty, max length) server-side.
// ============================================================
const { nowIso, validateMessageText } = require('../utils/chat');

// GET /api/customer/conversations — list this customer's conversations, newest first,
// each with the shop context, last message preview, and unread (shop->customer) count.
router.get('/conversations', (req, res) => {
  try {
    const customerId = req.user.id;
    const conversations = db.prepare(`
      SELECT
        c.id, c.shop_id, c.created_at, c.updated_at, c.last_message_at,
        s.name AS shop_name, s.category AS shop_category,
        s.image_url AS shop_image_url, s.status AS shop_status,
        (SELECT m.message_text FROM messages m WHERE m.conversation_id = c.id
           ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_message_text,
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id
           AND m.sender_role = 'shop' AND m.read_at IS NULL) AS unread_count
      FROM conversations c
      JOIN shops s ON s.id = c.shop_id
      WHERE c.customer_id = ?
      ORDER BY COALESCE(c.last_message_at, c.created_at) DESC, c.id DESC
    `).all(customerId);

    const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
    return res.json({ success: true, conversations, total_unread: totalUnread });
  } catch (error) {
    console.error('List customer conversations error:', error);
    return res.status(500).json({ success: false, error: 'Failed to load conversations' });
  }
});

// GET /api/customer/conversations/unread-count — lightweight total for the nav badge.
// NOTE: registered before any "/conversations/:id/..." route so the literal path wins.
router.get('/conversations/unread-count', (req, res) => {
  try {
    const customerId = req.user.id;
    const row = db.prepare(`
      SELECT COUNT(*) AS unread
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE c.customer_id = ? AND m.sender_role = 'shop' AND m.read_at IS NULL
    `).get(customerId);
    return res.json({ success: true, unread_count: row ? row.unread : 0 });
  } catch (error) {
    console.error('Customer unread-count error:', error);
    return res.status(500).json({ success: false, error: 'Failed to load unread count' });
  }
});

// POST /api/customer/conversations { shop_id } — create-or-reuse (idempotent).
// UNIQUE(customer_id, shop_id) + ON CONFLICT DO NOTHING guarantees no duplicate
// conversation per (customer, shop) pair, even under concurrent taps.
router.post('/conversations', (req, res) => {
  try {
    const customerId = req.user.id;
    const shopId = parseInt(req.body ? req.body.shop_id : undefined, 10);
    if (!Number.isInteger(shopId) || shopId <= 0) {
      return res.status(400).json({ success: false, error: 'A valid shop_id is required' });
    }

    const shop = db.prepare('SELECT id, status FROM shops WHERE id = ?').get(shopId);
    if (!shop) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }
    if (shop.status !== 'active') {
      return res.status(403).json({ success: false, error: 'This shop is not available for messaging' });
    }

    const ts = nowIso();
    db.prepare(`
      INSERT INTO conversations (customer_id, shop_id, created_at, updated_at, last_message_at)
      VALUES (?, ?, ?, ?, NULL)
      ON CONFLICT(customer_id, shop_id) DO NOTHING
    `).run(customerId, shopId, ts, ts);

    const conversation = db.prepare(`
      SELECT c.id, c.shop_id, c.created_at, c.updated_at, c.last_message_at,
             s.name AS shop_name, s.category AS shop_category,
             s.image_url AS shop_image_url, s.status AS shop_status
      FROM conversations c
      JOIN shops s ON s.id = c.shop_id
      WHERE c.customer_id = ? AND c.shop_id = ?
    `).get(customerId, shopId);

    return res.json({ success: true, conversation });
  } catch (error) {
    console.error('Create customer conversation error:', error);
    return res.status(500).json({ success: false, error: 'Failed to start conversation' });
  }
});

// GET /api/customer/conversations/:id/messages — chronological messages for a
// conversation the caller owns. Non-owned/absent => 404.
router.get('/conversations/:id/messages', (req, res) => {
  try {
    const customerId = req.user.id;
    const conversationId = parseInt(req.params.id, 10);
    if (!Number.isInteger(conversationId)) {
      return res.status(400).json({ success: false, error: 'Invalid conversation id' });
    }

    const conversation = db.prepare(`
      SELECT c.id, c.shop_id, c.created_at, c.last_message_at,
             s.name AS shop_name, s.category AS shop_category,
             s.image_url AS shop_image_url, s.status AS shop_status
      FROM conversations c
      JOIN shops s ON s.id = c.shop_id
      WHERE c.id = ? AND c.customer_id = ?
    `).get(conversationId, customerId);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const messages = db.prepare(`
      SELECT id, conversation_id, sender_role, sender_user_id, message_text, created_at, read_at
      FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC, id ASC
    `).all(conversationId);

    return res.json({ success: true, conversation, messages });
  } catch (error) {
    console.error('Get customer messages error:', error);
    return res.status(500).json({ success: false, error: 'Failed to load messages' });
  }
});

// POST /api/customer/conversations/:id/messages { message_text } — send a message.
router.post('/conversations/:id/messages', (req, res) => {
  try {
    const customerId = req.user.id;
    const conversationId = parseInt(req.params.id, 10);
    if (!Number.isInteger(conversationId)) {
      return res.status(400).json({ success: false, error: 'Invalid conversation id' });
    }

    const check = validateMessageText(req.body ? req.body.message_text : undefined);
    if (!check.ok) {
      return res.status(400).json({ success: false, error: check.error });
    }

    const conversation = db.prepare(`
      SELECT c.id, s.status AS shop_status
      FROM conversations c
      JOIN shops s ON s.id = c.shop_id
      WHERE c.id = ? AND c.customer_id = ?
    `).get(conversationId, customerId);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }
    if (conversation.shop_status !== 'active') {
      return res.status(403).json({ success: false, error: 'This shop is not available for messaging' });
    }

    const ts = nowIso();
    const send = db.transaction(() => {
      const info = db.prepare(`
        INSERT INTO messages (conversation_id, sender_role, sender_user_id, message_text, created_at, read_at)
        VALUES (?, 'customer', ?, ?, ?, NULL)
      `).run(conversationId, customerId, check.text, ts);
      db.prepare('UPDATE conversations SET last_message_at = ?, updated_at = ? WHERE id = ?')
        .run(ts, ts, conversationId);
      return info.lastInsertRowid;
    });
    const newId = send();

    const message = db.prepare(`
      SELECT id, conversation_id, sender_role, sender_user_id, message_text, created_at, read_at
      FROM messages WHERE id = ?
    `).get(newId);

    return res.status(201).json({ success: true, message });
  } catch (error) {
    console.error('Send customer message error:', error);
    return res.status(500).json({ success: false, error: 'Failed to send message' });
  }
});

// PATCH|PUT /api/customer/conversations/:id/read — mark shop->customer messages read.
function markCustomerConversationRead(req, res) {
  try {
    const customerId = req.user.id;
    const conversationId = parseInt(req.params.id, 10);
    if (!Number.isInteger(conversationId)) {
      return res.status(400).json({ success: false, error: 'Invalid conversation id' });
    }

    const conversation = db.prepare('SELECT id FROM conversations WHERE id = ? AND customer_id = ?')
      .get(conversationId, customerId);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const info = db.prepare(`
      UPDATE messages SET read_at = ?
      WHERE conversation_id = ? AND sender_role = 'shop' AND read_at IS NULL
    `).run(nowIso(), conversationId);

    return res.json({ success: true, marked_read: info.changes });
  } catch (error) {
    console.error('Mark customer read error:', error);
    return res.status(500).json({ success: false, error: 'Failed to mark as read' });
  }
}
router.patch('/conversations/:id/read', markCustomerConversationRead);
router.put('/conversations/:id/read', markCustomerConversationRead);

module.exports = router;
