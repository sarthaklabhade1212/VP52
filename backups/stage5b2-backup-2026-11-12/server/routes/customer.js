const express = require('express');
const crypto = require('crypto');
const db = require('../db/database');
const { authenticateToken, requireRole, requireCompletedProfile } = require('../middleware/auth');
const { CATEGORIES, getCategoryById } = require('../config/categories');

const router = express.Router();

// Apply Customer Authentication Middleware to all customer routes
router.use(authenticateToken);
router.use(requireRole('customer'));
router.use(requireCompletedProfile);

// Categories reference for Customer
router.get('/categories', (req, res) => {
  return res.json({ success: true, categories: CATEGORIES });
});

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

function getRewardSetting(key, defaultValue) {
  try {
    const row = db.prepare('SELECT value FROM reward_settings WHERE key = ?').get(key) ||
                db.prepare('SELECT value FROM admin_settings WHERE key = ?').get(key);
    return row ? row.value : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

// VP52 12-Tier Coin Hierarchy
const VP52_TIERS = [
  'Bronze',
  'Silver',
  'Gold',
  'Platinum',
  'Diamond',
  'Titanium',
  'Ruby',
  'Crown',
  'Royal',
  'Elite',
  'Legend',
  'VIP'
];

function getTierValues() {
  const defaults = {
    Bronze: 1,
    Silver: 2,
    Gold: 4,
    Platinum: 8,
    Diamond: 16,
    Titanium: 32,
    Ruby: 64,
    Crown: 128,
    Royal: 256,
    Elite: 512,
    Legend: 1024,
    VIP: 2048
  };
  try {
    const rows = db.prepare("SELECT key, value FROM admin_settings WHERE key LIKE 'coin_value_%'").all();
    rows.forEach(r => {
      const tierName = r.key.replace('coin_value_', '');
      const capitalized = tierName.charAt(0).toUpperCase() + tierName.slice(1).toLowerCase();
      const val = parseInt(r.value, 10);
      if (VP52_TIERS.includes(capitalized) && !isNaN(val) && val > 0) {
        defaults[capitalized] = val;
      }
    });
  } catch (e) {}
  return defaults;
}

// Automatic Tier Transition Engine (Deterministic 12-Tier Aging Progression)
function reconcileTierTransitions(userId) {
  try {
    const maturedLots = db.prepare(`
      SELECT * FROM coin_lots
      WHERE user_id = ?
        AND status IN ('ACTIVE', 'PARTIALLY_USED')
        AND coins_remaining > 0
        AND tier != 'VIP'
        AND (
          (next_transition_at IS NOT NULL AND datetime(next_transition_at) <= datetime('now'))
          OR
          (next_transition_at IS NULL AND datetime(expires_at) <= datetime('now'))
        )
    `).all(userId);

    if (!maturedLots || maturedLots.length === 0) return;

    maturedLots.forEach(lot => {
      const currentTier = lot.tier || 'Bronze';
      const currentTierIndex = VP52_TIERS.indexOf(currentTier);
      if (currentTierIndex === -1 || currentTierIndex >= VP52_TIERS.length - 1) return; // VIP doesn't convert

      const nextTier = VP52_TIERS[currentTierIndex + 1];
      const remaining = lot.coins_remaining;

      // Deterministic integer-safe conversion formula:
      // Bronze -> Elite (indexes 0 to 9): 50% conversion -> Math.floor(remaining / 2)
      // Legend -> VIP (index 10 -> 11): 5 Legend = 1 VIP -> Math.floor(remaining / 5)
      let convertedAmount = 0;
      if (currentTierIndex === 10) { // Legend -> VIP
        convertedAmount = Math.floor(remaining / 5);
      } else {
        convertedAmount = Math.floor(remaining / 2);
      }

      if (convertedAmount > 0) {
        const nextTransitionStr = new Date(Date.now() + 30 * 86400 * 1000).toISOString();

        db.prepare(`
          UPDATE coin_lots
          SET tier = ?,
              coins_remaining = ?,
              original_amount = ?,
              status = 'ACTIVE',
              last_transition_at = CURRENT_TIMESTAMP,
              next_transition_at = ?,
              expires_at = ?
          WHERE id = ?
        `).run(nextTier, convertedAmount, convertedAmount, nextTransitionStr, nextTransitionStr, lot.id);

        db.prepare(`
          INSERT INTO point_ledger (user_id, transaction_id, type, points, previous_balance, new_balance, reason)
          VALUES (?, ?, 'TIER_TRANSITION', ?, ?, ?, ?)
        `).run(
          userId,
          `TIER-TRANSITION-${lot.id}-${Date.now()}`,
          convertedAmount,
          remaining,
          convertedAmount,
          `VP52 Matured Lot Conversion: ${remaining} ${currentTier} -> ${convertedAmount} ${nextTier}`
        );
      } else {
        // Under conversion threshold -> Mark lot as EXPIRED
        db.prepare(`
          UPDATE coin_lots
          SET status = 'EXPIRED', coins_remaining = 0
          WHERE id = ?
        `).run(lot.id);
      }
    });

    // Recalculate active wallet sum
    const totalRow = db.prepare(`
      SELECT SUM(coins_remaining) AS total FROM coin_lots
      WHERE user_id = ? AND status IN ('ACTIVE', 'PARTIALLY_USED')
    `).get(userId);
    const newBal = totalRow ? (totalRow.total || 0) : 0;
    db.prepare('UPDATE wallets SET balance = ? WHERE user_id = ?').run(newBal, userId);
  } catch (e) {
    console.error('Tier transition reconciliation error:', e.message);
  }
}

// 1. Get Wallet Balance & Multi-Tier Summary
router.get('/wallet', (req, res) => {
  try {
    const userId = req.user.id;
    reconcileTierTransitions(userId);

    const wallet = db.prepare('SELECT balance, total_earned, total_redeemed FROM wallets WHERE user_id = ?').get(userId) || { balance: 0, total_earned: 0, total_redeemed: 0 };

    const tierValues = getTierValues();
    const tierBreakdown = {};
    VP52_TIERS.forEach(t => {
      tierBreakdown[t] = {
        tier: t,
        coins: 0,
        value_inr: 0,
        unit_value: tierValues[t] || 1,
        lots_count: 0
      };
    });

    const activeLots = db.prepare(`
      SELECT id, transaction_id, source, coins_earned, coins_remaining, tier, original_amount, earned_at, expires_at, next_transition_at, status,
             CAST((julianday(COALESCE(next_transition_at, expires_at)) - julianday('now')) * 24 AS INTEGER) AS hours_until_transition
      FROM coin_lots
      WHERE user_id = ? AND status IN ('ACTIVE', 'PARTIALLY_USED') AND coins_remaining > 0
      ORDER BY earned_at ASC
    `).all(userId);

    let totalAvailableCoins = 0;
    let totalValueInr = 0;

    activeLots.forEach(lot => {
      const lotTier = VP52_TIERS.includes(lot.tier) ? lot.tier : 'Bronze';
      tierBreakdown[lotTier].coins += lot.coins_remaining;
      tierBreakdown[lotTier].value_inr += lot.coins_remaining * (tierValues[lotTier] || 1);
      tierBreakdown[lotTier].lots_count += 1;

      totalAvailableCoins += lot.coins_remaining;
      totalValueInr += lot.coins_remaining * (tierValues[lotTier] || 1);
    });

    const tierSummary = VP52_TIERS.map(t => ({
      tier: t,
      coins: tierBreakdown[t].coins,
      value_inr: tierBreakdown[t].value_inr,
      unit_value: tierBreakdown[t].unit_value,
      lots_count: tierBreakdown[t].lots_count
    }));

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

    const rewardHistory = db.prepare(`
      SELECT id, activity_type, points, created_at
      FROM reward_transactions
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(userId);

    const redemptionHistory = db.prepare(`
      SELECT r.id, r.redemption_code, r.points_deducted, r.discount_percent, r.max_discount_inr, r.status, r.created_at, r.redeemed_at, r.coin_tier,
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
        available_coins: totalAvailableCoins,
        discount_value_inr: totalValueInr,
        total_expired: totalExpired,
        earned_today: earnedToday,
        earned_this_month: earnedThisMonth,
        tier_breakdown: tierBreakdown
      },
      tierSummary,
      activeLots,
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

    // Atomic transaction for awarding points + point_ledger + coin_lots (Bronze Tier)
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
      const expiresAt = new Date(Date.now() + 30 * 86400 * 1000).toISOString();

      // Insert into coin_lots (Bronze Tier)
      db.prepare(`
        INSERT INTO coin_lots (user_id, transaction_id, source, coins_earned, coins_remaining, tier, original_amount, next_transition_at, expires_at, status)
        VALUES (?, ?, 'AD_REWARD', ?, ?, 'Bronze', ?, ?, ?, 'ACTIVE')
      `).run(userId, txId, pointsAwarded, pointsAwarded, pointsAwarded, expiresAt, expiresAt);

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

// Update Customer Profile Photo
router.post('/photo', (req, res) => {
  try {
    const userId = req.user.id;
    const { photo_url } = req.body || {};

    if (!photo_url || typeof photo_url !== 'string') {
      return res.status(400).json({ success: false, error: 'Valid photo URL is required' });
    }

    const cleanUrl = photo_url.trim();
    if (!cleanUrl.startsWith('/uploads/') && !cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      return res.status(400).json({ success: false, error: 'Invalid photo URL format' });
    }

    db.prepare('UPDATE users SET profile_photo = ? WHERE id = ?').run(cleanUrl, userId);

    const user = db.prepare('SELECT id, full_name, email, phone, status, profile_photo, profile_completed, created_at FROM users WHERE id = ?').get(userId);

    return res.json({
      success: true,
      message: 'Profile photo updated successfully',
      profile_photo: cleanUrl,
      user
    });
  } catch (error) {
    console.error('Update profile photo error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update profile photo' });
  }
});

// Remove Customer Profile Photo
router.delete('/photo', (req, res) => {
  try {
    const userId = req.user.id;
    db.prepare('UPDATE users SET profile_photo = NULL WHERE id = ?').run(userId);
    return res.json({ success: true, message: 'Profile photo removed' });
  } catch (error) {
    console.error('Remove profile photo error:', error);
    return res.status(500).json({ success: false, error: 'Failed to remove profile photo' });
  }
});

// 3. Get Active Approved Shops & Offers (Strict Public Discoverability Filter)
router.get('/shops', (req, res) => {
  try {
    const { search, category, subcategory, minRating, openNow, sortBy, maxDistance, lat, lng } = req.query;

    const hasUserLocation = isValidCoord(lat, lng);
    const userLat = hasUserLocation ? Number(lat) : null;
    const userLng = hasUserLocation ? Number(lng) : null;

    let query = `
      SELECT id, shop_code, name, category, subcategory, description, address, area_locality, city, district, state, pincode,
             phone, whatsapp_number, image_url, logo_url, cover_photo_url, status, verification_status,
             latitude, longitude, rating, rating_avg, rating_count, opening_time, closing_time, is_temporarily_closed
      FROM shops
      WHERE LOWER(status) = 'active' AND LOWER(verification_status) = 'approved'
    `;

    const params = [];

    if (search) {
      query += ` AND (
        name LIKE ? OR category LIKE ? OR subcategory LIKE ? OR description LIKE ? OR address LIKE ?
        OR EXISTS (SELECT 1 FROM products p WHERE p.shop_id = shops.id AND p.name LIKE ?)
      )`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term, term, term);
    }

    if (category && category !== 'All') {
      const catObj = getCategoryById(category);
      const catName = catObj ? catObj.name : category.trim();
      const aliases = [category.trim(), catName];
      const lower = catName.toLowerCase();
      if (lower.includes('grocery')) {
        aliases.push('Grocery & Supermarket', 'Groceries', 'Grocery');
      } else if (lower.includes('hotel') || lower.includes('food services')) {
        aliases.push('Café & Bakery', 'Fine Dining', 'Restaurant', 'Hotel', 'Food');
      } else if (lower.includes('clothing') || lower.includes('fashion')) {
        aliases.push('Clothing & Apparel', 'Clothing', 'Paithani');
      } else if (lower.includes('electrical') || lower.includes('electronics')) {
        aliases.push('Electronics & Accessories', 'Electronics');
      } else if (lower.includes('general')) {
        aliases.push('Books & Supplies', 'Retail');
      }

      const placeholders = aliases.map(() => '?').join(' OR category = ');
      query += ` AND (category = ${placeholders})`;
      params.push(...aliases);
    }

    if (subcategory && subcategory !== 'All') {
      query += ` AND subcategory = ?`;
      params.push(subcategory.trim());
    }

    if (minRating) {
      const minR = parseFloat(minRating);
      if (Number.isFinite(minR)) {
        query += ` AND COALESCE(rating_avg, rating, 4.8) >= ?`;
        params.push(minR);
      }
    }

    query += ` ORDER BY name ASC`;

    let shops = db.prepare(query).all(...params);
    shops = shops.filter(s => isValidCoord(s.latitude, s.longitude));

    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;

    shops = shops.map(s => {
      let isOpen = true;
      if (s.is_temporarily_closed) {
        isOpen = false;
      } else if (s.opening_time && s.closing_time) {
        isOpen = currentTimeStr >= s.opening_time && currentTimeStr <= s.closing_time;
      }
      return {
        ...s,
        distance_km: hasUserLocation ? calculateDistance(userLat, userLng, s.latitude, s.longitude) : null,
        is_open: isOpen,
        rating: s.rating_avg || s.rating || 4.8,
        rating_count: s.rating_count || 0
      };
    });

    if (openNow === 'true' || openNow === true) {
      shops = shops.filter(s => s.is_open);
    }

    if (hasUserLocation) {
      if (maxDistance && maxDistance !== 'all') {
        const maxDistKm = parseFloat(maxDistance);
        if (Number.isFinite(maxDistKm)) {
          shops = shops.filter(s => s.distance_km !== null && s.distance_km <= maxDistKm);
        }
      }
    }

    // Sorting
    if (sortBy === 'rating') {
      shops.sort((a, b) => (b.rating_avg || b.rating || 0) - (a.rating_avg || a.rating || 0));
    } else if (sortBy === 'name') {
      shops.sort((a, b) => a.name.localeCompare(b.name));
    } else if (hasUserLocation) {
      shops.sort((a, b) => {
        if (a.distance_km === null) return 1;
        if (b.distance_km === null) return -1;
        return a.distance_km - b.distance_km;
      });
    }

    const offers = db.prepare(`
      SELECT o.id, o.shop_id, o.title, o.discount_percent, o.tier_discounts, o.required_points, o.max_discount_inr, o.valid_until, o.status,
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

// Single Shop Details (Cover, Logo, Gallery, Products/Menu, Offers, Reviews)
router.get('/shops/:id', (req, res) => {
  try {
    const userId = req.user.id;
    const shopId = req.params.id;

    const shop = db.prepare(`
      SELECT id, shop_code, name, category, subcategory, description, address, area_locality, city, district, state, pincode,
             phone, whatsapp_number, image_url, logo_url, cover_photo_url, status, verification_status,
             latitude, longitude, rating, rating_avg, rating_count, opening_time, closing_time, business_hours, is_temporarily_closed
      FROM shops
      WHERE id = ? AND LOWER(status) = 'active' AND LOWER(verification_status) = 'approved'
    `).get(shopId);

    if (!shop) {
      return res.status(404).json({ success: false, error: 'Shop not found or not currently active.' });
    }

    const photos = db.prepare('SELECT id, photo_url, caption, is_cover FROM shop_photos WHERE shop_id = ? ORDER BY is_cover DESC, id ASC').all(shopId);
    const products = db.prepare('SELECT * FROM products WHERE shop_id = ? AND is_available = 1 ORDER BY display_order ASC, id DESC').all(shopId);
    const offers = db.prepare("SELECT * FROM offers WHERE shop_id = ? AND LOWER(status) = 'active' ORDER BY required_points ASC").all(shopId);

    const reviews = db.prepare(`
      SELECT r.id, r.user_id, r.rating, r.comment, r.photo_url, r.merchant_reply, r.merchant_replied_at, r.is_verified_visit, r.created_at,
             u.full_name AS customer_name
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.shop_id = ? AND r.status = 'approved'
      ORDER BY r.created_at DESC
    `).all(shopId);

    // Distribution
    const ratingDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach(r => {
      const star = Math.min(5, Math.max(1, Math.round(r.rating)));
      ratingDist[star] = (ratingDist[star] || 0) + 1;
    });

    const userReview = reviews.find(r => r.user_id === userId) || null;

    return res.json({
      success: true,
      shop: {
        ...shop,
        photos,
        products,
        offers,
        reviews,
        rating_distribution: ratingDist,
        user_review: userReview
      }
    });
  } catch (error) {
    console.error('Fetch customer shop detail error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch shop details' });
  }
});

// Customer Submit Rating & Review
router.post('/shops/:id/reviews', (req, res) => {
  try {
    const userId = req.user.id;
    const shopId = req.params.id;
    const { rating, comment, photo_url } = req.body;

    const numRating = Number(rating);
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ success: false, error: 'Star rating must be an integer between 1 and 5' });
    }

    if (!comment || typeof comment !== 'string' || comment.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Review text feedback is required' });
    }

    const shop = db.prepare("SELECT id FROM shops WHERE id = ? AND LOWER(status) = 'active' AND LOWER(verification_status) = 'approved'").get(shopId);
    if (!shop) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }

    // Check if customer already submitted review
    const existing = db.prepare('SELECT id FROM reviews WHERE user_id = ? AND shop_id = ?').get(userId, shopId);

    if (existing) {
      db.prepare(`
        UPDATE reviews
        SET rating = ?, comment = ?, photo_url = COALESCE(?, photo_url), created_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(numRating, comment.trim(), photo_url || null, existing.id);
    } else {
      db.prepare(`
        INSERT INTO reviews (user_id, shop_id, rating, comment, photo_url, status)
        VALUES (?, ?, ?, ?, ?, 'approved')
      `).run(userId, shopId, numRating, comment.trim(), photo_url || null);
    }

    // Recalculate average rating & count
    const stats = db.prepare(`
      SELECT AVG(rating) as avg, COUNT(*) as count
      FROM reviews
      WHERE shop_id = ? AND status = 'approved'
    `).get(shopId);

    const newAvg = stats && stats.count > 0 ? Number(stats.avg.toFixed(1)) : numRating;
    const newCount = stats ? stats.count : 1;

    db.prepare('UPDATE shops SET rating_avg = ?, rating_count = ? WHERE id = ?').run(newAvg, newCount, shopId);

    return res.status(201).json({
      success: true,
      message: 'Review submitted successfully. Thank you for supporting local businesses!',
      rating_avg: newAvg,
      rating_count: newCount
    });
  } catch (error) {
    console.error('Submit review error:', error);
    return res.status(500).json({ success: false, error: 'Failed to submit review' });
  }
});

// Customer Report Abusive Review
router.post('/reviews/:id/report', (req, res) => {
  try {
    const userId = req.user.id;
    const reviewId = req.params.id;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, error: 'Please provide a reason for reporting this review' });
    }

    const review = db.prepare('SELECT id FROM reviews WHERE id = ?').get(reviewId);
    if (!review) return res.status(404).json({ success: false, error: 'Review not found' });

    db.prepare(`
      INSERT INTO review_reports (review_id, reporter_user_id, reason)
      VALUES (?, ?, ?)
    `).run(reviewId, userId, reason.trim());

    return res.json({ success: true, message: 'Report submitted for administrator moderation review.' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to report review' });
  }
});

// Orders & Inquiries (Section 11)
router.post('/orders', (req, res) => {
  try {
    const userId = req.user.id;
    const { shop_id, items, customer_name, customer_phone, delivery_address, order_notes } = req.body;

    if (!shop_id || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Shop and order items are required' });
    }

    const shop = db.prepare("SELECT id, name FROM shops WHERE id = ? AND LOWER(status) = 'active' AND LOWER(verification_status) = 'approved'").get(shop_id);
    if (!shop) return res.status(404).json({ success: false, error: 'Shop not found or not active' });

    const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    let totalAmount = 0;
    items.forEach(item => {
      totalAmount += (Number(item.price) || 0) * (Number(item.quantity) || 1);
    });

    const createOrder = db.transaction(() => {
      const orderRes = db.prepare(`
        INSERT INTO orders (
          order_number, user_id, shop_id, status, customer_name, customer_phone,
          delivery_address, order_notes, total_amount
        )
        VALUES (?, ?, ?, 'Pending', ?, ?, ?, ?, ?)
      `).run(
        orderNumber, userId, shop_id,
        customer_name || req.user.full_name || 'Customer',
        customer_phone || req.user.phone || '',
        delivery_address || null,
        order_notes || null,
        totalAmount
      );

      const orderId = orderRes.lastInsertRowid;
      const insertItem = db.prepare(`
        INSERT INTO order_items (order_id, product_id, item_name, price, quantity, item_total)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      items.forEach(item => {
        const qty = Number(item.quantity) || 1;
        const pr = Number(item.price) || 0;
        insertItem.run(orderId, item.product_id || null, item.name || item.item_name || 'Item', pr, qty, pr * qty);
      });

      return orderId;
    });

    const newOrderId = createOrder();

    return res.status(201).json({
      success: true,
      message: 'Order / inquiry placed successfully with merchant!',
      order: {
        id: newOrderId,
        order_number: orderNumber,
        shop_id,
        shop_name: shop.name,
        total_amount: totalAmount,
        status: 'Pending'
      }
    });
  } catch (error) {
    console.error('Create order error:', error);
    return res.status(500).json({ success: false, error: 'Failed to place order' });
  }
});

router.get('/orders', (req, res) => {
  try {
    const userId = req.user.id;
    const orders = db.prepare(`
      SELECT o.*, s.name AS shop_name, s.phone AS shop_phone, s.image_url AS shop_image
      FROM orders o
      JOIN shops s ON o.shop_id = s.id
      WHERE o.user_id = ?
      ORDER BY o.id DESC
    `).all(userId);

    const getItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
    const enriched = orders.map(ord => ({
      ...ord,
      items: getItems.all(ord.id)
    }));

    return res.json({ success: true, orders: enriched });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch customer orders' });
  }
});

// 4. Redeem Offer (Deduct Coins from Selected Tier & Generate Unique Redemption QR Code)
router.post('/redeem', (req, res) => {
  try {
    const userId = req.user.id;
    const { offer_id, selected_tier } = req.body;

    const coinTier = (selected_tier && VP52_TIERS.includes(selected_tier)) ? selected_tier : 'Bronze';

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

    // Determine applicable discount percentage for selected_tier
    let applicableDiscount = offer.discount_percent;
    if (offer.tier_discounts) {
      try {
        const parsedDiscounts = JSON.parse(offer.tier_discounts);
        if (parsedDiscounts && parsedDiscounts[coinTier] !== undefined) {
          applicableDiscount = parseInt(parsedDiscounts[coinTier], 10);
        }
      } catch (e) {}
    }

    // Reconcile tier transitions before checking balance
    reconcileTierTransitions(userId);

    // Sum available coins for user in selected_tier
    const tierCoinsRow = db.prepare(`
      SELECT SUM(coins_remaining) AS total FROM coin_lots
      WHERE user_id = ? AND tier = ? AND status IN ('ACTIVE', 'PARTIALLY_USED') AND coins_remaining > 0
    `).get(userId, coinTier);

    const availableTierCoins = tierCoinsRow ? (tierCoinsRow.total || 0) : 0;
    const requiredCoins = offer.required_points || 100;

    if (availableTierCoins < requiredCoins) {
      return res.status(400).json({
        success: false,
        error: `Insufficient ${coinTier} coin balance. You need ${requiredCoins} ${coinTier} coins, but currently have ${availableTierCoins} ${coinTier} coins.`
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
      // Deduct requiredCoins from coin_lots of selected_tier in FIFO order (oldest earned_at first)
      const activeLots = db.prepare(`
        SELECT id, coins_remaining FROM coin_lots
        WHERE user_id = ? AND tier = ? AND status IN ('ACTIVE', 'PARTIALLY_USED') AND coins_remaining > 0
        ORDER BY earned_at ASC
      `).all(userId, coinTier);

      let remainingToDeduct = requiredCoins;
      for (const lot of activeLots) {
        if (remainingToDeduct <= 0) break;
        if (lot.coins_remaining <= remainingToDeduct) {
          remainingToDeduct -= lot.coins_remaining;
          db.prepare("UPDATE coin_lots SET coins_remaining = 0, status = 'USED' WHERE id = ?").run(lot.id);
        } else {
          const newRem = lot.coins_remaining - remainingToDeduct;
          remainingToDeduct = 0;
          db.prepare("UPDATE coin_lots SET coins_remaining = ?, status = 'PARTIALLY_USED' WHERE id = ?").run(newRem, lot.id);
        }
      }

      // Update aggregate wallet balance
      db.prepare(`
        UPDATE wallets
        SET balance = balance - ?,
            total_redeemed = total_redeemed + ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND balance >= ?
      `).run(requiredCoins, requiredCoins, userId, requiredCoins);

      const result = db.prepare(`
        INSERT INTO redemptions (redemption_code, user_id, offer_id, shop_id, points_deducted, discount_percent, max_discount_inr, status, coin_tier)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
      `).run(
        redemptionCode,
        userId,
        offer.id,
        offer.shop_id,
        requiredCoins,
        applicableDiscount,
        offer.max_discount_inr,
        coinTier
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
      message: `${coinTier} Discount Offer Redeemed Successfully!`,
      redemption: {
        id: result.redemptionId,
        redemption_code: result.redemptionCode,
        offer_title: offer.title,
        shop_name: offer.shop_name,
        shop_category: offer.shop_category,
        discount_percent: applicableDiscount,
        max_discount_inr: offer.max_discount_inr,
        points_deducted: requiredCoins,
        coin_tier: coinTier,
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

    // Fetch recent session history for customer
    const sessionHistory = db.prepare(`
      SELECT id, started_at, expires_at, duration_seconds, coins_earned, status, completed_at, reward_claimed
      FROM vp52_coin_sessions
      WHERE user_id = ?
      ORDER BY id DESC LIMIT 10
    `).all(userId);

    if (pendingSession) {
      return res.json({
        success: true,
        session_state: pendingSession.ads_completed >= 3 ? 'READY_TO_START' : 'READY_TO_START',
        can_start: true,
        session: {
          id: pendingSession.id,
          status: pendingSession.status,
          ads_completed: pendingSession.ads_completed,
          can_start: true
        },
        session_history: sessionHistory
      });
    }

    // 4. Default: No active session -> customer is eligible to start 6-hour session immediately!
    return res.json({
      success: true,
      session_state: 'NO_SESSION',
      can_start: true,
      session: {
        ads_completed: 0,
        can_start: true,
        status: 'no_session'
      },
      session_history: sessionHistory
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

// POST /api/customer/coin-session/start — Start 6-Hour Session immediately
router.post('/coin-session/start', (req, res) => {
  try {
    const userId = req.user.id;
    const now = Date.now();
    const DURATION_SECONDS = GET_TEST_SESSION_DURATION();

    const startResult = db.transaction(() => {
      // 1. Duplicate session protection: check if an active unexpired session exists
      const activeSessions = db.prepare(`
        SELECT * FROM vp52_coin_sessions
        WHERE user_id = ? AND status = 'active'
        ORDER BY id DESC
      `).all(userId);

      for (const s of activeSessions) {
        const expiresMs = new Date(s.expires_at).getTime();
        if (Number.isFinite(expiresMs) && now < expiresMs) {
          return { existing: true, session: s };
        }
      }

      // 2. Auto-finalize any expired active unclaimed sessions atomically so wallet,
      // coin_lots, reward_transactions, and point_ledger stay strictly consistent
      for (const s of activeSessions) {
        const expiresMs = new Date(s.expires_at).getTime();
        if (s.reward_claimed === 0 && (!Number.isFinite(expiresMs) || now >= expiresMs)) {
          const finalizeInfo = db.prepare(`
            UPDATE vp52_coin_sessions
            SET status = 'completed', completed_at = CURRENT_TIMESTAMP, reward_claimed = 1, coins_earned = 100
            WHERE id = ? AND status = 'active' AND reward_claimed = 0
          `).run(s.id);

          if (finalizeInfo.changes === 1) {
            const txId = `VP52-SESSION-${s.id}`;
            const existingLot = db.prepare('SELECT id FROM coin_lots WHERE transaction_id = ?').get(txId);
            if (!existingLot) {
              const lotExpiresAt = new Date(now + 30 * 86400 * 1000).toISOString();
              db.prepare(`
                INSERT INTO coin_lots (user_id, transaction_id, source, coins_earned, coins_remaining, tier, original_amount, next_transition_at, expires_at, status)
                VALUES (?, ?, 'VP52_6HR_SESSION', 100, 100, 'Bronze', 100, ?, ?, 'ACTIVE')
              `).run(userId, txId, lotExpiresAt, lotExpiresAt);

              db.prepare('INSERT OR IGNORE INTO wallets (user_id, balance, total_earned, total_redeemed) VALUES (?, 0, 0, 0)').run(userId);
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
                VALUES (?, ?, 'AD_REWARD', 100, ?, ?, 'Auto-finalized Expired VP52 6-Hour Earning Session (100 Coins)')
              `).run(userId, txId, prevBal, newBal);
            }
          }
        }
      }

      // 3. Activate new 6-hour session immediately
      const durationSec = DURATION_SECONDS;
      const startTime = new Date(now).toISOString();
      const endTime = new Date(now + durationSec * 1000).toISOString();

      let session = db.prepare(`
        SELECT * FROM vp52_coin_sessions
        WHERE user_id = ? AND status IN ('ready_to_start', 'pending_ads')
        ORDER BY id DESC LIMIT 1
      `).get(userId);

      if (session) {
        db.prepare(`
          UPDATE vp52_coin_sessions
          SET started_at = ?, expires_at = ?, duration_seconds = ?, status = 'active', coins_earned = 0, reward_claimed = 0, ads_completed = 3
          WHERE id = ?
        `).run(startTime, endTime, durationSec, session.id);
      } else {
        const resIns = db.prepare(`
          INSERT INTO vp52_coin_sessions (user_id, started_at, expires_at, duration_seconds, status, ads_completed, coins_earned, reward_claimed)
          VALUES (?, ?, ?, ?, 'active', 3, 0, 0)
        `).run(userId, startTime, endTime, durationSec);
        session = { id: resIns.lastInsertRowid };
      }

      const startedSession = db.prepare('SELECT * FROM vp52_coin_sessions WHERE id = ?').get(session.id);
      return {
        existing: false,
        session: startedSession,
        startTime,
        endTime,
        durationSec
      };
    })();

    if (startResult.existing) {
      return res.json({
        success: true,
        message: 'Existing active session returned',
        session: startResult.session,
        ad_experience: {
          enabled: true,
          max_native_ads: 3,
          native_ad_unit_id: process.env.ADMOB_NATIVE_AD_UNIT_ID || 'ca-app-pub-3940256099942544/2247696110',
          app_id: process.env.ADMOB_APP_ID || 'ca-app-pub-3940256099942544~3347511713',
          test_mode: process.env.NODE_ENV !== 'production'
        }
      });
    }

    // Record AdMob request diagnostic event (Part 1 & 10)
    try {
      db.prepare(`
        INSERT INTO ad_event_logs (user_id, ad_format, event_type, metadata)
        VALUES (?, 'native', 'request', ?)
      `).run(userId, JSON.stringify({ placement: 'session_start', requested_count: 3 }));
    } catch (_) {}

    return res.json({
      success: true,
      message: '6-Hour Earning Session started immediately! Earning 100 VP52 Coins.',
      session: {
        id: startResult.session.id,
        started_at: startResult.startTime,
        expires_at: startResult.endTime,
        duration_seconds: startResult.durationSec,
        remaining_seconds: startResult.durationSec,
        coins_earned: 0,
        status: 'active'
      },
      ad_experience: {
        enabled: true,
        max_native_ads: 3,
        native_ad_unit_id: process.env.ADMOB_NATIVE_AD_UNIT_ID || 'ca-app-pub-3940256099942544/2247696110',
        app_id: process.env.ADMOB_APP_ID || 'ca-app-pub-3940256099942544~3347511713',
        test_mode: process.env.NODE_ENV !== 'production'
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

    // Atomic Completion Transaction: check, claim guard, and credit 100 coins atomically
    const completeTx = db.transaction(() => {
      const session = db.prepare(`
        SELECT * FROM vp52_coin_sessions
        WHERE user_id = ?
        ORDER BY id DESC LIMIT 1
      `).get(userId);

      if (!session) {
        return { status: 404, body: { success: false, error: 'No coin session found' } };
      }

      if (session.reward_claimed === 1) {
        const wallet = db.prepare('SELECT balance, total_earned FROM wallets WHERE user_id = ?').get(userId);
        return {
          status: 200,
          body: {
            success: true,
            already_claimed: true,
            message: '100 VP52 Coins were already credited to your wallet!',
            coins_awarded: 100,
            newBalance: wallet ? wallet.balance : 0
          }
        };
      }

      if (!session.started_at || !session.expires_at) {
        return {
          status: 400,
          body: { success: false, error: 'Session has not started yet.' }
        };
      }

      const expiresMs = new Date(session.expires_at).getTime();
      if (Number.isFinite(expiresMs) && now < expiresMs && session.status === 'active') {
        return {
          status: 400,
          body: {
            success: false,
            error: 'Session is still in progress. Please wait until the session duration completes.'
          }
        };
      }

      const upd = db.prepare(`
        UPDATE vp52_coin_sessions
        SET status = 'completed', completed_at = CURRENT_TIMESTAMP, reward_claimed = 1, coins_earned = 100
        WHERE id = ? AND reward_claimed = 0
      `).run(session.id);

      if (upd.changes !== 1) {
        const wallet = db.prepare('SELECT balance, total_earned FROM wallets WHERE user_id = ?').get(userId);
        return {
          status: 200,
          body: {
            success: true,
            already_claimed: true,
            message: '100 VP52 Coins were already credited to your wallet!',
            coins_awarded: 100,
            newBalance: wallet ? wallet.balance : 0
          }
        };
      }

      const txId = `VP52-SESSION-${session.id}`;
      const existingLot = db.prepare('SELECT id FROM coin_lots WHERE transaction_id = ?').get(txId);
      db.prepare('INSERT OR IGNORE INTO wallets (user_id, balance, total_earned, total_redeemed) VALUES (?, 0, 0, 0)').run(userId);
      const walletBefore = db.prepare('SELECT balance, total_earned FROM wallets WHERE user_id = ?').get(userId) || { balance: 0, total_earned: 0 };
      const prevBal = walletBefore.balance;
      let newBal = prevBal;
      let newLifetime = walletBefore.total_earned;

      if (!existingLot) {
        const expiresAt = new Date(now + 30 * 86400 * 1000).toISOString();
        db.prepare(`
          INSERT INTO coin_lots (user_id, transaction_id, source, coins_earned, coins_remaining, tier, original_amount, next_transition_at, expires_at, status)
          VALUES (?, ?, 'VP52_6HR_SESSION', 100, 100, 'Bronze', 100, ?, ?, 'ACTIVE')
        `).run(userId, txId, expiresAt, expiresAt);

        newBal = prevBal + 100;
        newLifetime = walletBefore.total_earned + 100;

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
      }

      return {
        status: 200,
        body: {
          success: true,
          message: '🎉 Congratulations! 100 VP52 Coins Credited to your Wallet!',
          coins_awarded: 100,
          newBalance: newBal,
          totalEarned: newLifetime
        }
      };
    });

    const outcome = completeTx();
    return res.status(outcome.status).json(outcome.body);
  } catch (error) {
    console.error('Complete coin session error:', error);
    return res.status(500).json({ success: false, error: 'Failed to complete session' });
  }
});

// GET /api/customer/coin-session/history — Customer session history
router.get('/coin-session/history', (req, res) => {
  try {
    const userId = req.user.id;
    const history = db.prepare(`
      SELECT id, started_at, expires_at, duration_seconds, status, coins_earned, reward_claimed, completed_at, created_at
      FROM vp52_coin_sessions
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT 25
    `).all(userId);

    return res.json({ success: true, history });
  } catch (err) {
    console.error('Fetch coin session history error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch session history' });
  }
});

