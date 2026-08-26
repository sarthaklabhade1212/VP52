const express = require('express');
const db = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Apply Admin Authentication Middleware to all admin routes
router.use(authenticateToken);
router.use(requireRole('admin'));

// Audit Logging Helper
function logAdminAction(adminId, action, targetEntity, metadata = {}) {
  try {
    db.prepare(`
      INSERT INTO audit_logs (admin_id, action, target_entity, metadata)
      VALUES (?, ?, ?, ?)
    `).run(adminId || 1, action, targetEntity, typeof metadata === 'string' ? metadata : JSON.stringify(metadata));
  } catch (e) {
    console.error('Audit log error:', e.message);
  }
}

// Audit Logs Retrieval Endpoint
router.get('/audit-logs', (req, res) => {
  try {
    const logs = db.prepare(`
      SELECT a.id, a.admin_id, a.action, a.target_entity, a.metadata, a.timestamp,
             adm.full_name AS admin_name, adm.email AS admin_email
      FROM audit_logs a
      LEFT JOIN admins adm ON a.admin_id = adm.id
      ORDER BY a.timestamp DESC
      LIMIT 100
    `).all();

    return res.json({ success: true, auditLogs: logs });
  } catch (error) {
    console.error('Fetch audit logs error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch audit logs' });
  }
});

// Reward Settings Management
router.get('/reward-settings', (req, res) => {
  try {
    const settingsRows = db.prepare('SELECT * FROM reward_settings').all();
    const levelsRows = db.prepare('SELECT * FROM reward_levels ORDER BY min_points ASC').all();

    const settingsObj = {};
    settingsRows.forEach(r => { settingsObj[r.key] = r.value; });

    return res.json({
      success: true,
      settings: settingsObj,
      rawSettings: settingsRows,
      levels: levelsRows
    });
  } catch (error) {
    console.error('Fetch reward settings error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch reward settings' });
  }
});

router.put('/reward-settings', (req, res) => {
  try {
    const { settings, levels } = req.body;
    const adminId = req.user ? req.user.id : 1;

    if (settings) {
      const upsertSetting = db.prepare(`
        INSERT INTO reward_settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
      `);

      for (const [key, val] of Object.entries(settings)) {
        upsertSetting.run(key, String(val));
      }
    }

    if (levels && Array.isArray(levels)) {
      const upsertLevel = db.prepare(`
        INSERT INTO reward_levels (level_name, min_points, benefits, discount_cap_percent)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(level_name) DO UPDATE SET
          min_points = excluded.min_points,
          benefits = excluded.benefits,
          discount_cap_percent = excluded.discount_cap_percent
      `);

      for (const lvl of levels) {
        upsertLevel.run(lvl.level_name, parseInt(lvl.min_points) || 0, lvl.benefits || '', parseInt(lvl.discount_cap_percent) || 5);
      }
    }

    logAdminAction(adminId, 'UPDATE_REWARD_SETTINGS', 'reward_settings', { settings, levels });

    return res.json({ success: true, message: 'Platform reward economy settings updated successfully!' });
  } catch (error) {
    console.error('Update reward settings error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update reward settings' });
  }
});

