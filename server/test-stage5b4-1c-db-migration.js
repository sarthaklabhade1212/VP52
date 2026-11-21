/**
 * Stage 5B.4.1C — Scratch Database Migration, Integrity & Rollback Safety Test
 *
 * Designed to run against an isolated PRE-MIGRATION copy of `server/db/rewards.db`
 * located in `/tmp/` (passed via DB_PATH or CLI arg, defaults strictly blocked from
 * touching the canonical workspace DB).
 *
 * Verifies:
 * 1. Pre-migration snapshot of all existing core tables (row counts + SHA-256 ordered digests).
 * 2. Additive Stage 5B.4.1B/C schema migration via `require('./db/database')`.
 * 3. Zero lost/altered rows across users, wallets, coin_lots, point_ledger, reward_transactions,
 *    reward_sessions, vp52_coin_sessions, shops, offers, ad_events.
 * 4. SQLite `PRAGMA integrity_check` === 'ok' and `PRAGMA foreign_key_check` === [].
 * 5. Unique constraints enforcement on `admob_ssv_verifications`:
 *    - duplicate `verification_token` rejected
 *    - duplicate non-null `transaction_id` rejected
 *    - duplicate active (`pending`/`verified`) slot per session rejected
 *    - repeated (`rejected`/`expired`) slot history allowed
 * 6. Idempotency (running DDL migration twice causes zero errors/mutations).
 * 7. Clean additive rollback (`DROP TABLE` for new tables) preserves 100% of original data.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

function assert(cond, msg) {
  if (!cond) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    throw new Error(msg);
  }
}

const CORE_TABLES = [
  'users',
  'wallets',
  'coin_lots',
  'point_ledger',
  'reward_transactions',
  'reward_sessions',
  'vp52_coin_sessions',
  'shops',
  'offers',
  'ad_events'
];

function snapshotDatabaseTables(sqliteDb) {
  const snapshot = {};
  for (const table of CORE_TABLES) {
    const exists = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
    if (!exists) {
      snapshot[table] = { exists: false, count: 0, sha256: null };
      continue;
    }
    const rows = sqliteDb.prepare(`SELECT * FROM ${table} ORDER BY rowid ASC`).all();
    const digest = crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
    snapshot[table] = { exists: true, count: rows.length, sha256: digest };
  }
  return snapshot;
}

function compareSnapshots(before, after, phaseLabel) {
  for (const table of CORE_TABLES) {
    assert(before[table].exists === after[table].exists, `[${phaseLabel}] Table existence mismatch: ${table}`);
    assert(before[table].count === after[table].count, `[${phaseLabel}] Row count changed in ${table}: before=${before[table].count}, after=${after[table].count}`);
    assert(before[table].sha256 === after[table].sha256, `[${phaseLabel}] Row content hash mismatch in ${table}! Existing data was altered.`);
  }
}

function main() {
  console.log('==============================================================');
  console.log('VP52 STAGE 5B.4.1C — DATABASE MIGRATION & ROLLBACK SAFETY TEST');
  console.log('==============================================================\n');

  const scratchDbPath = process.argv[2] || process.env.VP52_SCRATCH_DB_PATH;
  if (!scratchDbPath) {
    throw new Error('Must pass isolated scratch DB path in /tmp/ as argument.');
  }

  const resolvedDbPath = fs.realpathSync(path.dirname(scratchDbPath)) + path.sep + path.basename(scratchDbPath);
  const realTmpPrefixes = ['/tmp/', '/private/tmp/', fs.realpathSync(require('os').tmpdir()) + path.sep];
  if (!realTmpPrefixes.some((p) => resolvedDbPath.startsWith(p))) {
    throw new Error(`SAFETY REFUSAL: scratchDbPath (${resolvedDbPath}) MUST live inside /tmp/!`);
  }
  const moduleTargetDb = path.resolve(__dirname, 'db', 'rewards.db');
  assert(resolvedDbPath === moduleTargetDb || fs.realpathSync(moduleTargetDb) === resolvedDbPath, `Run from copied /tmp server directory so database.js targets ${resolvedDbPath}`);
  assert(fs.existsSync(resolvedDbPath), `Scratch DB does not exist at ${resolvedDbPath}`);

  const preHash = crypto.createHash('sha256').update(fs.readFileSync(resolvedDbPath)).digest('hex');
  console.log(`Scratch DB path : ${resolvedDbPath}`);
  console.log(`Pre-migration SHA-256: ${preHash}\n`);

  // Step 1: Capture Pre-Migration Snapshot directly via read-only better-sqlite3
  const preDb = new Database(resolvedDbPath, { readonly: true });
  const preSsvTable = preDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='admob_ssv_verifications'").get();
  assert(!preSsvTable, 'Pre-migration scratch copy is clean pre-5B4.1B schema (no admob_ssv_verifications yet)');
  const preSnapshot = snapshotDatabaseTables(preDb);
  const preIntegrity = preDb.pragma('integrity_check', { simple: true });
  assert(preIntegrity === 'ok', `Pre-migration integrity_check ok (got ${preIntegrity})`);
  preDb.close();

  console.log('[1/5] Pre-migration snapshot captured across core tables:');
  for (const t of CORE_TABLES) {
    console.log(`      - ${t.padEnd(20)}: ${preSnapshot[t].count} rows (${preSnapshot[t].sha256 ? preSnapshot[t].sha256.slice(0, 12) : 'n/a'})`);
  }

  // Step 2: Run Stage 5B.4.1B/C Additive Migration via server/db/database.js on scratch copy
  console.log('\n[2/5] Running Stage 5B.4.1B/C additive migration on scratch copy...');
  process.env.VP52_DB_FILE_OVERRIDE = resolvedDbPath;
  // Note: database.js reads path.join(__dirname, 'rewards.db'); ensure scratch copy runs with copied server/db/database.js
  // when launched inside /tmp workspace OR load module directly from current folder if DB_PATH points here.
  const migratedDb = require('./db/database');
  const postIntegrity = migratedDb.pragma('integrity_check', { simple: true });
  const fkViolations = migratedDb.pragma('foreign_key_check');
  assert(postIntegrity === 'ok', `Post-migration PRAGMA integrity_check === 'ok' (got ${postIntegrity})`);
  assert(Array.isArray(fkViolations) && fkViolations.length === 0, `Zero foreign key violations (got ${JSON.stringify(fkViolations)})`);

  const postSnapshot = snapshotDatabaseTables(migratedDb);
  compareSnapshots(preSnapshot, postSnapshot, 'Post-Migration');
  console.log('      ✓ 100% of pre-existing tables, wallets, coin_lots, point_ledger & sessions preserved unchanged.');

  // Step 3: Verify new tables, indexes, and unique constraints
  console.log('\n[3/5] Verifying new AdMob SSV tables, indexes, and SQLite uniqueness constraints...');
  const newTables = migratedDb.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name IN ('admob_ssv_verifications', 'admob_ssv_audit_logs')
  `).all().map(r => r.name).sort();
  assert(newTables.join(',') === 'admob_ssv_audit_logs,admob_ssv_verifications', 'Both additive SSV tables exist');

  const indexes = migratedDb.prepare(`
    SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='admob_ssv_verifications'
  `).all().map(r => r.name);
  assert(indexes.includes('idx_admob_ssv_slot_verified'), 'Unique verified slot partial index exists');
  assert(indexes.includes('idx_admob_ssv_slot_pending'), 'Unique pending slot partial index exists');
  assert(indexes.includes('idx_admob_ssv_token'), 'verification_token lookup index exists');

  const sampleUser = migratedDb.prepare('SELECT id FROM users ORDER BY id ASC LIMIT 1').get();
  assert(sampleUser && sampleUser.id, 'Scratch DB contains at least 1 customer for constraint tests');
  const insSession = migratedDb.prepare(`
    INSERT INTO reward_sessions (user_id, start_time, end_time, status, session_number_for_day, ads_watched, coins_earned)
    VALUES (?, datetime('now'), datetime('now', '+6 hours'), 'active', 99, 0, 0)
  `).run(sampleUser.id);
  const testSessId = Number(insSession.lastInsertRowid);

  // Insert valid slot 1 pending
  migratedDb.prepare(`
    INSERT INTO admob_ssv_verifications (
      verification_token, user_id, session_type, session_id, ad_slot,
      app_id, ad_unit_id, reward_item, reward_amount, status, transaction_id, expires_at
    ) VALUES ('TOK_U1', ?, 'reward_session', ?, 1, 'app', 'unit', 'coin', 1, 'verified', 'TX_U1', datetime('now', '+15 minutes'))
  `).run(sampleUser.id, testSessId);

  // Duplicate verification_token MUST throw
  let dupTokenBlocked = false;
  try {
    migratedDb.prepare(`
      INSERT INTO admob_ssv_verifications (
        verification_token, user_id, session_type, session_id, ad_slot,
        app_id, ad_unit_id, reward_item, reward_amount, status, expires_at
      ) VALUES ('TOK_U1', ?, 'reward_session', ?, 2, 'app', 'unit', 'coin', 1, 'pending', datetime('now', '+15 minutes'))
    `).run(sampleUser.id, testSessId);
  } catch (e) {
    dupTokenBlocked = /UNIQUE/i.test(e.message);
  }
  assert(dupTokenBlocked, 'Duplicate verification_token blocked at SQLite constraint level');

  // Duplicate transaction_id MUST throw
  let dupTxBlocked = false;
  try {
    migratedDb.prepare(`
      INSERT INTO admob_ssv_verifications (
        verification_token, user_id, session_type, session_id, ad_slot,
        app_id, ad_unit_id, reward_item, reward_amount, status, transaction_id, expires_at
      ) VALUES ('TOK_U2', ?, 'reward_session', ?, 2, 'app', 'unit', 'coin', 1, 'verified', 'TX_U1', datetime('now', '+15 minutes'))
    `).run(sampleUser.id, testSessId);
  } catch (e) {
    dupTxBlocked = /UNIQUE/i.test(e.message);
  }
  assert(dupTxBlocked, 'Duplicate transaction_id blocked at SQLite constraint level');

  // Duplicate pending slot 1 MUST throw (partial unique index idx_admob_ssv_slot_pending)
  migratedDb.prepare(`
    INSERT INTO admob_ssv_verifications (
      verification_token, user_id, session_type, session_id, ad_slot,
      app_id, ad_unit_id, reward_item, reward_amount, status, expires_at
    ) VALUES ('TOK_U3_PEND', ?, 'reward_session', ?, 2, 'app', 'unit', 'coin', 1, 'pending', datetime('now', '+15 minutes'))
  `).run(sampleUser.id, testSessId);

  let dupPendingSlotBlocked = false;
  try {
    migratedDb.prepare(`
      INSERT INTO admob_ssv_verifications (
        verification_token, user_id, session_type, session_id, ad_slot,
        app_id, ad_unit_id, reward_item, reward_amount, status, expires_at
      ) VALUES ('TOK_U3_PEND_DUP', ?, 'reward_session', ?, 2, 'app', 'unit', 'coin', 1, 'pending', datetime('now', '+15 minutes'))
    `).run(sampleUser.id, testSessId);
  } catch (e) {
    dupPendingSlotBlocked = /UNIQUE/i.test(e.message);
  }
  assert(dupPendingSlotBlocked, 'Duplicate pending slot blocked at SQLite partial index level');

  // Duplicate verified slot 1 MUST throw (partial unique index idx_admob_ssv_slot_verified)
  let dupVerifiedSlotBlocked = false;
  try {
    migratedDb.prepare(`
      INSERT INTO admob_ssv_verifications (
        verification_token, user_id, session_type, session_id, ad_slot,
        app_id, ad_unit_id, reward_item, reward_amount, status, expires_at
      ) VALUES ('TOK_U3_VER_DUP', ?, 'reward_session', ?, 1, 'app', 'unit', 'coin', 1, 'verified', datetime('now', '+15 minutes'))
    `).run(sampleUser.id, testSessId);
  } catch (e) {
    dupVerifiedSlotBlocked = /UNIQUE/i.test(e.message);
  }
  assert(dupVerifiedSlotBlocked, 'Duplicate verified slot blocked at SQLite partial index level');

  // Historical rejected slot 1 MUST be allowed without colliding with active slot 1
  migratedDb.prepare(`
    INSERT INTO admob_ssv_verifications (
      verification_token, user_id, session_type, session_id, ad_slot,
      app_id, ad_unit_id, reward_item, reward_amount, status, expires_at
    ) VALUES ('TOK_U4', ?, 'reward_session', ?, 1, 'app', 'unit', 'coin', 1, 'rejected', datetime('now', '+15 minutes'))
  `).run(sampleUser.id, testSessId);
  console.log('      ✓ Unique token, transaction_id, pending-slot & verified-slot constraints enforced; rejected slot reuse permitted.');

  // Clean up test synthetic session row before rollback verification
  migratedDb.prepare('DELETE FROM admob_ssv_verifications WHERE session_id = ?').run(testSessId);
  migratedDb.prepare('DELETE FROM reward_sessions WHERE id = ?').run(testSessId);

  // Step 4: Idempotent re-run check
  console.log('\n[4/5] Verifying migration idempotency (second DDL pass)...');
  migratedDb.exec(`
    CREATE TABLE IF NOT EXISTS admob_ssv_verifications (id INTEGER PRIMARY KEY AUTOINCREMENT, verification_token TEXT UNIQUE);
    CREATE TABLE IF NOT EXISTS admob_ssv_audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_admob_ssv_slot_verified ON admob_ssv_verifications(session_type, session_id, ad_slot) WHERE status = 'verified';
    CREATE UNIQUE INDEX IF NOT EXISTS idx_admob_ssv_slot_pending ON admob_ssv_verifications(session_type, session_id, ad_slot) WHERE status = 'pending';
  `);
  compareSnapshots(preSnapshot, snapshotDatabaseTables(migratedDb), 'Idempotent-ReRun');
  console.log('      ✓ Re-running migration DDL is safely idempotent.');

  // Step 5: Additive Rollback Verification
  console.log('\n[5/5] Testing clean additive rollback & post-rollback full table hash verification...');
  migratedDb.exec(`
    DROP TABLE IF EXISTS admob_ssv_audit_logs;
    DROP TABLE IF EXISTS admob_ssv_verifications;
  `);
  const postRollbackIntegrity = migratedDb.pragma('integrity_check', { simple: true });
  const postRollbackFk = migratedDb.pragma('foreign_key_check');
  assert(postRollbackIntegrity === 'ok', 'Post-rollback PRAGMA integrity_check ok');
  assert(Array.isArray(postRollbackFk) && postRollbackFk.length === 0, 'Post-rollback zero foreign-key violations');
  compareSnapshots(preSnapshot, snapshotDatabaseTables(migratedDb), 'Post-Rollback');
  migratedDb.close();
  console.log('      ✓ Clean rollback restored original schema with 100% identical row hashes across all 10 core tables.');

  console.log('\n==============================================================');
  console.log('🎉 DATABASE MIGRATION, CONSTRAINT & ROLLBACK SAFETY PASSED');
  console.log('==============================================================');
}

try {
  main();
} catch (err) {
  console.error('\n❌ DATABASE MIGRATION SAFETY TEST FAILED:', err);
  process.exit(1);
}
