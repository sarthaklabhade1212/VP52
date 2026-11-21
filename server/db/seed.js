require('dotenv').config();

// Strict Production Environment Guard
// The demo seed wipes all tables and populates well-known demo credentials.
// It is strictly restricted to development/test environments.
if (process.env.NODE_ENV === 'production') {
  console.error(
    '⛔ FATAL: Refusing to run demo seed in production (NODE_ENV=production).\n' +
    '   Demo accounts and destructive table deletion are strictly prohibited in production.\n' +
    '   Provision production accounts using: npm run admin -- create <email>'
  );
  process.exit(1);
}

const db = require('./database');
const bcrypt = require('bcryptjs');

function seedDatabase() {
  console.log('🌱 Seeding Rewards App database...');

  // Clear existing tables in order
  db.exec('DELETE FROM bill_items;');
  db.exec('DELETE FROM bills;');
  db.exec('DELETE FROM products;');
  db.exec('DELETE FROM reward_sessions;');
  db.exec('DELETE FROM complaints;');
  db.exec('DELETE FROM reviews;');
  db.exec('DELETE FROM favorites;');
  db.exec('DELETE FROM reward_levels;');
  db.exec('DELETE FROM redemptions;');
  db.exec('DELETE FROM reward_transactions;');
  db.exec('DELETE FROM wallets;');
  db.exec('DELETE FROM offers;');
  db.exec('DELETE FROM shops;');
  db.exec('DELETE FROM users;');
  db.exec('DELETE FROM admins;');
  db.exec('DELETE FROM admin_settings;');

  // Reset sqlite autoincrement sequences
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('users', 'admins', 'shops', 'offers', 'wallets', 'reward_transactions', 'redemptions');");

  // 1. Create Admin
  const adminPassword = bcrypt.hashSync('Admin@123', 10);
  const adminInsert = db.prepare(`
    INSERT INTO admins (full_name, email, password_hash)
    VALUES (?, ?, ?)
  `);
  adminInsert.run('System Administrator', 'admin@example.com', adminPassword);
  console.log('✅ Created Demo Admin (admin@example.com / Admin@123)');

  // 2. Create Customers
  const customerPassword = bcrypt.hashSync('Customer@123', 10);
  const userInsert = db.prepare(`
    INSERT INTO users (full_name, email, phone, password_hash, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Main Demo Customer (1,250 current balance: 1,750 earned - 500 redeemed)
  const c1 = userInsert.run('Sarthak Labhade', 'customer@example.com', '+91 98765 43210', customerPassword, 'active', '2026-01-10 10:00:00');
  const c2 = userInsert.run('Rahul Sharma', 'rahul.sharma@example.com', '+91 98123 45678', customerPassword, 'active', '2026-01-15 11:30:00');
  const c3 = userInsert.run('Ananya Patel', 'ananya.p@example.com', '+91 97234 56789', customerPassword, 'active', '2026-02-01 14:15:00');
  const c4 = userInsert.run('Vikram Singh', 'vikram.singh@example.com', '+91 96345 67890', customerPassword, 'active', '2026-02-05 09:45:00');
  const c5 = userInsert.run('Priya Verma', 'priya.verma@example.com', '+91 95456 78901', customerPassword, 'suspended', '2026-02-10 16:20:00');

  console.log('✅ Created 5 Demo Customers (including customer@example.com / Customer@123)');

  // 3. Create Wallets
  const walletInsert = db.prepare(`
    INSERT INTO wallets (user_id, balance, total_earned, total_redeemed)
    VALUES (?, ?, ?, ?)
  `);
  walletInsert.run(c1.lastInsertRowid, 1250, 1750, 500); // 1,250 points demo customer
  walletInsert.run(c2.lastInsertRowid, 900, 1400, 500);
  walletInsert.run(c3.lastInsertRowid, 2100, 2600, 500);
  walletInsert.run(c4.lastInsertRowid, 450, 700, 250);
  walletInsert.run(c5.lastInsertRowid, 100, 100, 0);

  // 4. Create Physical Shops with Credentials
  const shopPassword = bcrypt.hashSync('Shop@123', 10);
  const shopInsert = db.prepare(`
    INSERT INTO shops (shop_code, email, password_hash, name, category, description, address, phone, image_url, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const s1 = shopInsert.run(
    'SHOP-001',
    'shop@example.com',
    shopPassword,
    'ABC Café',
    'Café & Bakery',
    'Artisanal coffee, fresh pastries, and cozy ambiance for work & chilling.',
    'FC Road, Shivajinagar, Pune, Maharashtra 411004',
    '+91 20 2567 8900',
    'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=600&q=80',
    'active'
  );

  const s2 = shopInsert.run(
    'SHOP-002',
    'cityrest@example.com',
    shopPassword,
    'City Restaurant',
    'Fine Dining',
    'Authentic North & South Indian delicacies, family thalis, and tandoori specialties.',
    'MG Road, Near Metro Station, Bengaluru, Karnataka 560001',
    '+91 80 4112 3456',
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80',
    'active'
  );

  const s3 = shopInsert.run(
    'SHOP-003',
    'stationery@example.com',
    shopPassword,
    'Smart Stationery',
    'Books & Supplies',
    'Premium notebooks, art supplies, school textbooks, and office essentials.',
    'Connaught Place, Block B, New Delhi 110001',
    '+91 11 2341 5678',
    'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=600&q=80',
    'active'
  );

  const s4 = shopInsert.run(
    'SHOP-004',
    'fashion@example.com',
    shopPassword,
    'Fashion Point',
    'Clothing & Apparel',
    'Trendy streetwear, ethnic fusion, denim, and seasonal accessories.',
    'Bandra West, Hill Road, Mumbai, Maharashtra 400050',
    '+91 22 2640 1234',
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=600&q=80',
    'active'
  );

  const s5 = shopInsert.run(
    'SHOP-005',
    'techworld@example.com',
    shopPassword,
    'Tech World',
    'Electronics & Accessories',
    'Smartwatch straps, wireless earbuds, phone covers, and fast chargers.',
    '100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038',
    '+91 80 2520 9988',
    'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=600&q=80',
    'active'
  );

  console.log('✅ Created 5 Physical Shops with Shop Accounts (shop@example.com / Shop@123)');

  // 5. Create Discount Offers (10 offers)
  const offerInsert = db.prepare(`
    INSERT INTO offers (shop_id, title, discount_percent, required_points, max_discount_inr, valid_until, usage_limit, status)
    VALUES (?, ?, ?, 0, ?, ?, ?, ?)
  `);

  const o1 = offerInsert.run(s1.lastInsertRowid, '10% OFF Total Bill', 10, 100, '2026-09-30', 200, 'active');
  const o2 = offerInsert.run(s1.lastInsertRowid, '20% OFF Coffee & Dessert Combo', 20, 200, '2026-10-15', 100, 'active');
  const o3 = offerInsert.run(s2.lastInsertRowid, '15% OFF Family Lunch/Dinner', 15, 200, '2026-11-30', 150, 'active');
  const o4 = offerInsert.run(s2.lastInsertRowid, '25% OFF Weekend Special Buffet', 25, 400, '2026-12-31', 75, 'active');
  const o5 = offerInsert.run(s3.lastInsertRowid, '5% OFF Any Stationery Purchase', 5, 50, '2026-09-30', 300, 'active');
  const o6 = offerInsert.run(s3.lastInsertRowid, '12% OFF Premium Art Supplies', 12, 150, '2026-10-31', 120, 'active');
  const o7 = offerInsert.run(s4.lastInsertRowid, '20% OFF Flat Discount on Apparel', 20, 500, '2026-12-15', 100, 'active');
  const o8 = offerInsert.run(s4.lastInsertRowid, '10% OFF Fashion Accessories', 10, 250, '2026-11-15', 250, 'active');
  const o9 = offerInsert.run(s5.lastInsertRowid, '8% OFF Wireless Audio Devices', 8, 350, '2026-10-30', 90, 'active');
  const o10 = offerInsert.run(s5.lastInsertRowid, '15% OFF Mobile Accessories', 15, 600, '2026-12-31', 150, 'active');

  console.log('✅ Created 10 Discount Offers');

  // 6. Create Reward Transactions (20 reward logs)
  const rewardInsert = db.prepare(`
    INSERT INTO reward_transactions (user_id, activity_type, points, created_at)
    VALUES (?, ?, ?, ?)
  `);

  const dates = [
    '2026-08-18 13:45:00', '2026-08-18 12:30:00', '2026-08-18 10:15:00',
    '2026-08-17 19:20:00', '2026-08-17 16:10:00', '2026-08-17 14:00:00',
    '2026-08-16 21:05:00', '2026-08-16 18:30:00', '2026-08-15 15:45:00',
    '2026-08-15 11:20:00', '2026-08-14 20:00:00', '2026-08-14 17:15:00',
    '2026-08-13 13:10:00', '2026-08-12 19:50:00', '2026-08-11 15:25:00',
    '2026-08-10 18:40:00', '2026-08-09 12:00:00', '2026-08-08 16:30:00',
    '2026-08-07 14:20:00', '2026-08-06 10:00:00'
  ];

  // 20 entries for various users
  dates.forEach((d, i) => {
    const uid = (i % 4) + 1; // Users 1 to 4
    rewardInsert.run(uid, 'Sponsored Content Reward', 100, d);
  });

  console.log('✅ Created 20 Reward Transactions');

  // 7. Create Redemption Transactions (10 redemptions)
  const redemptionInsert = db.prepare(`
    INSERT INTO redemptions (redemption_code, user_id, offer_id, shop_id, points_deducted, discount_percent, max_discount_inr, status, created_at, redeemed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Active redemption for customer@example.com (RW-2026-000123 as requested in prompt spec!)
  redemptionInsert.run('RW-2026-000123', c1.lastInsertRowid, o1.lastInsertRowid, s1.lastInsertRowid, 500, 10, 100, 'ACTIVE', '2026-08-18 11:00:00', null);
  
  // Historical redemptions
  redemptionInsert.run('RW-2026-000122', c2.lastInsertRowid, o1.lastInsertRowid, s1.lastInsertRowid, 500, 10, 100, 'USED', '2026-08-17 15:30:00', '2026-08-17 16:00:00');
  redemptionInsert.run('RW-2026-000121', c3.lastInsertRowid, o3.lastInsertRowid, s2.lastInsertRowid, 1000, 15, 200, 'USED', '2026-08-16 19:45:00', '2026-08-16 20:15:00');
  redemptionInsert.run('RW-2026-000120', c4.lastInsertRowid, o5.lastInsertRowid, s3.lastInsertRowid, 250, 5, 50, 'USED', '2026-08-15 14:10:00', '2026-08-15 14:40:00');
  redemptionInsert.run('RW-2026-000119', c1.lastInsertRowid, o5.lastInsertRowid, s3.lastInsertRowid, 250, 5, 50, 'EXPIRED', '2026-07-10 10:00:00', null);
  redemptionInsert.run('RW-2026-000118', c3.lastInsertRowid, o7.lastInsertRowid, s4.lastInsertRowid, 1200, 20, 500, 'USED', '2026-08-14 18:20:00', '2026-08-14 19:00:00');
  redemptionInsert.run('RW-2026-000117', c2.lastInsertRowid, o9.lastInsertRowid, s5.lastInsertRowid, 700, 8, 350, 'USED', '2026-08-13 12:15:00', '2026-08-13 13:00:00');
  redemptionInsert.run('RW-2026-000116', c1.lastInsertRowid, o2.lastInsertRowid, s1.lastInsertRowid, 800, 20, 200, 'USED', '2026-08-12 17:00:00', '2026-08-12 17:45:00');
  redemptionInsert.run('RW-2026-000115', c3.lastInsertRowid, o4.lastInsertRowid, s2.lastInsertRowid, 1500, 25, 400, 'ACTIVE', '2026-08-18 09:30:00', null);
  redemptionInsert.run('RW-2026-000114', c4.lastInsertRowid, o6.lastInsertRowid, s3.lastInsertRowid, 400, 12, 150, 'USED', '2026-08-11 11:40:00', '2026-08-11 12:10:00');

  console.log('✅ Created 10 Redemption Transactions (including RW-2026-000123)');

  // 8. Create Sample Products & Services for Itemized Billing
  const prodInsert = db.prepare(`
    INSERT INTO products (shop_id, name, photo_url, price, category, reward_eligible, reward_percent, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // ABC Café Products (s1)
  prodInsert.run(s1.lastInsertRowid, 'Artisanal Cappuccino', 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=400&q=80', 180, 'Beverage', 1, 10, 'Rich espresso with steamed milk froth');
  prodInsert.run(s1.lastInsertRowid, 'Butter Croissant', 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=400&q=80', 120, 'Bakery', 1, 10, 'Freshly baked flaky butter croissant');
  prodInsert.run(s1.lastInsertRowid, 'Private Event Space Rent', 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=400&q=80', 2500, 'Services', 0, 0, 'Hourly rental for private party space (Non-eligible)');

  // City Restaurant Products (s2)
  prodInsert.run(s2.lastInsertRowid, 'Special Royal Thali', 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=400&q=80', 350, 'Food', 1, 15, 'Complete traditional thali with paneer & desserts');
  prodInsert.run(s2.lastInsertRowid, 'Weekend Buffet Pass', 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=400&q=80', 799, 'Food', 1, 15, 'Unlimited lunch/dinner buffet');

  // Smart Stationery Products (s3)
  prodInsert.run(s3.lastInsertRowid, 'Premium Journal Notebook', 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=400&q=80', 250, 'Supplies', 1, 5, 'Hardcover ruled notebook');
  prodInsert.run(s3.lastInsertRowid, 'Art Paint Set', 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=400&q=80', 450, 'Art', 1, 5, 'Acrylic paint set with brushes');

  console.log('✅ Created Products & Services for Itemized Billing');

  // 9. Reward Levels Configuration (with discount_cap_percent)
  db.exec('DELETE FROM reward_levels');
  const levelInsert = db.prepare(`
    INSERT INTO reward_levels (level_name, min_points, benefits, discount_cap_percent)
    VALUES (?, ?, ?, ?)
  `);
  levelInsert.run('Basic', 0, 'Standard Membership & Access to local shop offers', 5);
  levelInsert.run('Silver', 100, 'Silver Member & Up to 7% Max Discount Cap', 7);
  levelInsert.run('Gold', 500, 'Gold Member & Up to 10% Max Discount Cap', 10);
  levelInsert.run('Diamond', 1500, 'Diamond Member & Up to 15% Max Discount Cap', 15);
  levelInsert.run('Platinum', 5000, 'Platinum VIP Member & Up to 20% Max Discount Cap', 20);

  console.log('✅ Configured Reward Levels (Basic 5%, Silver 7%, Gold 10%, Diamond 15%, Platinum 20%)');

  // 10. Platform Reward Settings
  db.exec('DELETE FROM reward_settings');
  const settingsInsert = db.prepare(`
    INSERT INTO reward_settings (key, value, description)
    VALUES (?, ?, ?)
  `);
  settingsInsert.run('session_duration_hours', '6', 'Duration of each reward session in hours');
  settingsInsert.run('ads_per_session', '3', 'Maximum ads allowed per reward session');
  settingsInsert.run('max_sessions_per_day', '2', 'Maximum reward sessions allowed per 24 hours');
  settingsInsert.run('coins_per_ad', '2', 'Coins awarded per completed advertisement');
  settingsInsert.run('coin_expiry_days', '30', 'Days before an earned coin lot expires');
  settingsInsert.run('coin_value_inr', '1', 'Fixed rupee value per coin (1 Coin = ₹1)');

  console.log('✅ Configured Platform Reward Settings');
  console.log('🎉 Database seeding finished successfully!');
}

// Safety guard: the demo seed wipes and repopulates tables with well-known
// credentials. It must never run against a production database.
if (process.env.NODE_ENV === 'production') {
  console.error(
    '✋ Refusing to run the demo seed in production (NODE_ENV=production). ' +
    'Demo data is for local development only; provision the first admin securely instead.'
  );
  process.exit(1);
}

seedDatabase();