// 1. Dashboard Analytics Summary & Chart Data
router.get('/analytics', (req, res) => {
  try {
    const totalCustomersRow = db.prepare('SELECT COUNT(*) AS count FROM users').get();
    const activeShopsRow = db.prepare("SELECT COUNT(*) AS count FROM shops WHERE status = 'active'").get();
    const totalPointsRow = db.prepare('SELECT SUM(total_earned) AS total FROM wallets').get();
    const totalRedemptionsRow = db.prepare('SELECT COUNT(*) AS count FROM redemptions').get();
    const activeOffersRow = db.prepare("SELECT COUNT(*) AS count FROM offers WHERE status = 'active'").get();
    
    const todayRedemptionsRow = db.prepare(`
      SELECT COUNT(*) AS count FROM redemptions
      WHERE date(created_at) = date('now')
    `).get();

    // Chart Data 1: Points Earned vs Redeemed Timeline (last 7 days)
    const pointsTrends = db.prepare(`
      SELECT date(created_at) as date, SUM(points) as points_earned
      FROM reward_transactions
      GROUP BY date(created_at)
      ORDER BY date(created_at) DESC
      LIMIT 7
    `).all().reverse();

    // Chart Data 2: Top Shops by Redemptions
    const shopRedemptionStats = db.prepare(`
      SELECT s.name AS shop_name, COUNT(r.id) AS redemptions_count, SUM(r.points_deducted) AS points_spent
      FROM redemptions r
      JOIN shops s ON r.shop_id = s.id
      GROUP BY r.shop_id
      ORDER BY redemptions_count DESC
      LIMIT 5
    `).all();

    return res.json({
      success: true,
      stats: {
        totalCustomers: totalCustomersRow ? totalCustomersRow.count : 0,
        activeShops: activeShopsRow ? activeShopsRow.count : 0,
        totalPointsDistributed: totalPointsRow ? (totalPointsRow.total || 0) : 0,
        totalRedemptions: totalRedemptionsRow ? totalRedemptionsRow.count : 0,
        activeOffers: activeOffersRow ? activeOffersRow.count : 0,
        todayRedemptions: todayRedemptionsRow ? todayRedemptionsRow.count : 0
      },
      charts: {
        pointsTrends,
        shopRedemptionStats
      }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return res.status(500).json({ success: false, error: 'Failed to compute dashboard analytics' });
  }
});

// 2. Customer Management (List all)
router.get('/customers', (req, res) => {
  try {
    const customers = db.prepare(`
      SELECT u.id, u.full_name, u.email, u.phone, u.status, u.created_at,
             w.balance, w.total_earned, w.total_redeemed
      FROM users u
      LEFT JOIN wallets w ON u.id = w.user_id
      ORDER BY u.id DESC
    `).all();

    return res.json({ success: true, customers });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch customer list' });
  }
});

// 3. Customer Detail Page
router.get('/customers/:id', (req, res) => {
  try {
    const customer = db.prepare(`
      SELECT u.id, u.full_name, u.email, u.phone, u.status, u.created_at,
             w.balance, w.total_earned, w.total_redeemed
      FROM users u
      LEFT JOIN wallets w ON u.id = w.user_id
      WHERE u.id = ?
    `).get(req.params.id);

    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const rewardHistory = db.prepare('SELECT * FROM reward_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 30').all(customer.id);
    const redemptionHistory = db.prepare(`
      SELECT r.*, s.name AS shop_name, o.title AS offer_title
      FROM redemptions r
      JOIN shops s ON r.shop_id = s.id
      JOIN offers o ON r.offer_id = o.id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
      LIMIT 30
    `).all(customer.id);

    return res.json({
      success: true,
      customer,
      rewardHistory,
      redemptionHistory
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch customer detail' });
  }
});

// 4. Update Customer Status (Suspend/Activate)
router.put('/customers/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status value' });
    }

    db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, req.params.id);
    return res.json({ success: true, message: `Customer status updated to ${status}` });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to update customer status' });
  }
});

// 5. Shops CRUD
router.get('/shops', (req, res) => {
  try {
    const shops = db.prepare('SELECT * FROM shops ORDER BY id DESC').all();
    return res.json({ success: true, shops });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch shops' });
  }
});

