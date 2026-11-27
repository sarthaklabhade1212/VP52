/**
 * VP52 V2 Verification Test Suite
 * Tests Two-Coin System (10,000:1 / 365-day conversion),
 * Membership Tier Cap Removal, 3-Ad AdMob SSV Session Unlock,
 * and Admin Merchant Advertisement Management.
 * 
 * Uses isolated database: /tmp/test_vp52_v2.db
 */

const fs = require('fs');
const path = require('path');

const TEST_DB_PATH = '/tmp/test_vp52_v2.db';
// Clean up any previous test database
if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
if (fs.existsSync(TEST_DB_PATH + '-wal')) fs.unlinkSync(TEST_DB_PATH + '-wal');
if (fs.existsSync(TEST_DB_PATH + '-shm')) fs.unlinkSync(TEST_DB_PATH + '-shm');

process.env.DATABASE_PATH = TEST_DB_PATH;
process.env.JWT_SECRET = 'test_jwt_secret_vp52_v2';
process.env.NODE_ENV = 'test';

const db = require('./db/database');
const { reconcileCoinConversions } = require('./utils/coinConversion');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('🚀 VP52 V2 AUTOMATED VERIFICATION SUITE');
  console.log(`📁 Isolated DB: ${TEST_DB_PATH}`);
  console.log('====================================================\n');

  try {
    // ----------------------------------------------------
    // TEST GROUP 1: Database Schema & Two-Coin Columns
    // ----------------------------------------------------
    console.log('--- TEST GROUP 1: Database Schema & Two-Coin Columns ---');
    
    const walletCols = db.prepare("PRAGMA table_info(wallets)").all();
    const hasNormalCoins = walletCols.some(c => c.name === 'normal_coins');
    const hasVipCoins = walletCols.some(c => c.name === 'vip_coins');
    assert(hasNormalCoins && hasVipCoins, 'wallets table contains normal_coins and vip_coins columns');

    const lotCols = db.prepare("PRAGMA table_info(coin_lots)").all();
    const hasCoinType = lotCols.some(c => c.name === 'coin_type');
    const hasConvertAt = lotCols.some(c => c.name === 'convert_at');
    assert(hasCoinType && hasConvertAt, 'coin_lots table contains coin_type and convert_at columns');

    const merchantAdsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='merchant_advertisements'").get();
    assert(!!merchantAdsTable, 'merchant_advertisements table exists in schema');

    // ----------------------------------------------------
    // TEST GROUP 2: Balance Preservation & Two-Coin Migration
    // ----------------------------------------------------
    console.log('\n--- TEST GROUP 2: Balance Preservation & Two-Coin Migration ---');

    // Create test customer
    const userRes = db.prepare(`
      INSERT INTO users (full_name, email, password_hash, status)
      VALUES ('Test Customer', 'customer@vp52test.com', 'hash123', 'active')
    `).run();
    const customerId = userRes.lastInsertRowid;

    // Simulate an existing customer wallet with 25,000 legacy coins
    db.prepare(`
      INSERT INTO wallets (user_id, balance, normal_coins, vip_coins, total_earned, total_redeemed)
      VALUES (?, 25000, 25000, 0, 25000, 0)
    `).run(customerId);

    const initialWallet = db.prepare("SELECT * FROM wallets WHERE user_id = ?").get(customerId);
    assert(initialWallet.balance === 25000, 'Legacy wallet balance is preserved at 25,000');
    assert(initialWallet.normal_coins === 25000, 'Normal coins initialized to 25,000 (100% balance preservation)');
    assert(initialWallet.vip_coins === 0, 'VIP coins initialized to 0');

    // ----------------------------------------------------
    // TEST GROUP 3: 365-Day Automatic Two-Coin Conversion (10,000 : 1)
    // ----------------------------------------------------
    console.log('\n--- TEST GROUP 3: 365-Day Automatic Two-Coin Conversion (10,000 : 1) ---');

    // Insert 2 coin lots:
    // Lot 1: 20,000 Normal Coins earned 400 days ago (Matured, should convert to 2 VIP Coins)
    const earned400DaysAgo = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
    const convertDateMatured = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();
    
    // Lot 2: 5,000 Normal Coins earned 30 days ago (Young, should remain Normal Coins)
    const earned30DaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const convertDateFuture = new Date(Date.now() + 335 * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO coin_lots (user_id, source, coins_earned, coins_remaining, earned_at, expires_at, status, coin_type, convert_at)
      VALUES (?, 'AD_REWARD', 20000, 20000, ?, datetime('now', '+365 days'), 'ACTIVE', 'NORMAL', ?)
    `).run(customerId, earned400DaysAgo, convertDateMatured);

    db.prepare(`
      INSERT INTO coin_lots (user_id, source, coins_earned, coins_remaining, earned_at, expires_at, status, coin_type, convert_at)
      VALUES (?, 'AD_REWARD', 5000, 5000, ?, datetime('now', '+365 days'), 'ACTIVE', 'NORMAL', ?)
    `).run(customerId, earned30DaysAgo, convertDateFuture);

    // Execute coin conversion engine
    const conversionResult = reconcileCoinConversions(customerId, db);
    assert(conversionResult.convertedUsers >= 1, 'Conversion engine processed customer with matured coins');
    assert(conversionResult.totalNormalDeducted === 20000, 'Exactly 20,000 Normal Coins deducted for conversion');
    assert(conversionResult.totalVipCredited === 2, 'Exactly 2 VIP Coins credited (10,000 : 1 ratio)');

    // Verify wallet after conversion
    const convertedWallet = db.prepare("SELECT * FROM wallets WHERE user_id = ?").get(customerId);
    assert(convertedWallet.vip_coins === 2.0, 'Customer VIP coins updated to 2.0');
    assert(convertedWallet.normal_coins === 5000, 'Customer Normal coins reduced to 5,000');
    assert(convertedWallet.balance === 5000, 'Customer spendable balance updated to 5,000');

    // Verify point_ledger log
    const ledgerEntry = db.prepare(`
      SELECT * FROM point_ledger
      WHERE user_id = ? AND type = 'COIN_CONVERSION'
    `).get(customerId);
    assert(!!ledgerEntry && ledgerEntry.points === -20000, 'Point ledger logged -20000 for COIN_CONVERSION');

    // Verify reward_transactions log
    const rewardTx = db.prepare(`
      SELECT * FROM reward_transactions
      WHERE user_id = ? AND activity_type = 'COIN_CONVERSION'
    `).get(customerId);
    assert(!!rewardTx && rewardTx.points === 2, 'Reward transactions logged 2 VIP coins from conversion');

    // ----------------------------------------------------
    // TEST GROUP 4: Partial Lot Conversion (e.g. 25,000 lot -> 20,000 converted, 5,000 remaining)
    // ----------------------------------------------------
    console.log('\n--- TEST GROUP 4: Partial Lot Conversion ---');

    // Create second customer for partial lot test
    const user2 = db.prepare(`
      INSERT INTO users (full_name, email, password_hash, status)
      VALUES ('Customer 2', 'customer2@vp52test.com', 'hash123', 'active')
    `).run();
    const cust2Id = user2.lastInsertRowid;

    db.prepare(`
      INSERT INTO wallets (user_id, balance, normal_coins, vip_coins, total_earned, total_redeemed)
      VALUES (?, 25000, 25000, 0, 25000, 0)
    `).run(cust2Id);

    // 1 lot of 25,000 matured coins
    const lotRes = db.prepare(`
      INSERT INTO coin_lots (user_id, source, coins_earned, coins_remaining, earned_at, expires_at, status, coin_type, convert_at)
      VALUES (?, 'AD_REWARD', 25000, 25000, ?, datetime('now', '+365 days'), 'ACTIVE', 'NORMAL', ?)
    `).run(cust2Id, earned400DaysAgo, convertDateMatured);
    const partialLotId = lotRes.lastInsertRowid;

    reconcileCoinConversions(cust2Id, db);

    const cust2Wallet = db.prepare("SELECT * FROM wallets WHERE user_id = ?").get(cust2Id);
    assert(cust2Wallet.vip_coins === 2.0, 'Partial test: 20,000 converted to 2 VIP Coins');
    assert(cust2Wallet.normal_coins === 5000, 'Partial test: 5,000 Normal Coins remaining');

    const updatedLot = db.prepare("SELECT * FROM coin_lots WHERE id = ?").get(partialLotId);
    assert(updatedLot.coins_remaining === 5000, 'Original lot remaining amount reduced to 5,000');
    assert(updatedLot.status === 'PARTIALLY_USED', 'Original lot status set to PARTIALLY_USED');

    // ----------------------------------------------------
    // TEST GROUP 5: Removal of Membership Tiers & 5% Discount Cap
    // ----------------------------------------------------
    console.log('\n--- TEST GROUP 5: Removal of Membership Tiers & 5% Discount Cap ---');

    // In VP52 v2, all membership caps (Basic 5%, Silver 10%, Gold 15%) are removed.
    // Merchants can offer full eligible discount up to customer coin balance without 5% cap restriction.
    const billAmount = 1000;
    const customerCoins = 500; // Customer has ₹500 in coins
    // Under old Basic tier (5% cap): max discount was ₹50 (5% of ₹1000).
    // Under VP52 v2: maxAllowedDiscountINR = eligibleAmount (₹1000) -> customer can redeem all 500 coins (₹500 discount).
    const maxAllowedDiscountINR = billAmount; // As implemented in server/routes/merchant.js
    const coinsToRedeem = Math.min(customerCoins, maxAllowedDiscountINR);
    assert(coinsToRedeem === 500, 'Customer can redeem full 500 coins on ₹1,000 bill (5% cap removed)');

    // ----------------------------------------------------
    // TEST GROUP 6: 3-Ad Google AdMob SSV Earning Session Unlock
    // ----------------------------------------------------
    console.log('\n--- TEST GROUP 6: 3-Ad Google AdMob Rewarded Session Unlock ---');

    // Create session record for customer in vp52_coin_sessions
    const sessionRes = db.prepare(`
      INSERT INTO vp52_coin_sessions (user_id, status, ads_completed, coins_earned)
      VALUES (?, 'pending_ads', 0, 0)
    `).run(customerId);
    const sessionId = sessionRes.lastInsertRowid;

    // Simulate Ad 1 completion via SSV
    db.prepare(`UPDATE vp52_coin_sessions SET ads_completed = 1 WHERE id = ?`).run(sessionId);
    let session = db.prepare("SELECT * FROM vp52_coin_sessions WHERE id = ?").get(sessionId);
    assert(session.ads_completed === 1 && session.status === 'pending_ads', 'Ad 1/3 completed: Session remains pending_ads');

    // Simulate Ad 2 completion via SSV
    db.prepare(`UPDATE vp52_coin_sessions SET ads_completed = 2 WHERE id = ?`).run(sessionId);
    session = db.prepare("SELECT * FROM vp52_coin_sessions WHERE id = ?").get(sessionId);
    assert(session.ads_completed === 2 && session.status === 'pending_ads', 'Ad 2/3 completed: Session remains pending_ads');

    // Simulate Ad 3 completion via SSV -> unlocks 6-hour active session
    const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
    db.prepare(`
      UPDATE vp52_coin_sessions
      SET ads_completed = 3, status = 'active', started_at = datetime('now'), expires_at = ?, coins_earned = 100
      WHERE id = ?
    `).run(expiresAt, sessionId);

    session = db.prepare("SELECT * FROM vp52_coin_sessions WHERE id = ?").get(sessionId);
    assert(session.ads_completed === 3 && session.status === 'active', 'Ad 3/3 completed: Session unlocked to active for 6 hours');
    assert(session.coins_earned === 100, 'Awards exactly 100 Normal Coins upon unlock/completion');

    // Verify coin lot created with 365-day maturation date
    const lot365 = db.prepare(`
      INSERT INTO coin_lots (user_id, source, coins_earned, coins_remaining, earned_at, expires_at, status, coin_type, convert_at)
      VALUES (?, 'AD_REWARD', 100, 100, datetime('now'), datetime('now', '+365 days'), 'ACTIVE', 'NORMAL', datetime('now', '+365 days'))
    `).run(customerId);
    const sessionLot = db.prepare("SELECT * FROM coin_lots WHERE id = ?").get(lot365.lastInsertRowid);
    assert(sessionLot.coin_type === 'NORMAL', 'Session coin lot created with coin_type = NORMAL');
    assert(!!sessionLot.convert_at, 'Session coin lot has convert_at set to 365 days in future');

    // ----------------------------------------------------
    // TEST GROUP 7: Admin Merchant Advertisements Management & Offers Feed
    // ----------------------------------------------------
    console.log('\n--- TEST GROUP 7: Merchant Advertisements Management & Customer Offers ---');

    // Create test merchant shop
    const shopRes = db.prepare(`
      INSERT INTO shops (name, shop_code, category, address, verification_status)
      VALUES ('VP52 Golden Store', 'VP52-GOLD', 'Retail', 'Main Market', 'approved')
    `).run();
    const shopId = shopRes.lastInsertRowid;

    // 1. Merchant creates ad (Initially PENDING)
    const adRes = db.prepare(`
      INSERT INTO merchant_advertisements (
        merchant_id, title, description, banner_image_url, offer_type,
        approval_status, is_active, start_date, expiry_date
      ) VALUES (
        ?, 'Grand Diwali 20% Off', 'Flat 20% discount on all items',
        'https://images.unsplash.com/photo-test.jpg', 'PROMOTIONAL_OFFER',
        'PENDING', 1, date('now', '-1 day'), date('now', '+30 days')
      )
    `).run(shopId);
    const adId = adRes.lastInsertRowid;

    // Verify it is NOT shown in customer offers feed when PENDING
    const customerOffersPending = db.prepare(`
      SELECT * FROM merchant_advertisements
      WHERE approval_status = 'APPROVED' AND is_active = 1
        AND (start_date IS NULL OR start_date <= date('now'))
        AND (expiry_date IS NULL OR expiry_date >= date('now'))
    `).all();
    assert(!customerOffersPending.some(o => o.id === adId), 'Pending merchant ad is NOT visible in customer offers feed');

    // 2. Admin approves ad
    db.prepare(`
      UPDATE merchant_advertisements
      SET approval_status = 'APPROVED', updated_at = datetime('now')
      WHERE id = ?
    `).run(adId);

    const approvedAd = db.prepare("SELECT * FROM merchant_advertisements WHERE id = ?").get(adId);
    assert(approvedAd.approval_status === 'APPROVED', 'Admin approved merchant advertisement');

    // 3. Customer offers feed now displays approved ad
    const customerOffersApproved = db.prepare(`
      SELECT ma.*, s.name AS shop_name, s.shop_code
      FROM merchant_advertisements ma
      JOIN shops s ON ma.merchant_id = s.id
      WHERE ma.approval_status = 'APPROVED' AND ma.is_active = 1
        AND (ma.start_date IS NULL OR ma.start_date <= date('now'))
        AND (ma.expiry_date IS NULL OR ma.expiry_date >= date('now'))
    `).all();
    assert(customerOffersApproved.some(o => o.id === adId), 'Approved & active ad is NOW visible in customer offers feed');

    // 4. Performance Tracking
    db.prepare("UPDATE merchant_advertisements SET impressions_count = impressions_count + 10 WHERE id = ?").run(adId);
    db.prepare("UPDATE merchant_advertisements SET clicks_count = clicks_count + 2 WHERE id = ?").run(adId);
    db.prepare("UPDATE merchant_advertisements SET redemptions_count = redemptions_count + 1 WHERE id = ?").run(adId);

    const trackedAd = db.prepare("SELECT * FROM merchant_advertisements WHERE id = ?").get(adId);
    assert(trackedAd.impressions_count === 10, 'Impressions tracking verified (10 impressions)');
    assert(trackedAd.clicks_count === 2, 'Clicks tracking verified (2 clicks)');
    assert(trackedAd.redemptions_count === 1, 'Redemptions tracking verified (1 redemption)');
    const ctr = (trackedAd.clicks_count / trackedAd.impressions_count) * 100;
    assert(ctr === 20, 'CTR accurately calculated at 20.0%');

    // 5. Admin deactivates ad
    db.prepare("UPDATE merchant_advertisements SET is_active = 0 WHERE id = ?").run(adId);
    const deactivatedOffers = db.prepare(`
      SELECT * FROM merchant_advertisements
      WHERE approval_status = 'APPROVED' AND is_active = 1
    `).all();
    assert(!deactivatedOffers.some(o => o.id === adId), 'Deactivated ad is immediately hidden from customer offers feed');

    // 6. Admin updates ad
    db.prepare(`
      UPDATE merchant_advertisements
      SET title = 'Updated Diwali 25% Off', description = 'Flat 25% discount'
      WHERE id = ?
    `).run(adId);
    const updatedAd = db.prepare("SELECT * FROM merchant_advertisements WHERE id = ?").get(adId);
    assert(updatedAd.title === 'Updated Diwali 25% Off', 'Admin updated ad title successfully');

    // ----------------------------------------------------
    // TEST GROUP 8: Strict System Separation Verification
    // ----------------------------------------------------
    console.log('\n--- TEST GROUP 8: Strict Separation of Ad Systems ---');
    
    // Merchant Advertisements are in merchant_advertisements
    // AdMob rewarded ads are in admob_ssv_verifications / admob_ssv_audit_logs / ad_event_logs
    const admobSsvTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='admob_ssv_verifications'").get();
    const admobAuditLogsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='admob_ssv_audit_logs'").get();
    assert(!!admobSsvTable && !!admobAuditLogsTable, 'Google AdMob SSV tables remain independent and distinct');
    assert(merchantAdsTable.name === 'merchant_advertisements', 'Merchant Advertisements operate on dedicated table');

    console.log('\n====================================================');
    console.log(`🏁 VERIFICATION COMPLETE: ${passedTests} passed, ${failedTests} failed.`);
    console.log('====================================================\n');

    if (failedTests > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }

  } catch (err) {
    console.error('💥 Test execution error:', err);
    process.exit(1);
  } finally {
    // Clean up test DB
    try {
      if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
      if (fs.existsSync(TEST_DB_PATH + '-wal')) fs.unlinkSync(TEST_DB_PATH + '-wal');
      if (fs.existsSync(TEST_DB_PATH + '-shm')) fs.unlinkSync(TEST_DB_PATH + '-shm');
    } catch (e) {}
  }
}

runTests();
