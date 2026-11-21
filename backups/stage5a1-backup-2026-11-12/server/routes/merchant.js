const express = require('express');
const crypto = require('crypto');
const db = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Apply Merchant Authentication Middleware
router.use(authenticateToken);
router.use(requireRole('shop'));

// 0. Merchant Shop Details & Settings
router.get('/my-shop', (req, res) => {
  try {
    const shopId = req.user.shop_id || req.user.id;
    const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(shopId);
    if (!shop) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }
    const photos = db.prepare('SELECT * FROM shop_photos WHERE shop_id = ? ORDER BY is_cover DESC, id ASC').all(shopId);
    return res.json({ success: true, shop: { ...shop, photos } });
  } catch (error) {
    console.error('Fetch my-shop error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch shop details' });
  }
});

router.put('/my-shop', (req, res) => {
  try {
    const shopId = req.user.shop_id || req.user.id;
    const {
      name, description, phone, whatsapp_number, subcategory,
      address, area_locality, city, district, state, pincode,
      opening_time, closing_time, business_hours, is_temporarily_closed,
      logo_url, cover_photo_url
    } = req.body;

    db.prepare(`
      UPDATE shops
      SET name = COALESCE(?, name),
          description = COALESCE(?, description),
          phone = COALESCE(?, phone),
          whatsapp_number = COALESCE(?, whatsapp_number),
          subcategory = COALESCE(?, subcategory),
          address = COALESCE(?, address),
          area_locality = COALESCE(?, area_locality),
          city = COALESCE(?, city),
          district = COALESCE(?, district),
          state = COALESCE(?, state),
          pincode = COALESCE(?, pincode),
          opening_time = COALESCE(?, opening_time),
          closing_time = COALESCE(?, closing_time),
          business_hours = COALESCE(?, business_hours),
          is_temporarily_closed = COALESCE(?, is_temporarily_closed),
          logo_url = COALESCE(?, logo_url),
          cover_photo_url = COALESCE(?, cover_photo_url)
      WHERE id = ?
    `).run(
      name, description, phone, whatsapp_number, subcategory,
      address, area_locality, city, district, state, pincode,
      opening_time, closing_time,
      business_hours ? (typeof business_hours === 'string' ? business_hours : JSON.stringify(business_hours)) : null,
      is_temporarily_closed !== undefined ? (is_temporarily_closed ? 1 : 0) : null,
      logo_url, cover_photo_url,
      shopId
    );

    const updated = db.prepare('SELECT * FROM shops WHERE id = ?').get(shopId);
    return res.json({ success: true, message: 'Shop profile updated successfully', shop: updated });
  } catch (error) {
    console.error('Update my-shop error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update shop' });
  }
});

// Merchant Photos Management
router.get('/photos', (req, res) => {
  try {
    const shopId = req.user.shop_id || req.user.id;
    const photos = db.prepare('SELECT * FROM shop_photos WHERE shop_id = ? ORDER BY is_cover DESC, id ASC').all(shopId);
    return res.json({ success: true, photos });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch photos' });
  }
});

