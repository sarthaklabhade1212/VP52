import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Receipt, Sparkles, ShoppingBag, Clock, CheckCircle2 } from 'lucide-react';

export default function AdminTransactions() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('redemptions'); // 'redemptions' | 'rewards'
  const [rewardTx, setRewardTx] = useState([]);
  const [redemptionTx, setRedemptionTx] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/transactions/rewards', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/admin/transactions/redemptions', { headers: { Authorization: `Bearer ${token}` } })
    ])
      .then(async ([r1, r2]) => {
        const d1 = await r1.json();
        const d2 = await r2.json();
        if (d1.success) setRewardTx(d1.rewards || []);
        if (d2.success) setRedemptionTx(d2.redemptions || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Receipt size={26} color="#4f46e5" /> Audit Transaction Logs
        </h2>
        <p style={{ fontSize: '14px', color: '#64748b' }}>
          Immutable ledger of earned simulated ad rewards and shop redemption transactions.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('redemptions')}
          className={activeTab === 'redemptions' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '10px 18px', fontSize: '13px', borderRadius: '10px' }}
        >
          <ShoppingBag size={16} /> Shop Redemptions ({redemptionTx.length})
        </button>

        <button
          onClick={() => setActiveTab('rewards')}
          className={activeTab === 'rewards' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '10px 18px', fontSize: '13px', borderRadius: '10px' }}
        >
          <Sparkles size={16} /> Reward Transactions ({rewardTx.length})
        </button>
      </div>

      <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {activeTab === 'redemptions' ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase' }}>
                <th style={{ padding: '14px 20px' }}>Code</th>
                <th style={{ padding: '14px 20px' }}>Customer</th>
                <th style={{ padding: '14px 20px' }}>Physical Shop</th>
                <th style={{ padding: '14px 20px' }}>Discount</th>
                <th style={{ padding: '14px 20px' }}>Points Deducted</th>
                <th style={{ padding: '14px 20px' }}>Status</th>
                <th style={{ padding: '14px 20px' }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {redemptionTx.map((tx) => (
                <tr key={tx.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '14px 20px', fontWeight: 800, color: '#4f46e5' }}>{tx.redemption_code}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ fontWeight: 700, color: '#0f172a', display: 'block' }}>{tx.customer_name}</span>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>{tx.customer_email}</span>
                  </td>
                  <td style={{ padding: '14px 20px', fontWeight: 700, color: '#0f172a' }}>{tx.shop_name}</td>
                  <td style={{ padding: '14px 20px', fontWeight: 800, color: '#10b981' }}>{tx.discount_percent}% OFF</td>
                  <td style={{ padding: '14px 20px', fontWeight: 700, color: '#dc2626' }}>-{tx.points_deducted} Pts</td>
                  <td style={{ padding: '14px 20px' }}>
                    <span className={`badge ${tx.status === 'ACTIVE' ? 'badge-active' : tx.status === 'USED' ? 'badge-used' : 'badge-expired'}`}>
                      {tx.status}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: '12px', color: '#64748b' }}>
                    {new Date(tx.created_at).toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase' }}>
                <th style={{ padding: '14px 20px' }}>Tx ID</th>
                <th style={{ padding: '14px 20px' }}>Customer</th>
                <th style={{ padding: '14px 20px' }}>Activity</th>
                <th style={{ padding: '14px 20px' }}>Points Earned</th>
                <th style={{ padding: '14px 20px' }}>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {rewardTx.map((tx) => (
                <tr key={tx.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '14px 20px', fontWeight: 700, color: '#64748b' }}>#{tx.id}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ fontWeight: 700, color: '#0f172a', display: 'block' }}>{tx.customer_name}</span>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>{tx.customer_email}</span>
                  </td>
                  <td style={{ padding: '14px 20px', fontWeight: 600, color: '#475569' }}>{tx.activity_type}</td>
                  <td style={{ padding: '14px 20px', fontWeight: 800, color: '#16a34a' }}>+{tx.points} Pts</td>
                  <td style={{ padding: '14px 20px', fontSize: '12px', color: '#64748b' }}>
                    {new Date(tx.created_at).toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
