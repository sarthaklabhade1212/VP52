const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');
const { authenticateToken, requireRole, requirePermission } = require('../middleware/auth');
const { generateStrongPassword } = require('../utils/password');
const { CATEGORIES, getCategoryById, isValidCategoryAndSubcategory } = require('../config/categories');

const router = express.Router();

// Apply Admin Authentication Middleware to all admin routes
router.use(authenticateToken);
router.use(requireRole('admin'));

// Audit Logging & Activity Trail Helper
function recordAdminActivity(adminId, action, module, recordId = null, req = null, { oldValue = null, newValue = null, reason = null, status = 'success' } = {}) {
  try {
    let adminName = 'Admin';
    if (adminId) {
      const a = db.prepare('SELECT full_name FROM admins WHERE id = ?').get(adminId);
      if (a) adminName = a.full_name;
    }
    const ip = req ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '') : '';
    
    // Insert into comprehensive admin_activity_logs table
    db.prepare(`
      INSERT INTO admin_activity_logs (admin_id, admin_name, action, module, record_id, ip_address, old_value, new_value, reason, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      adminId || 1,
      adminName,
      action,
      module,
      recordId ? String(recordId) : null,
      String(ip),
      oldValue ? (typeof oldValue === 'string' ? oldValue : JSON.stringify(oldValue)) : null,
      newValue ? (typeof newValue === 'string' ? newValue : JSON.stringify(newValue)) : null,
      reason || null,
      status
    );

    // Legacy audit_logs table compatibility
    db.prepare(`
      INSERT INTO audit_logs (admin_id, action, target_entity, metadata)
      VALUES (?, ?, ?, ?)
    `).run(
      adminId || 1,
      action,
      module,
      JSON.stringify({ recordId, oldValue, newValue, reason, status })
    );
  } catch (e) {
    console.error('Activity log error:', e.message);
  }
}

// Legacy alias
const logAdminAction = (adminId, action, targetEntity, metadata = {}) => {
  recordAdminActivity(adminId, action, targetEntity, metadata?.recordId || null, null, {
    newValue: metadata,
    reason: metadata?.reason || null
  });
};

// Date Range Clause Helper for SQL queries
function getDateRangeClause(range, startDate, endDate, dateColumn = 'created_at') {
  if (range === 'today') {
    return {
      clause: `datetime(${dateColumn}) >= datetime('now', 'start of day')`,
      params: []
    };
  } else if (range === 'yesterday') {
    return {
      clause: `datetime(${dateColumn}) >= datetime('now', 'start of day', '-1 day') AND datetime(${dateColumn}) < datetime('now', 'start of day')`,
      params: []
    };
  } else if (range === '7days') {
    return {
      clause: `datetime(${dateColumn}) >= datetime('now', '-7 days')`,
      params: []
    };
  } else if (range === '30days') {
    return {
      clause: `datetime(${dateColumn}) >= datetime('now', '-30 days')`,
      params: []
    };
  } else if (range === 'this_month') {
    return {
      clause: `datetime(${dateColumn}) >= datetime('now', 'start of month')`,
      params: []
    };
  } else if (range === 'prev_month') {
    return {
      clause: `datetime(${dateColumn}) >= datetime('now', 'start of month', '-1 month') AND datetime(${dateColumn}) < datetime('now', 'start of month')`,
      params: []
    };
  } else if (range === 'custom' && startDate && endDate) {
    return {
      clause: `datetime(${dateColumn}) >= datetime(?) AND datetime(${dateColumn}) <= datetime(?)`,
      params: [new Date(startDate).toISOString(), new Date(endDate).toISOString()]
    };
  }
  return { clause: '1=1', params: [] };
}

// Zero-dependency RFC 4180 CSV serializer
function toCSV(rows, columns) {
  if (!rows || !rows.length) return '';
  const header = columns.map(c => typeof c === 'string' ? c : c.header).join(',');
  const lines = rows.map(r => {
    return columns.map(col => {
      const key = typeof col === 'string' ? col : col.key;
      let val = r[key];
      if (val === null || val === undefined) val = '';
      val = String(val).replace(/"/g, '""');
      return `"${val}"`;
    }).join(',');
  });
  return [header, ...lines].join('\n');
}

// Categories reference for Admin (Dynamic DB table with fallback to master config)
router.get('/categories', (req, res) => {
  try {
    const categories = db.prepare('SELECT * FROM categories ORDER BY display_order ASC, name ASC').all();
    if (categories && categories.length > 0) {
      const subcategories = db.prepare('SELECT * FROM subcategories ORDER BY display_order ASC, name ASC').all();
      const shopCounts = db.prepare('SELECT category, COUNT(*) AS count FROM shops GROUP BY category').all();
      const countsMap = {};
      shopCounts.forEach(sc => { countsMap[(sc.category || '').toLowerCase()] = sc.count; });

      const fullCategories = categories.map(cat => {
        const subs = subcategories.filter(s => s.category_id === cat.id).map(s => s.name);
        return {
          id: cat.id,
          name: cat.name,
          icon: cat.icon,
          catalogType: cat.catalog_type,
          color: cat.color,
          description: cat.description,
          is_active: cat.is_active,
          display_order: cat.display_order,
          subcategories: subs,
          merchant_count: countsMap[cat.name.toLowerCase()] || 0
        };
      });
      return res.json({ success: true, categories: fullCategories });
    }
    return res.json({ success: true, categories: CATEGORIES });
  } catch (err) {
    return res.json({ success: true, categories: CATEGORIES });
  }
});

// Coordinate validation for admin-authored shop locations.
// Latitude must be a finite number in [-90, 90]; longitude in [-180, 180].
// Returns { ok: true, latitude, longitude } with numeric values, or
// { ok: false, error } describing the first problem. The admin is the ONLY
// authority permitted to set a shop's coordinates, so this runs on every
// create/edit write path.
function validateCoordinates(latitude, longitude) {
  if (latitude === undefined || latitude === null || latitude === '') {
    return { ok: false, error: 'Shop latitude is required' };
  }
  if (longitude === undefined || longitude === null || longitude === '') {
    return { ok: false, error: 'Shop longitude is required' };
  }
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return { ok: false, error: 'Invalid latitude: must be a number between -90 and 90' };
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    return { ok: false, error: 'Invalid longitude: must be a number between -180 and 180' };
  }
  return { ok: true, latitude: lat, longitude: lng };
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

// Detailed Merchant Overview (Images, Products, Offers, Reviews)
router.get('/shops/:id/details', (req, res) => {
  try {
    const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(req.params.id);
    if (!shop) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }
    const photos = db.prepare('SELECT * FROM shop_photos WHERE shop_id = ? ORDER BY is_cover DESC, id ASC').all(shop.id);
    const products = db.prepare('SELECT * FROM products WHERE shop_id = ? ORDER BY display_order ASC, id DESC').all(shop.id);
    const offers = db.prepare('SELECT * FROM offers WHERE shop_id = ? ORDER BY id DESC').all(shop.id);
    const reviews = db.prepare(`
      SELECT r.*, u.full_name AS customer_name, u.email AS customer_email
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.shop_id = ?
      ORDER BY r.created_at DESC
    `).all(shop.id);

    return res.json({
      success: true,
      shop: {
        ...shop,
        photos,
        products,
        offers,
        reviews
      }
    });
  } catch (error) {
    console.error('Fetch shop details error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch shop details' });
  }
});

// Admin Add Shop + Merchant Credentials
router.post('/shops', (req, res) => {
  try {
    const {
      name, owner_name, category, subcategory, description,
      address, area_locality, city, district, state, pincode,
      phone, whatsapp_number, email, image_url, logo_url, cover_photo_url,
      opening_time, closing_time, business_hours, is_temporarily_closed,
      status, latitude, longitude, photos
    } = req.body;

    if (!name || !owner_name || !phone || !address) {
      return res.status(400).json({ success: false, error: 'Shop name, owner name, mobile number, and address are required' });
    }

    // Shop location is REQUIRED and authoritative. The admin must confirm exact
    // coordinates in the UI; there is NO silent Pune default any more.
    const coords = validateCoordinates(latitude, longitude);
    if (!coords.ok) {
      return res.status(400).json({ success: false, error: coords.error });
    }

    const cleanPhone = phone.trim();
    const cleanEmail = email ? email.trim().toLowerCase() : `shop_${Date.now()}@merchant.com`;

    // Check existing email
    const existingShop = db.prepare('SELECT id FROM shops WHERE email = ?').get(cleanEmail);
    if (existingShop) {
      return res.status(400).json({ success: false, error: `Email "${cleanEmail}" is already registered to another merchant.` });
    }

    // Server-side crypto temporary password
    const rawTempPassword = generateStrongPassword(16);
    const passwordHash = bcrypt.hashSync(rawTempPassword, 10);

    const countRow = db.prepare('SELECT COUNT(*) AS count FROM shops').get();
    const nextId = (countRow ? countRow.count : 0) + 1;
    const shopCode = `SHOP-00${nextId}`;

    const initialStatus = status || 'active';
    const initialVerificationStatus = initialStatus === 'active' ? 'approved' : 'pending';

    const finalCoverPhoto = cover_photo_url || image_url || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80';
    const finalLogo = logo_url || null;

    const result = db.prepare(`
      INSERT INTO shops (
        shop_code, email, password_hash, name, category, subcategory, description,
        address, area_locality, city, district, state, pincode,
        phone, whatsapp_number, image_url, logo_url, cover_photo_url,
        opening_time, closing_time, business_hours, is_temporarily_closed,
        status, verification_status, owner_name, latitude, longitude, must_change_password
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      shopCode,
      cleanEmail,
      passwordHash,
      name.trim(),
      category ? category.trim() : 'Retail',
      subcategory ? subcategory.trim() : null,
      description ? description.trim() : `Registered by Admin for ${owner_name.trim()}`,
      address.trim(),
      area_locality ? area_locality.trim() : null,
      city ? city.trim() : null,
      district ? district.trim() : null,
      state ? state.trim() : null,
      pincode ? pincode.trim() : null,
      cleanPhone,
      whatsapp_number ? whatsapp_number.trim() : null,
      finalCoverPhoto,
      finalLogo,
      finalCoverPhoto,
      opening_time || '09:00',
      closing_time || '21:00',
      business_hours ? (typeof business_hours === 'string' ? business_hours : JSON.stringify(business_hours)) : null,
      is_temporarily_closed ? 1 : 0,
      initialStatus,
      initialVerificationStatus,
      owner_name.trim(),
      coords.latitude,
      coords.longitude
    );

    const newShopId = result.lastInsertRowid;
    const permanentQr = 'VP52-MCH-' + crypto.randomBytes(10).toString('hex').toUpperCase();
    db.prepare("UPDATE shops SET permanent_qr_code = ?, qr_status = 'active', qr_generated_at = datetime('now') WHERE id = ?").run(permanentQr, newShopId);
    db.prepare('INSERT OR IGNORE INTO merchant_wallets (shop_id, balance, total_received, total_spent) VALUES (?, 0, 0, 0)').run(newShopId);

    // Insert photos if provided
    if (Array.isArray(photos) && photos.length > 0) {
      const insertPhoto = db.prepare(`
        INSERT INTO shop_photos (shop_id, photo_url, caption, is_cover)
        VALUES (?, ?, ?, ?)
      `);
      photos.forEach(p => {
        if (p && p.photo_url) {
          insertPhoto.run(newShopId, p.photo_url, p.caption || null, p.is_cover ? 1 : 0);
        }
      });
    }

    // Audit Log Entry
    db.prepare(`
      INSERT INTO reward_transactions (user_id, activity_type, points)
      VALUES (1, ?, 0)
    `).run(`ADMIN CREATED MERCHANT ACCOUNT: ${name.trim()} (${shopCode}) | Mobile: ${cleanPhone}`);

    return res.status(201).json({
      success: true,
      message: 'Merchant account and physical store created successfully!',
      credentials: {
        shopId: newShopId,
        shopCode,
        shopName: name.trim(),
        ownerName: owner_name.trim(),
        mobileNumber: cleanPhone,
        email: cleanEmail,
        accountStatus: initialStatus,
        latitude: coords.latitude,
        longitude: coords.longitude,
        temporaryPassword: rawTempPassword // SHOWN ONCE TO ADMIN UPON CREATION
      }
    });
  } catch (error) {
    console.error('Admin add shop error:', error);
    return res.status(500).json({ success: false, error: 'Failed to create shop and merchant account' });
  }
});

// Update Shop Details (admin is the sole authority for public shop coordinates)
router.put('/shops/:id', (req, res) => {
  try {
    const {
      name, owner_name, category, subcategory, description,
      address, area_locality, city, district, state, pincode,
      phone, whatsapp_number, email, image_url, logo_url, cover_photo_url,
      opening_time, closing_time, business_hours, is_temporarily_closed,
      status, latitude, longitude
    } = req.body;

    const existing = db.prepare('SELECT id FROM shops WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }

    const coords = validateCoordinates(latitude, longitude);
    if (!coords.ok) {
      return res.status(400).json({ success: false, error: coords.error });
    }

    const finalCoverPhoto = cover_photo_url || image_url;

    db.prepare(`
      UPDATE shops
      SET name = COALESCE(?, name),
          owner_name = COALESCE(?, owner_name),
          category = COALESCE(?, category),
          subcategory = COALESCE(?, subcategory),
          description = COALESCE(?, description),
          address = COALESCE(?, address),
          area_locality = COALESCE(?, area_locality),
          city = COALESCE(?, city),
          district = COALESCE(?, district),
          state = COALESCE(?, state),
          pincode = COALESCE(?, pincode),
          phone = COALESCE(?, phone),
          whatsapp_number = COALESCE(?, whatsapp_number),
          email = COALESCE(?, email),
          image_url = COALESCE(?, image_url),
          logo_url = COALESCE(?, logo_url),
          cover_photo_url = COALESCE(?, cover_photo_url),
          opening_time = COALESCE(?, opening_time),
          closing_time = COALESCE(?, closing_time),
          business_hours = COALESCE(?, business_hours),
          is_temporarily_closed = COALESCE(?, is_temporarily_closed),
          status = COALESCE(?, status),
          latitude = ?,
          longitude = ?
      WHERE id = ?
    `).run(
      name, owner_name, category, subcategory, description,
      address, area_locality, city, district, state, pincode,
      phone, whatsapp_number, email, finalCoverPhoto, logo_url, finalCoverPhoto,
      opening_time, closing_time, business_hours ? (typeof business_hours === 'string' ? business_hours : JSON.stringify(business_hours)) : null,
      is_temporarily_closed !== undefined ? (is_temporarily_closed ? 1 : 0) : null,
      status || 'active', coords.latitude, coords.longitude, req.params.id
    );

    // Audit Log
    db.prepare(`
      INSERT INTO reward_transactions (user_id, activity_type, points)
      VALUES (1, ?, 0)
    `).run(`ADMIN UPDATED SHOP ID ${req.params.id} (location + details)`);

    return res.json({ success: true, message: 'Shop and merchant account updated successfully' });
  } catch (error) {
    console.error('Admin update shop error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update shop' });
  }
});