router.post('/photos', (req, res) => {
  try {
    const shopId = req.user.shop_id || req.user.id;
    const { photo_url, caption, is_cover } = req.body;
    if (!photo_url) return res.status(400).json({ success: false, error: 'Photo URL is required' });

    if (is_cover) {
      db.prepare('UPDATE shop_photos SET is_cover = 0 WHERE shop_id = ?').run(shopId);
      db.prepare('UPDATE shops SET cover_photo_url = ? WHERE id = ?').run(photo_url, shopId);
    }

    const result = db.prepare(`
      INSERT INTO shop_photos (shop_id, photo_url, caption, is_cover)
      VALUES (?, ?, ?, ?)
    `).run(shopId, photo_url, caption || null, is_cover ? 1 : 0);

    return res.status(201).json({
      success: true,
      message: 'Photo uploaded to shop gallery',
      photo: {
        id: result.lastInsertRowid,
        shop_id: shopId,
        photo_url,
        caption,
        is_cover: is_cover ? 1 : 0
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to upload photo' });
  }
});

router.delete('/photos/:id', (req, res) => {
  try {
    const shopId = req.user.shop_id || req.user.id;
    db.prepare('DELETE FROM shop_photos WHERE id = ? AND shop_id = ?').run(req.params.id, shopId);
    return res.json({ success: true, message: 'Photo deleted' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to delete photo' });
  }
});

// 1. Get Merchant Products & Services
router.get('/products', (req, res) => {
  try {
    const shopId = req.user.shop_id || req.user.id;
    const products = db.prepare('SELECT * FROM products WHERE shop_id = ? ORDER BY display_order ASC, id DESC').all(shopId);
    return res.json({ success: true, products });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch products' });
  }
});

// 2. Add Merchant Product/Service
router.post('/products', (req, res) => {
  try {
    const shopId = req.user.shop_id || req.user.id;
    const {
      name, photo_url, price, category, reward_eligible, reward_percent, description,
      product_type, veg_non_veg, food_category, special_offer, fabric, colour, size,
      brand, specifications, warranty, price_max, duration, timings, facility_name,
      is_available, display_order, photos
    } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ success: false, error: 'Product name and price are required' });
    }

    const result = db.prepare(`
      INSERT INTO products (
        shop_id, name, photo_url, price, category, reward_eligible, reward_percent, description,
        product_type, veg_non_veg, food_category, special_offer, fabric, colour, size,
        brand, specifications, warranty, price_max, duration, timings, facility_name,
        is_available, display_order, photos
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      shopId,
      name.trim(),
      photo_url ? photo_url.trim() : 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=400&q=80',
      parseFloat(price),
      category ? category.trim() : 'General',
      reward_eligible ? 1 : 0,
      reward_percent !== undefined ? parseInt(reward_percent) : 10,
      description ? description.trim() : '',
      product_type || 'product',
      veg_non_veg || null,
      food_category || null,
      special_offer || null,
      fabric || null,
      colour || null,
      size || null,
      brand || null,
      specifications || null,
      warranty || null,
      price_max ? parseFloat(price_max) : null,
      duration || null,
      timings || null,
      facility_name || null,
      is_available !== undefined ? (is_available ? 1 : 0) : 1,
      display_order ? parseInt(display_order) : 0,
      photos ? (typeof photos === 'string' ? photos : JSON.stringify(photos)) : null
    );

    return res.status(201).json({ success: true, message: 'Item added successfully', productId: result.lastInsertRowid });
  } catch (error) {
    console.error('Add product error:', error);
    return res.status(500).json({ success: false, error: 'Failed to add item' });
  }
});

// 3. Edit Product
router.put('/products/:id', (req, res) => {
  try {
    const shopId = req.user.shop_id || req.user.id;
    const {
      name, photo_url, price, category, reward_eligible, reward_percent, description, availability,
      product_type, veg_non_veg, food_category, special_offer, fabric, colour, size,
      brand, specifications, warranty, price_max, duration, timings, facility_name,
      is_available, display_order, photos
    } = req.body;

    db.prepare(`
      UPDATE products
      SET name = COALESCE(?, name),
          photo_url = COALESCE(?, photo_url),
          price = COALESCE(?, price),
          category = COALESCE(?, category),
          reward_eligible = COALESCE(?, reward_eligible),
          reward_percent = COALESCE(?, reward_percent),
          description = COALESCE(?, description),
          availability = COALESCE(?, availability),
          product_type = COALESCE(?, product_type),
          veg_non_veg = COALESCE(?, veg_non_veg),
          food_category = COALESCE(?, food_category),
          special_offer = COALESCE(?, special_offer),
          fabric = COALESCE(?, fabric),
          colour = COALESCE(?, colour),
          size = COALESCE(?, size),
          brand = COALESCE(?, brand),
          specifications = COALESCE(?, specifications),
          warranty = COALESCE(?, warranty),
          price_max = COALESCE(?, price_max),
          duration = COALESCE(?, duration),
          timings = COALESCE(?, timings),
          facility_name = COALESCE(?, facility_name),
          is_available = COALESCE(?, is_available),
          display_order = COALESCE(?, display_order),
          photos = COALESCE(?, photos)
      WHERE id = ? AND shop_id = ?
    `).run(
      name, photo_url, price !== undefined ? parseFloat(price) : null, category,
      reward_eligible !== undefined ? (reward_eligible ? 1 : 0) : null,
      reward_percent !== undefined ? parseInt(reward_percent) : null,
      description, availability,
      product_type, veg_non_veg, food_category, special_offer, fabric, colour, size,
      brand, specifications, warranty, price_max ? parseFloat(price_max) : null,
      duration, timings, facility_name,
      is_available !== undefined ? (is_available ? 1 : 0) : null,
      display_order !== undefined ? parseInt(display_order) : null,
      photos ? (typeof photos === 'string' ? photos : JSON.stringify(photos)) : null,
      req.params.id, shopId
    );

    return res.json({ success: true, message: 'Item updated successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to update item' });
  }
});

// 4. Delete Product
router.delete('/products/:id', (req, res) => {
  try {
    const shopId = req.user.shop_id || req.user.id;
    db.prepare('DELETE FROM products WHERE id = ? AND shop_id = ?').run(req.params.id, shopId);
    return res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to delete product' });
  }
});

// Customer Reviews for Merchant
router.get('/reviews', (req, res) => {
  try {
    const shopId = req.user.shop_id || req.user.id;
    const reviews = db.prepare(`
      SELECT r.*, u.full_name AS customer_name
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.shop_id = ? AND r.status != 'hidden'
      ORDER BY r.created_at DESC
    `).all(shopId);

    const stats = db.prepare(`
      SELECT AVG(rating) as avg, COUNT(*) as count
      FROM reviews
      WHERE shop_id = ? AND status = 'approved'
    `).get(shopId);

    return res.json({
      success: true,
      reviews,
      rating_avg: stats && stats.count > 0 ? Number(stats.avg.toFixed(1)) : 4.8,
      rating_count: stats ? stats.count : 0
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch reviews' });
  }
});

router.post('/reviews/:id/reply', (req, res) => {
  try {
    const shopId = req.user.shop_id || req.user.id;
    const { reply } = req.body;
    if (!reply || !reply.trim()) {
      return res.status(400).json({ success: false, error: 'Reply text is required' });
    }

    const review = db.prepare('SELECT id FROM reviews WHERE id = ? AND shop_id = ?').get(req.params.id, shopId);
    if (!review) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }

    db.prepare(`
      UPDATE reviews
      SET merchant_reply = ?, merchant_replied_at = CURRENT_TIMESTAMP
      WHERE id = ? AND shop_id = ?
    `).run(reply.trim(), req.params.id, shopId);

    return res.json({ success: true, message: 'Reply posted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to reply to review' });
  }
});

// Orders Management for Merchant (Section 11)
router.get('/orders', (req, res) => {
  try {
    const shopId = req.user.shop_id || req.user.id;
    const orders = db.prepare('SELECT * FROM orders WHERE shop_id = ? ORDER BY id DESC').all(shopId);

    const getItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
    const enriched = orders.map(ord => ({
      ...ord,
      items: getItems.all(ord.id)
    }));

    return res.json({ success: true, orders: enriched });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
});

router.put('/orders/:id/status', (req, res) => {
  try {
    const shopId = req.user.shop_id || req.user.id;
    const { status, cancellation_reason } = req.body;

    const validStatuses = ['Pending', 'Accepted', 'Preparing', 'Ready', 'Dispatched', 'Delivered', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid order status' });
    }

    const order = db.prepare('SELECT id FROM orders WHERE id = ? AND shop_id = ?').get(req.params.id, shopId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    db.prepare(`
      UPDATE orders
      SET status = ?, cancellation_reason = COALESCE(?, cancellation_reason), updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND shop_id = ?
    `).run(status, cancellation_reason || null, req.params.id, shopId);

    return res.json({ success: true, message: `Order status updated to ${status}` });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to update order status' });
  }
});

// 5. ITEMIZED BILLING & SERVER-SIDE REWARD CALCULATOR (CORE FEATURE #15)
router.post('/create-bill', (req, res) => {
  try {
    const shopId = req.user.shop_id || req.user.id;
    const { customer_identifier, items } = req.body;

    if (!customer_identifier || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Customer identifier and at least one item are required' });
    }

    // Find customer by email, phone, or ID
    const customer = db.prepare(`
      SELECT * FROM users
      WHERE email = ? OR phone = ? OR id = ?
    `).get(customer_identifier.trim().toLowerCase(), customer_identifier.trim(), customer_identifier.trim());

    if (!customer) {
      return res.status(404).json({ success: false, error: `Customer "${customer_identifier}" not found. Verify email/phone.` });
    }

    // 1. Calculate Customer Level & Discount Cap %
    const walletRow = db.prepare('SELECT balance, total_earned FROM wallets WHERE user_id = ?').get(customer.id) || { balance: 0, total_earned: 0 };
    const lifetimePoints = walletRow.total_earned;

    const levels = db.prepare('SELECT * FROM reward_levels ORDER BY min_points ASC').all();
    let currentLevel = 'Basic';
    let discountCapPercent = 5;

    for (const lvl of levels) {
      if (lifetimePoints >= lvl.min_points) {
        currentLevel = lvl.level_name;
        discountCapPercent = lvl.discount_cap_percent || 5;
      }
    }

    // 2. Calculate Bill Totals Server-Side
    let totalAmount = 0;
    let eligibleAmount = 0;

    const validatedItems = items.map(item => {
      const price = parseFloat(item.price) || 0;
      const quantity = parseInt(item.quantity) || 1;
      const subtotal = price * quantity;
      const isEligible = item.reward_eligible ? 1 : 0;

      totalAmount += subtotal;
      if (isEligible) {
        eligibleAmount += subtotal;
      }

      return {
        product_id: item.product_id || null,
        product_name: item.product_name || 'Store Item',
        price,
        quantity,
        subtotal,
        reward_eligible: isEligible
      };
    });

    // 3. Level Discount Cap Calculation
    const maxAllowedDiscountINR = Math.floor(eligibleAmount * (discountCapPercent / 100));

    // Auto-expire lots before calculating available coins
    db.prepare(`
      UPDATE coin_lots
      SET status = 'EXPIRED'
      WHERE user_id = ? AND status IN ('ACTIVE', 'PARTIALLY_USED') AND datetime(expires_at) <= datetime('now')
    `).run(customer.id);

    const activeCoinsRow = db.prepare(`
      SELECT SUM(coins_remaining) AS active_coins FROM coin_lots
      WHERE user_id = ? AND status IN ('ACTIVE', 'PARTIALLY_USED') AND datetime(expires_at) > datetime('now')
    `).get(customer.id);
    const availableCoins = activeCoinsRow && activeCoinsRow.active_coins !== null ? activeCoinsRow.active_coins : walletRow.balance;

    const coinsToRedeem = Math.min(availableCoins, maxAllowedDiscountINR);
    const discountAmountINR = coinsToRedeem; // 1 Coin = ₹1
    const netAmountPayable = totalAmount - discountAmountINR;

    const defaultRewardPercent = 10;
    const pointsAwarded = Math.floor(eligibleAmount * (defaultRewardPercent / 100));

    // Generate unique Bill Number (e.g. BILL-2026-98123)
    const billNumber = `BILL-2026-${Math.floor(100000 + Math.random() * 900000)}`;

    // 4. Atomic Database Transaction: FIFO Coin Redemption + Bill Creation + Point Credit
    const billTransaction = db.transaction(() => {
      // 4A. FIFO Coin Lot Deduction
      if (coinsToRedeem > 0) {
        let remainingToDeduct = coinsToRedeem;
        const activeLots = db.prepare(`
          SELECT * FROM coin_lots
          WHERE user_id = ? AND status IN ('ACTIVE', 'PARTIALLY_USED') AND datetime(expires_at) > datetime('now')
          ORDER BY expires_at ASC, id ASC
        `).all(customer.id);

        for (const lot of activeLots) {
          if (remainingToDeduct <= 0) break;
          const take = Math.min(lot.coins_remaining, remainingToDeduct);
          const newLotRemaining = lot.coins_remaining - take;
          const newLotStatus = newLotRemaining === 0 ? 'USED' : 'PARTIALLY_USED';

          db.prepare(`
            UPDATE coin_lots
            SET coins_remaining = ?, status = ?
            WHERE id = ?
          `).run(newLotRemaining, newLotStatus, lot.id);

          remainingToDeduct -= take;
        }

        const prevBal = walletRow.balance;
        const newBal = Math.max(0, prevBal - coinsToRedeem);
        db.prepare('UPDATE wallets SET balance = ?, total_redeemed = total_redeemed + ? WHERE user_id = ?').run(newBal, coinsToRedeem, customer.id);

        db.prepare(`
          INSERT INTO point_ledger (user_id, transaction_id, type, points, previous_balance, new_balance, merchant_id, reason)
          VALUES (?, ?, 'REDEEMED', ?, ?, ?, ?, ?)
        `).run(customer.id, billNumber, coinsToRedeem, prevBal, newBal, shopId, `Discount Applied via FIFO Redemption (${billNumber})`);
      }

      // 4B. Insert Bill Header
      const billResult = db.prepare(`
        INSERT INTO bills (bill_number, shop_id, user_id, total_amount, eligible_amount, reward_percent, points_awarded)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(billNumber, shopId, customer.id, totalAmount, eligibleAmount, discountCapPercent, pointsAwarded);

      const billId = billResult.lastInsertRowid;

      // 4C. Insert Bill Items
      const itemInsert = db.prepare(`
        INSERT INTO bill_items (bill_id, product_id, product_name, price, quantity, subtotal, reward_eligible)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of validatedItems) {
        itemInsert.run(billId, item.product_id, item.product_name, item.price, item.quantity, item.subtotal, item.reward_eligible);
      }

      // 4D. Award Reward Points to Customer Wallet as a new 30-day coin lot
      if (pointsAwarded > 0) {
        const expiryDays = 30;
        const expiresAt = new Date(Date.now() + expiryDays * 86400 * 1000).toISOString();

        db.prepare(`
          INSERT INTO coin_lots (user_id, transaction_id, source, coins_earned, coins_remaining, expires_at, status)
          VALUES (?, ?, 'STORE_PURCHASE', ?, ?, ?, 'ACTIVE')
        `).run(customer.id, billNumber, pointsAwarded, pointsAwarded, expiresAt);

        const currentW = db.prepare('SELECT balance, total_earned FROM wallets WHERE user_id = ?').get(customer.id);
        const prevB = currentW.balance;
        const newB = prevB + pointsAwarded;
        const newLifetime = currentW.total_earned + pointsAwarded;

        db.prepare('UPDATE wallets SET balance = ?, total_earned = ? WHERE user_id = ?').run(newB, newLifetime, customer.id);

        db.prepare(`
          INSERT INTO reward_transactions (user_id, activity_type, points)
          VALUES (?, ?, ?)
        `).run(customer.id, `Store Purchase Reward — ${billNumber}`, pointsAwarded);

        db.prepare(`
          INSERT INTO point_ledger (user_id, transaction_id, type, points, previous_balance, new_balance, merchant_id, reason)
          VALUES (?, ?, 'EARNED', ?, ?, ?, ?, ?)
        `).run(customer.id, billNumber, pointsAwarded, prevB, newB, shopId, `Store Purchase Billing Reward (${billNumber})`);
      }

      const finalW = db.prepare('SELECT balance, total_earned FROM wallets WHERE user_id = ?').get(customer.id);

      return {
        billId,
        billNumber,
        newBalance: finalW ? finalW.balance : 0
      };
    });

    const txResult = billTransaction();

    return res.status(201).json({
      success: true,
      message: 'Itemized Bill Generated & Reward Applied Successfully!',
      bill: {
        id: txResult.billId,
        bill_number: txResult.billNumber,
        customer_name: customer.full_name,
        customer_level: currentLevel,
        level_discount_cap_percent: discountCapPercent,
        total_amount: totalAmount,
        eligible_amount: eligibleAmount,
        max_allowed_discount: maxAllowedDiscountINR,
        coins_redeemed: coinsToRedeem,
        discount_amount_inr: discountAmountINR,
        net_amount_payable: netAmountPayable,
        points_awarded: pointsAwarded,
        new_customer_balance: txResult.newBalance
      }
    });
  } catch (error) {
    console.error('Create bill error:', error);
    return res.status(500).json({ success: false, error: 'Failed to generate itemized bill' });
  }
});

// Merchant Offers CRUD
router.get('/offers', (req, res) => {
  try {
    const shopId = req.user.shop_id || req.user.id;
    const offers = db.prepare('SELECT * FROM offers WHERE shop_id = ? ORDER BY created_at DESC').all(shopId);
    return res.json({ success: true, offers });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch merchant offers' });
  }
});

router.post('/offers', (req, res) => {
  try {
    const shopId = req.user.shop_id || req.user.id;
    const { title, discount_percent, max_discount_inr, valid_until, usage_limit, status } = req.body;

    if (!title || !discount_percent || !max_discount_inr || !valid_until) {
      return res.status(400).json({ success: false, error: 'Title, discount %, max discount INR, and valid until date are required' });
    }

    const result = db.prepare(`
      INSERT INTO offers (shop_id, title, discount_percent, required_points, max_discount_inr, valid_until, usage_limit, status)
      VALUES (?, ?, ?, 0, ?, ?, ?, ?)
    `).run(shopId, title.trim(), parseInt(discount_percent), parseInt(max_discount_inr), valid_until, parseInt(usage_limit) || 100, status || 'active');

    return res.status(201).json({ success: true, message: 'Merchant offer created successfully!', offerId: result.lastInsertRowid });
  } catch (error) {
    console.error('Create merchant offer error:', error);
    return res.status(500).json({ success: false, error: 'Failed to create merchant offer' });
  }
});

router.put('/offers/:id', (req, res) => {
  try {
    const shopId = req.user.shop_id || req.user.id;
    const { title, discount_percent, max_discount_inr, valid_until, usage_limit, status } = req.body;

    db.prepare(`
      UPDATE offers
      SET title = ?, discount_percent = ?, max_discount_inr = ?, valid_until = ?, usage_limit = ?, status = ?
      WHERE id = ? AND shop_id = ?
    `).run(title.trim(), parseInt(discount_percent), parseInt(max_discount_inr), valid_until, parseInt(usage_limit) || 100, status || 'active', req.params.id, shopId);

    return res.json({ success: true, message: 'Merchant offer updated successfully!' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to update merchant offer' });
  }
});

router.delete('/offers/:id', (req, res) => {
  try {
    const shopId = req.user.shop_id || req.user.id;
    db.prepare('DELETE FROM offers WHERE id = ? AND shop_id = ?').run(req.params.id, shopId);
    return res.json({ success: true, message: 'Offer deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to delete offer' });
  }
});

// ============================================================
// Merchant <-> Customer Chat
//
// SECURITY MODEL (read before editing):
//  * The shop identity is ALWAYS taken from the verified JWT
//    (req.user.shop_id || req.user.id). shop_id is NEVER read from the request —
//    a merchant can therefore only ever touch conversations for their own shop.
//  * Every conversation lookup is filtered by "shop_id = <jwt shop id>". A
//    conversation belonging to another shop returns 404 (not 403) so IDs cannot
//    be enumerated by probing.
//  * Merchants can only REPLY to conversations; creating a conversation is a
//    customer-only action (POST /api/customer/conversations).
// ============================================================
const { nowIso, validateMessageText } = require('../utils/chat');

// GET /api/merchant/conversations — conversations involving this shop, newest first,
// each with customer context, last message preview, and unread (customer->shop) count.
router.get('/conversations', (req, res) => {
  try {
    const shopId = req.user.shop_id || req.user.id;
    const conversations = db.prepare(`
      SELECT
        c.id, c.customer_id, c.created_at, c.updated_at, c.last_message_at,
        COALESCE(u.full_name, 'Customer') AS customer_name,
        (SELECT m.message_text FROM messages m WHERE m.conversation_id = c.id
           ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_message_text,
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id
           AND m.sender_role = 'customer' AND m.read_at IS NULL) AS unread_count
      FROM conversations c
      JOIN users u ON u.id = c.customer_id
      WHERE c.shop_id = ?
      ORDER BY COALESCE(c.last_message_at, c.created_at) DESC, c.id DESC
    `).all(shopId);

    const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
    return res.json({ success: true, conversations, total_unread: totalUnread });
  } catch (error) {
    console.error('List merchant conversations error:', error);
    return res.status(500).json({ success: false, error: 'Failed to load conversations' });
  }
});

// GET /api/merchant/conversations/unread-count — lightweight total for the nav badge.
router.get('/conversations/unread-count', (req, res) => {
  try {
    const shopId = req.user.shop_id || req.user.id;
    const row = db.prepare(`
      SELECT COUNT(*) AS unread
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE c.shop_id = ? AND m.sender_role = 'customer' AND m.read_at IS NULL
    `).get(shopId);
    return res.json({ success: true, unread_count: row ? row.unread : 0 });
  } catch (error) {
    console.error('Merchant unread-count error:', error);
    return res.status(500).json({ success: false, error: 'Failed to load unread count' });
  }
});

// GET /api/merchant/conversations/:id/messages — chronological messages for a
// conversation belonging to this shop. Non-owned/absent => 404.
router.get('/conversations/:id/messages', (req, res) => {
  try {
    const shopId = req.user.shop_id || req.user.id;
    const conversationId = parseInt(req.params.id, 10);
    if (!Number.isInteger(conversationId)) {
      return res.status(400).json({ success: false, error: 'Invalid conversation id' });
    }

    const conversation = db.prepare(`
      SELECT c.id, c.customer_id, c.created_at, c.last_message_at,
             COALESCE(u.full_name, 'Customer') AS customer_name
      FROM conversations c
      JOIN users u ON u.id = c.customer_id
      WHERE c.id = ? AND c.shop_id = ?
    `).get(conversationId, shopId);
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
    console.error('Get merchant messages error:', error);
    return res.status(500).json({ success: false, error: 'Failed to load messages' });
  }
});

// POST /api/merchant/conversations/:id/messages { message_text } — reply to a customer.
router.post('/conversations/:id/messages', (req, res) => {
  try {
    const shopId = req.user.shop_id || req.user.id;
    const conversationId = parseInt(req.params.id, 10);
    if (!Number.isInteger(conversationId)) {
      return res.status(400).json({ success: false, error: 'Invalid conversation id' });
    }

    const check = validateMessageText(req.body ? req.body.message_text : undefined);
    if (!check.ok) {
      return res.status(400).json({ success: false, error: check.error });
    }

    const conversation = db.prepare('SELECT id FROM conversations WHERE id = ? AND shop_id = ?')
      .get(conversationId, shopId);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const ts = nowIso();
    const send = db.transaction(() => {
      const info = db.prepare(`
        INSERT INTO messages (conversation_id, sender_role, sender_user_id, message_text, created_at, read_at)
        VALUES (?, 'shop', ?, ?, ?, NULL)
      `).run(conversationId, shopId, check.text, ts);
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
    console.error('Send merchant message error:', error);
    return res.status(500).json({ success: false, error: 'Failed to send message' });
  }
});

// PATCH|PUT /api/merchant/conversations/:id/read — mark customer->shop messages read.
function markMerchantConversationRead(req, res) {
  try {
    const shopId = req.user.shop_id || req.user.id;
    const conversationId = parseInt(req.params.id, 10);
    if (!Number.isInteger(conversationId)) {
      return res.status(400).json({ success: false, error: 'Invalid conversation id' });
    }

    const conversation = db.prepare('SELECT id FROM conversations WHERE id = ? AND shop_id = ?')
      .get(conversationId, shopId);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const info = db.prepare(`
      UPDATE messages SET read_at = ?
      WHERE conversation_id = ? AND sender_role = 'customer' AND read_at IS NULL
    `).run(nowIso(), conversationId);

    return res.json({ success: true, marked_read: info.changes });
  } catch (error) {
    console.error('Mark merchant read error:', error);
    return res.status(500).json({ success: false, error: 'Failed to mark as read' });
  }
}
router.patch('/conversations/:id/read', markMerchantConversationRead);
router.put('/conversations/:id/read', markMerchantConversationRead);

module.exports = router;
