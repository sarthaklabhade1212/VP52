const express = require('express');
const db = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Apply Shop Merchant Authentication Middleware
router.use(authenticateToken);
router.use(requireRole('shop'));

// 1. Shop Dashboard Summary & Statistics
router.get('/dashboard', (req, res) => {
  try {
    const shopId = req.user.shop_id || req.user.id;

    // Fetch Shop Profile Info
    const shopInfo = db.prepare('SELECT id, shop_code, name, email, phone, address, category, status, image_url, description FROM shops WHERE id = ?').get(shopId);

    if (!shopInfo) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }

    // KPI Metrics
    const todayRedemptionsRow = db.prepare(`
      SELECT COUNT(*) AS count FROM redemptions
      WHERE shop_id = ? AND status = 'USED' AND date(redeemed_at) = date('now')
    `).get(shopId);

    const totalRedemptionsRow = db.prepare(`
      SELECT COUNT(*) AS count FROM redemptions
      WHERE shop_id = ? AND status = 'USED'
    `).get(shopId);

    const activeOffersRow = db.prepare(`
      SELECT COUNT(*) AS count FROM offers
      WHERE shop_id = ? AND status = 'active'
    `).get(shopId);

    const totalDiscountsRow = db.prepare(`
      SELECT SUM(max_discount_inr) AS total FROM redemptions
      WHERE shop_id = ? AND status = 'USED'
    `).get(shopId);

    // Recent Redemptions Table
    const recentRedemptions = db.prepare(`
      SELECT r.id, r.redemption_code, r.points_deducted, r.discount_percent, r.max_discount_inr, r.status, r.created_at, r.redeemed_at,
             u.full_name AS customer_name, u.email AS customer_email, o.title AS offer_title
      FROM redemptions r
      JOIN users u ON r.user_id = u.id
      JOIN offers o ON r.offer_id = o.id
      WHERE r.shop_id = ?
      ORDER BY r.created_at DESC
      LIMIT 10
    `).all(shopId);

    // Active Shop Offers List
    const activeOffers = db.prepare(`
      SELECT * FROM offers
      WHERE shop_id = ? AND status = 'active'
      ORDER BY required_points ASC
    `).all(shopId);

    return res.json({
      success: true,
      shop: {
        ...shopInfo,
        shop_code: shopInfo.shop_code || `SHOP-00${shopInfo.id}`
      },
      stats: {
        todayRedemptions: todayRedemptionsRow ? todayRedemptionsRow.count : 0,
        totalRedemptions: totalRedemptionsRow ? totalRedemptionsRow.count : 0,
        activeOffersCount: activeOffersRow ? activeOffersRow.count : 0,
        totalDiscountsGiven: totalDiscountsRow ? (totalDiscountsRow.total || 0) : 0
      },
      recentRedemptions,
      activeOffers
    });
  } catch (error) {
    console.error('Shop dashboard error:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve shop dashboard details' });
  }
});