// Admin Add Shop + Merchant Credentials
router.post('/shops', (req, res) => {
  try {
    const { name, owner_name, category, description, address, phone, email, image_url, status, latitude, longitude, temp_password } = req.body;
    if (!name || !owner_name || !phone || !address) {
      return res.status(400).json({ success: false, error: 'Shop name, owner name, mobile number, and address are required' });
    }

    const cleanPhone = phone.trim();
    const cleanEmail = email ? email.trim().toLowerCase() : `shop_${Date.now()}@merchant.com`;

    // Check existing email
    const existingShop = db.prepare('SELECT id FROM shops WHERE email = ?').get(cleanEmail);
    if (existingShop) {
      return res.status(400).json({ success: false, error: `Email "${cleanEmail}" is already registered to another merchant.` });
    }

    // Auto-generate secure temporary password if not provided (e.g. Shop@123)
    const rawTempPassword = temp_password ? temp_password.trim() : `Shop@${Math.floor(100 + Math.random() * 900)}`;
    const bcrypt = require('bcryptjs');
    const passwordHash = bcrypt.hashSync(rawTempPassword, 10);

    const countRow = db.prepare('SELECT COUNT(*) AS count FROM shops').get();
    const nextId = (countRow ? countRow.count : 0) + 1;
    const shopCode = `SHOP-00${nextId}`;

    const initialStatus = status || 'active';
    const initialVerificationStatus = initialStatus === 'active' ? 'approved' : 'pending';

    const result = db.prepare(`
      INSERT INTO shops (shop_code, email, password_hash, name, category, description, address, phone, image_url, status, verification_status, owner_name, latitude, longitude)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      shopCode,
      cleanEmail,
      passwordHash,
      name.trim(),
      category ? category.trim() : 'Retail',
      description ? description.trim() : `Registered by Admin for ${owner_name.trim()}`,
      address.trim(),
      cleanPhone,
      image_url ? image_url.trim() : 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80',
      initialStatus,
      initialVerificationStatus,
      owner_name.trim(),
      latitude ? parseFloat(latitude) : 18.5204,
      longitude ? parseFloat(longitude) : 73.8567
    );

    // Audit Log Entry
    db.prepare(`
      INSERT INTO reward_transactions (user_id, activity_type, points)
      VALUES (1, ?, 0)
    `).run(`ADMIN CREATED MERCHANT ACCOUNT: ${name.trim()} (${shopCode}) | Mobile: ${cleanPhone}`);

    return res.status(201).json({
      success: true,
      message: 'Merchant account and physical store created successfully!',
      credentials: {
        shopId: result.lastInsertRowid,
        shopCode,
        shopName: name.trim(),
        ownerName: owner_name.trim(),
        mobileNumber: cleanPhone,
        email: cleanEmail,
        accountStatus: initialStatus,
        temporaryPassword: rawTempPassword // SHOWN ONCE TO ADMIN UPON CREATION
      }
    });
  } catch (error) {
    console.error('Admin add shop error:', error);
    return res.status(500).json({ success: false, error: 'Failed to create shop and merchant account' });
  }
});

// Update Shop Details
router.put('/shops/:id', (req, res) => {
  try {
    const { name, owner_name, category, description, address, phone, email, image_url, status } = req.body;
    db.prepare(`
      UPDATE shops
      SET name = ?, owner_name = ?, category = ?, description = ?, address = ?, phone = ?, email = ?, image_url = ?, status = ?
      WHERE id = ?
    `).run(name, owner_name, category, description, address, phone, email, image_url, status || 'active', req.params.id);

    return res.json({ success: true, message: 'Shop and merchant account updated successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to update shop' });
  }
});

// Update Account Status (Active, Suspended, Inactive)
router.put('/shops/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended', 'inactive', 'pending'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid account status' });
    }

    const verificationStatus = status === 'active' ? 'approved' : status === 'pending' ? 'pending' : 'suspended';
    db.prepare('UPDATE shops SET status = ?, verification_status = ? WHERE id = ?').run(status, verificationStatus, req.params.id);

    // Audit Log
    db.prepare(`
      INSERT INTO reward_transactions (user_id, activity_type, points)
      VALUES (1, ?, 0)
    `).run(`ADMIN CHANGED SHOP ID ${req.params.id} STATUS TO: ${status.toUpperCase()}`);

    return res.json({ success: true, message: `Merchant account status updated to "${status.toUpperCase()}".` });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to update account status' });
  }
});

// Reset Merchant Credentials
router.put('/shops/:id/reset-credentials', (req, res) => {
  try {
    const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(req.params.id);
    if (!shop) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }

    const newTempPassword = `ShopTemp#${Math.floor(1000 + Math.random() * 9000)}`;
    const bcrypt = require('bcryptjs');
    const passwordHash = bcrypt.hashSync(newTempPassword, 10);

    db.prepare('UPDATE shops SET password_hash = ? WHERE id = ?').run(passwordHash, shop.id);

    // Audit Log
    db.prepare(`
      INSERT INTO reward_transactions (user_id, activity_type, points)
      VALUES (1, ?, 0)
    `).run(`ADMIN RESET CREDENTIALS FOR SHOP ${shop.name} (${shop.shop_code})`);

    return res.json({
      success: true,
      message: `Credentials reset for "${shop.name}".`,
      credentials: {
        shopId: shop.id,
        shopCode: shop.shop_code,
        shopName: shop.name,
        mobileNumber: shop.phone,
        email: shop.email,
        newTemporaryPassword: newTempPassword // SHOWN ONCE TO ADMIN UPON RESET
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to reset merchant credentials' });
  }
});

router.delete('/shops/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM shops WHERE id = ?').run(req.params.id);
    return res.json({ success: true, message: 'Shop deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to delete shop' });
  }
});

// 6. Offers CRUD
router.get('/offers', (req, res) => {
  try {
    const offers = db.prepare(`
      SELECT o.*, s.name AS shop_name, s.category AS shop_category
      FROM offers o
      JOIN shops s ON o.shop_id = s.id
      ORDER BY o.id DESC
    `).all();

    return res.json({ success: true, offers });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch offers' });
  }
});

router.post('/offers', (req, res) => {
  try {
    const { shop_id, title, discount_percent, max_discount_inr, valid_until, usage_limit, status } = req.body;
    if (!shop_id || !title || !discount_percent || !max_discount_inr || !valid_until) {
      return res.status(400).json({ success: false, error: 'Missing required offer fields (Shop, Title, Discount %, Max Discount INR, Valid Until)' });
    }

    const result = db.prepare(`
      INSERT INTO offers (shop_id, title, discount_percent, required_points, max_discount_inr, valid_until, usage_limit, status)
      VALUES (?, ?, ?, 0, ?, ?, ?, ?)
    `).run(shop_id, title.trim(), discount_percent, max_discount_inr, valid_until, usage_limit || 100, status || 'active');

    return res.status(201).json({ success: true, message: 'Offer created successfully', offerId: result.lastInsertRowid });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to create offer' });
  }
});

router.put('/offers/:id', (req, res) => {
  try {
    const { shop_id, title, discount_percent, max_discount_inr, valid_until, usage_limit, status } = req.body;
    db.prepare(`
      UPDATE offers
      SET shop_id = ?, title = ?, discount_percent = ?, max_discount_inr = ?, valid_until = ?, usage_limit = ?, status = ?
      WHERE id = ?
    `).run(shop_id, title, discount_percent, max_discount_inr, valid_until, usage_limit, status, req.params.id);

    return res.json({ success: true, message: 'Offer updated successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to update offer' });
  }
});

router.delete('/offers/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM offers WHERE id = ?').run(req.params.id);
    return res.json({ success: true, message: 'Offer deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to delete offer' });
  }
});