// Approve Merchant
router.put('/shops/:id/approve', (req, res) => {
  try {
    const shop = db.prepare('SELECT id, name FROM shops WHERE id = ?').get(req.params.id);
    if (!shop) return res.status(404).json({ success: false, error: 'Shop not found' });

    db.prepare(`
      UPDATE shops
      SET verification_status = 'approved', status = 'active', rejection_reason = NULL
      WHERE id = ?
    `).run(shop.id);

    return res.json({ success: true, message: `Merchant "${shop.name}" has been approved and published.` });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to approve merchant' });
  }
});

// Reject Merchant (with reason)
router.put('/shops/:id/reject', (req, res) => {
  try {
    const { reason } = req.body;
    const shop = db.prepare('SELECT id, name FROM shops WHERE id = ?').get(req.params.id);
    if (!shop) return res.status(404).json({ success: false, error: 'Shop not found' });

    db.prepare(`
      UPDATE shops
      SET verification_status = 'rejected', status = 'inactive', rejection_reason = ?
      WHERE id = ?
    `).run(reason || 'Application rejected by administrator', shop.id);

    return res.json({ success: true, message: `Merchant "${shop.name}" application was rejected.` });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to reject merchant' });
  }
});

// Suspend Merchant
router.put('/shops/:id/suspend', (req, res) => {
  try {
    const shop = db.prepare('SELECT id, name FROM shops WHERE id = ?').get(req.params.id);
    if (!shop) return res.status(404).json({ success: false, error: 'Shop not found' });

    db.prepare(`
      UPDATE shops
      SET verification_status = 'suspended', status = 'suspended'
      WHERE id = ?
    `).run(shop.id);

    return res.json({ success: true, message: `Merchant "${shop.name}" has been suspended.` });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to suspend merchant' });
  }
});

// Shop Photos Management for Admin
router.get('/shops/:id/photos', (req, res) => {
  try {
    const photos = db.prepare('SELECT * FROM shop_photos WHERE shop_id = ? ORDER BY is_cover DESC, id ASC').all(req.params.id);
    return res.json({ success: true, photos });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch photos' });
  }
});

