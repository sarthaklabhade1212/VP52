const express = require('express');
const crypto = require('crypto');
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
    let shopInfo = db.prepare('SELECT id, shop_code, name, email, phone, address, category, status, verification_status, image_url, logo_url, description, permanent_qr_code, qr_status, qr_generated_at FROM shops WHERE id = ?').get(shopId);

    if (!shopInfo) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }

    if (!shopInfo.permanent_qr_code) {
      const newQr = 'VP52-MCH-' + crypto.randomBytes(10).toString('hex').toUpperCase();
      db.prepare("UPDATE shops SET permanent_qr_code = ?, qr_status = 'active', qr_generated_at = datetime('now') WHERE id = ?").run(newQr, shopId);
      shopInfo.permanent_qr_code = newQr;
      shopInfo.qr_status = 'active';
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

    // Ensure merchant wallet row exists
    db.prepare('INSERT OR IGNORE INTO merchant_wallets (shop_id, balance, total_received, total_spent) VALUES (?, 0, 0, 0)').run(shopId);
    const merchantWallet = db.prepare('SELECT balance, total_received, total_spent FROM merchant_wallets WHERE shop_id = ?').get(shopId) || { balance: 0, total_received: 0, total_spent: 0 };

    // Recent Customer-Selected Coin Collections
    const recentCoinCollections = db.prepare(`
      SELECT ct.transfer_id, ct.redemption_id, ct.coins_amount, ct.discount_inr, ct.created_at,
             u.full_name AS customer_name, u.phone AS customer_phone
      FROM coin_transfers ct
      JOIN users u ON ct.customer_id = u.id
      WHERE ct.merchant_id = ?
      ORDER BY ct.created_at DESC
      LIMIT 10
    `).all(shopId);

    const unreadNotificationsRow = db.prepare('SELECT COUNT(*) AS count FROM merchant_notifications WHERE shop_id = ? AND is_read = 0').get(shopId);
    const unreadNotificationsCount = unreadNotificationsRow ? unreadNotificationsRow.count : 0;

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
        totalDiscountsGiven: totalDiscountsRow ? (totalDiscountsRow.total || 0) : 0,
        merchantCoins: merchantWallet.balance || 0,
        merchantCoinsReceived: merchantWallet.total_received || 0,
        merchantCoinsSpent: merchantWallet.total_spent || 0,
        unreadNotifications: unreadNotificationsCount
      },
      merchant_wallet: merchantWallet,
      unread_notifications_count: unreadNotificationsCount,
      recentRedemptions,
      recentCoinCollections,
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
        coin_tier: redemption.coin_tier || 'Bronze',
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
      message: `✅ DISCOUNT APPROVED! ${updated.discount_percent}% discount (${updated.coin_tier || 'Bronze'} Tier) can be given to ${updated.customer_name}.`,
      redemption: updated
    });
  } catch (error) {
    console.error('Approve redeem error:', error);
    return res.status(500).json({ success: false, error: 'Failed to approve redemption' });
  }
});