// 7. QR Code Verification (Lookup Code)
router.get('/verify-qr/:code', (req, res) => {
  try {
    const code = req.params.code.trim().toUpperCase();

    const redemption = db.prepare(`
      SELECT r.id, r.redemption_code, r.points_deducted, r.discount_percent, r.max_discount_inr, r.status, r.created_at, r.redeemed_at,
             u.full_name AS customer_name, u.email AS customer_email, u.phone AS customer_phone,
             s.name AS shop_name, s.category AS shop_category, s.address AS shop_address,
             o.title AS offer_title, o.valid_until
      FROM redemptions r
      JOIN users u ON r.user_id = u.id
      JOIN shops s ON r.shop_id = s.id
      JOIN offers o ON r.offer_id = o.id
      WHERE UPPER(r.redemption_code) = ?
    `).get(code);

    if (!redemption) {
      return res.status(404).json({
        success: false,
        valid: false,
        error: `No redemption record found for code "${code}". Please verify the code and try again.`
      });
    }

    const isValid = redemption.status === 'ACTIVE';

    return res.json({
      success: true,
      valid: isValid,
      redemption
    });
  } catch (error) {
    console.error('Verify QR error:', error);
    return res.status(500).json({ success: false, error: 'Failed to verify redemption code' });
  }
});