router.post('/shops/:id/photos', (req, res) => {
  try {
    const { photo_url, caption, is_cover } = req.body;
    if (!photo_url) return res.status(400).json({ success: false, error: 'Photo URL is required' });

    if (is_cover) {
      db.prepare('UPDATE shop_photos SET is_cover = 0 WHERE shop_id = ?').run(req.params.id);
      db.prepare('UPDATE shops SET cover_photo_url = ? WHERE id = ?').run(photo_url, req.params.id);
    }

    const result = db.prepare(`
      INSERT INTO shop_photos (shop_id, photo_url, caption, is_cover)
      VALUES (?, ?, ?, ?)
    `).run(req.params.id, photo_url, caption || null, is_cover ? 1 : 0);

    return res.status(201).json({
      success: true,
      message: 'Photo added successfully',
      photo: {
        id: result.lastInsertRowid,
        shop_id: Number(req.params.id),
        photo_url,
        caption,
        is_cover: is_cover ? 1 : 0
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to add photo' });
  }
});

router.delete('/shops/:id/photos/:photoId', (req, res) => {
  try {
    db.prepare('DELETE FROM shop_photos WHERE id = ? AND shop_id = ?').run(req.params.photoId, req.params.id);
    return res.json({ success: true, message: 'Photo deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to delete photo' });
  }
});

// Customer Reviews Moderation for Admin
router.get('/reviews/moderation', (req, res) => {
  try {
    const reviews = db.prepare(`
      SELECT r.*, u.full_name AS customer_name, u.email AS customer_email,
             s.name AS shop_name, s.shop_code,
             (SELECT COUNT(*) FROM review_reports rr WHERE rr.review_id = r.id) AS report_count
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      JOIN shops s ON r.shop_id = s.id
      ORDER BY report_count DESC, r.created_at DESC
    `).all();

    return res.json({ success: true, reviews });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch reviews for moderation' });
  }
});

router.put('/reviews/:id/status', (req, res) => {
  try {
    const { status } = req.body; // 'approved' | 'hidden' | 'flagged'
    if (!['approved', 'hidden', 'flagged'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }
    db.prepare('UPDATE reviews SET status = ? WHERE id = ?').run(status, req.params.id);
    return res.json({ success: true, message: `Review status updated to "${status}".` });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to update review status' });
  }
});

router.delete('/reviews/:id', (req, res) => {
  try {
    const review = db.prepare('SELECT shop_id FROM reviews WHERE id = ?').get(req.params.id);
    if (!review) return res.status(404).json({ success: false, error: 'Review not found' });

    db.prepare('DELETE FROM reviews WHERE id = ?').run(req.params.id);

    // Recalculate average rating for shop
    const avgRow = db.prepare('SELECT AVG(rating) as avg, COUNT(*) as count FROM reviews WHERE shop_id = ? AND status = "approved"').get(review.shop_id);
    const newAvg = avgRow && avgRow.count > 0 ? Number(avgRow.avg.toFixed(1)) : 4.8;
    const newCount = avgRow ? avgRow.count : 0;
    db.prepare('UPDATE shops SET rating_avg = ?, rating_count = ? WHERE id = ?').run(newAvg, newCount, review.shop_id);

    return res.json({ success: true, message: 'Review deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to delete review' });
  }
});

router.get('/review-reports', (req, res) => {
  try {
    const reports = db.prepare(`
      SELECT rr.*, r.comment AS review_comment, r.rating, r.shop_id,
             u.full_name AS reporter_name, s.name AS shop_name
      FROM review_reports rr
      JOIN reviews r ON rr.review_id = r.id
      LEFT JOIN users u ON rr.reporter_user_id = u.id
      JOIN shops s ON r.shop_id = s.id
      ORDER BY rr.created_at DESC
    `).all();
    return res.json({ success: true, reports });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch review reports' });
  }
});

router.put('/review-reports/:id/dismiss', (req, res) => {
  try {
    db.prepare("UPDATE review_reports SET status = 'dismissed' WHERE id = ?").run(req.params.id);
    return res.json({ success: true, message: 'Report dismissed' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to dismiss report' });
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

    // Server-side crypto-generated temporary password (never admin-chosen, never
    // logged). Stored only as a bcrypt hash; forces a change on next merchant login.
    const newTempPassword = generateStrongPassword(16);
    const passwordHash = bcrypt.hashSync(newTempPassword, 10);

    db.prepare('UPDATE shops SET password_hash = ?, must_change_password = 1 WHERE id = ?').run(passwordHash, shop.id);

    // Audit Log (never records the password)
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
        ownerName: shop.owner_name,
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

// ============================================================================
// CENTRALIZED ADMIN DASHBOARD MODULES (15 MODULES INTEGRATION)
// ============================================================================

// ----------------------------------------------------------------------------
// MODULE 1: CENTRALIZED DASHBOARD OVERVIEW & GLOBAL SEARCH
// ----------------------------------------------------------------------------

router.get('/dashboard-stats', (req, res) => {
  try {
    const { range, startDate, endDate } = req.query;
    const { clause: userDateClause, params: userDateParams } = getDateRangeClause(range, startDate, endDate, 'created_at');
    const { clause: shopDateClause, params: shopDateParams } = getDateRangeClause(range, startDate, endDate, 'created_at');
    const { clause: orderDateClause, params: orderDateParams } = getDateRangeClause(range, startDate, endDate, 'created_at');
    const { clause: payDateClause, params: payDateParams } = getDateRangeClause(range, startDate, endDate, 'created_at');

    // Overview Metric Counts
    const totalCustomers = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
    const newCustomers = db.prepare(`SELECT COUNT(*) AS c FROM users WHERE ${userDateClause}`).get(...userDateParams).c;

    const totalMerchants = db.prepare('SELECT COUNT(*) AS c FROM shops').get().c;
    const approvedMerchants = db.prepare("SELECT COUNT(*) AS c FROM shops WHERE LOWER(verification_status) = 'approved'").get().c;
    const pendingMerchants = db.prepare("SELECT COUNT(*) AS c FROM shops WHERE LOWER(verification_status) = 'pending'").get().c;
    const rejectedMerchants = db.prepare("SELECT COUNT(*) AS c FROM shops WHERE LOWER(verification_status) = 'rejected'").get().c;
    const suspendedMerchants = db.prepare("SELECT COUNT(*) AS c FROM shops WHERE LOWER(status) = 'suspended'").get().c;

    const totalCoinsIssued = db.prepare("SELECT COALESCE(SUM(points), 0) AS s FROM point_ledger WHERE type IN ('earned', 'admin_adjustment') AND points > 0").get().s;
    const totalCoinsRedeemed = db.prepare("SELECT COALESCE(SUM(points_deducted), 0) AS s FROM redemptions").get().s;
    const outstandingLiability = db.prepare("SELECT COALESCE(SUM(balance), 0) AS s FROM wallets").get().s;

    const activeOffers = db.prepare("SELECT COUNT(*) AS c FROM offers WHERE LOWER(status) = 'active'").get().c;
    const totalOrders = db.prepare('SELECT COUNT(*) AS c FROM orders').get().c;
    const pendingOrders = db.prepare("SELECT COUNT(*) AS c FROM orders WHERE LOWER(status) = 'pending'").get().c;

    const totalBookings = db.prepare('SELECT COUNT(*) AS c FROM bookings').get().c;
    const pendingBookings = db.prepare("SELECT COUNT(*) AS c FROM bookings WHERE LOWER(status) = 'pending'").get().c;

    const totalPayments = db.prepare("SELECT COALESCE(SUM(amount), 0) AS s FROM payments WHERE LOWER(status) = 'successful'").get().s;
    const totalReferrals = db.prepare('SELECT COUNT(*) AS c FROM referrals').get().c;
    const activeMembers = db.prepare('SELECT COUNT(DISTINCT user_id) AS c FROM wallets WHERE balance > 0').get().c;
    const openComplaints = db.prepare("SELECT COUNT(*) AS c FROM complaints WHERE LOWER(status) IN ('open', 'in_progress', 'waiting_response', 'escalated')").get().c;
    const pendingFraudAlerts = db.prepare("SELECT COUNT(*) AS c FROM fraud_alerts WHERE status = 'pending_review'").get().c;

    // VP52 Sessions & AdMob & Merchant Wallet Metrics (Parts 1, 2, 6, 7, 10)
    const activeCustomerSessions = db.prepare("SELECT COUNT(*) AS c FROM vp52_coin_sessions WHERE status = 'active' AND datetime(expires_at) > datetime('now')").get().c;
    const totalSessionsStarted = db.prepare('SELECT COUNT(*) AS c FROM vp52_coin_sessions').get().c;
    const totalAdRequests = db.prepare("SELECT COUNT(*) AS c FROM ad_event_logs WHERE event_type = 'request'").get().c;
    const confirmedAdImpressions = db.prepare("SELECT COUNT(*) AS c FROM ad_event_logs WHERE event_type = 'impression'").get().c;
    const merchantCoinsReceived = db.prepare('SELECT COALESCE(SUM(total_received), 0) AS s FROM merchant_wallets').get().s;
    const merchantCoinsBalance = db.prepare('SELECT COALESCE(SUM(balance), 0) AS s FROM merchant_wallets').get().s;
    const totalQrRedemptions = db.prepare('SELECT COUNT(*) AS c FROM coin_transfers').get().c;
    const successfulTransactions = db.prepare("SELECT COUNT(*) AS c FROM coin_transfers WHERE status = 'COMPLETED'").get().c;
    const failedTransactions = db.prepare("SELECT COUNT(*) AS c FROM coin_redemption_requests WHERE status IN ('cancelled', 'expired')").get().c;

    // Charts Data
    const customerRegistrations = db.prepare(`
      SELECT date(created_at) AS date, COUNT(*) AS count
      FROM users
      WHERE datetime(created_at) >= datetime('now', '-30 days')
      GROUP BY date(created_at)
      ORDER BY date ASC
    `).all();

    const merchantRegistrations = db.prepare(`
      SELECT date(created_at) AS date, COUNT(*) AS count
      FROM shops
      WHERE datetime(created_at) >= datetime('now', '-30 days')
      GROUP BY date(created_at)
      ORDER BY date ASC
    `).all();

    const coinIssuanceTrend = db.prepare(`
      SELECT date(created_at) AS date, SUM(points) AS issued
      FROM point_ledger
      WHERE type IN ('earned', 'admin_adjustment') AND points > 0 AND datetime(created_at) >= datetime('now', '-14 days')
      GROUP BY date(created_at)
      ORDER BY date ASC
    `).all();

    const coinRedemptionTrend = db.prepare(`
      SELECT date(created_at) AS date, SUM(points_deducted) AS redeemed
      FROM redemptions
      WHERE datetime(created_at) >= datetime('now', '-14 days')
      GROUP BY date(created_at)
      ORDER BY date ASC
    `).all();

    const orderTrends = db.prepare(`
      SELECT date(created_at) AS date, COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS total
      FROM orders
      WHERE datetime(created_at) >= datetime('now', '-14 days')
      GROUP BY date(created_at)
      ORDER BY date ASC
    `).all();

    const categoryDistribution = db.prepare(`
      SELECT category, COUNT(*) AS count
      FROM shops
      GROUP BY category
      ORDER BY count DESC
    `).all();

    return res.json({
      success: true,
      stats: {
        totalCustomers,
        newCustomers,
        totalMerchants,
        approvedMerchants,
        pendingMerchants,
        rejectedMerchants,
        suspendedMerchants,
        totalCoinsIssued,
        totalCoinsRedeemed,
        outstandingLiability,
        activeOffers,
        totalOrders,
        pendingOrders,
        totalBookings,
        pendingBookings,
        totalPayments,
        totalReferrals,
        activeMembers,
        openComplaints,
        pendingFraudAlerts,
        activeCustomerSessions,
        totalSessionsStarted,
        totalAdRequests,
        confirmedAdImpressions,
        merchantCoinsReceived,
        merchantCoinsBalance,
        totalQrRedemptions,
        successfulTransactions,
        failedTransactions
      },
      charts: {
        customerRegistrations,
        merchantRegistrations,
        coinIssuanceTrend,
        coinRedemptionTrend,
        orderTrends,
        categoryDistribution
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return res.status(500).json({ success: false, error: 'Failed to compute dashboard stats' });
  }
});

router.get('/global-search', (req, res) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim() || q.trim().length < 2) {
      return res.json({ success: true, results: { customers: [], merchants: [], orders: [], complaints: [] } });
    }
    const term = `%${q.trim()}%`;
    const customers = db.prepare(`
      SELECT id, full_name, email, phone, status
      FROM users
      WHERE full_name LIKE ? OR email LIKE ? OR phone LIKE ?
      LIMIT 5
    `).all(term, term, term);

    const merchants = db.prepare(`
      SELECT id, name, shop_code, category, verification_status, phone, address
      FROM shops
      WHERE name LIKE ? OR shop_code LIKE ? OR phone LIKE ?
      LIMIT 5
    `).all(term, term, term);

    const orders = db.prepare(`
      SELECT id, order_number, customer_name, status, total_amount
      FROM orders
      WHERE order_number LIKE ? OR customer_name LIKE ?
      LIMIT 5
    `).all(term, term);

    const complaints = db.prepare(`
      SELECT id, ticket_id, category, status, priority, description
      FROM complaints
      WHERE ticket_id LIKE ? OR description LIKE ?
      LIMIT 5
    `).all(term, term);

    return res.json({
      success: true,
      results: { customers, merchants, orders, complaints }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------------------------------
// MODULE 2: CUSTOMER MANAGEMENT ADDITIONS (AUDITED COIN ADJUSTMENT)
// ----------------------------------------------------------------------------

router.post('/customers/:id/coin-adjustment', requirePermission('coins:adjust'), (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { amount, reason } = req.body;
    const numAmount = Number(amount);

    if (!userId || !numAmount || !Number.isInteger(numAmount)) {
      return res.status(400).json({ success: false, error: 'Valid customer ID and non-zero integer coin amount are required' });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, error: 'Adjustment reason is required for compliance audit' });
    }

    const customer = db.prepare('SELECT id, full_name, email FROM users WHERE id = ?').get(userId);
    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });

    let wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(userId);
    if (!wallet) {
      db.prepare('INSERT INTO wallets (user_id, balance, total_earned, total_redeemed) VALUES (?, 0, 0, 0)').run(userId);
      wallet = { balance: 0, total_earned: 0, total_redeemed: 0 };
    }

    if (numAmount < 0 && wallet.balance + numAmount < 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot deduct ${Math.abs(numAmount)} coins. Customer only has ${wallet.balance} available coins.`
      });
    }

    const prevBalance = wallet.balance;
    const newBalance = prevBalance + numAmount;
    const adminId = req.user.id;
    const txId = 'ADJ-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7).toUpperCase();

    const adjustTx = db.transaction(() => {
      if (numAmount > 0) {
        db.prepare('UPDATE wallets SET balance = balance + ?, total_earned = total_earned + ? WHERE user_id = ?')
          .run(numAmount, numAmount, userId);
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        db.prepare(`
          INSERT INTO coin_lots (user_id, transaction_id, source, coins_earned, coins_remaining, original_amount, expires_at, status, tier)
          VALUES (?, ?, 'ADMIN_ADJUSTMENT', ?, ?, ?, ?, 'ACTIVE', 'Bronze')
        `).run(userId, txId, numAmount, numAmount, numAmount, expiresAt);
      } else {
        db.prepare('UPDATE wallets SET balance = balance + ?, total_redeemed = total_redeemed + ? WHERE user_id = ?')
          .run(numAmount, Math.abs(numAmount), userId);
        let remToDeduct = Math.abs(numAmount);
        const activeLots = db.prepare("SELECT * FROM coin_lots WHERE user_id = ? AND status = 'ACTIVE' ORDER BY expires_at ASC").all(userId);
        for (const lot of activeLots) {
          if (remToDeduct <= 0) break;
          const take = Math.min(lot.coins_remaining, remToDeduct);
          const remaining = lot.coins_remaining - take;
          db.prepare('UPDATE coin_lots SET coins_remaining = ?, status = ? WHERE id = ?')
            .run(remaining, remaining === 0 ? 'USED' : 'ACTIVE', lot.id);
          remToDeduct -= take;
        }
      }

      db.prepare(`
        INSERT INTO point_ledger (user_id, transaction_id, type, points, previous_balance, new_balance, reason, authorized_admin_id, source)
        VALUES (?, ?, 'admin_adjustment', ?, ?, ?, ?, ?, 'admin')
      `).run(userId, txId, numAmount, prevBalance, newBalance, reason.trim(), adminId);
    });

    adjustTx();

    recordAdminActivity(adminId, 'coin_adjustment', 'VP52 Coin Management', userId, req, {
      oldValue: { balance: prevBalance },
      newValue: { balance: newBalance, amount: numAmount },
      reason: reason.trim()
    });

    return res.json({
      success: true,
      message: `Successfully adjusted ${numAmount > 0 ? '+' : ''}${numAmount} coins for ${customer.full_name}. New balance: ${newBalance}.`,
      transaction_id: txId,
      new_balance: newBalance
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------------------------------
// MODULE 3: MERCHANT MANAGEMENT ADDITIONS
// ----------------------------------------------------------------------------

router.put('/shops/:id/reactivate', requirePermission('merchants:manage'), (req, res) => {
  try {
    const shopId = req.params.id;
    const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(shopId);
    if (!shop) return res.status(404).json({ success: false, error: 'Shop not found' });

    db.prepare("UPDATE shops SET status = 'active', verification_status = 'approved' WHERE id = ?").run(shopId);

    recordAdminActivity(req.user.id, 'reactivate_shop', 'Merchant Management', shopId, req, {
      oldValue: { status: shop.status, verification_status: shop.verification_status },
      newValue: { status: 'active', verification_status: 'approved' }
    });

    return res.json({ success: true, message: `Shop "${shop.name}" has been reactivated.` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Permanent Merchant QR Management
router.get('/merchants/qr', requirePermission('merchants:manage'), (req, res) => {
  try {
    const { status, search } = req.query;
    let whereClauses = ['1=1'];
    let params = [];

    if (status && status !== 'all') {
      whereClauses.push('s.qr_status = ?');
      params.push(status);
    }

    if (search && search.trim()) {
      whereClauses.push('(s.name LIKE ? OR s.shop_code LIKE ? OR s.permanent_qr_code LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    const whereSql = whereClauses.join(' AND ');
    const merchants = db.prepare(`
      SELECT s.id, s.shop_code, s.name, s.category, s.phone, s.owner_name,
             s.permanent_qr_code, s.qr_status, s.qr_generated_at, s.status, s.verification_status,
             COALESCE(mw.balance, 0) AS coin_balance,
             COALESCE(mw.total_received, 0) AS total_received
      FROM shops s
      LEFT JOIN merchant_wallets mw ON s.id = mw.shop_id
      WHERE ${whereSql}
      ORDER BY s.id DESC
    `).all(...params);

    return res.json({ success: true, merchants });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Update Permanent Merchant QR Status (active, suspended, revoked)
router.post('/merchants/:id/qr/status', requirePermission('merchants:manage'), (req, res) => {
  try {
    const shopId = req.params.id;
    const { status, reason } = req.body;

    if (!['active', 'suspended', 'revoked'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Status must be active, suspended, or revoked.' });
    }

    const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(shopId);
    if (!shop) return res.status(404).json({ success: false, error: 'Merchant not found.' });

    const revokedAt = status === 'revoked' ? new Date().toISOString() : null;
    db.prepare('UPDATE shops SET qr_status = ?, qr_revoked_at = ? WHERE id = ?').run(status, revokedAt, shopId);

    recordAdminActivity(req.user.id, `qr_${status}`, 'Merchant QR Management', shopId, req, {
      oldValue: { qr_status: shop.qr_status, permanent_qr_code: shop.permanent_qr_code },
      newValue: { qr_status: status },
      reason: reason || `Admin updated QR status to ${status}`
    });

    return res.json({
      success: true,
      message: `Merchant QR code status updated to ${status}.`,
      shop_id: shopId,
      qr_status: status
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Regenerate Permanent Merchant QR Code (Audited process; historical records preserved)
router.post('/merchants/:id/qr/regenerate', requirePermission('merchants:manage'), (req, res) => {
  try {
    const shopId = req.params.id;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, error: 'An audited reason is required to regenerate a merchant permanent QR.' });
    }

    const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(shopId);
    if (!shop) return res.status(404).json({ success: false, error: 'Merchant not found.' });

    const oldQr = shop.permanent_qr_code;
    const newQr = 'VP52-MCH-' + crypto.randomBytes(10).toString('hex').toUpperCase();

    if (oldQr) {
      db.prepare('INSERT OR IGNORE INTO merchant_revoked_qr_codes (shop_id, qr_code, reason) VALUES (?, ?, ?)').run(shopId, oldQr, reason.trim());
    }

    db.prepare(`
      UPDATE shops
      SET permanent_qr_code = ?, qr_status = 'active', qr_generated_at = datetime('now'), qr_revoked_at = NULL
      WHERE id = ?
    `).run(newQr, shopId);

    recordAdminActivity(req.user.id, 'regenerate_merchant_qr', 'Merchant QR Management', shopId, req, {
      oldValue: { permanent_qr_code: oldQr, qr_status: shop.qr_status },
      newValue: { permanent_qr_code: newQr, qr_status: 'active' },
      reason: reason.trim()
    });

    return res.json({
      success: true,
      message: `Successfully generated new permanent QR code for ${shop.name}. Historical transactions remain untouched.`,
      permanent_qr_code: newQr,
      qr_string: `VP52:MERCHANT:${newQr}`
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------------------------------
// MODULE 4: CATEGORY MANAGEMENT (ALL 17 CATEGORIES & 256 SUBCATEGORIES)
// ----------------------------------------------------------------------------

router.post('/categories', requirePermission('categories:manage'), (req, res) => {
  try {
    const { id, name, icon, catalog_type, color, description, display_order, subcategories } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Category name is required' });
    }
    const catId = (id && id.trim())
      ? id.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
      : name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const existing = db.prepare('SELECT id FROM categories WHERE id = ? OR LOWER(name) = ?').get(catId, name.trim().toLowerCase());
    if (existing) {
      return res.status(400).json({ success: false, error: 'Category with this name or ID already exists' });
    }

    const maxOrder = db.prepare('SELECT COALESCE(MAX(display_order), 0) AS mo FROM categories').get().mo;
    const order = display_order !== undefined ? Number(display_order) : maxOrder + 1;

    db.transaction(() => {
      db.prepare(`
        INSERT INTO categories (id, name, icon, catalog_type, color, description, is_active, display_order)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?)
      `).run(catId, name.trim(), icon || 'Store', catalog_type || 'product', color || '#D4AF37', description || '', order);

      if (Array.isArray(subcategories)) {
        const insertSub = db.prepare('INSERT INTO subcategories (category_id, name, is_active, display_order) VALUES (?, ?, 1, ?)');
        subcategories.forEach((s, idx) => {
          if (s && String(s).trim()) {
            insertSub.run(catId, String(s).trim(), idx);
          }
        });
      }
    })();

    recordAdminActivity(req.user.id, 'create_category', 'Category Management', catId, req, {
      newValue: { id: catId, name: name.trim(), subcategories }
    });

    return res.status(201).json({ success: true, message: 'Category created successfully', categoryId: catId });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/categories/:id', requirePermission('categories:manage'), (req, res) => {
  try {
    const catId = req.params.id;
    const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(catId);
    if (!cat) return res.status(404).json({ success: false, error: 'Category not found' });

    const { name, icon, catalog_type, color, description, is_active, display_order } = req.body;
    const newName = (name && name.trim()) ? name.trim() : cat.name;

    db.transaction(() => {
      db.prepare(`
        UPDATE categories
        SET name = ?, icon = COALESCE(?, icon), catalog_type = COALESCE(?, catalog_type),
            color = COALESCE(?, color), description = COALESCE(?, description),
            is_active = COALESCE(?, is_active), display_order = COALESCE(?, display_order)
        WHERE id = ?
      `).run(newName, icon || null, catalog_type || null, color || null, description || null, is_active !== undefined ? Number(is_active) : null, display_order !== undefined ? Number(display_order) : null, catId);

      // If category name changed, safely update assigned shops
      if (newName !== cat.name) {
        db.prepare('UPDATE shops SET category = ? WHERE LOWER(category) = ?').run(newName, cat.name.toLowerCase());
      }
    })();

    recordAdminActivity(req.user.id, 'update_category', 'Category Management', catId, req, {
      oldValue: cat,
      newValue: { name: newName, icon, is_active }
    });

    return res.json({ success: true, message: `Category "${newName}" updated successfully.` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/categories/:id', requirePermission('categories:manage'), (req, res) => {
  try {
    const catId = req.params.id;
    const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(catId);
    if (!cat) return res.status(404).json({ success: false, error: 'Category not found' });

    const assignedShops = db.prepare('SELECT COUNT(*) AS c FROM shops WHERE LOWER(category) = ?').get(cat.name.toLowerCase()).c;
    const { target_category_id } = req.body || {};

    if (assignedShops > 0) {
      if (!target_category_id) {
        return res.status(400).json({
          success: false,
          error: `Cannot delete category "${cat.name}" because ${assignedShops} merchant(s) are assigned to it. Please reassign merchants or specify target_category_id.`
        });
      }
      const targetCat = db.prepare('SELECT * FROM categories WHERE id = ?').get(target_category_id);
      if (!targetCat) {
        return res.status(400).json({ success: false, error: 'Target category for reassignment was not found' });
      }
      db.prepare('UPDATE shops SET category = ? WHERE LOWER(category) = ?').run(targetCat.name, cat.name.toLowerCase());
    }

    db.transaction(() => {
      db.prepare('DELETE FROM subcategories WHERE category_id = ?').run(catId);
      db.prepare('DELETE FROM categories WHERE id = ?').run(catId);
    })();

    recordAdminActivity(req.user.id, 'delete_category', 'Category Management', catId, req, {
      oldValue: cat,
      reason: `Reassigned ${assignedShops} shops to target`
    });

    return res.json({ success: true, message: `Category "${cat.name}" deleted successfully.` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/categories/:id/subcategories', requirePermission('categories:manage'), (req, res) => {
  try {
    const catId = req.params.id;
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, error: 'Subcategory name is required' });

    const cat = db.prepare('SELECT id FROM categories WHERE id = ?').get(catId);
    if (!cat) return res.status(404).json({ success: false, error: 'Category not found' });

    const maxOrder = db.prepare('SELECT COALESCE(MAX(display_order), 0) AS mo FROM subcategories WHERE category_id = ?').get(catId).mo;
    const result = db.prepare('INSERT INTO subcategories (category_id, name, is_active, display_order) VALUES (?, ?, 1, ?)')
      .run(catId, name.trim(), maxOrder + 1);

    recordAdminActivity(req.user.id, 'create_subcategory', 'Category Management', result.lastInsertRowid, req, {
      newValue: { category_id: catId, name: name.trim() }
    });

    return res.status(201).json({ success: true, message: 'Subcategory created', id: result.lastInsertRowid });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/subcategories/:subId', requirePermission('categories:manage'), (req, res) => {
  try {
    const subId = req.params.subId;
    const sub = db.prepare('SELECT * FROM subcategories WHERE id = ?').get(subId);
    if (!sub) return res.status(404).json({ success: false, error: 'Subcategory not found' });

    const assignedShops = db.prepare('SELECT COUNT(*) AS c FROM shops WHERE LOWER(subcategory) = ?').get(sub.name.toLowerCase()).c;
    if (assignedShops > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete subcategory "${sub.name}" because ${assignedShops} merchant(s) currently use it.`
      });
    }

    db.prepare('DELETE FROM subcategories WHERE id = ?').run(subId);
    recordAdminActivity(req.user.id, 'delete_subcategory', 'Category Management', subId, req, { oldValue: sub });
    return res.json({ success: true, message: 'Subcategory deleted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------------------------------
// MODULE 5: VP52 COIN MANAGEMENT & AUDITABLE TRANSACTION LEDGER
// ----------------------------------------------------------------------------

router.get('/coins/overview', requirePermission('coins:view'), (req, res) => {
  try {
    const issued = db.prepare("SELECT COALESCE(SUM(points), 0) AS total FROM point_ledger WHERE type IN ('earned', 'admin_adjustment') AND points > 0").get().total;
    const redeemed = db.prepare("SELECT COALESCE(SUM(points_deducted), 0) AS total FROM redemptions").get().total;
    const outstanding = db.prepare("SELECT COALESCE(SUM(balance), 0) AS total FROM wallets").get().total;
    const expired = db.prepare("SELECT COALESCE(SUM(coins_earned - coins_remaining), 0) AS total FROM coin_lots WHERE status = 'EXPIRED'").get().total;
    const activeLots = db.prepare("SELECT COUNT(*) AS total FROM coin_lots WHERE status = 'ACTIVE'").get().total;
    const totalSessions = db.prepare("SELECT COUNT(*) AS total FROM vp52_coin_sessions").get().total;

    return res.json({
      success: true,
      overview: {
        total_issued: issued,
        total_redeemed: redeemed,
        outstanding_liability: outstanding,
        total_expired: expired,
        active_lots_count: activeLots,
        total_sessions: totalSessions
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/coins/ledger', requirePermission('coins:view'), (req, res) => {
  try {
    const { type, search, range, startDate, endDate, limit = 100, offset = 0 } = req.query;
    let query = `
      SELECT pl.*, u.full_name AS customer_name, u.email AS customer_email, u.phone AS customer_phone,
             s.name AS merchant_name, s.shop_code AS merchant_shop_code,
             adm.full_name AS admin_authorizer_name
      FROM point_ledger pl
      LEFT JOIN users u ON pl.user_id = u.id
      LEFT JOIN shops s ON pl.merchant_id = s.id
      LEFT JOIN admins adm ON pl.authorized_admin_id = adm.id
      WHERE 1=1
    `;
    const params = [];

    if (type && type !== 'all') {
      query += ' AND pl.type = ?';
      params.push(type);
    }
    if (search && search.trim()) {
      query += ' AND (u.full_name LIKE ? OR u.email LIKE ? OR s.name LIKE ? OR pl.reason LIKE ?)';
      const sTerm = `%${search.trim()}%`;
      params.push(sTerm, sTerm, sTerm, sTerm);
    }
    if (range) {
      const { clause, params: rParams } = getDateRangeClause(range, startDate, endDate, 'pl.created_at');
      query += ` AND ${clause}`;
      params.push(...rParams);
    }

    query += ' ORDER BY pl.created_at DESC, pl.id DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const ledger = db.prepare(query).all(...params);
    return res.json({ success: true, ledger });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/coins/reversal', requirePermission('coins:adjust'), (req, res) => {
  try {
    const { transaction_id, reason } = req.body;
    if (!transaction_id || !reason || !reason.trim()) {
      return res.status(400).json({ success: false, error: 'Transaction ID and reversal reason are required' });
    }

    const orig = db.prepare('SELECT * FROM point_ledger WHERE transaction_id = ?').get(transaction_id);
    if (!orig) return res.status(404).json({ success: false, error: 'Original transaction not found' });

    const reversePoints = -orig.points;
    const wallet = db.prepare('SELECT balance FROM wallets WHERE user_id = ?').get(orig.user_id);
    if (!wallet) return res.status(400).json({ success: false, error: 'Customer wallet not found' });

    if (reversePoints < 0 && wallet.balance + reversePoints < 0) {
      return res.status(400).json({ success: false, error: 'Cannot reverse: customer coin balance is insufficient' });
    }

    const prevBal = wallet.balance;
    const newBal = prevBal + reversePoints;
    const revTxId = 'REV-' + Date.now();

    db.transaction(() => {
      db.prepare('UPDATE wallets SET balance = balance + ? WHERE user_id = ?').run(reversePoints, orig.user_id);
      db.prepare(`
        INSERT INTO point_ledger (user_id, transaction_id, type, points, previous_balance, new_balance, reason, authorized_admin_id, source, reference_id)
        VALUES (?, ?, 'reversal', ?, ?, ?, ?, ?, 'admin', ?)
      `).run(orig.user_id, revTxId, reversePoints, prevBal, newBal, reason.trim(), req.user.id, transaction_id);
    })();

    recordAdminActivity(req.user.id, 'coin_reversal', 'VP52 Coin Management', orig.user_id, req, {
      oldValue: orig,
      newValue: { reversePoints, newBal },
      reason: reason.trim()
    });

    return res.json({ success: true, message: 'Transaction reversed successfully', reversal_transaction_id: revTxId });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/coins/sessions', requirePermission('coins:view'), (req, res) => {
  try {
    const sessions = db.prepare(`
      SELECT s.*, u.full_name AS customer_name, u.email AS customer_email
      FROM vp52_coin_sessions s
      JOIN users u ON s.user_id = u.id
      ORDER BY s.session_start DESC
      LIMIT 100
    `).all();
    return res.json({ success: true, sessions });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/coins/lots', requirePermission('coins:view'), (req, res) => {
  try {
    const lots = db.prepare(`
      SELECT l.*, u.full_name AS customer_name, u.email AS customer_email
      FROM coin_lots l
      JOIN users u ON l.user_id = u.id
      ORDER BY l.id DESC
      LIMIT 100
    `).all();
    return res.json({ success: true, lots });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/coins/redemptions', requirePermission('coins:view'), (req, res) => {
  try {
    const redemptions = db.prepare(`
      SELECT r.*, u.full_name AS customer_name, u.email AS customer_email, s.name AS shop_name, o.title AS offer_title
      FROM redemptions r
      JOIN users u ON r.user_id = u.id
      JOIN shops s ON r.shop_id = s.id
      LEFT JOIN offers o ON r.offer_id = o.id
      ORDER BY r.created_at DESC
      LIMIT 100
    `).all();
    return res.json({ success: true, redemptions });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Customer-to-Merchant Coin Transfers (With search, merchant filter, customer filter, date filter)
router.get('/coins/transfers', requirePermission('coins:view'), (req, res) => {
  try {
    const { merchant_id, customer_id, search, status, start_date, end_date, limit = 100 } = req.query;
    let whereClauses = ['1=1'];
    let params = [];

    if (merchant_id) {
      whereClauses.push('ct.merchant_id = ?');
      params.push(merchant_id);
    }
    if (customer_id) {
      whereClauses.push('ct.customer_id = ?');
      params.push(customer_id);
    }
    if (status && status !== 'all') {
      whereClauses.push('ct.status = ?');
      params.push(status);
    }
    if (start_date) {
      whereClauses.push('date(ct.created_at) >= date(?)');
      params.push(start_date);
    }
    if (end_date) {
      whereClauses.push('date(ct.created_at) <= date(?)');
      params.push(end_date);
    }
    if (search && search.trim()) {
      whereClauses.push('(s.name LIKE ? OR s.shop_code LIKE ? OR u.full_name LIKE ? OR u.phone LIKE ? OR ct.transfer_id LIKE ? OR ct.merchant_qr_code LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term, term, term);
    }

    const whereSql = whereClauses.join(' AND ');
    const transfers = db.prepare(`
      SELECT ct.*, u.full_name AS customer_name, u.phone AS customer_phone,
             s.name AS merchant_name, s.shop_code AS merchant_code, s.category AS merchant_category,
             s.permanent_qr_code
      FROM coin_transfers ct
      JOIN users u ON ct.customer_id = u.id
      JOIN shops s ON ct.merchant_id = s.id
      WHERE ${whereSql}
      ORDER BY ct.created_at DESC
      LIMIT ?
    `).all(...params, parseInt(limit, 10) || 100);

    const totals = db.prepare(`
      SELECT COUNT(*) AS total_count, COALESCE(SUM(coins_amount), 0) AS total_coins, COALESCE(SUM(discount_inr), 0) AS total_discount
      FROM coin_transfers
      WHERE status = 'COMPLETED'
    `).get();

    return res.json({ success: true, transfers, totals });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Merchant Coin Wallets (Part 6 & 10)
router.get('/coins/merchant-wallets', requirePermission('coins:view'), (req, res) => {
  try {
    const wallets = db.prepare(`
      SELECT mw.*, s.name AS shop_name, s.shop_code, s.category, s.phone, s.owner_name
      FROM merchant_wallets mw
      JOIN shops s ON mw.shop_id = s.id
      ORDER BY mw.balance DESC
      LIMIT 100
    `).all();

    const summary = db.prepare(`
      SELECT COALESCE(SUM(balance), 0) AS total_balance,
             COALESCE(SUM(total_received), 0) AS total_received,
             COALESCE(SUM(total_spent), 0) AS total_spent
      FROM merchant_wallets
    `).get();

    return res.json({ success: true, wallets, summary });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/coins/export', requirePermission('coins:view'), (req, res) => {
  try {
    const ledger = db.prepare(`
      SELECT pl.id, pl.transaction_id, pl.type, pl.points, pl.previous_balance, pl.new_balance,
             pl.reason, pl.created_at, u.full_name AS customer_name, u.email AS customer_email,
             s.name AS merchant_name, adm.full_name AS authorized_by
      FROM point_ledger pl
      LEFT JOIN users u ON pl.user_id = u.id
      LEFT JOIN shops s ON pl.merchant_id = s.id
      LEFT JOIN admins adm ON pl.authorized_admin_id = adm.id
      ORDER BY pl.id DESC
    `).all();

    const csv = toCSV(ledger, [
      { header: 'ID', key: 'id' },
      { header: 'Transaction ID', key: 'transaction_id' },
      { header: 'Timestamp', key: 'created_at' },
      { header: 'Customer', key: 'customer_name' },
      { header: 'Email', key: 'customer_email' },
      { header: 'Type', key: 'type' },
      { header: 'Coins', key: 'points' },
      { header: 'Prev Balance', key: 'previous_balance' },
      { header: 'New Balance', key: 'new_balance' },
      { header: 'Merchant', key: 'merchant_name' },
      { header: 'Authorized By', key: 'authorized_by' },
      { header: 'Reason', key: 'reason' }
    ]);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="vp52_coin_ledger_${Date.now()}.csv"`);
    return res.send(csv);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------------------------------
// MODULE 6: OFFERS MANAGEMENT ADDITIONS
// ----------------------------------------------------------------------------

router.put('/offers/:id/toggle', requirePermission('offers:manage'), (req, res) => {
  try {
    const offer = db.prepare('SELECT * FROM offers WHERE id = ?').get(req.params.id);
    if (!offer) return res.status(404).json({ success: false, error: 'Offer not found' });

    const newStatus = offer.status === 'active' ? 'inactive' : 'active';
    db.prepare('UPDATE offers SET status = ? WHERE id = ?').run(newStatus, offer.id);

    recordAdminActivity(req.user.id, 'toggle_offer_status', 'Offers Management', offer.id, req, {
      oldValue: { status: offer.status },
      newValue: { status: newStatus }
    });

    return res.json({ success: true, message: `Offer is now ${newStatus}.`, status: newStatus });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------------------------------
// MODULE 7: ORDER & BOOKING MANAGEMENT
// ----------------------------------------------------------------------------

router.get('/orders', requirePermission('orders:view'), (req, res) => {
  try {
    const { status, search, range, startDate, endDate, limit = 50, offset = 0 } = req.query;
    let query = `
      SELECT o.*, u.full_name AS customer_full_name, u.email AS customer_email,
             s.name AS shop_name, s.shop_code, s.category AS shop_category
      FROM orders o
      JOIN users u ON o.user_id = u.id
      JOIN shops s ON o.shop_id = s.id
      WHERE 1=1
    `;
    const params = [];
    if (status && status !== 'all') {
      query += ' AND LOWER(o.status) = ?';
      params.push(status.toLowerCase());
    }
    if (search && search.trim()) {
      query += ' AND (o.order_number LIKE ? OR o.customer_name LIKE ? OR s.name LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }
    if (range) {
      const { clause, params: rParams } = getDateRangeClause(range, startDate, endDate, 'o.created_at');
      query += ` AND ${clause}`;
      params.push(...rParams);
    }
    query += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const orders = db.prepare(query).all(...params);
    return res.json({ success: true, orders });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/orders/:id', requirePermission('orders:view'), (req, res) => {
  try {
    const order = db.prepare(`
      SELECT o.*, u.full_name AS customer_full_name, u.email AS customer_email,
             s.name AS shop_name, s.phone AS shop_phone, s.address AS shop_address
      FROM orders o
      JOIN users u ON o.user_id = u.id
      JOIN shops s ON o.shop_id = s.id
      WHERE o.id = ?
    `).get(req.params.id);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    return res.json({ success: true, order: { ...order, items } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/orders/:id/status', requirePermission('orders:manage'), (req, res) => {
  try {
    const { status, cancellation_reason, notes } = req.body;
    const validStatuses = ['Pending', 'Accepted', 'Preparing', 'Ready', 'Dispatched', 'Delivered', 'Cancelled'];
    const match = validStatuses.find(s => s.toLowerCase() === (status || '').toLowerCase());
    if (!match) return res.status(400).json({ success: false, error: 'Invalid order status' });

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

    db.prepare(`
      UPDATE orders
      SET status = ?, cancellation_reason = COALESCE(?, cancellation_reason), order_notes = COALESCE(?, order_notes), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(match, cancellation_reason || null, notes || null, order.id);

    recordAdminActivity(req.user.id, 'update_order_status', 'Order & Booking Management', order.id, req, {
      oldValue: { status: order.status },
      newValue: { status: match, cancellation_reason, notes }
    });

    return res.json({ success: true, message: `Order status updated to ${match}.` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/bookings', requirePermission('orders:view'), (req, res) => {
  try {
    const { status, search, range, startDate, endDate, limit = 50, offset = 0 } = req.query;
    let query = `
      SELECT b.*, u.email AS customer_email, s.name AS shop_name, s.shop_code
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN shops s ON b.shop_id = s.id
      WHERE 1=1
    `;
    const params = [];
    if (status && status !== 'all') {
      query += ' AND LOWER(b.status) = ?';
      params.push(status.toLowerCase());
    }
    if (search && search.trim()) {
      query += ' AND (b.booking_number LIKE ? OR b.customer_name LIKE ? OR b.service_name LIKE ? OR s.name LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }
    if (range) {
      const { clause, params: rParams } = getDateRangeClause(range, startDate, endDate, 'b.created_at');
      query += ` AND ${clause}`;
      params.push(...rParams);
    }
    query += ' ORDER BY b.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const bookings = db.prepare(query).all(...params);
    return res.json({ success: true, bookings });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/bookings/:id/status', requirePermission('orders:manage'), (req, res) => {
  try {
    const { status, cancellation_reason, notes } = req.body;
    const valid = ['Pending', 'Confirmed', 'Completed', 'Cancelled', 'Rejected'];
    const match = valid.find(s => s.toLowerCase() === (status || '').toLowerCase());
    if (!match) return res.status(400).json({ success: false, error: 'Invalid booking status' });

    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    db.prepare(`
      UPDATE bookings
      SET status = ?, cancellation_reason = COALESCE(?, cancellation_reason), notes = COALESCE(?, notes), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(match, cancellation_reason || null, notes || null, booking.id);

    recordAdminActivity(req.user.id, 'update_booking_status', 'Order & Booking Management', booking.id, req, {
      oldValue: { status: booking.status },
      newValue: { status: match, cancellation_reason, notes }
    });

    return res.json({ success: true, message: `Booking status updated to ${match}.` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------------------------------
// MODULE 8: PAYMENT MANAGEMENT (ACTUAL TRANSACTION RECORDS)
// ----------------------------------------------------------------------------

router.get('/payments', requirePermission('payments:view'), (req, res) => {
  try {
    const { status, search, range, startDate, endDate, limit = 50, offset = 0 } = req.query;
    let query = `
      SELECT p.*, u.full_name AS customer_name, u.email AS customer_email, s.name AS shop_name, o.order_number
      FROM payments p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN shops s ON p.shop_id = s.id
      LEFT JOIN orders o ON p.order_id = o.id
      WHERE 1=1
    `;
    const params = [];
    if (status && status !== 'all') {
      query += ' AND LOWER(p.status) = ?';
      params.push(status.toLowerCase());
    }
    if (search && search.trim()) {
      query += ' AND (p.payment_reference LIKE ? OR u.full_name LIKE ? OR s.name LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }
    if (range) {
      const { clause, params: rParams } = getDateRangeClause(range, startDate, endDate, 'p.created_at');
      query += ` AND ${clause}`;
      params.push(...rParams);
    }
    query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const payments = db.prepare(query).all(...params);
    return res.json({ success: true, payments });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/payments/overview', requirePermission('payments:view'), (req, res) => {
  try {
    const totalRevenue = db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE LOWER(status) = 'successful'").get().total;
    const totalRefunds = db.prepare("SELECT COALESCE(SUM(refund_amount), 0) AS total FROM payments WHERE LOWER(status) IN ('refunded', 'partially refunded')").get().total;
    const successfulCount = db.prepare("SELECT COUNT(*) AS c FROM payments WHERE LOWER(status) = 'successful'").get().c;
    const failedCount = db.prepare("SELECT COUNT(*) AS c FROM payments WHERE LOWER(status) = 'failed'").get().c;

    return res.json({
      success: true,
      overview: {
        recorded_revenue: totalRevenue,
        total_refunds: totalRefunds,
        net_revenue: totalRevenue - totalRefunds,
        successful_transactions: successfulCount,
        failed_transactions: failedCount,
        merchant_subscriptions: 'FREE (₹0.00)'
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/payments/refund', requirePermission('payments:manage'), (req, res) => {
  try {
    const { payment_id, refund_amount, reason } = req.body;
    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(payment_id);
    if (!payment) return res.status(404).json({ success: false, error: 'Payment not found' });

    const refAmt = Number(refund_amount);
    if (!refAmt || refAmt <= 0 || refAmt > payment.amount) {
      return res.status(400).json({ success: false, error: 'Invalid refund amount. Must be <= original payment amount.' });
    }

    const newStatus = refAmt === payment.amount ? 'Refunded' : 'Partially Refunded';
    db.prepare(`
      UPDATE payments
      SET status = ?, refund_amount = COALESCE(refund_amount, 0) + ?, notes = COALESCE(notes || ' | ', '') || ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newStatus, refAmt, `Refund processed: ₹${refAmt}. Reason: ${reason || 'Customer request'}`, payment.id);

    recordAdminActivity(req.user.id, 'process_refund', 'Payment Management', payment.id, req, {
      oldValue: { status: payment.status, refund_amount: payment.refund_amount },
      newValue: { status: newStatus, refund_amount: (payment.refund_amount || 0) + refAmt },
      reason
    });

    return res.json({ success: true, message: `Refund of ₹${refAmt} recorded. Status: ${newStatus}.` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/payments/export', requirePermission('payments:view'), (req, res) => {
  try {
    const payments = db.prepare(`
      SELECT p.id, p.payment_reference, p.amount, p.currency, p.payment_method, p.status, p.refund_amount, p.created_at,
             u.full_name AS customer_name, s.name AS shop_name, o.order_number
      FROM payments p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN shops s ON p.shop_id = s.id
      LEFT JOIN orders o ON p.order_id = o.id
      ORDER BY p.id DESC
    `).all();

    const csv = toCSV(payments, [
      { header: 'ID', key: 'id' },
      { header: 'Reference', key: 'payment_reference' },
      { header: 'Date', key: 'created_at' },
      { header: 'Customer', key: 'customer_name' },
      { header: 'Shop', key: 'shop_name' },
      { header: 'Order Number', key: 'order_number' },
      { header: 'Amount (INR)', key: 'amount' },
      { header: 'Method', key: 'payment_method' },
      { header: 'Status', key: 'status' },
      { header: 'Refunded (INR)', key: 'refund_amount' }
    ]);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="vp52_payments_${Date.now()}.csv"`);
    return res.send(csv);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------------------------------
// MODULE 9: REFERRAL MANAGEMENT & FRAUD PREVENTION
// ----------------------------------------------------------------------------

router.get('/referrals', requirePermission('referrals:view'), (req, res) => {
  try {
    const { status, search, range, startDate, endDate, limit = 50, offset = 0 } = req.query;
    let query = `
      SELECT r.*,
             ref.full_name AS referrer_name, ref.email AS referrer_email, ref.phone AS referrer_phone,
             rec.full_name AS referred_name, rec.email AS referred_email, rec.phone AS referred_phone
      FROM referrals r
      JOIN users ref ON r.referrer_user_id = ref.id
      JOIN users rec ON r.referred_user_id = rec.id
      WHERE 1=1
    `;
    const params = [];
    if (status && status !== 'all') {
      query += ' AND LOWER(r.status) = ?';
      params.push(status.toLowerCase());
    }
    if (search && search.trim()) {
      query += ' AND (r.referral_code LIKE ? OR ref.full_name LIKE ? OR rec.full_name LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }
    if (range) {
      const { clause, params: rParams } = getDateRangeClause(range, startDate, endDate, 'r.created_at');
      query += ` AND ${clause}`;
      params.push(...rParams);
    }
    query += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const referrals = db.prepare(query).all(...params);
    return res.json({ success: true, referrals });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/referrals/overview', requirePermission('referrals:view'), (req, res) => {
  try {
    const total = db.prepare('SELECT COUNT(*) AS c FROM referrals').get().c;
    const completed = db.prepare("SELECT COUNT(*) AS c FROM referrals WHERE status = 'completed'").get().c;
    const rewarded = db.prepare("SELECT COUNT(*) AS c FROM referrals WHERE status = 'rewarded'").get().c;
    const fraud = db.prepare("SELECT COUNT(*) AS c FROM referrals WHERE status = 'fraud_suspected'").get().c;
    const totalCoins = db.prepare('SELECT COALESCE(SUM(coins_awarded), 0) AS s FROM referrals').get().s;

    return res.json({
      success: true,
      overview: {
        total_referrals: total,
        completed_referrals: completed,
        rewarded_referrals: rewarded,
        fraud_suspected: fraud,
        total_coins_awarded: totalCoins
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/referrals/:id/status', requirePermission('referrals:manage'), (req, res) => {
  try {
    const { status, coins_to_award, admin_notes } = req.body;
    const valid = ['pending', 'completed', 'rewarded', 'rejected', 'fraud_suspected'];
    if (!valid.includes(status)) return res.status(400).json({ success: false, error: 'Invalid referral status' });

    const ref = db.prepare('SELECT * FROM referrals WHERE id = ?').get(req.params.id);
    if (!ref) return res.status(404).json({ success: false, error: 'Referral record not found' });

    let rewardTxId = ref.reward_transaction_id;
    let coins = ref.coins_awarded;

    if (status === 'rewarded' && ref.status !== 'rewarded' && coins_to_award && Number(coins_to_award) > 0) {
      coins = Number(coins_to_award);
      rewardTxId = 'REF-' + Date.now();
      const referrerWallet = db.prepare('SELECT balance FROM wallets WHERE user_id = ?').get(ref.referrer_user_id);
      const prevBal = referrerWallet ? referrerWallet.balance : 0;
      const newBal = prevBal + coins;

      db.transaction(() => {
        db.prepare('UPDATE wallets SET balance = balance + ?, total_earned = total_earned + ? WHERE user_id = ?')
          .run(coins, coins, ref.referrer_user_id);
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        db.prepare(`
          INSERT INTO coin_lots (user_id, transaction_id, source, coins_earned, coins_remaining, original_amount, expires_at, status, tier)
          VALUES (?, ?, 'REFERRAL_REWARD', ?, ?, ?, ?, 'ACTIVE', 'Bronze')
        `).run(ref.referrer_user_id, rewardTxId, coins, coins, coins, expiresAt);
        db.prepare(`
          INSERT INTO point_ledger (user_id, transaction_id, type, points, previous_balance, new_balance, reason, source, authorized_admin_id)
          VALUES (?, ?, 'earned', ?, ?, ?, ?, 'referral', ?)
        `).run(ref.referrer_user_id, rewardTxId, coins, prevBal, newBal, `Referral reward for code ${ref.referral_code}`, req.user.id);
      })();
    }

    db.prepare(`
      UPDATE referrals
      SET status = ?, coins_awarded = ?, reward_transaction_id = ?, admin_notes = COALESCE(?, admin_notes), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, coins, rewardTxId, admin_notes || null, ref.id);

    recordAdminActivity(req.user.id, 'update_referral_status', 'Referral Management', ref.id, req, {
      oldValue: { status: ref.status },
      newValue: { status, coins_awarded: coins, admin_notes }
    });

    return res.json({ success: true, message: `Referral status updated to ${status}.` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/referrals/codes/:code/disable', requirePermission('referrals:manage'), (req, res) => {
  try {
    const code = req.params.code.trim();
    db.prepare("UPDATE referrals SET status = 'fraud_suspected', admin_notes = 'Referral code disabled due to fraud suspicion' WHERE referral_code = ?").run(code);

    recordAdminActivity(req.user.id, 'disable_referral_code', 'Referral Management', code, req, {
      reason: 'Flagged as fraudulent'
    });

    return res.json({ success: true, message: `Referral code "${code}" has been disabled.` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/referrals/export', requirePermission('referrals:view'), (req, res) => {
  try {
    const referrals = db.prepare(`
      SELECT r.id, r.referral_code, r.status, r.coins_awarded, r.created_at,
             ref.full_name AS referrer_name, rec.full_name AS referred_name
      FROM referrals r
      JOIN users ref ON r.referrer_user_id = ref.id
      JOIN users rec ON r.referred_user_id = rec.id
      ORDER BY r.id DESC
    `).all();

    const csv = toCSV(referrals, [
      { header: 'ID', key: 'id' },
      { header: 'Referral Code', key: 'referral_code' },
      { header: 'Status', key: 'status' },
      { header: 'Coins Awarded', key: 'coins_awarded' },
      { header: 'Referrer Name', key: 'referrer_name' },
      { header: 'Referred Name', key: 'referred_name' },
      { header: 'Date', key: 'created_at' }
    ]);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="vp52_referrals_${Date.now()}.csv"`);
    return res.send(csv);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------------------------------
// MODULE 10: MEMBERSHIP MANAGEMENT (FUTURE PLANS CONFIGURATION)
// ----------------------------------------------------------------------------

router.get('/memberships/plans', requirePermission('memberships:view'), (req, res) => {
  try {
    const plans = db.prepare('SELECT * FROM membership_plans ORDER BY id ASC').all();
    const formatted = plans.map(p => ({
      ...p,
      benefits: typeof p.benefits_json === 'string' ? JSON.parse(p.benefits_json || '[]') : []
    }));
    return res.json({ success: true, plans: formatted });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/memberships/plans', requirePermission('memberships:manage'), (req, res) => {
  try {
    const { name, slug, description, price, duration_days, benefits, target_role, is_active } = req.body;
    if (!name || !slug) return res.status(400).json({ success: false, error: 'Plan name and slug are required' });

    // Note commercial invariant: paid plans remain inactive for now
    const activeFlag = Number(price) > 0 ? 0 : (is_active ? 1 : 0);

    const result = db.prepare(`
      INSERT INTO membership_plans (name, slug, description, price, duration_days, benefits_json, is_active, target_role)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name.trim(),
      slug.trim().toLowerCase(),
      description || '',
      Number(price) || 0.0,
      Number(duration_days) || 365,
      JSON.stringify(Array.isArray(benefits) ? benefits : []),
      activeFlag,
      target_role || 'customer'
    );

    recordAdminActivity(req.user.id, 'create_membership_plan', 'Membership Management', result.lastInsertRowid, req, {
      newValue: { name, slug, price, is_active: activeFlag }
    });

    return res.status(201).json({ success: true, message: 'Membership plan created', planId: result.lastInsertRowid });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/memberships/plans/:id', requirePermission('memberships:manage'), (req, res) => {
  try {
    const plan = db.prepare('SELECT * FROM membership_plans WHERE id = ?').get(req.params.id);
    if (!plan) return res.status(404).json({ success: false, error: 'Membership plan not found' });

    const { name, description, price, duration_days, benefits, is_active } = req.body;
    const activeFlag = Number(price) > 0 ? 0 : (is_active !== undefined ? Number(is_active) : plan.is_active);

    db.prepare(`
      UPDATE membership_plans
      SET name = COALESCE(?, name), description = COALESCE(?, description), price = COALESCE(?, price),
          duration_days = COALESCE(?, duration_days), benefits_json = COALESCE(?, benefits_json),
          is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name || null,
      description || null,
      price !== undefined ? Number(price) : null,
      duration_days !== undefined ? Number(duration_days) : null,
      benefits ? JSON.stringify(benefits) : null,
      activeFlag,
      plan.id
    );

    recordAdminActivity(req.user.id, 'update_membership_plan', 'Membership Management', plan.id, req, {
      oldValue: plan,
      newValue: { name, price, is_active: activeFlag }
    });

    return res.json({ success: true, message: 'Membership plan updated successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/memberships/plans/:id/toggle', requirePermission('memberships:manage'), (req, res) => {
  try {
    const plan = db.prepare('SELECT * FROM membership_plans WHERE id = ?').get(req.params.id);
    if (!plan) return res.status(404).json({ success: false, error: 'Plan not found' });

    if (plan.price > 0 && !plan.is_active) {
      return res.status(400).json({
        success: false,
        error: 'Paid membership plans cannot be activated in this release. Merchant and customer accounts remain FREE.'
      });
    }

    const newActive = plan.is_active ? 0 : 1;
    db.prepare('UPDATE membership_plans SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newActive, plan.id);

    recordAdminActivity(req.user.id, 'toggle_plan_status', 'Membership Management', plan.id, req, {
      oldValue: { is_active: plan.is_active },
      newValue: { is_active: newActive }
    });

    return res.json({ success: true, message: `Plan is now ${newActive ? 'active' : 'inactive'}.` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/memberships/members', requirePermission('memberships:view'), (req, res) => {
  try {
    const members = db.prepare(`
      SELECT u.id, u.full_name, u.email, u.phone, u.status AS account_status,
             COALESCE(um.status, 'Free') AS membership_status,
             COALESCE(mp.name, 'Standard Free Member') AS plan_name,
             u.created_at AS member_since
      FROM users u
      LEFT JOIN user_memberships um ON u.id = um.user_id
      LEFT JOIN membership_plans mp ON um.plan_id = mp.id
      ORDER BY u.id DESC
      LIMIT 100
    `).all();
    return res.json({ success: true, members });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------------------------------
// MODULE 11: NOTIFICATION MANAGEMENT (BROADCAST SYSTEM)
// ----------------------------------------------------------------------------

router.get('/notifications', requirePermission('notifications:view'), (req, res) => {
  try {
    const notifications = db.prepare(`
      SELECT n.*, adm.full_name AS created_by_admin_name
      FROM notifications n
      LEFT JOIN admins adm ON n.created_by = adm.id
      ORDER BY n.created_at DESC
    `).all();
    return res.json({ success: true, notifications });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/notifications/send', requirePermission('notifications:send'), (req, res) => {
  try {
    const { title, message, target_audience, target_id, notification_type } = req.body;
    if (!title || !message) return res.status(400).json({ success: false, error: 'Notification title and message are required' });

    const validAudience = ['all_customers', 'selected_customers', 'all_merchants', 'selected_merchants', 'category_merchants'];
    const aud = validAudience.includes(target_audience) ? target_audience : 'all_customers';

    let recipients = [];
    if (aud === 'all_customers') {
      recipients = db.prepare("SELECT id FROM users WHERE status = 'active'").all().map(u => u.id);
    } else if (aud === 'selected_customers' && target_id) {
      recipients = [Number(target_id)];
    }

    const nResult = db.prepare(`
      INSERT INTO notifications (title, message, target_audience, target_id, notification_type, delivery_channel, is_sent, created_by)
      VALUES (?, ?, ?, ?, ?, 'in_app', 1, ?)
    `).run(title.trim(), message.trim(), aud, target_id ? String(target_id) : null, notification_type || 'announcement', req.user.id);

    const notificationId = nResult.lastInsertRowid;
    if (recipients.length > 0) {
      const insertUserNotif = db.prepare('INSERT INTO user_notifications (user_id, notification_id, is_read) VALUES (?, ?, 0)');
      const batchTx = db.transaction(() => {
        recipients.forEach(uId => insertUserNotif.run(uId, notificationId));
      });
      batchTx();
    }

    recordAdminActivity(req.user.id, 'send_notification', 'Notification Management', notificationId, req, {
      newValue: { title, target_audience: aud, recipient_count: recipients.length }
    });

    return res.status(201).json({
      success: true,
      message: `Notification dispatched successfully to ${recipients.length} recipients.`,
      notificationId,
      recipient_count: recipients.length
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/notifications/:id/recipients', requirePermission('notifications:view'), (req, res) => {
  try {
    const recipients = db.prepare(`
      SELECT un.*, u.full_name, u.email
      FROM user_notifications un
      JOIN users u ON un.user_id = u.id
      WHERE un.notification_id = ?
      LIMIT 100
    `).all(req.params.id);
    return res.json({ success: true, recipients });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------------------------------
// MODULE 12: ADVERTISEMENT MANAGEMENT (PROMOTIONAL BANNERS ONLY)
// ----------------------------------------------------------------------------

router.get('/advertisements', requirePermission('advertisements:view'), (req, res) => {
  try {
    const ads = db.prepare('SELECT * FROM advertisements ORDER BY created_at DESC').all();
    const formatted = ads.map(a => ({
      ...a,
      ctr: a.impressions_count > 0 ? ((a.clicks_count / a.impressions_count) * 100).toFixed(2) + '%' : '0.00%'
    }));
    return res.json({ success: true, advertisements: formatted });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/advertisements', requirePermission('advertisements:manage'), (req, res) => {
  try {
    const { title, banner_url, destination_url, display_location, target_category, start_date, end_date, is_active } = req.body;
    if (!title || !banner_url || !display_location) {
      return res.status(400).json({ success: false, error: 'Title, banner image URL, and display location are required' });
    }

    const result = db.prepare(`
      INSERT INTO advertisements (title, banner_url, destination_url, display_location, target_category, start_date, end_date, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title.trim(),
      banner_url.trim(),
      destination_url || null,
      display_location,
      target_category || null,
      start_date || null,
      end_date || null,
      is_active !== undefined ? (is_active ? 1 : 0) : 1
    );

    recordAdminActivity(req.user.id, 'create_advertisement', 'Advertisement Management', result.lastInsertRowid, req, {
      newValue: { title, display_location, banner_url }
    });

    return res.status(201).json({ success: true, message: 'Advertisement banner created successfully', adId: result.lastInsertRowid });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/advertisements/:id', requirePermission('advertisements:manage'), (req, res) => {
  try {
    const ad = db.prepare('SELECT * FROM advertisements WHERE id = ?').get(req.params.id);
    if (!ad) return res.status(404).json({ success: false, error: 'Advertisement not found' });

    const { title, banner_url, destination_url, display_location, target_category, start_date, end_date, is_active } = req.body;

    db.prepare(`
      UPDATE advertisements
      SET title = COALESCE(?, title), banner_url = COALESCE(?, banner_url), destination_url = COALESCE(?, destination_url),
          display_location = COALESCE(?, display_location), target_category = COALESCE(?, target_category),
          start_date = COALESCE(?, start_date), end_date = COALESCE(?, end_date),
          is_active = COALESCE(?, is_active), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      title || null,
      banner_url || null,
      destination_url || null,
      display_location || null,
      target_category || null,
      start_date || null,
      end_date || null,
      is_active !== undefined ? Number(is_active) : null,
      ad.id
    );

    recordAdminActivity(req.user.id, 'update_advertisement', 'Advertisement Management', ad.id, req, {
      oldValue: ad,
      newValue: { title, display_location, is_active }
    });

    return res.json({ success: true, message: 'Advertisement updated successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/advertisements/:id/toggle', requirePermission('advertisements:manage'), (req, res) => {
  try {
    const ad = db.prepare('SELECT * FROM advertisements WHERE id = ?').get(req.params.id);
    if (!ad) return res.status(404).json({ success: false, error: 'Advertisement not found' });

    const newActive = ad.is_active ? 0 : 1;
    db.prepare('UPDATE advertisements SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newActive, ad.id);

    recordAdminActivity(req.user.id, 'toggle_advertisement_status', 'Advertisement Management', ad.id, req, {
      oldValue: { is_active: ad.is_active },
      newValue: { is_active: newActive }
    });

    return res.json({ success: true, message: `Advertisement is now ${newActive ? 'active' : 'inactive'}.` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/advertisements/:id', requirePermission('advertisements:manage'), (req, res) => {
  try {
    const ad = db.prepare('SELECT * FROM advertisements WHERE id = ?').get(req.params.id);
    if (!ad) return res.status(404).json({ success: false, error: 'Advertisement not found' });

    db.prepare('DELETE FROM advertisements WHERE id = ?').run(ad.id);
    recordAdminActivity(req.user.id, 'delete_advertisement', 'Advertisement Management', ad.id, req, { oldValue: ad });

    return res.json({ success: true, message: 'Advertisement banner deleted.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/advertisements/admob — Google AdMob Configuration & Diagnostic Status (Part 1, 10, 11)
router.get('/advertisements/admob', requirePermission('advertisements:view'), (req, res) => {
  try {
    const isProd = process.env.NODE_ENV === 'production';
    const config = {
      provider: 'Google AdMob (Official Mobile Ads SDK)',
      environment: isProd ? 'Production' : 'Development (Official Test Ad Units)',
      app_id: process.env.ADMOB_APP_ID || 'ca-app-pub-3940256099942544~3347511713',
      native_ad_unit_id: process.env.ADMOB_NATIVE_AD_UNIT_ID || 'ca-app-pub-3940256099942544/2247696110',
      banner_ad_unit_id: process.env.ADMOB_BANNER_AD_UNIT_ID || 'ca-app-pub-3940256099942544/6300978111',
      rewarded_ad_unit_id: process.env.ADMOB_REWARDED_AD_UNIT_ID || 'ca-app-pub-3940256099942544/5224354917',
      session_placements_count: 3,
      native_ads_format: 'Google Native Advanced',
      status: 'Active'
    };

    const stats = {
      totalRequests: db.prepare("SELECT COUNT(*) AS c FROM ad_event_logs WHERE event_type = 'request'").get().c,
      totalLoaded: db.prepare("SELECT COUNT(*) AS c FROM ad_event_logs WHERE event_type = 'loaded'").get().c,
      totalImpressions: db.prepare("SELECT COUNT(*) AS c FROM ad_event_logs WHERE event_type = 'impression'").get().c,
      totalClicks: db.prepare("SELECT COUNT(*) AS c FROM ad_event_logs WHERE event_type = 'click'").get().c,
      totalErrors: db.prepare("SELECT COUNT(*) AS c FROM ad_event_logs WHERE event_type = 'error'").get().c,
      rewardedCompletions: db.prepare("SELECT COUNT(*) AS c FROM ad_event_logs WHERE event_type = 'reward_completed'").get().c
    };

    const recentLogs = db.prepare(`
      SELECT l.*, u.full_name AS user_name
      FROM ad_event_logs l
      LEFT JOIN users u ON l.user_id = u.id
      ORDER BY l.created_at DESC
      LIMIT 50
    `).all();

    return res.json({ success: true, config, stats, recentLogs });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------------------------------
// MODULE 13: SUPPORT & COMPLAINTS ENHANCEMENTS
// ----------------------------------------------------------------------------

router.get('/complaints/:id', requirePermission('support:view'), (req, res) => {
  try {
    const complaint = db.prepare(`
      SELECT c.*, u.full_name AS customer_name, u.email AS customer_email, u.phone AS customer_phone,
             s.name AS shop_name, adm.full_name AS assigned_admin_name
      FROM complaints c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN shops s ON c.shop_id = s.id
      LEFT JOIN admins adm ON c.assigned_admin_id = adm.id
      WHERE c.id = ?
    `).get(req.params.id);

    if (!complaint) return res.status(404).json({ success: false, error: 'Complaint not found' });
    return res.json({ success: true, complaint });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/complaints/:id/assign', requirePermission('support:manage'), (req, res) => {
  try {
    const { assigned_admin_id } = req.body;
    db.prepare('UPDATE complaints SET assigned_admin_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(assigned_admin_id ? Number(assigned_admin_id) : null, req.params.id);

    recordAdminActivity(req.user.id, 'assign_complaint', 'Support & Complaints', req.params.id, req, {
      newValue: { assigned_admin_id }
    });

    return res.json({ success: true, message: 'Complaint assignment updated' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------------------------------
// MODULE 14: REPORTS & ANALYTICS
// ----------------------------------------------------------------------------

router.get('/reports/:reportType', requirePermission('reports:view'), (req, res) => {
  try {
    const { reportType } = req.params;
    const { range, startDate, endDate } = req.query;

    if (reportType === 'customers') {
      const { clause, params } = getDateRangeClause(range, startDate, endDate, 'created_at');
      const total = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
      const active = db.prepare("SELECT COUNT(*) AS c FROM users WHERE status = 'active'").get().c;
      const suspended = db.prepare("SELECT COUNT(*) AS c FROM users WHERE status = 'suspended'").get().c;
      const inRange = db.prepare(`SELECT COUNT(*) AS c FROM users WHERE ${clause}`).get(...params).c;
      const rows = db.prepare(`SELECT id, full_name, email, phone, status, created_at FROM users WHERE ${clause} ORDER BY created_at DESC LIMIT 100`).all(...params);

      return res.json({
        success: true,
        summary: { total_customers: total, active_customers: active, suspended_customers: suspended, new_in_range: inRange },
        rows
      });
    } else if (reportType === 'merchants') {
      const { clause, params } = getDateRangeClause(range, startDate, endDate, 'created_at');
      const total = db.prepare('SELECT COUNT(*) AS c FROM shops').get().c;
      const approved = db.prepare("SELECT COUNT(*) AS c FROM shops WHERE LOWER(verification_status) = 'approved'").get().c;
      const pending = db.prepare("SELECT COUNT(*) AS c FROM shops WHERE LOWER(verification_status) = 'pending'").get().c;
      const rejected = db.prepare("SELECT COUNT(*) AS c FROM shops WHERE LOWER(verification_status) = 'rejected'").get().c;
      const distribution = db.prepare('SELECT category, COUNT(*) AS count FROM shops GROUP BY category').all();
      const rows = db.prepare(`SELECT id, name, category, subcategory, status, verification_status, rating_avg, phone, created_at FROM shops WHERE ${clause} ORDER BY created_at DESC LIMIT 100`).all(...params);

      return res.json({
        success: true,
        summary: { total_merchants: total, approved_merchants: approved, pending_merchants: pending, rejected_merchants: rejected, category_distribution: distribution },
        rows
      });
    } else if (reportType === 'coins') {
      const { clause, params } = getDateRangeClause(range, startDate, endDate, 'created_at');
      const issued = db.prepare("SELECT COALESCE(SUM(points), 0) AS total FROM point_ledger WHERE type IN ('earned', 'admin_adjustment') AND points > 0").get().total;
      const redeemed = db.prepare("SELECT COALESCE(SUM(points_deducted), 0) AS total FROM redemptions").get().total;
      const liability = db.prepare("SELECT COALESCE(SUM(balance), 0) AS total FROM wallets").get().total;
      const rows = db.prepare(`
        SELECT pl.id, pl.transaction_id, pl.type, pl.points, pl.previous_balance, pl.new_balance, pl.reason, pl.created_at,
               u.full_name AS customer_name, s.name AS merchant_name
        FROM point_ledger pl
        LEFT JOIN users u ON pl.user_id = u.id
        LEFT JOIN shops s ON pl.merchant_id = s.id
        WHERE ${clause}
        ORDER BY pl.created_at DESC
        LIMIT 100
      `).all(...params);

      return res.json({
        success: true,
        summary: { total_coins_issued: issued, total_coins_redeemed: redeemed, outstanding_liability: liability },
        rows
      });
    } else if (reportType === 'orders') {
      const { clause, params } = getDateRangeClause(range, startDate, endDate, 'created_at');
      const total = db.prepare('SELECT COUNT(*) AS c FROM orders').get().c;
      const completed = db.prepare("SELECT COUNT(*) AS c FROM orders WHERE LOWER(status) = 'delivered'").get().c;
      const cancelled = db.prepare("SELECT COUNT(*) AS c FROM orders WHERE LOWER(status) = 'cancelled'").get().c;
      const pending = db.prepare("SELECT COUNT(*) AS c FROM orders WHERE LOWER(status) = 'pending'").get().c;
      const rows = db.prepare(`
        SELECT o.id, o.order_number, o.status, o.total_amount, o.customer_name, o.customer_phone, o.created_at,
               s.name AS shop_name
        FROM orders o
        JOIN shops s ON o.shop_id = s.id
        WHERE ${clause}
        ORDER BY o.created_at DESC
        LIMIT 100
      `).all(...params);

      return res.json({
        success: true,
        summary: { total_orders: total, completed_orders: completed, cancelled_orders: cancelled, pending_orders: pending },
        rows
      });
    } else if (reportType === 'payments') {
      const { clause, params } = getDateRangeClause(range, startDate, endDate, 'created_at');
      const totalRev = db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE LOWER(status) = 'successful'").get().total;
      const refunds = db.prepare("SELECT COALESCE(SUM(refund_amount), 0) AS total FROM payments WHERE LOWER(status) IN ('refunded', 'partially refunded')").get().total;
      const rows = db.prepare(`
        SELECT p.id, p.payment_reference, p.amount, p.currency, p.payment_method, p.status, p.refund_amount, p.created_at,
               u.full_name AS customer_name, s.name AS shop_name
        FROM payments p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN shops s ON p.shop_id = s.id
        WHERE ${clause}
        ORDER BY p.created_at DESC
        LIMIT 100
      `).all(...params);

      return res.json({
        success: true,
        summary: { recorded_revenue: totalRev, total_refunds: refunds, net_revenue: totalRev - refunds },
        rows
      });
    } else if (reportType === 'referrals') {
      const { clause, params } = getDateRangeClause(range, startDate, endDate, 'created_at');
      const total = db.prepare('SELECT COUNT(*) AS c FROM referrals').get().c;
      const rewarded = db.prepare("SELECT COUNT(*) AS c FROM referrals WHERE status = 'rewarded'").get().c;
      const fraud = db.prepare("SELECT COUNT(*) AS c FROM referrals WHERE status = 'fraud_suspected'").get().c;
      const rows = db.prepare(`
        SELECT r.id, r.referral_code, r.status, r.coins_awarded, r.created_at,
               ref.full_name AS referrer_name, rec.full_name AS referred_name
        FROM referrals r
        JOIN users ref ON r.referrer_user_id = ref.id
        JOIN users rec ON r.referred_user_id = rec.id
        WHERE ${clause}
        ORDER BY r.created_at DESC
        LIMIT 100
      `).all(...params);

      return res.json({
        success: true,
        summary: { total_referrals: total, rewarded_referrals: rewarded, fraud_suspected: fraud },
        rows
      });
    } else if (reportType === 'support') {
      const { clause, params } = getDateRangeClause(range, startDate, endDate, 'created_at');
      const total = db.prepare('SELECT COUNT(*) AS c FROM complaints').get().c;
      const open = db.prepare("SELECT COUNT(*) AS c FROM complaints WHERE LOWER(status) IN ('open', 'in_progress', 'waiting_response', 'escalated')").get().c;
      const resolved = db.prepare("SELECT COUNT(*) AS c FROM complaints WHERE LOWER(status) = 'resolved'").get().c;
      const rows = db.prepare(`
        SELECT c.id, c.ticket_id, c.category, c.status, c.priority, c.description, c.created_at,
               u.full_name AS customer_name
        FROM complaints c
        JOIN users u ON c.user_id = u.id
        WHERE ${clause}
        ORDER BY c.created_at DESC
        LIMIT 100
      `).all(...params);

      return res.json({
        success: true,
        summary: { total_complaints: total, open_complaints: open, resolved_complaints: resolved },
        rows
      });
    } else if (reportType === 'sessions') {
      const { clause, params } = getDateRangeClause(range, startDate, endDate, 'created_at');
      const totalSessions = db.prepare('SELECT COUNT(*) AS c FROM vp52_coin_sessions').get().c;
      const activeSessions = db.prepare("SELECT COUNT(*) AS c FROM vp52_coin_sessions WHERE status = 'active' AND datetime(expires_at) > datetime('now')").get().c;
      const completedSessions = db.prepare("SELECT COUNT(*) AS c FROM vp52_coin_sessions WHERE status = 'completed'").get().c;
      const totalCoinsEarned = db.prepare('SELECT COALESCE(SUM(coins_earned), 0) AS s FROM vp52_coin_sessions').get().s;

      const rows = db.prepare(`
        SELECT s.id, s.started_at, s.expires_at, s.duration_seconds, s.status, s.coins_earned, s.reward_claimed, s.created_at,
               u.full_name AS customer_name, u.phone AS customer_phone
        FROM vp52_coin_sessions s
        JOIN users u ON s.user_id = u.id
        WHERE ${clause}
        ORDER BY s.id DESC
        LIMIT 100
      `).all(...params);

      return res.json({
        success: true,
        summary: {
          total_sessions: totalSessions,
          active_sessions: activeSessions,
          completed_sessions: completedSessions,
          total_coins_earned: totalCoinsEarned
        },
        rows
      });
    } else if (reportType === 'admob') {
      const { clause, params } = getDateRangeClause(range, startDate, endDate, 'created_at');
      const totalRequests = db.prepare("SELECT COUNT(*) AS c FROM ad_event_logs WHERE event_type = 'request'").get().c;
      const totalImpressions = db.prepare("SELECT COUNT(*) AS c FROM ad_event_logs WHERE event_type = 'impression'").get().c;
      const totalClicks = db.prepare("SELECT COUNT(*) AS c FROM ad_event_logs WHERE event_type = 'click'").get().c;
      const totalErrors = db.prepare("SELECT COUNT(*) AS c FROM ad_event_logs WHERE event_type = 'error'").get().c;

      const rows = db.prepare(`
        SELECT l.id, l.ad_format, l.event_type, l.ad_unit_id, l.provider, l.metadata, l.created_at,
               u.full_name AS customer_name
        FROM ad_event_logs l
        LEFT JOIN users u ON l.user_id = u.id
        WHERE ${clause}
        ORDER BY l.id DESC
        LIMIT 100
      `).all(...params);

      return res.json({
        success: true,
        summary: {
          total_requests: totalRequests,
          total_impressions: totalImpressions,
          total_clicks: totalClicks,
          total_errors: totalErrors
        },
        rows
      });
    } else if (reportType === 'transfers') {
      const { clause, params } = getDateRangeClause(range, startDate, endDate, 'created_at');
      const totalTransfers = db.prepare('SELECT COUNT(*) AS c FROM coin_transfers').get().c;
      const totalCoins = db.prepare('SELECT COALESCE(SUM(coins_amount), 0) AS s FROM coin_transfers').get().s;
      const totalDiscounts = db.prepare('SELECT COALESCE(SUM(discount_inr), 0) AS s FROM coin_transfers').get().s;

      const rows = db.prepare(`
        SELECT ct.*, u.full_name AS customer_name, s.name AS merchant_name
        FROM coin_transfers ct
        JOIN users u ON ct.customer_id = u.id
        JOIN shops s ON ct.merchant_id = s.id
        WHERE ${clause}
        ORDER BY ct.id DESC
        LIMIT 100
      `).all(...params);

      return res.json({
        success: true,
        summary: {
          total_transfers: totalTransfers,
          total_coins_transferred: totalCoins,
          total_discount_inr: totalDiscounts
        },
        rows
      });
    } else {
      return res.status(400).json({ success: false, error: 'Unknown report type' });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/reports/:reportType/export', requirePermission('reports:view'), (req, res) => {
  try {
    const { reportType } = req.params;
    const { range, startDate, endDate } = req.query;
    const { clause, params } = getDateRangeClause(range, startDate, endDate, 'created_at');

    let rows = [];
    let cols = [];

    if (reportType === 'customers') {
      rows = db.prepare(`SELECT id, full_name, email, phone, status, city_area, created_at FROM users WHERE ${clause} ORDER BY id DESC`).all(...params);
      cols = ['id', 'full_name', 'email', 'phone', 'status', 'city_area', 'created_at'];
    } else if (reportType === 'merchants') {
      rows = db.prepare(`SELECT id, shop_code, name, category, subcategory, status, verification_status, phone, address, created_at FROM shops WHERE ${clause} ORDER BY id DESC`).all(...params);
      cols = ['id', 'shop_code', 'name', 'category', 'subcategory', 'status', 'verification_status', 'phone', 'address', 'created_at'];
    } else if (reportType === 'coins') {
      rows = db.prepare(`
        SELECT pl.id, pl.transaction_id, pl.type, pl.points, pl.previous_balance, pl.new_balance, pl.reason, pl.created_at,
               u.full_name AS customer_name
        FROM point_ledger pl
        LEFT JOIN users u ON pl.user_id = u.id
        WHERE ${clause}
        ORDER BY pl.id DESC
      `).all(...params);
      cols = ['id', 'transaction_id', 'created_at', 'customer_name', 'type', 'points', 'previous_balance', 'new_balance', 'reason'];
    } else if (reportType === 'orders') {
      rows = db.prepare(`
        SELECT o.id, o.order_number, o.status, o.total_amount, o.customer_name, o.customer_phone, o.created_at, s.name AS shop_name
        FROM orders o
        JOIN shops s ON o.shop_id = s.id
        WHERE ${clause}
        ORDER BY o.id DESC
      `).all(...params);
      cols = ['id', 'order_number', 'status', 'total_amount', 'customer_name', 'customer_phone', 'shop_name', 'created_at'];
    } else if (reportType === 'payments') {
      rows = db.prepare(`
        SELECT p.id, p.payment_reference, p.amount, p.currency, p.payment_method, p.status, p.refund_amount, p.created_at,
               u.full_name AS customer_name, s.name AS shop_name
        FROM payments p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN shops s ON p.shop_id = s.id
        WHERE ${clause}
        ORDER BY p.id DESC
      `).all(...params);
      cols = ['id', 'payment_reference', 'amount', 'currency', 'payment_method', 'status', 'refund_amount', 'customer_name', 'shop_name', 'created_at'];
    } else if (reportType === 'referrals') {
      rows = db.prepare(`
        SELECT r.id, r.referral_code, r.status, r.coins_awarded, r.created_at,
               ref.full_name AS referrer_name, rec.full_name AS referred_name
        FROM referrals r
        JOIN users ref ON r.referrer_user_id = ref.id
        JOIN users rec ON r.referred_user_id = rec.id
        WHERE ${clause}
        ORDER BY r.id DESC
      `).all(...params);
      cols = ['id', 'referral_code', 'status', 'coins_awarded', 'referrer_name', 'referred_name', 'created_at'];
    } else if (reportType === 'support') {
      rows = db.prepare(`
        SELECT c.id, c.ticket_id, c.category, c.status, c.priority, c.description, c.created_at,
               u.full_name AS customer_name
        FROM complaints c
        JOIN users u ON c.user_id = u.id
        WHERE ${clause}
        ORDER BY c.id DESC
      `).all(...params);
      cols = ['id', 'ticket_id', 'category', 'status', 'priority', 'customer_name', 'description', 'created_at'];
    } else if (reportType === 'sessions') {
      rows = db.prepare(`
        SELECT s.id, s.started_at, s.expires_at, s.duration_seconds, s.status, s.coins_earned, s.reward_claimed, s.created_at,
               u.full_name AS customer_name, u.phone AS customer_phone
        FROM vp52_coin_sessions s
        JOIN users u ON s.user_id = u.id
        WHERE ${clause}
        ORDER BY s.id DESC
      `).all(...params);
      cols = ['id', 'customer_name', 'customer_phone', 'status', 'duration_seconds', 'coins_earned', 'reward_claimed', 'started_at', 'expires_at', 'created_at'];
    } else if (reportType === 'admob') {
      rows = db.prepare(`
        SELECT l.id, l.ad_format, l.event_type, l.ad_unit_id, l.provider, l.metadata, l.created_at,
               u.full_name AS customer_name
        FROM ad_event_logs l
        LEFT JOIN users u ON l.user_id = u.id
        WHERE ${clause}
        ORDER BY l.id DESC
      `).all(...params);
      cols = ['id', 'customer_name', 'ad_format', 'event_type', 'ad_unit_id', 'provider', 'metadata', 'created_at'];
    } else if (reportType === 'transfers') {
      rows = db.prepare(`
        SELECT ct.id, ct.transfer_id, ct.redemption_id, ct.coins_amount, ct.discount_inr, ct.status, ct.created_at,
               u.full_name AS customer_name, s.name AS merchant_name
        FROM coin_transfers ct
        JOIN users u ON ct.customer_id = u.id
        JOIN shops s ON ct.merchant_id = s.id
        WHERE ${clause}
        ORDER BY ct.id DESC
      `).all(...params);
      cols = ['id', 'transfer_id', 'redemption_id', 'customer_name', 'merchant_name', 'coins_amount', 'discount_inr', 'status', 'created_at'];
    }

    const csv = toCSV(rows, cols);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="vp52_${reportType}_report_${Date.now()}.csv"`);
    return res.send(csv);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------------------------------
// MODULE 15: ADMIN & SECURITY SETTINGS (RBAC, LOGS, BACKUPS & FRAUD SCANNER)
// ----------------------------------------------------------------------------

router.get('/admins', requirePermission('admins:manage'), (req, res) => {
  try {
    const admins = db.prepare('SELECT id, full_name, email, role, permissions, status, phone, last_login_at, created_at FROM admins ORDER BY id ASC').all();
    const formatted = admins.map(a => ({
      ...a,
      permissions: typeof a.permissions === 'string' ? JSON.parse(a.permissions || '[]') : (a.permissions || ['*'])
    }));
    return res.json({ success: true, admins: formatted });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/admins', requirePermission('admins:manage'), (req, res) => {
  try {
    const { full_name, email, password, role, permissions, phone } = req.body;
    if (!full_name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Full name, email, and password are required' });
    }
    const cleanEmail = email.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM admins WHERE email = ?').get(cleanEmail);
    if (existing) {
      return res.status(409).json({ success: false, error: 'An admin with this email already exists' });
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);
    const perms = Array.isArray(permissions) ? JSON.stringify(permissions) : '["*"]';

    const result = db.prepare(`
      INSERT INTO admins (full_name, email, password_hash, role, permissions, phone, status)
      VALUES (?, ?, ?, ?, ?, ?, 'active')
    `).run(full_name.trim(), cleanEmail, passwordHash, role || 'admin', perms, phone || null);

    recordAdminActivity(req.user.id, 'create_admin', 'Admin & Security Settings', result.lastInsertRowid, req, {
      newValue: { email: cleanEmail, role: role || 'admin' }
    });

    return res.status(201).json({ success: true, message: 'Admin account created successfully', adminId: result.lastInsertRowid });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/admins/:id', requirePermission('admins:manage'), (req, res) => {
  try {
    const adminId = req.params.id;
    const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(adminId);
    if (!admin) return res.status(404).json({ success: false, error: 'Admin not found' });

    const { full_name, role, permissions, phone, status } = req.body;
    const perms = permissions ? (Array.isArray(permissions) ? JSON.stringify(permissions) : permissions) : admin.permissions;

    db.prepare(`
      UPDATE admins
      SET full_name = COALESCE(?, full_name), role = COALESCE(?, role), permissions = ?, phone = COALESCE(?, phone), status = COALESCE(?, status)
      WHERE id = ?
    `).run(full_name || null, role || null, perms, phone || null, status || null, adminId);

    recordAdminActivity(req.user.id, 'update_admin', 'Admin & Security Settings', adminId, req, {
      oldValue: { role: admin.role, status: admin.status },
      newValue: { role, permissions, status }
    });

    return res.json({ success: true, message: 'Admin profile updated' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/admins/:id/deactivate', requirePermission('admins:manage'), (req, res) => {
  try {
    const adminId = Number(req.params.id);
    if (adminId === req.user.id) {
      return res.status(400).json({ success: false, error: 'You cannot deactivate your own admin account.' });
    }

    const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(adminId);
    if (!admin) return res.status(404).json({ success: false, error: 'Admin not found' });

    if (admin.role === 'super_admin' && admin.status === 'active') {
      const activeSuperAdmins = db.prepare("SELECT COUNT(*) AS c FROM admins WHERE role = 'super_admin' AND status = 'active'").get().c;
      if (activeSuperAdmins <= 1) {
        return res.status(400).json({ success: false, error: 'Cannot deactivate the last active Super Admin.' });
      }
    }

    const newStatus = admin.status === 'active' ? 'inactive' : 'active';
    db.prepare('UPDATE admins SET status = ? WHERE id = ?').run(newStatus, adminId);

    recordAdminActivity(req.user.id, 'toggle_admin_status', 'Admin & Security Settings', adminId, req, {
      oldValue: { status: admin.status },
      newValue: { status: newStatus }
    });

    return res.json({ success: true, message: `Admin account is now ${newStatus}.` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/activity-logs', requirePermission('security:view'), (req, res) => {
  try {
    const { module, admin_id, range, startDate, endDate, limit = 50, offset = 0 } = req.query;
    let query = 'SELECT * FROM admin_activity_logs WHERE 1=1';
    const params = [];

    if (module && module !== 'all') {
      query += ' AND module = ?';
      params.push(module);
    }
    if (admin_id && admin_id !== 'all') {
      query += ' AND admin_id = ?';
      params.push(Number(admin_id));
    }
    if (range) {
      const { clause, params: rParams } = getDateRangeClause(range, startDate, endDate, 'timestamp');
      query += ` AND ${clause}`;
      params.push(...rParams);
    }
    query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const logs = db.prepare(query).all(...params);
    return res.json({ success: true, logs });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Database Backups Management
router.get('/backups', requirePermission('security:manage'), (req, res) => {
  try {
    const backupDir = path.join(__dirname, '..', 'db', 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.db'));
    const backups = files.map(file => {
      const filePath = path.join(backupDir, file);
      const stat = fs.statSync(filePath);
      return {
        filename: file,
        size_bytes: stat.size,
        size_mb: (stat.size / (1024 * 1024)).toFixed(2) + ' MB',
        created_at: stat.birthtime || stat.mtime
      };
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return res.json({ success: true, backups });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/backups/create', requirePermission('security:manage'), async (req, res) => {
  try {
    const backupDir = path.join(__dirname, '..', 'db', 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `manual_admin_backup_${timestamp}.db`;
    const backupPath = path.join(backupDir, filename);

    await db.backup(backupPath);

    const Database = require('better-sqlite3');
    const testDb = new Database(backupPath);
    const integrity = testDb.prepare('PRAGMA integrity_check').get();
    testDb.close();

    recordAdminActivity(req.user.id, 'create_backup', 'Admin & Security Settings', filename, req, {
      newValue: { filename, integrity: integrity.integrity_check }
    });

    return res.json({
      success: true,
      message: 'Verified database backup created successfully.',
      filename,
      integrity: integrity.integrity_check
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/backups/verify/:filename', requirePermission('security:manage'), (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const backupPath = path.join(__dirname, '..', 'db', 'backups', filename);
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ success: false, error: 'Backup file not found' });
    }

    const Database = require('better-sqlite3');
    const testDb = new Database(backupPath);
    const integrity = testDb.prepare('PRAGMA integrity_check').get();
    const counts = {
      users: testDb.prepare('SELECT COUNT(*) as c FROM users').get().c,
      shops: testDb.prepare('SELECT COUNT(*) as c FROM shops').get().c,
      admins: testDb.prepare('SELECT COUNT(*) as c FROM admins').get().c,
      wallets: testDb.prepare('SELECT COUNT(*) as c FROM wallets').get().c
    };
    testDb.close();

    return res.json({
      success: true,
      filename,
      integrity: integrity.integrity_check,
      is_valid: integrity.integrity_check === 'ok',
      snapshot_counts: counts
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Fraud Detection Heuristics
router.get('/fraud/alerts', requirePermission('security:view'), (req, res) => {
  try {
    const alerts = db.prepare('SELECT * FROM fraud_alerts ORDER BY status ASC, id DESC').all();
    return res.json({ success: true, alerts });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/fraud/scan', requirePermission('security:manage'), (req, res) => {
  try {
    let newAlertsCount = 0;
    const insertAlert = db.prepare(`
      INSERT INTO fraud_alerts (alert_type, severity, target_type, target_id, details, status)
      VALUES (?, ?, ?, ?, ?, 'pending_review')
    `);

    // 1. Check duplicate phones among customers
    const dupPhones = db.prepare(`
      SELECT phone, COUNT(*) AS count
      FROM users
      WHERE phone IS NOT NULL AND phone != ''
      GROUP BY phone
      HAVING count > 1
    `).all();

    for (const dp of dupPhones) {
      const users = db.prepare('SELECT id, full_name, email FROM users WHERE phone = ?').all(dp.phone);
      const userIds = users.map(u => u.id).join(', ');
      const exists = db.prepare("SELECT id FROM fraud_alerts WHERE alert_type = 'duplicate_phone' AND details LIKE ?").get(`%${dp.phone}%`);
      if (!exists) {
        insertAlert.run(
          'duplicate_phone',
          'high',
          'user',
          users[0].id,
          `Multiple accounts (${userIds}) share identical phone number: ${dp.phone}.`
        );
        newAlertsCount++;
      }
    }

    // 2. Check excessive coin velocity (e.g. >250 points in 24 hours)
    const velocity = db.prepare(`
      SELECT user_id, SUM(points) AS total_pts
      FROM point_ledger
      WHERE type IN ('earned', 'admin_adjustment') AND points > 0 AND datetime(created_at) >= datetime('now', '-24 hours')
      GROUP BY user_id
      HAVING total_pts >= 250
    `).all();

    for (const v of velocity) {
      const exists = db.prepare("SELECT id FROM fraud_alerts WHERE alert_type = 'high_coin_velocity' AND target_id = ? AND status = 'pending_review'").get(v.user_id);
      if (!exists) {
        insertAlert.run(
          'high_coin_velocity',
          'medium',
          'user',
          v.user_id,
          `Rapid coin velocity: ${v.total_pts} coins accumulated within 24 hours.`
        );
        newAlertsCount++;
      }
    }

    // 3. Check suspicious referral patterns (many referrals, 0 redemptions)
    const refAbuse = db.prepare(`
      SELECT r.referrer_user_id, COUNT(*) AS ref_count, COALESCE(w.total_redeemed, 0) AS redeemed
      FROM referrals r
      JOIN wallets w ON r.referrer_user_id = w.user_id
      GROUP BY r.referrer_user_id
      HAVING ref_count >= 5 AND redeemed = 0
    `).all();

    for (const ra of refAbuse) {
      const exists = db.prepare("SELECT id FROM fraud_alerts WHERE alert_type = 'referral_abuse' AND target_id = ? AND status = 'pending_review'").get(ra.referrer_user_id);
      if (!exists) {
        insertAlert.run(
          'referral_abuse',
          'medium',
          'user',
          ra.referrer_user_id,
          `Customer has ${ra.ref_count} referrals recorded but 0 actual shop redemptions.`
        );
        newAlertsCount++;
      }
    }

    return res.json({
      success: true,
      message: `Fraud scan complete. ${newAlertsCount} new alerts flagged for manual review.`,
      new_alerts_flagged: newAlertsCount
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/fraud/alerts/:id/resolve', requirePermission('security:manage'), (req, res) => {
  try {
    const alertId = req.params.id;
    const { status, action_notes } = req.body;
    if (!['reviewed_safe', 'action_taken'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Status must be "reviewed_safe" or "action_taken"' });
    }

    db.prepare(`
      UPDATE fraud_alerts
      SET status = ?, action_taken_by = ?, action_notes = ?, resolved_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, req.user.id, action_notes || 'Reviewed by admin', alertId);

    recordAdminActivity(req.user.id, 'resolve_fraud_alert', 'Admin & Security Settings', alertId, req, {
      newValue: { status, action_notes }
    });

    return res.json({ success: true, message: `Alert marked as ${status}.` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
