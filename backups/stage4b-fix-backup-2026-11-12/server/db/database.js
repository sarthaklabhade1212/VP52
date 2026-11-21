const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const dbPath = path.join(__dirname, 'rewards.db');
const db = new Database(dbPath);

// Enable WAL mode & foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      password_hash TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      city_area TEXT,
      latitude REAL,
      longitude REAL,
      profile_photo TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS shops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_code TEXT UNIQUE,
      email TEXT UNIQUE,
      password_hash TEXT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      address TEXT NOT NULL,
      phone TEXT,
      image_url TEXT,
      status TEXT DEFAULT 'active',
      verification_status TEXT DEFAULT 'approved', -- pending, approved, rejected, suspended
      owner_name TEXT,
      latitude REAL DEFAULT 18.5204,
      longitude REAL DEFAULT 73.8567,
      rating REAL DEFAULT 4.8,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      photo_url TEXT,
      price REAL NOT NULL,
      category TEXT,
      reward_eligible INTEGER DEFAULT 1, -- 1 for true, 0 for false
      reward_percent INTEGER DEFAULT 10,
      description TEXT,
      availability TEXT DEFAULT 'available',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shop_id) REFERENCES shops (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      discount_percent INTEGER NOT NULL,
      required_points INTEGER DEFAULT 0,
      max_discount_inr INTEGER NOT NULL,
      valid_until DATE NOT NULL,
      usage_limit INTEGER DEFAULT 100,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shop_id) REFERENCES shops (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS wallets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      balance INTEGER DEFAULT 0,
      total_earned INTEGER DEFAULT 0,
      total_redeemed INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reward_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      activity_type TEXT NOT NULL,
      points INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS redemptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      redemption_code TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      offer_id INTEGER NOT NULL,
      shop_id INTEGER NOT NULL,
      points_deducted INTEGER NOT NULL,
      discount_percent INTEGER NOT NULL,
      max_discount_inr INTEGER NOT NULL,
      status TEXT DEFAULT 'ACTIVE', -- ACTIVE, USED, EXPIRED, CANCELLED
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      redeemed_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (offer_id) REFERENCES offers (id) ON DELETE CASCADE,
      FOREIGN KEY (shop_id) REFERENCES shops (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_number TEXT UNIQUE NOT NULL,
      shop_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      total_amount REAL NOT NULL,
      eligible_amount REAL NOT NULL,
      reward_percent INTEGER NOT NULL,
      points_awarded INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shop_id) REFERENCES shops (id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bill_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      subtotal REAL NOT NULL,
      reward_eligible INTEGER NOT NULL,
      FOREIGN KEY (bill_id) REFERENCES bills (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reward_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      status TEXT DEFAULT 'active', -- active, completed, expired
      points_accumulated INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      transaction_id TEXT,
      status TEXT DEFAULT 'open', -- open, under_review, resolved, closed
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      shop_id INTEGER NOT NULL,
      transaction_id TEXT,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (shop_id) REFERENCES shops (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      shop_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, shop_id),
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (shop_id) REFERENCES shops (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS admin_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reward_levels (
      level_name TEXT PRIMARY KEY,
      min_points INTEGER NOT NULL,
      benefits TEXT,
      discount_cap_percent INTEGER DEFAULT 10
    );

    CREATE TABLE IF NOT EXISTS coin_lots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      transaction_id TEXT,
      source TEXT NOT NULL, -- AD_REWARD, STORE_PURCHASE, BONUS
      coins_earned INTEGER NOT NULL,
      coins_remaining INTEGER NOT NULL,
      earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      status TEXT DEFAULT 'ACTIVE', -- ACTIVE, PARTIALLY_USED, USED, EXPIRED
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reward_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS point_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      transaction_id TEXT,
      type TEXT NOT NULL, -- EARNED, REDEEMED, BONUS, AD_REWARD, ADJUSTMENT, EXPIRY
      points INTEGER NOT NULL,
      previous_balance INTEGER NOT NULL,
      new_balance INTEGER NOT NULL,
      merchant_id INTEGER,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (merchant_id) REFERENCES shops (id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER,
      action TEXT NOT NULL,
      target_entity TEXT NOT NULL,
      metadata TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ============================================================
    -- Customer <-> Merchant Chat (added feature)
    --
    -- Design / portability:
    --  * created_at / updated_at / last_message_at / read_at store ISO-8601 UTC
    --    strings written by the application layer (see server/utils/chat.js),
    --    NOT datetime('now'), so the schema and all queries port to PostgreSQL
    --    without SQLite-specific date logic.
    --  * UNIQUE(customer_id, shop_id) guarantees at most ONE conversation per
    --    (customer, shop) pair — enforced by the DB, not by application checks.
    --  * ON DELETE CASCADE cleans up conversations + messages if a shop or
    --    customer is removed (covers the "deleted shop" case).
    --  * messages.sender_user_id is intentionally NOT a foreign key: it points at
    --    users.id when sender_role='customer' and shops.id when sender_role='shop',
    --    so it is qualified by sender_role rather than a single FK target.
    -- ============================================================
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      shop_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_message_at TEXT,
      UNIQUE(customer_id, shop_id),
      FOREIGN KEY (customer_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (shop_id) REFERENCES shops (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      sender_role TEXT NOT NULL CHECK (sender_role IN ('customer', 'shop')),
      sender_user_id INTEGER NOT NULL,
      message_text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      read_at TEXT,
      FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_conversations_customer ON conversations (customer_id, last_message_at);
    CREATE INDEX IF NOT EXISTS idx_conversations_shop ON conversations (shop_id, last_message_at);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages (conversation_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages (conversation_id, sender_role, read_at);
    CREATE TABLE IF NOT EXISTS vp52_coin_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      ads_completed INTEGER DEFAULT 0,
      started_at DATETIME,
      expires_at DATETIME,
      duration_seconds INTEGER DEFAULT 21600,
      status TEXT DEFAULT 'pending_ads',
      coins_earned REAL DEFAULT 0,
      reward_claimed INTEGER DEFAULT 0,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS account_deletion_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      identifier TEXT NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customer_otp_challenges (
      id TEXT PRIMARY KEY,
      phone TEXT NOT NULL,
      otp_hash TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      max_attempts INTEGER DEFAULT 5,
      expires_at DATETIME NOT NULL,
      consumed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ip_address TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_otp_phone ON customer_otp_challenges(phone, created_at);

    CREATE TABLE IF NOT EXISTS revoked_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_hash TEXT UNIQUE NOT NULL,
      revoked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_revoked_tokens ON revoked_tokens(token_hash);

    CREATE TABLE IF NOT EXISTS shop_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      photo_url TEXT NOT NULL,
      caption TEXT,
      is_cover INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS review_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
      reporter_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      status TEXT DEFAULT 'Pending',
      cancellation_reason TEXT,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      delivery_address TEXT,
      order_notes TEXT,
      total_amount REAL DEFAULT 0.0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      item_name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      item_total REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token_hash);

    -- ==============================================
    -- CENTRALIZED ADMIN PANEL TABLES
    -- ==============================================

    -- Dynamic Category & Subcategory Management
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT DEFAULT 'Store',
      catalog_type TEXT DEFAULT 'product',
      color TEXT DEFAULT '#D4AF37',
      description TEXT,
      is_active INTEGER DEFAULT 1,
      display_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS subcategories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id TEXT NOT NULL,
      name TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      display_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE
    );

    -- Admin Activity Logs (Comprehensive Audit Trail)
    CREATE TABLE IF NOT EXISTS admin_activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER,
      admin_name TEXT,
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      record_id TEXT,
      ip_address TEXT,
      old_value TEXT,
      new_value TEXT,
      reason TEXT,
      status TEXT DEFAULT 'success',
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Service Bookings (Appointments / Services)
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_number TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      shop_id INTEGER NOT NULL,
      service_id INTEGER,
      service_name TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      booking_date TEXT NOT NULL,
      booking_time TEXT NOT NULL,
      status TEXT DEFAULT 'Pending', -- Pending, Confirmed, Completed, Cancelled, Rejected
      cancellation_reason TEXT,
      total_amount REAL DEFAULT 0.0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (shop_id) REFERENCES shops (id)
    );

    -- Payment Records (Auditable Transaction Receipts)
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_reference TEXT UNIQUE NOT NULL,
      order_id INTEGER,
      booking_id INTEGER,
      user_id INTEGER NOT NULL,
      shop_id INTEGER,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'INR',
      payment_method TEXT DEFAULT 'cash', -- cash, upi, qr_discount, card
      status TEXT DEFAULT 'Successful', -- Pending, Successful, Failed, Refunded, Partially Refunded, Cancelled
      refund_amount REAL DEFAULT 0.0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (shop_id) REFERENCES shops (id)
    );

    -- Referral Tracking & Fraud Detection
    CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_user_id INTEGER NOT NULL,
      referred_user_id INTEGER UNIQUE NOT NULL,
      referral_code TEXT NOT NULL,
      status TEXT DEFAULT 'pending', -- pending, completed, rewarded, rejected, fraud_suspected
      coins_awarded INTEGER DEFAULT 0,
      reward_transaction_id TEXT,
      admin_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (referrer_user_id) REFERENCES users (id),
      FOREIGN KEY (referred_user_id) REFERENCES users (id)
    );

    -- Membership Plans (Configurable Future Tiers - Free currently)
    CREATE TABLE IF NOT EXISTS membership_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      price REAL DEFAULT 0.0,
      duration_days INTEGER DEFAULT 365,
      benefits_json TEXT,
      is_active INTEGER DEFAULT 0, -- Disabled in this release (Free)
      target_role TEXT DEFAULT 'customer',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_memberships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      plan_id INTEGER NOT NULL,
      status TEXT DEFAULT 'Free', -- Free, Active, Expired, Cancelled, Suspended
      start_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (plan_id) REFERENCES membership_plans (id)
    );

    -- Broadcast Notifications System
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      target_audience TEXT NOT NULL, -- all_customers, selected_customers, all_merchants, selected_merchants, category_merchants
      target_id TEXT,
      notification_type TEXT DEFAULT 'announcement', -- announcement, offer, merchant_approval, order_update, booking_update, reward, system
      delivery_channel TEXT DEFAULT 'in_app',
      is_sent INTEGER DEFAULT 1,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      read_count INTEGER DEFAULT 0,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      notification_id INTEGER NOT NULL,
      is_read INTEGER DEFAULT 0,
      read_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (notification_id) REFERENCES notifications (id) ON DELETE CASCADE
    );

    -- Advertisement Banners Management (Promotional Only, Separate from Rewarded Ads)
    CREATE TABLE IF NOT EXISTS advertisements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      banner_url TEXT NOT NULL,
      destination_url TEXT,
      display_location TEXT NOT NULL, -- home_banner, category_page, discovery_page, offers_page
      target_category TEXT,
      start_date DATE,
      end_date DATE,
      is_active INTEGER DEFAULT 1,
      impressions_count INTEGER DEFAULT 0,
      clicks_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Fraud Detection Alerts (Flags for Human Review)
    CREATE TABLE IF NOT EXISTS fraud_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_type TEXT NOT NULL, -- multiple_accounts_same_device, high_coin_velocity, referral_abuse, review_manipulation, abnormal_login
      severity TEXT DEFAULT 'medium', -- low, medium, high, critical
      target_type TEXT NOT NULL, -- user, merchant, transaction, referral
      target_id INTEGER NOT NULL,
      details TEXT NOT NULL,
      status TEXT DEFAULT 'pending_review', -- pending_review, reviewed_safe, action_taken
      action_taken_by INTEGER,
      action_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME
    );
  `);

  // Migrations for safety
  try {
    const { normalizePhoneNumber } = require('../utils/phone');
    const usersWithPhone = db.prepare("SELECT id, phone FROM users WHERE phone IS NOT NULL").all();
    const updatePhoneStmt = db.prepare("UPDATE users SET phone = ? WHERE id = ?");
    for (const u of usersWithPhone) {
      const res = normalizePhoneNumber(u.phone);
      if (res.isValid && res.normalized && res.normalized !== u.phone) {
        try {
          updatePhoneStmt.run(res.normalized, u.id);
        } catch (e) {}
      }
    }
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL;");
    const shopColumns = db.prepare("PRAGMA table_info(shops)").all().map(c => c.name);
    if (!shopColumns.includes('verification_status')) db.exec("ALTER TABLE shops ADD COLUMN verification_status TEXT DEFAULT 'approved';");
    if (!shopColumns.includes('owner_name')) db.exec("ALTER TABLE shops ADD COLUMN owner_name TEXT;");
    if (!shopColumns.includes('latitude')) db.exec("ALTER TABLE shops ADD COLUMN latitude REAL DEFAULT 18.5204;");
    if (!shopColumns.includes('longitude')) db.exec("ALTER TABLE shops ADD COLUMN longitude REAL DEFAULT 73.8567;");
    if (!shopColumns.includes('rating')) db.exec("ALTER TABLE shops ADD COLUMN rating REAL DEFAULT 4.8;");
    if (!shopColumns.includes('must_change_password')) db.exec("ALTER TABLE shops ADD COLUMN must_change_password INTEGER DEFAULT 0;");
    if (!shopColumns.includes('subcategory')) db.exec("ALTER TABLE shops ADD COLUMN subcategory TEXT;");
    if (!shopColumns.includes('whatsapp_number')) db.exec("ALTER TABLE shops ADD COLUMN whatsapp_number TEXT;");
    if (!shopColumns.includes('area_locality')) db.exec("ALTER TABLE shops ADD COLUMN area_locality TEXT;");
    if (!shopColumns.includes('city')) db.exec("ALTER TABLE shops ADD COLUMN city TEXT;");
    if (!shopColumns.includes('district')) db.exec("ALTER TABLE shops ADD COLUMN district TEXT;");
    if (!shopColumns.includes('state')) db.exec("ALTER TABLE shops ADD COLUMN state TEXT;");
    if (!shopColumns.includes('pincode')) db.exec("ALTER TABLE shops ADD COLUMN pincode TEXT;");
    if (!shopColumns.includes('logo_url')) db.exec("ALTER TABLE shops ADD COLUMN logo_url TEXT;");
    if (!shopColumns.includes('cover_photo_url')) db.exec("ALTER TABLE shops ADD COLUMN cover_photo_url TEXT;");
    if (!shopColumns.includes('opening_time')) db.exec("ALTER TABLE shops ADD COLUMN opening_time TEXT DEFAULT '09:00';");
    if (!shopColumns.includes('closing_time')) db.exec("ALTER TABLE shops ADD COLUMN closing_time TEXT DEFAULT '21:00';");
    if (!shopColumns.includes('business_hours')) db.exec("ALTER TABLE shops ADD COLUMN business_hours TEXT;");
    if (!shopColumns.includes('is_temporarily_closed')) db.exec("ALTER TABLE shops ADD COLUMN is_temporarily_closed INTEGER DEFAULT 0;");
    if (!shopColumns.includes('rejection_reason')) db.exec("ALTER TABLE shops ADD COLUMN rejection_reason TEXT;");
    if (!shopColumns.includes('auth_provider')) db.exec("ALTER TABLE shops ADD COLUMN auth_provider TEXT DEFAULT 'local';");
    if (!shopColumns.includes('google_id')) db.exec("ALTER TABLE shops ADD COLUMN google_id TEXT;");
    if (!shopColumns.includes('subscription_tier')) db.exec("ALTER TABLE shops ADD COLUMN subscription_tier TEXT DEFAULT 'free';");
    if (!shopColumns.includes('subscription_status')) db.exec("ALTER TABLE shops ADD COLUMN subscription_status TEXT DEFAULT 'active';");
    if (!shopColumns.includes('rating_avg')) db.exec("ALTER TABLE shops ADD COLUMN rating_avg REAL DEFAULT 4.8;");
    if (!shopColumns.includes('rating_count')) db.exec("ALTER TABLE shops ADD COLUMN rating_count INTEGER DEFAULT 0;");

    const productColumns = db.prepare("PRAGMA table_info(products)").all().map(c => c.name);
    if (!productColumns.includes('product_type')) db.exec("ALTER TABLE products ADD COLUMN product_type TEXT DEFAULT 'product';");
    if (!productColumns.includes('veg_non_veg')) db.exec("ALTER TABLE products ADD COLUMN veg_non_veg TEXT;");
    if (!productColumns.includes('food_category')) db.exec("ALTER TABLE products ADD COLUMN food_category TEXT;");
    if (!productColumns.includes('special_offer')) db.exec("ALTER TABLE products ADD COLUMN special_offer TEXT;");
    if (!productColumns.includes('fabric')) db.exec("ALTER TABLE products ADD COLUMN fabric TEXT;");
    if (!productColumns.includes('colour')) db.exec("ALTER TABLE products ADD COLUMN colour TEXT;");
    if (!productColumns.includes('size')) db.exec("ALTER TABLE products ADD COLUMN size TEXT;");
    if (!productColumns.includes('brand')) db.exec("ALTER TABLE products ADD COLUMN brand TEXT;");
    if (!productColumns.includes('specifications')) db.exec("ALTER TABLE products ADD COLUMN specifications TEXT;");
    if (!productColumns.includes('warranty')) db.exec("ALTER TABLE products ADD COLUMN warranty TEXT;");
    if (!productColumns.includes('price_max')) db.exec("ALTER TABLE products ADD COLUMN price_max REAL;");
    if (!productColumns.includes('duration')) db.exec("ALTER TABLE products ADD COLUMN duration TEXT;");
    if (!productColumns.includes('timings')) db.exec("ALTER TABLE products ADD COLUMN timings TEXT;");
    if (!productColumns.includes('facility_name')) db.exec("ALTER TABLE products ADD COLUMN facility_name TEXT;");
    if (!productColumns.includes('is_available')) db.exec("ALTER TABLE products ADD COLUMN is_available INTEGER DEFAULT 1;");
    if (!productColumns.includes('display_order')) db.exec("ALTER TABLE products ADD COLUMN display_order INTEGER DEFAULT 0;");
    if (!productColumns.includes('photos')) db.exec("ALTER TABLE products ADD COLUMN photos TEXT;");

    const reviewColumns = db.prepare("PRAGMA table_info(reviews)").all().map(c => c.name);
    if (!reviewColumns.includes('photo_url')) db.exec("ALTER TABLE reviews ADD COLUMN photo_url TEXT;");
    if (!reviewColumns.includes('merchant_reply')) db.exec("ALTER TABLE reviews ADD COLUMN merchant_reply TEXT;");
    if (!reviewColumns.includes('merchant_replied_at')) db.exec("ALTER TABLE reviews ADD COLUMN merchant_replied_at DATETIME;");
    if (!reviewColumns.includes('status')) db.exec("ALTER TABLE reviews ADD COLUMN status TEXT DEFAULT 'approved';");
    if (!reviewColumns.includes('is_verified_visit')) db.exec("ALTER TABLE reviews ADD COLUMN is_verified_visit INTEGER DEFAULT 0;");

    // Indexes for Marketplace Performance
    db.exec("CREATE INDEX IF NOT EXISTS idx_shops_category ON shops(category);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_shops_subcategory ON shops(subcategory);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_shops_status ON shops(status);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_shops_verification ON shops(verification_status);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_products_shop ON products(shop_id);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_products_type ON products(product_type);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_reviews_shop ON reviews(shop_id);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_orders_shop ON orders(shop_id);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_shop_photos_shop ON shop_photos(shop_id);");

    const userColumns = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
    if (!userColumns.includes('city_area')) db.exec("ALTER TABLE users ADD COLUMN city_area TEXT;");
    if (!userColumns.includes('latitude')) db.exec("ALTER TABLE users ADD COLUMN latitude REAL;");
    if (!userColumns.includes('longitude')) db.exec("ALTER TABLE users ADD COLUMN longitude REAL;");
    if (!userColumns.includes('profile_photo')) db.exec("ALTER TABLE users ADD COLUMN profile_photo TEXT;");
    if (!userColumns.includes('qr_token')) db.exec("ALTER TABLE users ADD COLUMN qr_token TEXT;");
    if (!userColumns.includes('qr_token_created_at')) db.exec("ALTER TABLE users ADD COLUMN qr_token_created_at DATETIME;");
    // Google Sign-In (customer only): additive columns + a partial unique index so a
    // Google identity maps to at most one customer. Existing rows keep google_subject_id
    // NULL and auth_provider defaulting to 'local'; no data is rewritten or removed.
    if (!userColumns.includes('google_subject_id')) db.exec("ALTER TABLE users ADD COLUMN google_subject_id TEXT;");
    if (!userColumns.includes('auth_provider')) db.exec("ALTER TABLE users ADD COLUMN auth_provider TEXT DEFAULT 'local';");
    if (!userColumns.includes('profile_completed')) {
      db.exec("ALTER TABLE users ADD COLUMN profile_completed INTEGER DEFAULT 0;");
      db.exec("UPDATE users SET profile_completed = 1 WHERE phone IS NOT NULL OR auth_provider = 'local';");
    }
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_subject_id ON users(google_subject_id) WHERE google_subject_id IS NOT NULL;");

    const levelColumns = db.prepare("PRAGMA table_info(reward_levels)").all().map(c => c.name);
    if (!levelColumns.includes('discount_cap_percent')) db.exec("ALTER TABLE reward_levels ADD COLUMN discount_cap_percent INTEGER DEFAULT 10;");

    const sessionColumns = db.prepare("PRAGMA table_info(reward_sessions)").all().map(c => c.name);
    if (!sessionColumns.includes('session_number_for_day')) db.exec("ALTER TABLE reward_sessions ADD COLUMN session_number_for_day INTEGER DEFAULT 1;");
    if (!sessionColumns.includes('ads_watched')) db.exec("ALTER TABLE reward_sessions ADD COLUMN ads_watched INTEGER DEFAULT 0;");
    if (!sessionColumns.includes('coins_earned')) db.exec("ALTER TABLE reward_sessions ADD COLUMN coins_earned INTEGER DEFAULT 0;");

    // VP52 Multi-Tier Coin System Additive Migrations
    const coinLotColumns = db.prepare("PRAGMA table_info(coin_lots)").all().map(c => c.name);
    if (!coinLotColumns.includes('tier')) db.exec("ALTER TABLE coin_lots ADD COLUMN tier TEXT DEFAULT 'Bronze';");
    if (!coinLotColumns.includes('original_amount')) db.exec("ALTER TABLE coin_lots ADD COLUMN original_amount INTEGER;");
    if (!coinLotColumns.includes('next_transition_at')) db.exec("ALTER TABLE coin_lots ADD COLUMN next_transition_at DATETIME;");
    if (!coinLotColumns.includes('last_transition_at')) db.exec("ALTER TABLE coin_lots ADD COLUMN last_transition_at DATETIME;");

    const offerColumns = db.prepare("PRAGMA table_info(offers)").all().map(c => c.name);
    if (!offerColumns.includes('tier_discounts')) db.exec("ALTER TABLE offers ADD COLUMN tier_discounts TEXT;");

    const redemptionColumns = db.prepare("PRAGMA table_info(redemptions)").all().map(c => c.name);
    if (!redemptionColumns.includes('coin_tier')) db.exec("ALTER TABLE redemptions ADD COLUMN coin_tier TEXT DEFAULT 'Bronze';");
    if (!redemptionColumns.includes('coin_lot_id')) db.exec("ALTER TABLE redemptions ADD COLUMN coin_lot_id INTEGER;");

    // Centralized Admin Panel Additional Migrations
    const adminColumns = db.prepare("PRAGMA table_info(admins)").all().map(c => c.name);
    if (!adminColumns.includes('role')) db.exec("ALTER TABLE admins ADD COLUMN role TEXT DEFAULT 'super_admin';");
    if (!adminColumns.includes('permissions')) db.exec("ALTER TABLE admins ADD COLUMN permissions TEXT DEFAULT '[\"*\"]';");
    if (!adminColumns.includes('status')) db.exec("ALTER TABLE admins ADD COLUMN status TEXT DEFAULT 'active';");
    if (!adminColumns.includes('phone')) db.exec("ALTER TABLE admins ADD COLUMN phone TEXT;");
    if (!adminColumns.includes('last_login_at')) db.exec("ALTER TABLE admins ADD COLUMN last_login_at DATETIME;");

    // Ensure production admin and initial admin have super_admin role
    db.prepare("UPDATE admins SET role = 'super_admin', permissions = '[\"*\"]', status = 'active' WHERE role IS NULL OR role = '';").run();

    if (!userColumns.includes('referral_code')) {
      db.exec("ALTER TABLE users ADD COLUMN referral_code TEXT;");
      const usersList = db.prepare("SELECT id FROM users WHERE referral_code IS NULL").all();
      const setRefStmt = db.prepare("UPDATE users SET referral_code = ? WHERE id = ?");
      for (const u of usersList) {
        const code = 'VP' + u.id + Math.random().toString(36).substring(2, 6).toUpperCase();
        try { setRefStmt.run(code, u.id); } catch (e) {}
      }
      db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code) WHERE referral_code IS NOT NULL;");
    }

    const ledgerColumns = db.prepare("PRAGMA table_info(point_ledger)").all().map(c => c.name);
    if (!ledgerColumns.includes('source')) db.exec("ALTER TABLE point_ledger ADD COLUMN source TEXT DEFAULT 'system';");
    if (!ledgerColumns.includes('authorized_admin_id')) db.exec("ALTER TABLE point_ledger ADD COLUMN authorized_admin_id INTEGER;");
    if (!ledgerColumns.includes('reference_id')) db.exec("ALTER TABLE point_ledger ADD COLUMN reference_id TEXT;");

    const complaintColumns = db.prepare("PRAGMA table_info(complaints)").all().map(c => c.name);
    if (!complaintColumns.includes('shop_id')) db.exec("ALTER TABLE complaints ADD COLUMN shop_id INTEGER;");
    if (!complaintColumns.includes('priority')) db.exec("ALTER TABLE complaints ADD COLUMN priority TEXT DEFAULT 'medium';");
    if (!complaintColumns.includes('internal_notes')) db.exec("ALTER TABLE complaints ADD COLUMN internal_notes TEXT;");
    if (!complaintColumns.includes('assigned_admin_id')) db.exec("ALTER TABLE complaints ADD COLUMN assigned_admin_id INTEGER;");
    if (!complaintColumns.includes('resolution')) db.exec("ALTER TABLE complaints ADD COLUMN resolution TEXT;");
    if (!complaintColumns.includes('resolved_at')) db.exec("ALTER TABLE complaints ADD COLUMN resolved_at DATETIME;");
    if (!complaintColumns.includes('updated_at')) db.exec("ALTER TABLE complaints ADD COLUMN updated_at DATETIME;");

    if (!offerColumns.includes('banner_url')) db.exec("ALTER TABLE offers ADD COLUMN banner_url TEXT;");
    if (!offerColumns.includes('terms_and_conditions')) db.exec("ALTER TABLE offers ADD COLUMN terms_and_conditions TEXT;");
    if (!offerColumns.includes('applicable_category')) db.exec("ALTER TABLE offers ADD COLUMN applicable_category TEXT;");
    if (!offerColumns.includes('start_date')) db.exec("ALTER TABLE offers ADD COLUMN start_date DATE;");
    if (!offerColumns.includes('end_date')) db.exec("ALTER TABLE offers ADD COLUMN end_date DATE;");

    // Seed master categories & subcategories from config if table is empty
    const catCount = db.prepare("SELECT COUNT(*) AS c FROM categories").get().c;
    if (catCount === 0) {
      const { CATEGORIES } = require('../config/categories');
      const insertCat = db.prepare(`
        INSERT OR IGNORE INTO categories (id, name, icon, catalog_type, color, description, is_active, display_order)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?)
      `);
      const insertSub = db.prepare(`
        INSERT OR IGNORE INTO subcategories (category_id, name, is_active, display_order)
        VALUES (?, ?, 1, ?)
      `);

      const seedTx = db.transaction(() => {
        CATEGORIES.forEach((cat, cIdx) => {
          insertCat.run(cat.id, cat.name, cat.icon || 'Store', cat.catalogType || 'product', cat.color || '#D4AF37', cat.description || '', cIdx);
          if (Array.isArray(cat.subcategories)) {
            cat.subcategories.forEach((sub, sIdx) => {
              insertSub.run(cat.id, sub, sIdx);
            });
          }
        });
      });
      seedTx();
      console.log('✅ Seeded master categories & subcategories into dynamic database tables');
    }

    // Seed default membership plans if empty
    const planCount = db.prepare("SELECT COUNT(*) AS c FROM membership_plans").get().c;
    if (planCount === 0) {
      const insertPlan = db.prepare(`
        INSERT INTO membership_plans (name, slug, description, price, duration_days, benefits_json, is_active, target_role)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertPlan.run(
        'Standard Free Member',
        'free-member',
        'Unlimited access to local shop discovery, VP52 coin earning sessions, and instant 1 coin = ₹1 discounts.',
        0.0,
        365,
        JSON.stringify(['1 Coin = ₹1 Discount', '6-Hour Coin Sessions', 'All 17 Categories', 'Free In-App Chat']),
        1,
        'customer'
      );
      insertPlan.run(
        'Merchant Free Tier',
        'merchant-free',
        'Free lifetime merchant shop profile, product catalog, photo gallery, customer reviews and in-app chat.',
        0.0,
        3650,
        JSON.stringify(['Free Registration', 'Unlimited Products & Menu Items', 'Photo Gallery', 'Review Management', 'Direct Customer Orders']),
        1,
        'merchant'
      );
      insertPlan.run(
        'VP52 Premium Club (Future)',
        'premium-club',
        'Future customer VIP tier with higher discount caps, exclusive partner offers and priority bookings.',
        99.0,
        365,
        JSON.stringify(['Higher Discount Cap', 'Exclusive Merchant Deals', 'Priority Customer Support']),
        0, // Disabled in current release
        'customer'
      );
    }

    // ============================================================
    // VP52 Unlimited 6-Hour Sessions, AdMob & Customer/Merchant Redemption System
    // ============================================================
    db.exec(`
      CREATE TABLE IF NOT EXISTS merchant_wallets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shop_id INTEGER UNIQUE NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        balance INTEGER DEFAULT 0,
        total_received INTEGER DEFAULT 0,
        total_spent INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS coin_redemption_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        redemption_id TEXT UNIQUE NOT NULL,
        secure_token TEXT UNIQUE NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        merchant_id INTEGER REFERENCES shops(id) ON DELETE SET NULL,
        coins_amount INTEGER NOT NULL,
        discount_inr REAL NOT NULL,
        status TEXT DEFAULT 'pending', -- pending, completed, cancelled, expired
        expires_at DATETIME NOT NULL,
        completed_at DATETIME,
        cancelled_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_redemption_token ON coin_redemption_requests(secure_token);
      CREATE INDEX IF NOT EXISTS idx_redemption_user ON coin_redemption_requests(user_id, status);
      CREATE INDEX IF NOT EXISTS idx_redemption_status ON coin_redemption_requests(status, expires_at);

      CREATE TABLE IF NOT EXISTS merchant_coin_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        transaction_id TEXT NOT NULL,
        redemption_id TEXT REFERENCES coin_redemption_requests(redemption_id),
        customer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        type TEXT NOT NULL, -- CUSTOMER_REDEMPTION, PLATFORM_USE, REVERSAL, ADJUSTMENT
        coins INTEGER NOT NULL,
        previous_balance INTEGER NOT NULL,
        new_balance INTEGER NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_mcl_shop ON merchant_coin_ledger(shop_id, created_at);

      CREATE TABLE IF NOT EXISTS coin_transfers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transfer_id TEXT UNIQUE NOT NULL,
        redemption_id TEXT NOT NULL REFERENCES coin_redemption_requests(redemption_id),
        customer_id INTEGER NOT NULL REFERENCES users(id),
        merchant_id INTEGER NOT NULL REFERENCES shops(id),
        coins_amount INTEGER NOT NULL,
        discount_inr REAL NOT NULL,
        customer_previous_balance INTEGER NOT NULL,
        customer_new_balance INTEGER NOT NULL,
        merchant_previous_balance INTEGER NOT NULL,
        merchant_new_balance INTEGER NOT NULL,
        status TEXT DEFAULT 'COMPLETED',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_transfers_cust ON coin_transfers(customer_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_transfers_merch ON coin_transfers(merchant_id, created_at);

      CREATE TABLE IF NOT EXISTS ad_event_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        ad_format TEXT DEFAULT 'native', -- native, banner, rewarded
        event_type TEXT NOT NULL, -- request, loaded, impression, click, error, reward_completed
        ad_unit_id TEXT,
        provider TEXT DEFAULT 'AdMob',
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_ad_events_type ON ad_event_logs(event_type, created_at);
    `);

    // Ensure all existing shops have a merchant_wallet row
    db.exec(`
      INSERT OR IGNORE INTO merchant_wallets (shop_id, balance, total_received, total_spent)
      SELECT id, 0, 0, 0 FROM shops WHERE id IS NOT NULL;
    `);

    // -------------------------------------------------------------
    // Permanent Merchant QR & Customer Coin Transfer Schema
    // -------------------------------------------------------------
    try { db.exec("ALTER TABLE shops ADD COLUMN permanent_qr_code TEXT"); } catch (_) {}
    try { db.exec("ALTER TABLE shops ADD COLUMN qr_status TEXT DEFAULT 'active'"); } catch (_) {}
    try { db.exec("ALTER TABLE shops ADD COLUMN qr_generated_at DATETIME"); } catch (_) {}
    try { db.exec("ALTER TABLE shops ADD COLUMN qr_revoked_at DATETIME"); } catch (_) {}
    try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_shops_permanent_qr ON shops(permanent_qr_code)"); } catch (_) {}

    try { db.exec("ALTER TABLE coin_transfers ADD COLUMN merchant_qr_code TEXT"); } catch (_) {}
    try { db.exec("ALTER TABLE coin_transfers ADD COLUMN idempotency_key TEXT"); } catch (_) {}
    try { db.exec("CREATE INDEX IF NOT EXISTS idx_transfers_idempotency ON coin_transfers(idempotency_key)"); } catch (_) {}

    db.exec(`
      CREATE TABLE IF NOT EXISTS merchant_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        notification_type TEXT DEFAULT 'coin_received',
        metadata TEXT,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_merchant_notif_shop ON merchant_notifications(shop_id, is_read, created_at);

      CREATE TABLE IF NOT EXISTS merchant_revoked_qr_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        qr_code TEXT UNIQUE NOT NULL,
        revoked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        reason TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_revoked_qr ON merchant_revoked_qr_codes(qr_code);
    `);

    // Ensure all existing shops have a unique permanent QR code
    const shopsWithoutQr = db.prepare("SELECT id, shop_code FROM shops WHERE permanent_qr_code IS NULL OR permanent_qr_code = ''").all();
    if (shopsWithoutQr && shopsWithoutQr.length > 0) {
      const updateQr = db.prepare("UPDATE shops SET permanent_qr_code = ?, qr_status = 'active', qr_generated_at = datetime('now') WHERE id = ?");
      for (const s of shopsWithoutQr) {
        const uniqueQr = 'VP52-MCH-' + crypto.randomBytes(10).toString('hex').toUpperCase();
        updateQr.run(uniqueQr, s.id);
      }
    }
  } catch (e) {
    console.error('Migration error:', e.message);
  }
}

initDatabase();

module.exports = db;