// 8. Admin Mark Redemption AS USED
router.post('/mark-used', (req, res) => {
  try {
    const { redemption_code } = req.body;
    if (!redemption_code) {
      return res.status(400).json({ success: false, error: 'Redemption code is required' });
    }

    const code = redemption_code.trim().toUpperCase();
    const redemption = db.prepare('SELECT * FROM redemptions WHERE UPPER(redemption_code) = ?').get(code);

    if (!redemption) {
      return res.status(404).json({ success: false, error: 'Redemption code not found' });
    }

    if (redemption.status === 'USED') {
      return res.status(400).json({
        success: false,
        error: `Redemption code ${code} has ALREADY been used on ${redemption.redeemed_at}. Duplicate redemption prevented.`
      });
    }

    if (redemption.status !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        error: `Cannot apply discount. Redemption status is currently "${redemption.status}".`
      });
    }

    // Mark as USED
    db.prepare(`
      UPDATE redemptions
      SET status = 'USED',
          redeemed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(redemption.id);

    const updated = db.prepare(`
      SELECT r.*, s.name AS shop_name, u.full_name AS customer_name
      FROM redemptions r
      JOIN shops s ON r.shop_id = s.id
      JOIN users u ON r.user_id = u.id
      WHERE r.id = ?
    `).get(redemption.id);

    return res.json({
      success: true,
      message: `VALID REDEMPTION - ${updated.discount_percent}% OFF at ${updated.shop_name} applied successfully!`,
      redemption: updated
    });
  } catch (error) {
    console.error('Mark used error:', error);
    return res.status(500).json({ success: false, error: 'Failed to mark redemption as used' });
  }
});

// 9. Admin Settings Management
router.get('/settings', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM admin_settings').all();
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    return res.json({ success: true, settings });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch settings' });
  }
});

router.put('/settings', (req, res) => {
  try {
    const { points_per_ad, max_daily_rewards, min_redemption_points, ad_duration_seconds } = req.body;

    const upsert = db.prepare('INSERT INTO admin_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP');

    if (points_per_ad !== undefined) upsert.run('points_per_ad', String(points_per_ad));
    if (max_daily_rewards !== undefined) upsert.run('max_daily_rewards', String(max_daily_rewards));
    if (min_redemption_points !== undefined) upsert.run('min_redemption_points', String(min_redemption_points));
    if (ad_duration_seconds !== undefined) upsert.run('ad_duration_seconds', String(ad_duration_seconds));

    return res.json({ success: true, message: 'Settings saved successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
});

// 10. Reward & Redemption Transaction Audit Tables
router.get('/transactions/rewards', (req, res) => {
  try {
    const rewards = db.prepare(`
      SELECT t.id, t.activity_type, t.points, t.created_at, u.full_name AS customer_name, u.email AS customer_email
      FROM reward_transactions t
      JOIN users u ON t.user_id = u.id
      ORDER BY t.created_at DESC
      LIMIT 100
    `).all();

    return res.json({ success: true, rewards });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch reward transactions' });
  }
});

router.get('/transactions/redemptions', (req, res) => {
  try {
    const redemptions = db.prepare(`
      SELECT r.id, r.redemption_code, r.points_deducted, r.discount_percent, r.max_discount_inr, r.status, r.created_at, r.redeemed_at,
             u.full_name AS customer_name, u.email AS customer_email,
             s.name AS shop_name, o.title AS offer_title
      FROM redemptions r
      JOIN users u ON r.user_id = u.id
      JOIN shops s ON r.shop_id = s.id
      JOIN offers o ON r.offer_id = o.id
      ORDER BY r.created_at DESC
      LIMIT 100
    `).all();

    return res.json({ success: true, redemptions });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch redemption transactions' });
  }
});

// 11. Merchant Verification Queue
router.get('/merchants/pending', (req, res) => {
  try {
    const pendingShops = db.prepare("SELECT * FROM shops WHERE verification_status = 'pending' ORDER BY id DESC").all();
    return res.json({ success: true, shops: pendingShops });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch pending verification queue' });
  }
});

router.put('/merchants/:id/verify', (req, res) => {
  try {
    const { action } = req.body; // 'approved' | 'rejected' | 'suspended'
    if (!['approved', 'rejected', 'suspended'].includes(action)) {
      return res.status(400).json({ success: false, error: 'Invalid verification action' });
    }

    db.prepare('UPDATE shops SET verification_status = ? WHERE id = ?').run(action, req.params.id);

    return res.json({ success: true, message: `Merchant verification status updated to "${action}".` });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to update merchant verification status' });
  }
});

// 12. Customer Support Complaints Moderation
router.get('/complaints', (req, res) => {
  try {
    const complaints = db.prepare(`
      SELECT c.*, u.full_name AS customer_name, u.email AS customer_email
      FROM complaints c
      JOIN users u ON c.user_id = u.id
      ORDER BY c.created_at DESC
    `).all();

    return res.json({ success: true, complaints });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch complaints' });
  }
});

router.put('/complaints/:id', (req, res) => {
  try {
    const { status } = req.body;
    if (!['open', 'under_review', 'resolved', 'closed'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid complaint status' });
    }

    db.prepare('UPDATE complaints SET status = ? WHERE id = ?').run(status, req.params.id);
    return res.json({ success: true, message: `Complaint status updated to "${status}".` });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to update complaint' });
  }
});

// 13. Reward Levels Rules Management
router.get('/levels', (req, res) => {
  try {
    const levels = db.prepare('SELECT * FROM reward_levels ORDER BY min_points ASC').all();
    return res.json({ success: true, levels });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch reward levels' });
  }
});

router.put('/levels/:name', (req, res) => {
  try {
    const { min_points, benefits } = req.body;
    db.prepare(`
      UPDATE reward_levels
      SET min_points = ?, benefits = ?
      WHERE level_name = ?
    `).run(parseInt(min_points), benefits, req.params.name);

    return res.json({ success: true, message: `Level rule "${req.params.name}" updated successfully.` });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to update level rule' });
  }
});

module.exports = router;