// 1.5 Scan Customer Identity QR Code (Workflow B: Merchant Camera Scan Customer QR)
router.post('/scan-customer-qr', (req, res) => {
  try {
    const { qr_payload } = req.body;
    if (!qr_payload) {
      return res.status(400).json({ success: false, error: 'QR code payload is required' });
    }

    const payloadStr = qr_payload.trim();

    // 1. Parse JSON payload if encoded as JSON token
    let customerIdentifier = payloadStr;
    try {
      const parsed = JSON.parse(payloadStr);
      if (parsed && (parsed.customer_id || parsed.email || parsed.token || parsed.mobile)) {
        customerIdentifier = String(parsed.customer_id || parsed.email || parsed.mobile || parsed.token);
      }
    } catch (e) {
      // Not JSON, check if token format e.g. CUST-1 or customer@example.com
      if (payloadStr.startsWith('CUST-TOKEN-') || payloadStr.startsWith('CUST-')) {
        customerIdentifier = payloadStr.replace('CUST-TOKEN-', '').replace('CUST-', '');
      }
    }

    // 2. Query user from DB (by secure qr_token, email, phone, or ID)
    const customer = db.prepare(`
      SELECT id, full_name, email, phone, status, city_area, profile_photo, created_at
      FROM users
      WHERE qr_token = ? OR id = ? OR LOWER(email) = ? OR phone = ?
    `).get(payloadStr, customerIdentifier, customerIdentifier.toLowerCase(), customerIdentifier);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: `❌ UNKNOWN CUSTOMER QR: No active customer found matching payload "${payloadStr}".`
      });
    }

    if (customer.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: `❌ SUSPENDED ACCOUNT: Customer account "${customer.full_name}" is currently suspended.`
      });
    }

    // 3. Fetch Wallet Balance
    const wallet = db.prepare('SELECT balance, total_earned FROM wallets WHERE user_id = ?').get(customer.id) || { balance: 0, total_earned: 0 };

    // 4. Calculate Customer Level
    const levels = db.prepare('SELECT * FROM reward_levels ORDER BY min_points ASC').all();
    let currentLevel = 'Basic';
    for (const lvl of levels) {
      if (wallet.total_earned >= lvl.min_points) {
        currentLevel = lvl.level_name;
      }
    }

    return res.json({
      success: true,
      message: '✅ CUSTOMER IDENTIFIED SUCCESSFULLY',
      customer: {
        id: customer.id,
        full_name: customer.full_name,
        email: customer.email,
        phone: customer.phone || 'N/A',
        city_area: customer.city_area || 'Pune',
        profile_photo: customer.profile_photo || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80`,
        balance: wallet.balance,
        total_earned: wallet.total_earned,
        current_level: currentLevel
      }
    });
  } catch (error) {
    console.error('Scan customer QR error:', error);
    return res.status(500).json({ success: false, error: 'Failed to process Customer QR code scan' });
  }
});


// 2. Scan & Verify Customer Reward QR Code (WITH WRONG SHOP PROTECTION)
router.post('/verify-qr', (req, res) => {
  try {
    const shopId = req.user.shop_id || req.user.id;
    const { redemption_code } = req.body;

    if (!redemption_code) {
      return res.status(400).json({ success: false, valid: false, error: 'Redemption code is required' });
    }

    const code = redemption_code.trim().toUpperCase();

    // Query redemption record
    const redemption = db.prepare(`
      SELECT r.id, r.redemption_code, r.user_id, r.offer_id, r.shop_id, r.points_deducted, r.discount_percent, r.max_discount_inr, r.status, r.created_at, r.redeemed_at,
             u.full_name AS customer_name, u.email AS customer_email,
             s.name AS target_shop_name, s.shop_code AS target_shop_code,
             o.title AS offer_title, o.valid_until, o.status AS offer_status
      FROM redemptions r
      JOIN users u ON r.user_id = u.id
      JOIN shops s ON r.shop_id = s.id
      JOIN offers o ON r.offer_id = o.id
      WHERE UPPER(r.redemption_code) = ?
    `).get(code);

    // 1. Existence Check
    if (!redemption) {
      return res.status(404).json({
        success: false,
        valid: false,
        reason: 'NOT_FOUND',
        error: `❌ INVALID REWARD: Redemption code "${code}" does not exist in the system.`
      });
    }

    // 2. WRONG SHOP PROTECTION (REQUIREMENT #9)
    if (redemption.shop_id !== shopId) {
      const currentShop = db.prepare('SELECT name FROM shops WHERE id = ?').get(shopId);
      const currentShopName = currentShop ? currentShop.name : 'Your Shop';

      return res.status(400).json({
        success: false,
        valid: false,
        reason: 'WRONG_SHOP',
        error: `❌ WRONG SHOP - This reward is for "${redemption.target_shop_name}" and is NOT valid at your shop ("${currentShopName}").`,
        targetShopName: redemption.target_shop_name,
        currentShopName
      });
    }

    // 3. Status Check (Already Used)
    if (redemption.status === 'USED') {
      return res.status(400).json({
        success: false,
        valid: false,
        reason: 'ALREADY_USED',
        error: `❌ ALREADY REDEEMED: This reward code ${code} was already used on ${new Date(redemption.redeemed_at).toLocaleString('en-IN')}.`,
        redeemedAt: redemption.redeemed_at
      });
    }

    if (redemption.status !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        valid: false,
        reason: 'INACTIVE_STATUS',
        error: `❌ INVALID STATUS: This redemption status is currently "${redemption.status}".`
      });
    }

    // 4. Expiry Check
    const today = new Date().toISOString().split('T')[0];
    if (redemption.valid_until && redemption.valid_until < today) {
      return res.status(400).json({
        success: false,
        valid: false,
        reason: 'EXPIRED',
        error: `❌ EXPIRED REWARD: Offer expired on ${redemption.valid_until}.`
      });
    }

    // 5. Offer Status Check
    if (redemption.offer_status !== 'active') {
      return res.status(400).json({
        success: false,
        valid: false,
        reason: 'OFFER_INACTIVE',
        error: '❌ INACTIVE OFFER: Associated discount offer has been deactivated.'
      });
    }

    // ALL CHECKS PASSED PERFECTLY!
    return res.json({
      success: true,
      valid: true,
      message: '✅ VALID REWARD DETECTED',
      redemption: {
        id: redemption.id,
        redemption_code: redemption.redemption_code,
        customer_name: redemption.customer_name,
        customer_email: redemption.customer_email,
        shop_name: redemption.target_shop_name,
        offer_title: redemption.offer_title,
        discount_percent: redemption.discount_percent,
        points_used: redemption.points_deducted,
        max_discount_inr: redemption.max_discount_inr,
        valid_until: redemption.valid_until,
        status: 'ACTIVE'
      }
    });
  } catch (error) {
    console.error('Shop QR verify error:', error);
    return res.status(500).json({ success: false, valid: false, error: 'Failed to process QR code verification' });
  }
});

// 3. Approve & Redeem (ATOMIC TRANSACTION WITH DUPLICATE PROTECTION)
router.post('/approve-redeem', (req, res) => {
  try {
    const shopId = req.user.shop_id || req.user.id;
    const { redemption_code } = req.body;

    if (!redemption_code) {
      return res.status(400).json({ success: false, error: 'Redemption code is required' });
    }

    const code = redemption_code.trim().toUpperCase();

    // Verify redemption details first
    const redemption = db.prepare('SELECT * FROM redemptions WHERE UPPER(redemption_code) = ?').get(code);

    if (!redemption) {
      return res.status(404).json({ success: false, error: 'Redemption code not found' });
    }

    // Wrong Shop Check
    if (redemption.shop_id !== shopId) {
      return res.status(400).json({ success: false, error: 'WRONG SHOP: This reward is not valid at your physical store.' });
    }

    if (redemption.status === 'USED') {
      return res.status(400).json({
        success: false,
        error: `ALREADY REDEEMED: Code ${code} was already used on ${new Date(redemption.redeemed_at).toLocaleString('en-IN')}. Duplicate redemption prevented.`
      });
    }

    if (redemption.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, error: `Cannot redeem: Status is ${redemption.status}` });
    }

    // Atomic update to prevent race conditions
    const updateStmt = db.prepare(`
      UPDATE redemptions
      SET status = 'USED',
          redeemed_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'ACTIVE' AND shop_id = ?
    `);

    const result = updateStmt.run(redemption.id, shopId);

    if (result.changes === 0) {
      return res.status(400).json({
        success: false,
        error: 'Already Redeemed: Double discount attempt blocked.'
      });
    }

    const updated = db.prepare(`
      SELECT r.*, s.name AS shop_name, u.full_name AS customer_name
      FROM redemptions r
      JOIN shops s ON r.shop_id = s.id
      JOIN users u ON r.user_id = u.id
      WHERE r.id = ?
    `).get(redemption.id);

    return res.json({
      success: true,
      message: `✅ DISCOUNT APPROVED! ${updated.discount_percent}% discount (Max ₹${updated.max_discount_inr}) can be given to ${updated.customer_name}.`,
      redemption: updated
    });
  } catch (error) {
    console.error('Approve redeem error:', error);
    return res.status(500).json({ success: false, error: 'Failed to approve redemption' });
  }
});

// 4. Get Active Offers for Current Shop
router.get('/offers', (req, res) => {
  try {
    const shopId = req.user.shop_id || req.user.id;
    const offers = db.prepare(`
      SELECT * FROM offers
      WHERE shop_id = ?
      ORDER BY id DESC
    `).all(shopId);

    return res.json({ success: true, offers });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch shop offers' });
  }
});

// 5. Get Redemption History for Current Shop
router.get('/history', (req, res) => {
  try {
    const shopId = req.user.shop_id || req.user.id;
    const { timeFilter, statusFilter } = req.query;

    let query = `
      SELECT r.id, r.redemption_code, r.points_deducted, r.discount_percent, r.max_discount_inr, r.status, r.created_at, r.redeemed_at,
             u.full_name AS customer_name, u.email AS customer_email, o.title AS offer_title
      FROM redemptions r
      JOIN users u ON r.user_id = u.id
      JOIN offers o ON r.offer_id = o.id
      WHERE r.shop_id = ?
    `;

    const params = [shopId];

    if (timeFilter === 'today') {
      query += ` AND date(r.created_at) = date('now')`;
    } else if (timeFilter === 'week') {
      query += ` AND date(r.created_at) >= date('now', '-7 days')`;
    } else if (timeFilter === 'month') {
      query += ` AND date(r.created_at) >= date('now', '-30 days')`;
    }

    if (statusFilter && statusFilter !== 'all') {
      query += ` AND r.status = ?`;
      params.push(statusFilter.toUpperCase());
    }

    query += ` ORDER BY r.created_at DESC LIMIT 100`;

    const history = db.prepare(query).all(...params);

    return res.json({ success: true, history });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch shop redemption history' });
  }
});

module.exports = router;
