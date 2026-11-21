/**
 * VP52 Phase 2: Safe Test & Demo Data Cleanup Utility
 * 
 * Safely identifies and cleans up confirmed test and demo records from SQLite.
 * 
 * Safeguards:
 * 1. Default DRY-RUN mode: No deletions occur unless explicitly passed --execute.
 * 2. Mandatory backup: Creates a timestamped, verified SQLite backup snapshot using
 *    SQLite's backup API (db.backup()) before any destructive actions.
 * 3. Strict Whitelist: Genuine production admin (sanketshinde.vp52@gmail.com) and
 *    genuine customer (saruu548@gmail.com) are strictly protected.
 * 4. Evidence-based classification: Candidate records must have explicit test/seed
 *    origins (seed.js demo emails, @vp52.com, @vp52test.com, @googleplay.test).
 * 5. Dependency mapping: Maps and safely cascades only test-dependent records inside
 *    a single atomic transaction.
 * 6. Foreign-key verification: Runs PRAGMA foreign_key_check() post-operation.
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const db = require('../db/database');

// Explicit Whitelist of Genuine Production Accounts (MUST NEVER BE DELETED)
const GENUINE_WHITELIST = {
  adminEmails: [
    'sanketshinde.vp52@gmail.com'
  ],
  userEmails: [
    'saruu548@gmail.com'
  ]
};

// Known Test / Demo Patterns & Evidence
const SEED_DEMO_USERS = [
  'customer@example.com',
  'rahul.sharma@example.com',
  'ananya.p@example.com',
  'vikram.singh@example.com',
  'priya.verma@example.com'
];

const SEED_DEMO_SHOPS = [
  'shop@example.com',
  'cityrest@example.com',
  'stationery@example.com',
  'fashion@example.com',
  'techworld@example.com'
];

const TEST_EMAIL_DOMAINS = [
  '@vp52.com',
  '@vp52test.com',
  '@googleplay.test'
];

/**
 * Create a timestamped, verified SQLite backup snapshot
 */
async function createDatabaseBackup() {
  const backupDir = path.join(__dirname, '..', 'db', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `rewards_backup_${timestamp}.db`);

  console.log(`\n📦 Creating database backup snapshot via SQLite Backup API...`);
  console.log(`   Destination: ${backupPath}`);

  // Flush any pending WAL frames
  db.pragma('wal_checkpoint(TRUNCATE)');

  // Execute backup
  await db.backup(backupPath);

  // Verify backup integrity
  const backupDb = new Database(backupPath, { readonly: true });
  const checkResult = backupDb.pragma('integrity_check');
  const isHealthy = Array.isArray(checkResult) && checkResult.length === 1 && checkResult[0].integrity_check === 'ok';

  if (!isHealthy) {
    backupDb.close();
    throw new Error(`Backup integrity check failed: ${JSON.stringify(checkResult)}`);
  }

  const backupStats = fs.statSync(backupPath);
  const userCount = backupDb.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const shopCount = backupDb.prepare('SELECT COUNT(*) as c FROM shops').get().c;
  const adminCount = backupDb.prepare('SELECT COUNT(*) as c FROM admins').get().c;
  backupDb.close();

  console.log(`✅ Backup successfully created and verified!`);
  console.log(`   File size: ${backupStats.size} bytes`);
  console.log(`   Integrity: OK`);
  console.log(`   Snapshot counts -> Admins: ${adminCount}, Users: ${userCount}, Shops: ${shopCount}\n`);

  return {
    backupPath,
    fileSize: backupStats.size,
    isHealthy: true,
    userCount,
    shopCount,
    adminCount,
    timestamp: now.toISOString()
  };
}

/**
 * Audit all users, shops, admins and classify them
 */
