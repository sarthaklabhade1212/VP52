const crypto = require('crypto');

function getDatabase(dbOverride) {
  if (dbOverride) return dbOverride;
  return require('../db/database');
}

/**
 * Reconciles 365-day coin conversions for a user (or all users if targetUserId is null/undefined).
 * 
 * Rules:
 *  - 10,000 Normal Coins = 1 VIP Coin (10,000 : 1)
 *  - Conversion period: 365 days from earned_at
 *  - Automatically converts any Normal Coins lot/balance that is >= 365 days old into VIP Coins
 *  - Partial conversion: If total matured coins is e.g. 25,000:
 *      vipToCredit = Math.floor(25,000 / 10,000) = 2 VIP Coins
 *      normalToDeduct = 20,000 Normal Coins
 *      5,000 remains in Normal Coins
 *  - If matured < 10,000: remains in Normal Coins until reaching conversion threshold
 *  - Records COIN_CONVERSION in point_ledger and reward_transactions
 *  - Synchronizes wallets: normal_coins, vip_coins, and balance
 */
function reconcileCoinConversions(targetUserId = null, dbOverride = null) {
  const db = getDatabase(dbOverride);
  let convertedUsers = 0;
  let totalNormalDeducted = 0;
  let totalVipCredited = 0;

  try {
    const userIds = targetUserId
      ? [targetUserId]
      : db.prepare(`
          SELECT DISTINCT user_id FROM coin_lots
          WHERE status IN ('ACTIVE', 'PARTIALLY_USED')
            AND coins_remaining > 0
            AND (coin_type = 'NORMAL' OR tier != 'VIP' OR coin_type IS NULL)
            AND datetime(COALESCE(convert_at, datetime(earned_at, '+365 days'))) <= datetime('now')
        `).all().map(r => r.user_id);

    for (const userId of userIds) {
      const executeUserTx = db.transaction(() => {
        // Query matured Normal Coin lots (FIFO)
        const maturedLots = db.prepare(`
          SELECT * FROM coin_lots
          WHERE user_id = ?
            AND status IN ('ACTIVE', 'PARTIALLY_USED')
            AND coins_remaining > 0
            AND (coin_type = 'NORMAL' OR tier != 'VIP' OR coin_type IS NULL)
            AND datetime(COALESCE(convert_at, datetime(earned_at, '+365 days'))) <= datetime('now')
          ORDER BY earned_at ASC, id ASC
        `).all(userId);

        if (!maturedLots || maturedLots.length === 0) return;

        const totalMatured = maturedLots.reduce((sum, l) => sum + (l.coins_remaining || 0), 0);
        const vipToCredit = Math.floor(totalMatured / 10000);
        const normalToDeduct = vipToCredit * 10000;

        if (vipToCredit > 0 && normalToDeduct > 0) {
          let remainingToDeduct = normalToDeduct;

          for (const lot of maturedLots) {
            if (remainingToDeduct <= 0) break;
            const take = Math.min(lot.coins_remaining, remainingToDeduct);
            const newLotRemaining = lot.coins_remaining - take;
            const newLotStatus = newLotRemaining === 0 ? 'CONVERTED' : 'PARTIALLY_USED';

            db.prepare(`
              UPDATE coin_lots
              SET coins_remaining = ?,
                  status = ?,
                  last_transition_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `).run(newLotRemaining, newLotStatus, lot.id);

            remainingToDeduct -= take;
          }

          // Create or credit VIP Coin Lot
          const convTxId = `CONV-VIP-${userId}-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
          db.prepare(`
            INSERT INTO coin_lots (
              user_id, transaction_id, source, coins_earned, coins_remaining,
              coin_type, tier, original_amount, status, expires_at
            )
            VALUES (?, ?, 'CONVERSION', ?, ?, 'VIP', 'VIP', ?, 'ACTIVE', datetime('now', '+100 years'))
          `).run(userId, convTxId, vipToCredit, vipToCredit, vipToCredit);

          // Get wallet before updating
          const wBefore = db.prepare('SELECT balance, normal_coins, vip_coins FROM wallets WHERE user_id = ?').get(userId) || { balance: 0, normal_coins: 0, vip_coins: 0 };
          const prevBal = wBefore.balance;
          const newBal = Math.max(0, prevBal - normalToDeduct);

          // Audit in point_ledger
          db.prepare(`
            INSERT INTO point_ledger (user_id, transaction_id, type, points, previous_balance, new_balance, reason)
            VALUES (?, ?, 'COIN_CONVERSION', ?, ?, ?, ?)
          `).run(
            userId,
            convTxId,
            -normalToDeduct,
            prevBal,
            newBal,
            `10,000 Normal Coins = 1 VIP Coin (365-Day Conversion): Converted ${normalToDeduct} Normal Coins to ${vipToCredit} VIP Coin(s)`
          );

          // Audit in reward_transactions
          db.prepare(`
            INSERT INTO reward_transactions (user_id, activity_type, points)
            VALUES (?, 'COIN_CONVERSION', ?)
          `).run(userId, vipToCredit);

          convertedUsers++;
          totalNormalDeducted += normalToDeduct;
          totalVipCredited += vipToCredit;
        }

        // Recalculate and synchronize wallets table
        const normSum = db.prepare(`
          SELECT COALESCE(SUM(coins_remaining), 0) AS s FROM coin_lots
          WHERE user_id = ?
            AND status IN ('ACTIVE', 'PARTIALLY_USED')
            AND (coin_type = 'NORMAL' OR (tier != 'VIP' AND coin_type IS NULL))
        `).get(userId).s;

        const vipSum = db.prepare(`
          SELECT COALESCE(SUM(coins_remaining), 0) AS s FROM coin_lots
          WHERE user_id = ?
            AND status IN ('ACTIVE', 'PARTIALLY_USED')
            AND (coin_type = 'VIP' OR tier = 'VIP')
        `).get(userId).s;

        const lotCount = db.prepare('SELECT COUNT(*) AS c FROM coin_lots WHERE user_id = ?').get(userId).c;
        if (lotCount > 0) {
          db.prepare(`
            UPDATE wallets
            SET normal_coins = ?,
                vip_coins = ?,
                balance = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
          `).run(normSum, vipSum, normSum, userId);
        } else {
          db.prepare(`
            UPDATE wallets
            SET normal_coins = balance,
                vip_coins = COALESCE(vip_coins, 0),
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
          `).run(userId);
        }
      });
      executeUserTx();
    }
  } catch (err) {
    console.error('Error running coin conversion reconciliation:', err.message);
  }

  return { convertedUsers, totalNormalDeducted, totalVipCredited };
}

module.exports = {
  reconcileCoinConversions
};
