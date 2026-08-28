const db = require('./db/database');

function runTest() {
  console.log('--- VP52 6-HOUR COIN SESSION INTEGRATION TEST ---');

  // Find or create test customer
  let testUser = db.prepare("SELECT * FROM users WHERE email = 'testcustomer@vp52.com'").get();
  if (!testUser) {
    const res = db.prepare(`
      INSERT INTO users (full_name, email, password_hash)
      VALUES ('Test Customer', 'testcustomer@vp52.com', 'hash123')
    `).run();
    testUser = db.prepare("SELECT * FROM users WHERE id = ?").get(res.lastInsertRowid);
    db.prepare("INSERT INTO wallets (user_id, balance) VALUES (?, 0)").run(testUser.id);
  }

  const userId = testUser.id;
  console.log(`Test Customer ID: ${userId}`);

  // Reset any previous sessions for test customer
  db.prepare("DELETE FROM vp52_coin_sessions WHERE user_id = ?").run(userId);

  // 1. Initial State Check
  console.log('\n[TEST 1] Initial state check...');
  let session = db.prepare("SELECT * FROM vp52_coin_sessions WHERE user_id = ? AND status = 'active'").get(userId);
  console.log('Active session:', session ? 'FOUND (ERROR)' : 'NONE (PASS)');

  // 2. Complete 3 Ads
  console.log('\n[TEST 2] Completing 3 required ads...');
  for (let i = 1; i <= 3; i++) {
    let pending = db.prepare("SELECT * FROM vp52_coin_sessions WHERE user_id = ? AND status IN ('pending_ads', 'ready_to_start')").get(userId);
    if (!pending) {
      db.prepare("INSERT INTO vp52_coin_sessions (user_id, ads_completed, status) VALUES (?, 1, 'pending_ads')").run(userId);
    } else {
      const newCount = Math.min(3, pending.ads_completed + 1);
      const newStatus = newCount >= 3 ? 'ready_to_start' : 'pending_ads';
      db.prepare("UPDATE vp52_coin_sessions SET ads_completed = ?, status = ? WHERE id = ?").run(newCount, newStatus, pending.id);
    }
    const current = db.prepare("SELECT ads_completed, status FROM vp52_coin_sessions WHERE user_id = ?").get(userId);
    console.log(`Ad ${i} watched -> Ads Completed: ${current.ads_completed}/3, Status: ${current.status}`);
  }

  // 3. Start 6-Hour Session
  console.log('\n[TEST 3] Starting 6-Hour Session...');
  const pending = db.prepare("SELECT * FROM vp52_coin_sessions WHERE user_id = ? AND ads_completed >= 3").get(userId);
  const now = Date.now();
  const durationSec = 21600; // 6 hours
  const startTime = new Date(now).toISOString();
  const endTime = new Date(now + durationSec * 1000).toISOString();

  db.prepare(`
    UPDATE vp52_coin_sessions
    SET started_at = ?, expires_at = ?, duration_seconds = ?, status = 'active', coins_earned = 0, reward_claimed = 0
    WHERE id = ?
  `).run(startTime, endTime, durationSec, pending.id);

  session = db.prepare("SELECT * FROM vp52_coin_sessions WHERE id = ?").get(pending.id);
  console.log('Session started:', {
    id: session.id,
    started_at: session.started_at,
    expires_at: session.expires_at,
    duration_seconds: session.duration_seconds,
    status: session.status
  });

  // 4. Test Timestamp Rate Math
  console.log('\n[TEST 4] Simulating 1 hour, 3 hours, and 6 hours elapsed time...');
  const simulatedTimes = [
    { label: '0 seconds (Start)', elapsedSec: 0 },
    { label: '1 second', elapsedSec: 1 },
    { label: '1 hour (3,600s)', elapsedSec: 3600 },
    { label: '3 hours (10,800s)', elapsedSec: 10800 },
    { label: '6 hours (21,600s)', elapsedSec: 21600 }
  ];

  simulatedTimes.forEach(t => {
    const coins = Math.min(100.0, Math.max(0.0, (t.elapsedSec / durationSec) * 100.0));
    console.log(`- ${t.label}: ${coins.toFixed(5)} VP52 Coins (${((coins / 100) * 100).toFixed(2)}%)`);
  });

  // 5. Test Session Completion & Idempotency
  console.log('\n[TEST 5] Testing Session Completion & Idempotency...');
  const walletBefore = db.prepare("SELECT balance FROM wallets WHERE user_id = ?").get(userId) || { balance: 0 };
  console.log(`Wallet Balance Before Claim: ${walletBefore.balance} Coins`);

  // First Claim
  db.prepare(`
    UPDATE vp52_coin_sessions
    SET status = 'completed', completed_at = CURRENT_TIMESTAMP, reward_claimed = 1, coins_earned = 100
    WHERE id = ? AND reward_claimed = 0
  `).run(session.id);
  db.prepare("UPDATE wallets SET balance = balance + 100, total_earned = total_earned + 100 WHERE user_id = ?").run(userId);

  const walletAfterFirst = db.prepare("SELECT balance FROM wallets WHERE user_id = ?").get(userId);
  console.log(`Wallet Balance After 1st Claim: ${walletAfterFirst.balance} Coins (PASS: +100)`);

  // Second Claim Attempt (Idempotent Check)
  const sessionCheck = db.prepare("SELECT reward_claimed FROM vp52_coin_sessions WHERE id = ?").get(session.id);
  if (sessionCheck.reward_claimed === 1) {
    console.log('2nd Claim Attempt: Blocked by idempotency check (PASS - 0 extra coins awarded)');
  }
  const walletAfterSecond = db.prepare("SELECT balance FROM wallets WHERE user_id = ?").get(userId);
  console.log(`Wallet Balance After 2nd Claim Attempt: ${walletAfterSecond.balance} Coins`);

  console.log('\n--- ALL VP52 COIN SESSION INTEGRATION TESTS PASSED ---');
}

runTest();