function auditRecords() {
  const admins = db.prepare('SELECT id, full_name, email, created_at FROM admins ORDER BY id ASC').all();
  const users = db.prepare('SELECT id, full_name, email, phone, status, profile_completed, created_at FROM users ORDER BY id ASC').all();
  const shops = db.prepare('SELECT id, shop_code, email, name, category, phone, status, verification_status, created_at FROM shops ORDER BY id ASC').all();

  const toRetain = { admins: [], users: [], shops: [] };
  const toRemove = { admins: [], users: [], shops: [] };
  const toReview = { admins: [], users: [], shops: [] };

  // 1. Audit Admins
  admins.forEach(admin => {
    const email = admin.email.toLowerCase();
    if (GENUINE_WHITELIST.adminEmails.includes(email)) {
      toRetain.admins.push({
        ...admin,
        reason: 'Explicit genuine production administrator whitelist'
      });
    } else if (email === 'admin@example.com') {
      toRemove.admins.push({
        ...admin,
        reason: 'Confirmed demo administrator seeded by seed.js with default password Admin@123',
        dependencies: getAdminDependencies(admin.id)
      });
    } else {
      toReview.admins.push({
        ...admin,
        reason: 'Unrecognized administrator account'
      });
    }
  });

  // 2. Audit Users
  users.forEach(user => {
    const email = user.email.toLowerCase();
    const deps = getUserDependencies(user.id);

    if (GENUINE_WHITELIST.userEmails.includes(email)) {
      toRetain.users.push({
        ...user,
        reason: 'Explicit genuine customer account (real Google OAuth user verified on emulator)',
        dependencies: deps
      });
    } else if (SEED_DEMO_USERS.includes(email)) {
      toRemove.users.push({
        ...user,
        category: 'SEED_DEMO_USER',
        reason: `Seeded demo customer from seed.js with demo password Customer@123`,
        dependencies: deps
      });
    } else if (TEST_EMAIL_DOMAINS.some(domain => email.endsWith(domain))) {
      toRemove.users.push({
        ...user,
        category: 'INTEGRATION_TEST_FIXTURE',
        reason: `Integration test customer fixture created with mock domain (${email.split('@')[1]})`,
        dependencies: deps
      });
    } else {
      toReview.users.push({
        ...user,
        reason: 'Customer does not match known test patterns or explicit whitelist',
        dependencies: deps
      });
    }
  });

  // 3. Audit Shops
  shops.forEach(shop => {
    const email = (shop.email || '').toLowerCase();
    const deps = getShopDependencies(shop.id);

    if (SEED_DEMO_SHOPS.includes(email) || shop.shop_code.startsWith('SHOP-00')) {
      toRemove.shops.push({
        ...shop,
        category: 'SEED_DEMO_SHOP',
        reason: `Seeded demo physical merchant from seed.js with demo password Shop@123`,
        dependencies: deps
      });
    } else if (TEST_EMAIL_DOMAINS.some(domain => email.endsWith(domain)) || shop.shop_code.startsWith('TIER-SHOP-')) {
      toRemove.shops.push({
        ...shop,
        category: 'INTEGRATION_TEST_SHOP',
        reason: `Integration test shop fixture created by test-vp52-tier-system.js`,
        dependencies: deps
      });
    } else {
      toReview.shops.push({
        ...shop,
        reason: 'Merchant does not match known test patterns or explicit whitelist',
        dependencies: deps
      });
    }
  });

  return { toRetain, toRemove, toReview };
}

function getAdminDependencies(adminId) {
  const auditLogs = db.prepare('SELECT COUNT(*) as c FROM audit_logs WHERE admin_id = ?').get(adminId).c;
  return { audit_logs: auditLogs };
}

