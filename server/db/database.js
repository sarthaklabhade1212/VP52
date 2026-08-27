const Database = require('better-sqlite3');
const path = require('path');

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
  `);

  // Migrations for safety
  try {
    const shopColumns = db.prepare("PRAGMA table_info(shops)").all().map(c => c.name);
    if (!shopColumns.includes('verification_status')) db.exec("ALTER TABLE shops ADD COLUMN verification_status TEXT DEFAULT 'approved';");
    if (!shopColumns.includes('owner_name')) db.exec("ALTER TABLE shops ADD COLUMN owner_name TEXT;");
    if (!shopColumns.includes('latitude')) db.exec("ALTER TABLE shops ADD COLUMN latitude REAL DEFAULT 18.5204;");
    if (!shopColumns.includes('longitude')) db.exec("ALTER TABLE shops ADD COLUMN longitude REAL DEFAULT 73.8567;");
    if (!shopColumns.includes('rating')) db.exec("ALTER TABLE shops ADD COLUMN rating REAL DEFAULT 4.8;");
    if (!shopColumns.includes('must_change_password')) db.exec("ALTER TABLE shops ADD COLUMN must_change_password INTEGER DEFAULT 0;");

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
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_subject_id ON users(google_subject_id) WHERE google_subject_id IS NOT NULL;");

    const levelColumns = db.prepare("PRAGMA table_info(reward_levels)").all().map(c => c.name);
    if (!levelColumns.includes('discount_cap_percent')) db.exec("ALTER TABLE reward_levels ADD COLUMN discount_cap_percent INTEGER DEFAULT 10;");

    const sessionColumns = db.prepare("PRAGMA table_info(reward_sessions)").all().map(c => c.name);
    if (!sessionColumns.includes('session_number_for_day')) db.exec("ALTER TABLE reward_sessions ADD COLUMN session_number_for_day INTEGER DEFAULT 1;");
    if (!sessionColumns.includes('ads_watched')) db.exec("ALTER TABLE reward_sessions ADD COLUMN ads_watched INTEGER DEFAULT 0;");
    if (!sessionColumns.includes('coins_earned')) db.exec("ALTER TABLE reward_sessions ADD COLUMN coins_earned INTEGER DEFAULT 0;");
  } catch (e) {
    console.error('Migration error:', e.message);
  }
}

initDatabase();

module.exports = db;
