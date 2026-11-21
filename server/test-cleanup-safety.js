/**
 * VP52 Phase 2: Cleanup Safety & Seed Environment Guard Tests
 * 
 * Verifies:
 * 1. Seed Production Guard: Refuses to execute in production (NODE_ENV=production).
 * 2. SQLite Online Backup API: Creates intact, valid snapshot passing integrity check.
 * 3. Whitelist Protection: Real admin and customer accounts are strictly whitelisted.
 * 4. Candidate Identification: Accurately identifies demo/test accounts by explicit evidence.
 * 5. Foreign Key Integrity: No dangling or broken foreign keys exist in the database.
 * 6. Reference Data Protection: Platform reward levels and settings are preserved.
 */

const assert = require('assert');
const { spawnSync } = require('child_process');
const path = require('path');
const Database = require('better-sqlite3');
const db = require('./db/database');
const { createDatabaseBackup, auditRecords, GENUINE_WHITELIST } = require('./scripts/cleanup-test-data');

async function runTests() {
  console.log('🧪 Starting Phase 2: Cleanup Safety & Seed Guard Tests...\n');

  // TEST 1: Seed script refuses to execute in production
  console.log('Test 1: Seed script refuses to run with NODE_ENV=production');
  const seedProcess = spawnSync(process.execPath, [path.join(__dirname, 'db', 'seed.js')], {
    env: { ...process.env, NODE_ENV: 'production' },
    encoding: 'utf8'
  });
  assert.strictEqual(seedProcess.status, 1, 'Process should exit with code 1 in production');
  assert.ok(seedProcess.stderr.includes('Refusing to run') || seedProcess.stderr.includes('prohibited in production'));
  console.log('✅ TEST 1 PASSED: Seed script safely blocked in production environment');

  // TEST 2: SQLite Backup API verification
  console.log('\nTest 2: SQLite Backup API creates verified snapshot');
  const backup = await createDatabaseBackup();
  assert.ok(backup.isHealthy, 'Backup integrity check must be healthy');
  assert.ok(backup.fileSize > 0, 'Backup file must not be empty');
  assert.ok(backup.userCount > 0, 'Backup must contain users');
  assert.ok(backup.adminCount > 0, 'Backup must contain admins');
  console.log('✅ TEST 2 PASSED: Online backup created and integrity check verified');

  // TEST 3: Strict Whitelist Protection
  console.log('\nTest 3: Genuine production accounts are whitelisted and preserved');
  const audit = auditRecords();

  // Verify real admin is retained
  const retainedAdmin = audit.toRetain.admins.find(a => a.email.toLowerCase() === 'sanketshinde.vp52@gmail.com');
  assert.ok(retainedAdmin, 'Production admin sanketshinde.vp52@gmail.com MUST be retained');
  const removedAdmin = audit.toRemove.admins.find(a => a.email.toLowerCase() === 'sanketshinde.vp52@gmail.com');
  assert.strictEqual(removedAdmin, undefined, 'Production admin must NEVER be in toRemove list');

  // Verify real customer is retained
  const retainedUser = audit.toRetain.users.find(u => u.email.toLowerCase() === 'saruu548@gmail.com');
  assert.ok(retainedUser, 'Genuine customer saruu548@gmail.com MUST be retained');
  const removedUser = audit.toRemove.users.find(u => u.email.toLowerCase() === 'saruu548@gmail.com');
  assert.strictEqual(removedUser, undefined, 'Genuine customer must NEVER be in toRemove list');
  console.log('✅ TEST 3 PASSED: Whitelist strictly protects genuine admin and customer accounts');

  // TEST 4: Candidate identification accuracy
  console.log('\nTest 4: Accurate identification of demo/test records');
  assert.ok(audit.toRemove.admins.some(a => a.email === 'admin@example.com'), 'Demo admin admin@example.com identified');
  assert.ok(audit.toRemove.users.some(u => u.email === 'customer@example.com'), 'Demo customer customer@example.com identified');
  assert.ok(audit.toRemove.shops.some(s => s.shop_code === 'SHOP-001'), 'Demo shop SHOP-001 identified');
  console.log('✅ TEST 4 PASSED: Demo and test accounts correctly identified by explicit markers');

  // TEST 5: Foreign key integrity check
  console.log('\nTest 5: Database foreign key integrity check');
  const fkViolations = db.pragma('foreign_key_check');
  assert.strictEqual(fkViolations.length, 0, `Database has ${fkViolations.length} FK violations`);
  console.log('✅ TEST 5 PASSED: 0 foreign key violations (clean database integrity)');

  // TEST 6: Reference data protection
  console.log('\nTest 6: Reference data tables intact');
  const levels = db.prepare('SELECT COUNT(*) as c FROM reward_levels').get().c;
  const settings = db.prepare('SELECT COUNT(*) as c FROM reward_settings').get().c;
  assert.ok(levels >= 5, 'Reward levels reference table intact');
  assert.ok(settings >= 6, 'Reward settings reference table intact');
  console.log(`✅ TEST 6 PASSED: Shared reference data intact (${levels} levels, ${settings} settings)`);

  console.log('\n====================================================');
  console.log('🎉 ALL 6 CLEANUP SAFETY TESTS PASSED (100%)');
  console.log('====================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