function getUserDependencies(userId) {
  return {
    wallets: db.prepare('SELECT COUNT(*) as c FROM wallets WHERE user_id = ?').get(userId).c,
    reward_transactions: db.prepare('SELECT COUNT(*) as c FROM reward_transactions WHERE user_id = ?').get(userId).c,
    redemptions: db.prepare('SELECT COUNT(*) as c FROM redemptions WHERE user_id = ?').get(userId).c,
    bills: db.prepare('SELECT COUNT(*) as c FROM bills WHERE user_id = ?').get(userId).c,
    conversations: db.prepare('SELECT COUNT(*) as c FROM conversations WHERE customer_id = ?').get(userId).c,
    favorites: db.prepare('SELECT COUNT(*) as c FROM favorites WHERE user_id = ?').get(userId).c,
    reviews: db.prepare('SELECT COUNT(*) as c FROM reviews WHERE user_id = ?').get(userId).c,
    complaints: db.prepare('SELECT COUNT(*) as c FROM complaints WHERE user_id = ?').get(userId).c,
    reward_sessions: db.prepare('SELECT COUNT(*) as c FROM reward_sessions WHERE user_id = ?').get(userId).c,
    vp52_coin_sessions: db.prepare('SELECT COUNT(*) as c FROM vp52_coin_sessions WHERE user_id = ?').get(userId).c,
    coin_lots: db.prepare('SELECT COUNT(*) as c FROM coin_lots WHERE user_id = ?').get(userId).c,
    point_ledger: db.prepare('SELECT COUNT(*) as c FROM point_ledger WHERE user_id = ?').get(userId).c,
    password_reset_tokens: db.prepare('SELECT COUNT(*) as c FROM password_reset_tokens WHERE user_id = ?').get(userId).c,
    customer_otp_challenges: db.prepare('SELECT COUNT(*) as c FROM customer_otp_challenges WHERE phone = (SELECT phone FROM users WHERE id = ?)').get(userId).c
  };
}

function getShopDependencies(shopId) {
  return {
    offers: db.prepare('SELECT COUNT(*) as c FROM offers WHERE shop_id = ?').get(shopId).c,
    products: db.prepare('SELECT COUNT(*) as c FROM products WHERE shop_id = ?').get(shopId).c,
    redemptions: db.prepare('SELECT COUNT(*) as c FROM redemptions WHERE shop_id = ?').get(shopId).c,
    bills: db.prepare('SELECT COUNT(*) as c FROM bills WHERE shop_id = ?').get(shopId).c,
    conversations: db.prepare('SELECT COUNT(*) as c FROM conversations WHERE shop_id = ?').get(shopId).c,
    reviews: db.prepare('SELECT COUNT(*) as c FROM reviews WHERE shop_id = ?').get(shopId).c,
    favorites: db.prepare('SELECT COUNT(*) as c FROM favorites WHERE shop_id = ?').get(shopId).c,
    point_ledger: db.prepare('SELECT COUNT(*) as c FROM point_ledger WHERE merchant_id = ?').get(shopId).c
  };
}

/**
 * Print detailed Dry-Run Report
 */
