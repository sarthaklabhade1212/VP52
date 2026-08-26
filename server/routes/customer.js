const express = require('express');
const crypto = require('crypto');
const db = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Apply Customer Authentication Middleware to all customer routes
router.use(authenticateToken);
router.use(requireRole('customer'));

// Helper to calculate distance using Haversine formula (in km)
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 1.2; // default fallback 1.2 km
  const R = 6371; // Radius of Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
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

// 2. Watch Simulated Ad & Earn Points
router.post('/watch-ad', (req, res) => {
  try {
    const userId = req.user.id;
    const pointsConfigured = parseInt(getSetting('points_per_ad', '100'), 10);

    // Atomic transaction for awarding points + point_ledger
    const rewardTx = db.transaction(() => {
      const walletBefore = db.prepare('SELECT balance, total_earned FROM wallets WHERE user_id = ?').get(userId) || { balance: 0, total_earned: 0 };
      const prevBal = walletBefore.balance;
      const newBal = prevBal + pointsConfigured;

      db.prepare(`
        UPDATE wallets
        SET balance = ?,
            total_earned = total_earned + ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(newBal, pointsConfigured, userId);

      const result = db.prepare(`
        INSERT INTO reward_transactions (user_id, activity_type, points)
        VALUES (?, 'Sponsored Content Reward', ?)
      `).run(userId, pointsConfigured);

      const txId = `AD-REWARD-${result.lastInsertRowid}`;

      // Insert into point_ledger
      db.prepare(`
        INSERT INTO point_ledger (user_id, transaction_id, type, points, previous_balance, new_balance, reason)
        VALUES (?, ?, 'AD_REWARD', ?, ?, ?, 'Demo / Simulated Advertisement Watch Reward')
      `).run(userId, txId, pointsConfigured, prevBal, newBal);

      const freshWallet = db.prepare('SELECT balance, total_earned FROM wallets WHERE user_id = ?').get(userId);

      return {
        transactionId: result.lastInsertRowid,
        pointsAwarded: pointsConfigured,
        newBalance: freshWallet.balance,
        totalEarned: freshWallet.total_earned
      };
    });

    const result = rewardTx();

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
    const userLat = lat ? parseFloat(lat) : 18.5204;
    const userLng = lng ? parseFloat(lng) : 73.8567;

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

    // Attach calculated distance
    shops = shops.map(s => {
      const dist = calculateDistance(userLat, userLng, s.latitude || 18.5204, s.longitude || 73.8567);
      return {
        ...s,
        distance_km: dist,
        is_open: true
      };
    });

    // Apply distance filter if specified
    if (maxDistance && maxDistance !== 'all') {
      const maxDistKm = parseFloat(maxDistance);
      shops = shops.filter(s => s.distance_km <= maxDistKm);
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

// 6. SERVER-CONTROLLED 6-HOUR REWARD SESSION API
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

module.exports = router;