// 4. Create Merchant Offer with Multi-Tier Discounts
router.post('/offers', (req, res) => {
  try {
    const shopId = req.user.shop_id || req.user.id;
    const { title, discount_percent, required_points, max_discount_inr, valid_until, tier_discounts } = req.body;

    if (!title || !discount_percent || !max_discount_inr || !valid_until) {
      return res.status(400).json({ success: false, error: 'Title, default discount %, max discount in INR, and valid until date are required' });
    }

    const tierDiscountsJson = typeof tier_discounts === 'object' ? JSON.stringify(tier_discounts) : tier_discounts;

    const result = db.prepare(`
      INSERT INTO offers (shop_id, title, discount_percent, required_points, max_discount_inr, valid_until, tier_discounts, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(
      shopId,
      title.trim(),
      parseInt(discount_percent, 10),
      parseInt(required_points || 0, 10),
      parseInt(max_discount_inr, 10),
      valid_until,
      tierDiscountsJson || null
    );

    const newOffer = db.prepare('SELECT * FROM offers WHERE id = ?').get(result.lastInsertRowid);
    return res.status(201).json({ success: true, offer: newOffer });
  } catch (error) {
    console.error('Create offer error:', error);
    return res.status(500).json({ success: false, error: 'Failed to create offer' });
  }
});

// 5. Get Active Offers for Current Shop
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

// ============================================================
// MERCHANT SCAN & COLLECT & COIN WALLET (PARTS 5, 6, 7, 8)
// ============================================================

// POST /api/shop/redemption/lookup — Merchant scans customer QR, backend validates token
router.post('/redemption/lookup', (req, res) => {
  try {
    const shopId = req.user.shop_id || req.user.id;
    const { secure_token } = req.body;

    if (!secure_token) {
      return res.status(400).json({ success: false, error: 'Redemption token is required.' });
    }

    const token = secure_token.trim();

    const redemption = db.prepare(`
      SELECT r.*, u.full_name AS customer_name, u.phone AS customer_phone, w.balance AS customer_wallet_balance,
             s.name AS restricted_shop_name
      FROM coin_redemption_requests r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN wallets w ON u.id = w.user_id
      LEFT JOIN shops s ON r.merchant_id = s.id
      WHERE r.secure_token = ?
    `).get(token);

    if (!redemption) {
      return res.status(404).json({ success: false, error: 'Invalid or unknown redemption QR code.' });
    }

    if (redemption.status === 'completed') {
      return res.status(400).json({
        success: false,
        error: `This QR code was already collected on ${new Date(redemption.completed_at).toLocaleString('en-IN')}.`,
        status: 'completed'
      });
    }

    if (redemption.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'This redemption request was cancelled by the customer.',
        status: 'cancelled'
      });
    }

    // Check expiry
    if (new Date(redemption.expires_at).getTime() < Date.now()) {
      db.prepare("UPDATE coin_redemption_requests SET status = 'expired' WHERE id = ?").run(redemption.id);
      return res.status(400).json({
        success: false,
        error: 'This redemption QR code has expired. Please ask the customer to generate a new QR.',
        status: 'expired'
      });
    }

    // Check if restricted to a specific shop
    if (redemption.merchant_id && redemption.merchant_id !== shopId) {
      return res.status(403).json({
        success: false,
        error: `This redemption is restricted to "${redemption.restricted_shop_name}" and cannot be scanned at your shop.`,
        status: 'wrong_shop'
      });
    }

    // Check if customer still has sufficient balance
    if ((redemption.customer_wallet_balance || 0) < redemption.coins_amount) {
      return res.status(400).json({
        success: false,
        error: `Customer balance has changed. Available: ${redemption.customer_wallet_balance || 0} coins, requested: ${redemption.coins_amount} coins.`,
        status: 'insufficient_balance'
      });
    }

    // Privacy-safe customer identifier: First Name + Initial + masked phone
    const nameParts = (redemption.customer_name || 'Customer').split(' ');
    const safeName = nameParts.length > 1
      ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.`
      : nameParts[0];
    const maskedPhone = redemption.customer_phone
      ? `***${redemption.customer_phone.slice(-4)}`
      : '***';

    return res.json({
      success: true,
      redemption: {
        redemption_id: redemption.redemption_id,
        secure_token: redemption.secure_token,
        customer_name: safeName,
        customer_phone_masked: maskedPhone,
        coins_amount: redemption.coins_amount,
        discount_inr: redemption.discount_inr,
        expires_at: redemption.expires_at,
        status: redemption.status
      }
    });
  } catch (err) {
    console.error('Merchant redemption lookup error:', err);
    return res.status(500).json({ success: false, error: 'Failed to look up redemption QR code' });
  }
});

// POST /api/shop/redemption/confirm — Merchant confirms collection; atomic double-entry wallet transfer
router.post('/redemption/confirm', (req, res) => {
  try {
    const shopId = req.user.shop_id || req.user.id;
    const { secure_token } = req.body;

    if (!secure_token) {
      return res.status(400).json({ success: false, error: 'Redemption token is required.' });
    }

    const token = secure_token.trim();

    // Execute atomic collection transaction
    const executeCollection = db.transaction(() => {
      // 1. Lock and fetch redemption request
      const redemption = db.prepare(`
        SELECT * FROM coin_redemption_requests WHERE secure_token = ?
      `).get(token);

      if (!redemption) {
        throw new Error('NOT_FOUND: Redemption request does not exist');
      }

      if (redemption.status === 'completed') {
        throw new Error('ALREADY_COLLECTED: This redemption has already been collected');
      }

      if (redemption.status === 'cancelled') {
        throw new Error('CANCELLED: This redemption request was cancelled by the customer');
      }

      if (new Date(redemption.expires_at).getTime() < Date.now()) {
        db.prepare("UPDATE coin_redemption_requests SET status = 'expired' WHERE id = ?").run(redemption.id);
        throw new Error('EXPIRED: This redemption QR code has expired');
      }

      if (redemption.merchant_id && redemption.merchant_id !== shopId) {
        throw new Error('WRONG_MERCHANT: This redemption is restricted to another merchant');
      }

      const customerId = redemption.user_id;
      const coinsToDeduct = redemption.coins_amount;

      // 2. Lock customer wallet & verify balance
      const customerWallet = db.prepare('SELECT balance, total_redeemed FROM wallets WHERE user_id = ?').get(customerId);
      if (!customerWallet || customerWallet.balance < coinsToDeduct) {
        throw new Error(`INSUFFICIENT_BALANCE: Customer balance (${customerWallet ? customerWallet.balance : 0}) is less than required (${coinsToDeduct})`);
      }

      // 3. FIFO Coin Lot Consumption: Consume from customer's active coin lots preserving 30-day expiry
      let remainingToDeduct = coinsToDeduct;
      const activeLots = db.prepare(`
        SELECT id, coins_remaining, tier, expires_at
        FROM coin_lots
        WHERE user_id = ?
          AND status IN ('ACTIVE', 'PARTIALLY_USED')
          AND coins_remaining > 0
          AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))
        ORDER BY expires_at ASC, id ASC
      `).all(customerId);

      const availableInLots = activeLots.reduce((sum, lot) => sum + lot.coins_remaining, 0);
      if (availableInLots < coinsToDeduct) {
        throw new Error(`INSUFFICIENT_BALANCE: Only ${availableInLots} unexpired coins are available for redemption`);
      }

      for (const lot of activeLots) {
        if (remainingToDeduct <= 0) break;
        const take = Math.min(lot.coins_remaining, remainingToDeduct);
        const newRemaining = lot.coins_remaining - take;
        const newStatus = newRemaining === 0 ? 'USED' : 'PARTIALLY_USED';

        db.prepare(`
          UPDATE coin_lots
          SET coins_remaining = ?, status = ?
          WHERE id = ?
        `).run(newRemaining, newStatus, lot.id);

        remainingToDeduct -= take;
      }

      // 4. Update customer wallet
      const custPrevBal = customerWallet.balance;
      const custNewBal = custPrevBal - coinsToDeduct;
      const custNewTotalRedeemed = (customerWallet.total_redeemed || 0) + coinsToDeduct;

      db.prepare(`
        UPDATE wallets
        SET balance = ?, total_redeemed = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(custNewBal, custNewTotalRedeemed, customerId);

      // 5. Update or create merchant wallet
      db.prepare(`
        INSERT OR IGNORE INTO merchant_wallets (shop_id, balance, total_received, total_spent)
        VALUES (?, 0, 0, 0)
      `).run(shopId);

      const merchWallet = db.prepare('SELECT balance, total_received, total_spent FROM merchant_wallets WHERE shop_id = ?').get(shopId);
      const merchPrevBal = merchWallet.balance;
      const merchNewBal = merchPrevBal + coinsToDeduct;
      const merchNewTotalReceived = (merchWallet.total_received || 0) + coinsToDeduct;

      db.prepare(`
        UPDATE merchant_wallets
        SET balance = ?, total_received = ?, updated_at = CURRENT_TIMESTAMP
        WHERE shop_id = ?
      `).run(merchNewBal, merchNewTotalReceived, shopId);

      // 6. Double-entry transaction IDs & ledger records
      const txId = `TX-RED-${redemption.redemption_id}`;
      const shop = db.prepare('SELECT name FROM shops WHERE id = ?').get(shopId);
      const shopName = shop ? shop.name : `Shop #${shopId}`;

      // Customer Ledger (Debit)
      db.prepare(`
        INSERT INTO point_ledger (
          user_id, transaction_id, type, points, previous_balance, new_balance, merchant_id, reason
        )
        VALUES (?, ?, 'REDEEMED', ?, ?, ?, ?, ?)
      `).run(
        customerId,
        txId,
        -coinsToDeduct,
        custPrevBal,
        custNewBal,
        shopId,
        `Redeemed ${coinsToDeduct} coins (₹${coinsToDeduct} discount) at ${shopName} [Ref: ${redemption.redemption_id}]`
      );

      // Merchant Ledger (Credit)
      db.prepare(`
        INSERT INTO merchant_coin_ledger (
          shop_id, transaction_id, redemption_id, customer_id, type, coins, previous_balance, new_balance, description
        )
        VALUES (?, ?, ?, ?, 'CUSTOMER_REDEMPTION', ?, ?, ?, ?)
      `).run(
        shopId,
        txId,
        redemption.redemption_id,
        customerId,
        coinsToDeduct,
        merchPrevBal,
        merchNewBal,
        `Collected ${coinsToDeduct} coins from Customer #${customerId} (Redemption: ${redemption.redemption_id})`
      );

      // Coin Transfers linking table
      const transferId = `XFER-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      db.prepare(`
        INSERT INTO coin_transfers (
          transfer_id, redemption_id, customer_id, merchant_id, coins_amount, discount_inr,
          customer_previous_balance, customer_new_balance, merchant_previous_balance, merchant_new_balance, status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED')
      `).run(
        transferId,
        redemption.redemption_id,
        customerId,
        shopId,
        coinsToDeduct,
        redemption.discount_inr,
        custPrevBal,
        custNewBal,
        merchPrevBal,
        merchNewBal
      );

      // Update redemption request status to completed
      db.prepare(`
        UPDATE coin_redemption_requests
        SET status = 'completed', completed_at = CURRENT_TIMESTAMP, merchant_id = ?
        WHERE id = ?
      `).run(shopId, redemption.id);

      return {
        transferId,
        redemptionId: redemption.redemption_id,
        coinsCollected: coinsToDeduct,
        discountInr: redemption.discount_inr,
        customerNewBalance: custNewBal,
        merchantNewBalance: merchNewBal,
        shopName
      };
    });

    const outcome = executeCollection();

    return res.json({
      success: true,
      message: 'COLLECTION SUCCESSFUL. Both customer and merchant wallets updated.',
      outcome
    });
  } catch (err) {
    console.error('Merchant redemption confirm error:', err.message);
    const statusCode = err.message.startsWith('NOT_FOUND') ? 404
      : err.message.startsWith('WRONG_MERCHANT') ? 403
      : 400;
    return res.status(statusCode).json({ success: false, error: err.message.split(': ')[1] || err.message });
  }
});

// GET /api/shop/wallet — Merchant Coin Wallet details & transaction history
router.get('/wallet', (req, res) => {
  try {
    const shopId = req.user.shop_id || req.user.id;

    db.prepare(`
      INSERT OR IGNORE INTO merchant_wallets (shop_id, balance, total_received, total_spent)
      VALUES (?, 0, 0, 0)
    `).run(shopId);

    const wallet = db.prepare('SELECT * FROM merchant_wallets WHERE shop_id = ?').get(shopId) || { balance: 0, total_received: 0, total_spent: 0 };

    const recentTransactions = db.prepare(`
      SELECT mcl.*, u.full_name AS customer_name
      FROM merchant_coin_ledger mcl
      LEFT JOIN users u ON mcl.customer_id = u.id
      WHERE mcl.shop_id = ?
      ORDER BY mcl.id DESC
      LIMIT 50
    `).all(shopId);

    return res.json({
      success: true,
      wallet,
      recentTransactions
    });
  } catch (err) {
    console.error('Fetch merchant wallet error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch merchant wallet' });
  }
});

// GET /api/shop/redemptions/history — Customer coin redemptions collected at this shop
router.get('/redemptions/history', (req, res) => {
  try {
    const shopId = req.user.shop_id || req.user.id;

    const collections = db.prepare(`
      SELECT ct.id, ct.transfer_id, ct.redemption_id, ct.coins_amount, ct.discount_inr, ct.created_at,
             u.full_name AS customer_name, u.phone AS customer_phone
      FROM coin_transfers ct
      JOIN users u ON ct.customer_id = u.id
      WHERE ct.merchant_id = ?
      ORDER BY ct.created_at DESC
      LIMIT 100
    `).all(shopId);

    return res.json({
      success: true,
      collections
    });
  } catch (err) {
    console.error('Fetch merchant redemptions error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch redemption collections' });
  }
});

// GET /api/shop/my-qr — Return Permanent Merchant QR Code & poster details
router.get('/my-qr', (req, res) => {
  try {
    const shopId = req.user.shop_id || req.user.id;
    let shop = db.prepare(`
      SELECT id, shop_code, name, category, address, city, phone, image_url, logo_url,
             status, verification_status, permanent_qr_code, qr_status, qr_generated_at
      FROM shops WHERE id = ?
    `).get(shopId);

    if (!shop) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }

    if (!shop.permanent_qr_code) {
      const uniqueQr = 'VP52-MCH-' + crypto.randomBytes(10).toString('hex').toUpperCase();
      db.prepare("UPDATE shops SET permanent_qr_code = ?, qr_status = 'active', qr_generated_at = datetime('now') WHERE id = ?").run(uniqueQr, shopId);
      shop.permanent_qr_code = uniqueQr;
      shop.qr_status = 'active';
    }

    return res.json({
      success: true,
      shop: {
        ...shop,
        shop_code: shop.shop_code || `SHOP-00${shop.id}`,
        qr_string: `VP52:MERCHANT:${shop.permanent_qr_code}`,
        is_active: shop.status === 'active' && shop.qr_status !== 'suspended' && shop.qr_status !== 'revoked'
      }
    });
  } catch (err) {
    console.error('Fetch merchant QR error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve permanent merchant QR' });
  }
});

// GET /api/shop/notifications — Merchant notifications
router.get('/notifications', (req, res) => {
  try {
    const shopId = req.user.shop_id || req.user.id;
    const notifications = db.prepare(`
      SELECT * FROM merchant_notifications
      WHERE shop_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(shopId);

    const unreadCount = db.prepare(`
      SELECT COUNT(*) AS c FROM merchant_notifications
      WHERE shop_id = ? AND is_read = 0
    `).get(shopId)?.c || 0;

    return res.json({
      success: true,
      unread_count: unreadCount,
      notifications
    });
  } catch (err) {
    console.error('Fetch merchant notifications error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve merchant notifications' });
  }
});

// POST /api/shop/notifications/read-all — Mark merchant notifications as read
router.post('/notifications/read-all', (req, res) => {
  try {
    const shopId = req.user.shop_id || req.user.id;
    db.prepare('UPDATE merchant_notifications SET is_read = 1 WHERE shop_id = ?').run(shopId);
    return res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Mark merchant notifications read error:', err);
    return res.status(500).json({ success: false, error: 'Failed to mark notifications as read' });
  }
});

module.exports = router;