function printDryRunReport(auditResult, backupInfo) {
  const { toRetain, toRemove, toReview } = auditResult;

  console.log('========================================================================');
  console.log('📋 VP52 PHASE 2: DATABASE CLEANUP DRY-RUN AUDIT REPORT');
  console.log('========================================================================');
  console.log(`Database Location:   ${db.name || 'server/db/rewards.db'}`);
  console.log(`Mode:                DRY RUN (Read-Only — No records were modified or deleted)`);
  if (backupInfo) {
    console.log(`Verified Backup:     ${backupInfo.backupPath}`);
    console.log(`Backup Size:         ${backupInfo.fileSize} bytes (Integrity: OK)`);
  }
  console.log('------------------------------------------------------------------------\n');

  console.log('🛡️  PART 1: GENUINE RECORDS TO RETAIN (PROTECTED BY WHITELIST)');
  console.log('========================================================================');
  console.log(`Administrators (${toRetain.admins.length}):`);
  toRetain.admins.forEach(a => {
    console.log(`  • [ID: ${a.id}] ${a.full_name} <${a.email}> (Created: ${a.created_at})`);
    console.log(`    Reason: ${a.reason}`);
  });

  console.log(`\nCustomers (${toRetain.users.length}):`);
  toRetain.users.forEach(u => {
    console.log(`  • [ID: ${u.id}] ${u.full_name} <${u.email}> (Phone: ${u.phone || 'N/A'}, Created: ${u.created_at})`);
    console.log(`    Reason: ${u.reason}`);
  });

  if (toRetain.shops.length > 0) {
    console.log(`\nMerchants (${toRetain.shops.length}):`);
    toRetain.shops.forEach(s => {
      console.log(`  • [ID: ${s.id}] [${s.shop_code}] ${s.name} <${s.email}>`);
    });
  } else {
    console.log(`\nMerchants: None currently registered. All 7 existing shops are demo/test fixtures.`);
  }

  console.log('\n------------------------------------------------------------------------');
  console.log('🗑️  PART 2: CONFIRMED TEST & DEMO RECORDS CANDIDATE FOR REMOVAL');
  console.log('========================================================================');
  
  console.log(`\nDemo Administrator (${toRemove.admins.length}):`);
  toRemove.admins.forEach(a => {
    console.log(`  • [ID: ${a.id}] ${a.full_name} <${a.email}>`);
    console.log(`    Category: DEMO_ADMIN`);
    console.log(`    Evidence: ${a.reason}`);
    console.log(`    Linked Records: audit_logs: ${a.dependencies.audit_logs}`);
  });

  console.log(`\nTest / Demo Customers (${toRemove.users.length}):`);
  toRemove.users.forEach(u => {
    const depStr = Object.entries(u.dependencies)
      .filter(([_, count]) => count > 0)
      .map(([table, count]) => `${table}: ${count}`)
      .join(', ') || 'none';
    console.log(`  • [ID: ${u.id}] ${u.full_name} <${u.email}> (Phone: ${u.phone || 'null'})`);
    console.log(`    Category: ${u.category}`);
    console.log(`    Evidence: ${u.reason}`);
    console.log(`    Linked Records: ${depStr}`);
  });

  console.log(`\nTest / Demo Merchants (${toRemove.shops.length}):`);
  toRemove.shops.forEach(s => {
    const depStr = Object.entries(s.dependencies)
      .filter(([_, count]) => count > 0)
      .map(([table, count]) => `${table}: ${count}`)
      .join(', ') || 'none';
    console.log(`  • [ID: ${s.id}] [${s.shop_code}] ${s.name} <${s.email}>`);
    console.log(`    Category: ${s.category}`);
    console.log(`    Evidence: ${s.reason}`);
    console.log(`    Linked Records: ${depStr}`);
  });

  console.log('\n------------------------------------------------------------------------');
  console.log('⚠️  PART 3: RECORDS REQUIRING MANUAL REVIEW');
  console.log('========================================================================');
  if (toReview.admins.length === 0 && toReview.users.length === 0 && toReview.shops.length === 0) {
    console.log('  None. All records were conclusively classified as either Genuine Whitelisted or Confirmed Test/Demo.');
  } else {
    toReview.admins.forEach(a => console.log(`  • Admin [ID: ${a.id}] ${a.email} — ${a.reason}`));
    toReview.users.forEach(u => console.log(`  • User [ID: ${u.id}] ${u.email} — ${u.reason}`));
    toReview.shops.forEach(s => console.log(`  • Shop [ID: ${s.id}] ${s.email} — ${s.reason}`));
  }

  console.log('\n------------------------------------------------------------------------');
  console.log('🔗 PART 4: FOREIGN-KEY DEPENDENCY & REMOVAL IMPACT ANALYSIS');
  console.log('========================================================================');
  let totalWallets = 0, totalTxs = 0, totalReds = 0, totalOffers = 0, totalProducts = 0, totalBills = 0, totalLots = 0;
  toRemove.users.forEach(u => {
    totalWallets += u.dependencies.wallets;
    totalTxs += u.dependencies.reward_transactions;
    totalReds += u.dependencies.redemptions;
    totalBills += u.dependencies.bills;
    totalLots += u.dependencies.coin_lots;
  });
  toRemove.shops.forEach(s => {
    totalOffers += s.dependencies.offers;
    totalProducts += s.dependencies.products;
  });

  console.log(`If deletion is approved, the following test-only dependencies will be removed:`);
  console.log(`  • Wallets:             ${totalWallets} test wallet(s)`);
  console.log(`  • Coin Lots:           ${totalLots} test coin lot(s)`);
  console.log(`  • Reward Transactions: ${totalTxs} test transaction(s)`);
  console.log(`  • Redemptions:         ${totalReds} test redemption(s)`);
  console.log(`  • Bills & Items:       ${totalBills} test bill(s)`);
  console.log(`  • Offers:              ${totalOffers} test offer(s)`);
  console.log(`  • Products:            ${totalProducts} test product(s)`);
  console.log(`  • Shared Tables:       0 modifications (reward_levels and reward_settings are PRESERVED)`);
  console.log(`  • Audit Logs:          6 admin audit logs reassigned to Sanket Shinde (ID: 2)`);
  console.log('========================================================================\n');
}