// POST /api/customer/ad-event — Log ad placement requests, impressions, clicks, failures
router.post('/ad-event', (req, res) => {
  try {
    const userId = req.user.id;
    const { ad_format, event_type, ad_unit_id, provider, metadata } = req.body;

    if (!event_type) {
      return res.status(400).json({ success: false, error: 'event_type is required' });
    }

    db.prepare(`
      INSERT INTO ad_event_logs (user_id, ad_format, event_type, ad_unit_id, provider, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      ad_format || 'native',
      event_type,
      ad_unit_id || null,
      provider || 'AdMob',
      metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : null
    );

    return res.json({ success: true, recorded: true });
  } catch (err) {
    console.error('Ad event logging error:', err);
    return res.status(500).json({ success: false, error: 'Failed to log ad event' });
  }
});

// ============================================================
// CUSTOMER-CONTROLLED COIN REDEMPTION (PARTS 3, 4, 5, 8)
// ============================================================

// POST /api/customer/redemption/create — Customer enters desired coins, generates temporary single-use QR
router.post('/redemption/create', (req, res) => {
  try {
    const userId = req.user.id;
    const { coins_amount, merchant_id } = req.body;

    const coins = parseInt(coins_amount, 10);
    if (isNaN(coins) || coins <= 0) {
      return res.status(400).json({ success: false, error: 'Please enter a valid coin amount greater than 0.' });
    }

    // Check available balance in customer wallet
    const wallet = db.prepare('SELECT balance FROM wallets WHERE user_id = ?').get(userId);
    const currentBalance = wallet ? wallet.balance : 0;
    if (currentBalance < coins) {
      return res.status(400).json({
        success: false,
        error: `Insufficient balance. You have ${currentBalance} coins available, but requested ${coins} coins.`,
        available_balance: currentBalance
      });
    }

    // Optional merchant restriction
    let shopName = 'Any Participating VP52 Merchant';
    if (merchant_id) {
      const shop = db.prepare('SELECT id, name FROM shops WHERE id = ?').get(merchant_id);
      if (!shop) {
        return res.status(404).json({ success: false, error: 'Selected merchant not found.' });
      }
      shopName = shop.name;
    }

    // Cancel any previous pending redemption for this customer to prevent multiple active QR codes
    db.prepare(`
      UPDATE coin_redemption_requests
      SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND status = 'pending'
    `).run(userId);

    // Cryptographically secure token (stored server-side, single-use, temporary)
    const randomHex = crypto.randomBytes(16).toString('hex').toUpperCase();
    const secureToken = `VP52-RED-${randomHex}`;
    const redemptionId = `RED-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes validity

    db.prepare(`
      INSERT INTO coin_redemption_requests (
        redemption_id, secure_token, user_id, merchant_id, coins_amount, discount_inr, status, expires_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(
      redemptionId,
      secureToken,
      userId,
      merchant_id || null,
      coins,
      coins, // 1 coin = ₹1 discount
      expiresAt
    );

    return res.json({
      success: true,
      message: 'Redemption QR code generated. Show this QR to the merchant to collect your discount.',
      redemption: {
        redemption_id: redemptionId,
        secure_token: secureToken,
        coins_amount: coins,
        discount_inr: coins,
        merchant_name: shopName,
        expires_at: expiresAt,
        status: 'pending'
      }
    });
  } catch (err) {
    console.error('Customer create redemption error:', err);
    return res.status(500).json({ success: false, error: 'Failed to create coin redemption request' });
  }
});

// GET /api/customer/redemption/active — Fetch current active pending redemption
router.get('/redemption/active', (req, res) => {
  try {
    const userId = req.user.id;

    // Auto-expire outdated pending redemptions
    db.prepare(`
      UPDATE coin_redemption_requests
      SET status = 'expired'
      WHERE user_id = ? AND status = 'pending' AND datetime(expires_at) < datetime('now')
    `).run(userId);

    const active = db.prepare(`
      SELECT r.*, s.name AS merchant_name
      FROM coin_redemption_requests r
      LEFT JOIN shops s ON r.merchant_id = s.id
      WHERE r.user_id = ? AND r.status = 'pending' AND datetime(r.expires_at) > datetime('now')
      ORDER BY r.id DESC LIMIT 1
    `).get(userId);

    if (!active) {
      return res.json({ success: true, has_active: false });
    }

    return res.json({
      success: true,
      has_active: true,
      redemption: {
        redemption_id: active.redemption_id,
        secure_token: active.secure_token,
        coins_amount: active.coins_amount,
        discount_inr: active.discount_inr,
        merchant_name: active.merchant_name || 'Any Participating VP52 Merchant',
        expires_at: active.expires_at,
        status: active.status
      }
    });
  } catch (err) {
    console.error('Customer fetch active redemption error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch active redemption' });
  }
});

// POST /api/customer/redemption/cancel — Customer cancels pending redemption without penalty
router.post('/redemption/cancel', (req, res) => {
  try {
    const userId = req.user.id;
    const { redemption_id } = req.body;

    let result;
    if (redemption_id) {
      result = db.prepare(`
        UPDATE coin_redemption_requests
        SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND redemption_id = ? AND status = 'pending'
      `).run(userId, redemption_id);
    } else {
      result = db.prepare(`
        UPDATE coin_redemption_requests
        SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND status = 'pending'
      `).run(userId);
    }

    return res.json({
      success: true,
      message: 'Redemption request cancelled safely. No coins were deducted from your wallet.',
      cancelled_count: result.changes
    });
  } catch (err) {
    console.error('Customer cancel redemption error:', err);
    return res.status(500).json({ success: false, error: 'Failed to cancel redemption' });
  }
});

// GET /api/customer/redemptions/history — Customer coin redemption history
router.get('/redemptions/history', (req, res) => {
  try {
    const userId = req.user.id;
    const redemptions = db.prepare(`
      SELECT r.id, r.redemption_id, r.coins_amount, r.discount_inr, r.status, r.created_at, r.completed_at,
             s.name AS merchant_name, s.shop_code AS merchant_code
      FROM coin_redemption_requests r
      LEFT JOIN shops s ON r.merchant_id = s.id
      WHERE r.user_id = ?
      ORDER BY r.id DESC
      LIMIT 50
    `).all(userId);

    return res.json({ success: true, redemptions });
  } catch (err) {
    console.error('Customer fetch redemption history error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch redemption history' });
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

      // Auto-start new session (Unlimited sequential sessions permitted)
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

// DELETE /api/customer/account - Immediate In-App Customer Account Deletion (Google Play Compliance)
router.delete('/account', (req, res) => {
  try {
    const customerId = req.user.id;
    const user = db.prepare('SELECT id, email, phone FROM users WHERE id = ?').get(customerId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Customer account not found' });
    }

    const deleteTx = db.transaction(() => {
      const userBills = db.prepare('SELECT id FROM bills WHERE user_id = ?').all(customerId);
      for (const b of userBills) {
        db.prepare('DELETE FROM bill_items WHERE bill_id = ?').run(b.id);
      }
      db.prepare('DELETE FROM bills WHERE user_id = ?').run(customerId);

      // 2. Erase financial wallet, lots, transactions, and ledger
      db.prepare('DELETE FROM coin_lots WHERE user_id = ?').run(customerId);
      db.prepare('DELETE FROM wallets WHERE user_id = ?').run(customerId);
      db.prepare('DELETE FROM point_ledger WHERE user_id = ?').run(customerId);
      db.prepare('DELETE FROM reward_transactions WHERE user_id = ?').run(customerId);

      // 3. Erase redemptions & vouchers
      db.prepare('DELETE FROM redemptions WHERE user_id = ?').run(customerId);

      // 4. Erase ad sessions
      db.prepare('DELETE FROM reward_sessions WHERE user_id = ?').run(customerId);
      db.prepare('DELETE FROM vp52_coin_sessions WHERE user_id = ?').run(customerId);

      // 5. Erase user feedback, ratings, favorites
      db.prepare('DELETE FROM reviews WHERE user_id = ?').run(customerId);
      db.prepare('DELETE FROM complaints WHERE user_id = ?').run(customerId);
      db.prepare('DELETE FROM favorites WHERE user_id = ?').run(customerId);

      // 6. Erase messaging threads and conversations
      const conversations = db.prepare('SELECT id FROM conversations WHERE customer_id = ?').all(customerId);
      for (const conv of conversations) {
        db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(conv.id);
      }
      db.prepare('DELETE FROM conversations WHERE customer_id = ?').run(customerId);

      // 7. Delete user account record
      db.prepare('DELETE FROM users WHERE id = ?').run(customerId);
    });

    deleteTx();

    return res.json({
      success: true,
      message: 'Your account and all associated personal data have been permanently deleted.'
    });
  } catch (error) {
    console.error('Account deletion error:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete account. Please try again or contact support.' });
  }
});

// ============================================================
// PERMANENT MERCHANT QR & CUSTOMER COIN TRANSFER SYSTEM
// ============================================================

// POST /api/customer/merchant-qr/lookup — Customer scans merchant permanent QR, backend validates
router.post('/merchant-qr/lookup', (req, res) => {
  try {
    const userId = req.user.id;
    const { qr_code } = req.body;

    if (!qr_code || !qr_code.trim()) {
      return res.status(400).json({ success: false, error: 'Merchant QR code payload is required.' });
    }

    const cleanCode = qr_code.trim().replace(/^VP52:MERCHANT:/i, '');

    const shop = db.prepare(`
      SELECT id, shop_code, name, category, address, city, phone, image_url, logo_url,
             status, verification_status, permanent_qr_code, qr_status, rating
      FROM shops
      WHERE permanent_qr_code = ?
    `).get(cleanCode);

    if (!shop) {
      const revoked = db.prepare('SELECT * FROM merchant_revoked_qr_codes WHERE qr_code = ?').get(cleanCode);
      if (revoked) {
        return res.status(403).json({ success: false, error: 'This merchant QR code has been revoked. Please ask the merchant for their updated QR code.' });
      }
      return res.status(404).json({ success: false, error: 'Merchant QR code not recognized or invalid.' });
    }

    if (shop.status === 'suspended' || shop.qr_status === 'suspended') {
      return res.status(403).json({ success: false, error: 'This merchant QR code is currently suspended by administration.' });
    }

    if (shop.qr_status === 'revoked') {
      return res.status(403).json({ success: false, error: 'This merchant QR code has been revoked. Please ask the merchant for their updated QR code.' });
    }

    if (shop.status !== 'active') {
      return res.status(400).json({ success: false, error: 'This merchant shop is not currently active.' });
    }

    // Fetch customer available balance
    const wallet = db.prepare('SELECT balance FROM wallets WHERE user_id = ?').get(userId);
    const balance = wallet ? wallet.balance : 0;

    return res.json({
      success: true,
      merchant: {
        id: shop.id,
        shop_code: shop.shop_code || `SHOP-00${shop.id}`,
        name: shop.name,
        category: shop.category,
        address: shop.address,
        city: shop.city,
        phone: shop.phone,
        image_url: shop.image_url,
        logo_url: shop.logo_url,
        verification_status: shop.verification_status,
        permanent_qr_code: shop.permanent_qr_code,
        rating: shop.rating || 4.8
      },
      customer_balance: balance
    });
  } catch (err) {
    console.error('Customer merchant QR lookup error:', err);
    return res.status(500).json({ success: false, error: 'Failed to look up merchant details' });
  }
});

// POST /api/customer/merchant-qr/pay — Customer confirms coin payment to merchant permanent QR
router.post('/merchant-qr/pay', (req, res) => {
  try {
    const userId = req.user.id;
    const { qr_code, coins_amount, idempotency_key } = req.body;

    if (!qr_code || !qr_code.trim()) {
      return res.status(400).json({ success: false, error: 'Merchant QR code is required.' });
    }

    const cleanCode = qr_code.trim().replace(/^VP52:MERCHANT:/i, '');

    const num = Number(coins_amount);
    if (!Number.isInteger(num) || num <= 0) {
      return res.status(400).json({ success: false, error: 'Please enter a valid positive whole number of coins.' });
    }
    const coinsToPay = num;

    // Idempotency check: prevent duplicate payments
    if (idempotency_key && idempotency_key.trim()) {
      const existing = db.prepare(`
        SELECT ct.*, s.name AS merchant_name, s.category AS merchant_category, s.logo_url AS merchant_logo, s.image_url AS merchant_image
        FROM coin_transfers ct
        JOIN shops s ON ct.merchant_id = s.id
        WHERE ct.idempotency_key = ? AND ct.customer_id = ?
      `).get(idempotency_key.trim(), userId);

      if (existing) {
        return res.json({
          success: true,
          message: 'Payment already processed (idempotent)',
          transfer: {
            transfer_id: existing.transfer_id,
            coins_amount: existing.coins_amount,
            discount_inr: existing.discount_inr,
            merchant_id: existing.merchant_id,
            merchant_name: existing.merchant_name,
            merchant_category: existing.merchant_category,
            merchant_logo: existing.merchant_logo || existing.merchant_image,
            customer_balance_after: existing.customer_new_balance,
            timestamp: existing.created_at,
            status: existing.status
          }
        });
      }
    }

    // Validate customer exists and active
    const customer = db.prepare('SELECT id, full_name, phone, status FROM users WHERE id = ?').get(userId);
    if (!customer || customer.status !== 'active') {
      return res.status(403).json({ success: false, error: 'Customer account is not active.' });
    }

    // Validate merchant QR
    const shop = db.prepare(`
      SELECT id, shop_code, name, category, address, phone, logo_url, image_url, status, verification_status, qr_status
      FROM shops
      WHERE permanent_qr_code = ?
    `).get(cleanCode);

    if (!shop) {
      const revoked = db.prepare('SELECT * FROM merchant_revoked_qr_codes WHERE qr_code = ?').get(cleanCode);
      if (revoked) {
        return res.status(403).json({ success: false, error: 'This merchant QR code has been revoked.' });
      }
      return res.status(404).json({ success: false, error: 'Merchant QR code not recognized.' });
    }

    if (shop.status === 'suspended' || shop.qr_status === 'suspended') {
      return res.status(403).json({ success: false, error: 'This merchant QR code is suspended.' });
    }

    if (shop.qr_status === 'revoked') {
      return res.status(403).json({ success: false, error: 'This merchant QR code has been revoked.' });
    }

    if (shop.status !== 'active') {
      return res.status(400).json({ success: false, error: 'This merchant is currently not active.' });
    }

    // Reconcile any matured/expired lots before checking customer balance
    reconcileTierTransitions(userId);

    // ATOMIC TRANSACTION: double-entry transfer (Customer debit == Merchant credit)
    const executeTransfer = db.transaction(() => {
      // 0. Lock and re-verify customer wallet balance & FIFO lots inside transaction
      const wallet = db.prepare('SELECT balance FROM wallets WHERE user_id = ?').get(userId);
      if (!wallet || wallet.balance < coinsToPay) {
        return {
          errorStatus: 400,
          error: `Insufficient coin balance. Available: ${wallet ? wallet.balance : 0} coins, requested: ${coinsToPay} coins.`
        };
      }

      const activeLots = db.prepare(`
        SELECT id, coins_remaining, expires_at
        FROM coin_lots
        WHERE user_id = ?
          AND status IN ('ACTIVE', 'PARTIALLY_USED')
          AND coins_remaining > 0
          AND datetime(expires_at) > datetime('now')
        ORDER BY expires_at ASC, id ASC
      `).all(userId);

      const totalAvailableInLots = activeLots.reduce((sum, l) => sum + l.coins_remaining, 0);
      if (totalAvailableInLots < coinsToPay) {
        return {
          errorStatus: 400,
          error: `Only ${totalAvailableInLots} unexpired coins are available in your wallet for payment.`
        };
      }

      // 1. Debit customer wallet
      const custPrevBalance = wallet.balance;
      const custNewBalance = custPrevBalance - coinsToPay;
      db.prepare(`
        UPDATE wallets
        SET balance = ?, total_redeemed = total_redeemed + ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(custNewBalance, coinsToPay, userId);

      // 2. Consume FIFO lots (preserving PARTIALLY_USED vs USED status)
      let needed = coinsToPay;
      for (const lot of activeLots) {
        if (needed <= 0) break;
        if (lot.coins_remaining <= needed) {
          needed -= lot.coins_remaining;
          db.prepare("UPDATE coin_lots SET coins_remaining = 0, status = 'USED' WHERE id = ?").run(lot.id);
        } else {
          const newRemaining = lot.coins_remaining - needed;
          db.prepare("UPDATE coin_lots SET coins_remaining = ?, status = 'PARTIALLY_USED' WHERE id = ?").run(newRemaining, lot.id);
          needed = 0;
        }
      }

      // 3. Credit merchant wallet
      db.prepare('INSERT OR IGNORE INTO merchant_wallets (shop_id, balance, total_received, total_spent) VALUES (?, 0, 0, 0)').run(shop.id);
      const merchWallet = db.prepare('SELECT balance, total_received FROM merchant_wallets WHERE shop_id = ?').get(shop.id);
      const merchPrevBalance = merchWallet ? merchWallet.balance : 0;
      const merchNewBalance = merchPrevBalance + coinsToPay;

      db.prepare(`
        UPDATE merchant_wallets
        SET balance = ?, total_received = total_received + ?, updated_at = CURRENT_TIMESTAMP
        WHERE shop_id = ?
      `).run(merchNewBalance, coinsToPay, shop.id);

      // 4. Generate unique IDs
      const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
      const transferId = 'TX-MCH-' + uniqueSuffix;
      const redemptionId = 'RED-MCH-' + uniqueSuffix;
      const secureToken = 'VP52-MCH-TX-' + crypto.randomBytes(8).toString('hex').toUpperCase();

      // 5. Audit record in point_ledger (Customer debit)
      db.prepare(`
        INSERT INTO point_ledger (user_id, transaction_id, type, points, previous_balance, new_balance, merchant_id, reason)
        VALUES (?, ?, 'redeemed', ?, ?, ?, ?, ?)
      `).run(
        userId,
        transferId,
        -coinsToPay,
        custPrevBalance,
        custNewBalance,
        shop.id,
        `Paid ${coinsToPay} coins to ${shop.name} via Permanent Merchant QR`
      );

      // 6. Insert completed coin_redemption_requests row to maintain foreign-key and reporting invariants
      db.prepare(`
        INSERT INTO coin_redemption_requests (redemption_id, secure_token, user_id, merchant_id, coins_amount, discount_inr, status, expires_at, completed_at)
        VALUES (?, ?, ?, ?, ?, ?, 'completed', datetime('now', '+15 minutes'), CURRENT_TIMESTAMP)
      `).run(redemptionId, secureToken, userId, shop.id, coinsToPay, coinsToPay);

      // 7. Audit record in merchant_coin_ledger (Merchant credit)
      db.prepare(`
        INSERT INTO merchant_coin_ledger (shop_id, transaction_id, redemption_id, customer_id, type, coins, previous_balance, new_balance, description)
        VALUES (?, ?, ?, ?, 'CUSTOMER_REDEMPTION', ?, ?, ?, ?)
      `).run(
        shop.id,
        transferId,
        redemptionId,
        userId,
        coinsToPay,
        merchPrevBalance,
        merchNewBalance,
        `Received ${coinsToPay} coins (₹${coinsToPay} discount) from ${customer.full_name} via Permanent QR`
      );

      // 8. Permanent double-entry record in coin_transfers
      db.prepare(`
        INSERT INTO coin_transfers (
          transfer_id, redemption_id, customer_id, merchant_id,
          coins_amount, discount_inr,
          customer_previous_balance, customer_new_balance,
          merchant_previous_balance, merchant_new_balance,
          merchant_qr_code, idempotency_key, status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED')
      `).run(
        transferId, redemptionId, userId, shop.id,
        coinsToPay, coinsToPay,
        custPrevBalance, custNewBalance,
        merchPrevBalance, merchNewBalance,
        cleanCode, idempotency_key ? idempotency_key.trim() : null
      );

      // 9. Send real-time in-app notification to merchant
      db.prepare(`
        INSERT INTO merchant_notifications (shop_id, title, message, notification_type, metadata)
        VALUES (?, 'VP52 COINS RECEIVED', ?, 'coin_received', ?)
      `).run(
        shop.id,
        `Received ${coinsToPay} coins (₹${coinsToPay} discount) from ${customer.full_name}`,
        JSON.stringify({
          transfer_id: transferId,
          coins_amount: coinsToPay,
          discount_inr: coinsToPay,
          customer_name: customer.full_name,
          customer_phone: customer.phone,
          timestamp: new Date().toISOString()
        })
      );

      return {
        transfer_id: transferId,
        coins_amount: coinsToPay,
        discount_inr: coinsToPay,
        merchant_id: shop.id,
        merchant_name: shop.name,
        merchant_category: shop.category,
        merchant_logo: shop.logo_url || shop.image_url,
        customer_balance_after: custNewBalance,
        timestamp: new Date().toISOString(),
        status: 'COMPLETED'
      };
    });

    const transfer = executeTransfer();

    if (transfer && transfer.errorStatus) {
      return res.status(transfer.errorStatus).json({ success: false, error: transfer.error });
    }

    return res.json({
      success: true,
      message: 'Coins transferred successfully to merchant',
      transfer
    });
  } catch (err) {
    console.error('Customer merchant QR pay error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Payment failed' });
  }
});

// GET /api/customer/merchant-qr/transfers — Customer payment history with merchant QR
router.get('/merchant-qr/transfers', (req, res) => {
  try {
    const userId = req.user.id;
    const transfers = db.prepare(`
      SELECT ct.id, ct.transfer_id, ct.coins_amount, ct.discount_inr, ct.created_at, ct.status,
             s.id AS merchant_id, s.name AS merchant_name, s.category AS merchant_category,
             s.image_url AS merchant_image, s.logo_url AS merchant_logo, s.phone AS merchant_phone
      FROM coin_transfers ct
      JOIN shops s ON ct.merchant_id = s.id
      WHERE ct.customer_id = ?
      ORDER BY ct.created_at DESC
      LIMIT 100
    `).all(userId);

    return res.json({ success: true, transfers });
  } catch (err) {
    console.error('Customer fetch merchant transfers error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch transfer history' });
  }
});

module.exports = router;