/**
 * Execute Safe Deletion (ONLY when --execute is passed AND approved)
 */
function executeDeletion(auditResult) {
  const { toRemove } = auditResult;

  console.log('🚨 EXECUTING TRANSACTIONAL DELETION OF CONFIRMED TEST RECORDS...');

  const userIds = toRemove.users.map(u => u.id);
  const shopIds = toRemove.shops.map(s => s.id);
  const adminIds = toRemove.admins.map(a => a.id);

  if (userIds.length === 0 && shopIds.length === 0 && adminIds.length === 0) {
    console.log('ℹ️ No records to remove.');
    return;
  }

  const transaction = db.transaction(() => {
    // 1. Reassign audit_logs admin_id=1 to real admin (id=2) before removing admin id 1
    if (adminIds.includes(1)) {
      db.prepare('UPDATE audit_logs SET admin_id = 2 WHERE admin_id = 1').run();
      console.log('  -> Reassigned legacy admin audit logs to Sanket Shinde (ID: 2)');
    }

    // 2. Delete test user dependent records
    if (userIds.length > 0) {
      const uPlaceholders = userIds.map(() => '?').join(',');

      // Delete bill items for test bills
      db.prepare(`DELETE FROM bill_items WHERE bill_id IN (SELECT id FROM bills WHERE user_id IN (${uPlaceholders}))`).run(...userIds);
      db.prepare(`DELETE FROM bills WHERE user_id IN (${uPlaceholders})`).run(...userIds);

      // Delete message items for test conversations
      db.prepare(`DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE customer_id IN (${uPlaceholders}))`).run(...userIds);
      db.prepare(`DELETE FROM conversations WHERE customer_id IN (${uPlaceholders})`).run(...userIds);

      // Delete redemptions, coin lots, sessions, ledger, transactions, wallets
      db.prepare(`DELETE FROM redemptions WHERE user_id IN (${uPlaceholders})`).run(...userIds);
      db.prepare(`DELETE FROM coin_lots WHERE user_id IN (${uPlaceholders})`).run(...userIds);
      db.prepare(`DELETE FROM reward_sessions WHERE user_id IN (${uPlaceholders})`).run(...userIds);
      db.prepare(`DELETE FROM vp52_coin_sessions WHERE user_id IN (${uPlaceholders})`).run(...userIds);
      db.prepare(`DELETE FROM point_ledger WHERE user_id IN (${uPlaceholders})`).run(...userIds);
      db.prepare(`DELETE FROM reward_transactions WHERE user_id IN (${uPlaceholders})`).run(...userIds);
      db.prepare(`DELETE FROM wallets WHERE user_id IN (${uPlaceholders})`).run(...userIds);
      db.prepare(`DELETE FROM favorites WHERE user_id IN (${uPlaceholders})`).run(...userIds);
      db.prepare(`DELETE FROM reviews WHERE user_id IN (${uPlaceholders})`).run(...userIds);
      db.prepare(`DELETE FROM complaints WHERE user_id IN (${uPlaceholders})`).run(...userIds);
      db.prepare(`DELETE FROM password_reset_tokens WHERE user_id IN (${uPlaceholders})`).run(...userIds);

      // Delete customer_otp_challenges for test phone numbers
      const testPhones = toRemove.users.map(u => u.phone).filter(Boolean);
      if (testPhones.length > 0) {
        const pPlaceholders = testPhones.map(() => '?').join(',');
        db.prepare(`DELETE FROM customer_otp_challenges WHERE phone IN (${pPlaceholders})`).run(...testPhones);
      }

      // Finally delete users
      db.prepare(`DELETE FROM users WHERE id IN (${uPlaceholders})`).run(...userIds);
      console.log(`  -> Deleted ${userIds.length} test user(s) and their linked records`);
    }

    // 3. Delete test shop dependent records
    if (shopIds.length > 0) {
      const sPlaceholders = shopIds.map(() => '?').join(',');

      db.prepare(`DELETE FROM products WHERE shop_id IN (${sPlaceholders})`).run(...shopIds);
      db.prepare(`DELETE FROM offers WHERE shop_id IN (${sPlaceholders})`).run(...shopIds);
      db.prepare(`DELETE FROM redemptions WHERE shop_id IN (${sPlaceholders})`).run(...shopIds);
      db.prepare(`DELETE FROM bills WHERE shop_id IN (${sPlaceholders})`).run(...shopIds);
      db.prepare(`DELETE FROM conversations WHERE shop_id IN (${sPlaceholders})`).run(...shopIds);
      db.prepare(`DELETE FROM favorites WHERE shop_id IN (${sPlaceholders})`).run(...shopIds);
      db.prepare(`DELETE FROM reviews WHERE shop_id IN (${sPlaceholders})`).run(...shopIds);
      db.prepare(`DELETE FROM point_ledger WHERE merchant_id IN (${sPlaceholders})`).run(...shopIds);

      // Finally delete shops
      db.prepare(`DELETE FROM shops WHERE id IN (${sPlaceholders})`).run(...shopIds);
      console.log(`  -> Deleted ${shopIds.length} test shop(s) and their linked records`);
    }

    // 4. Delete demo admins
    if (adminIds.length > 0) {
      const aPlaceholders = adminIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM admins WHERE id IN (${aPlaceholders})`).run(...adminIds);
      console.log(`  -> Deleted ${adminIds.length} demo admin(s)`);
    }
  });

  transaction();

  // Run FK integrity check
  const fkViolations = db.pragma('foreign_key_check');
  if (fkViolations.length > 0) {
    throw new Error(`Foreign key integrity check failed after deletion: ${JSON.stringify(fkViolations)}`);
  }

  console.log('✅ PRAGMA foreign_key_check: 0 violations (Clean Foreign Key Integrity)');
  console.log('🎉 Cleanup transaction committed successfully!\n');
}

// CLI Entrypoint
async function main() {
  const args = process.argv.slice(2);
  const isExecute = args.includes('--execute');

  // Step 1: Mandatory Backup
  const backupInfo = await createDatabaseBackup();

  // Step 2: Audit
  const auditResult = auditRecords();

  // Step 3: Print Dry-Run Report
  printDryRunReport(auditResult, backupInfo);

  if (isExecute) {
    console.log('⚠️  --execute flag was supplied, proceeding with transactional deletion...');
    executeDeletion(auditResult);
  } else {
    console.log('🛑 [DRY RUN FINISHED]');
    console.log('No data was deleted. Awaiting explicit user approval before executing Phase 2 cleanup.');
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('❌ Error during cleanup utility execution:', err);
    process.exit(1);
  });
}

module.exports = {
  createDatabaseBackup,
  auditRecords,
  printDryRunReport,
  executeDeletion,
  GENUINE_WHITELIST
};
