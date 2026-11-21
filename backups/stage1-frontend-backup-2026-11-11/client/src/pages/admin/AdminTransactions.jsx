import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Receipt, Sparkles, ShoppingBag, Clock, CheckCircle2 } from 'lucide-react';

export default function AdminTransactions() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('redemptions');
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
    <div style={{ background: '#050505' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 800 }}>
          <Receipt size={26} color="#D4AF37" /> Audit Transaction Logs
        </h2>
        <p style={{ fontSize: '14px', color: '#B8B8B8' }}>
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
          <ShoppingBag size={16} color={activeTab === 'redemptions' ? '#050505' : '#D4AF37'} /> Shop Redemptions ({redemptionTx.length})
        </button>

        <button
          onClick={() => setActiveTab('rewards')}
          className={activeTab === 'rewards' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '10px 18px', fontSize: '13px', borderRadius: '10px' }}
        >
          <Sparkles size={16} color={activeTab === 'rewards' ? '#050505' : '#D4AF37'} /> Reward Transactions ({rewardTx.length})
        </button>
      </div>

      <div style={{ background: '#111111', borderRadius: '16px', border: '1px solid rgba(212, 175, 55, 0.15)', overflow: 'hidden' }}>
        {activeTab === 'redemptions' ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#151515', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', color: '#B8B8B8', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase' }}>
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
                <tr key={tx.id} style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.1)' }}>
                  <td style={{ padding: '14px 20px', fontWeight: 800, color: '#F2D675' }}>{tx.redemption_code}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ fontWeight: 700, color: '#FFFFFF', display: 'block' }}>{tx.customer_name}</span>
                    <span style={{ fontSize: '12px', color: '#B8B8B8' }}>{tx.customer_email}</span>
                  </td>
                  <td style={{ padding: '14px 20px', fontWeight: 700, color: '#FFFFFF' }}>{tx.shop_name}</td>
                  <td style={{ padding: '14px 20px', fontWeight: 800, color: '#D4AF37' }}>{tx.discount_percent}% OFF</td>
                  <td style={{ padding: '14px 20px', fontWeight: 700, color: '#ef4444' }}>-{tx.points_deducted} Pts</td>
                  <td style={{ padding: '14px 20px' }}>
                    <span className={`badge ${tx.status === 'ACTIVE' ? 'badge-active' : tx.status === 'USED' ? 'badge-used' : 'badge-expired'}`}>
                      {tx.status}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: '12px', color: '#B8B8B8' }}>
                    {new Date(tx.created_at).toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#151515', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', color: '#B8B8B8', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase' }}>
                <th style={{ padding: '14px 20px' }}>Tx ID</th>
                <th style={{ padding: '14px 20px' }}>Customer</th>
                <th style={{ padding: '14px 20px' }}>Activity</th>
                <th style={{ padding: '14px 20px' }}>Points Earned</th>
                <th style={{ padding: '14px 20px' }}>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {rewardTx.map((tx) => (
                <tr key={tx.id} style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.1)' }}>
                  <td style={{ padding: '14px 20px', fontWeight: 700, color: '#B8B8B8' }}>#{tx.id}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ fontWeight: 700, color: '#FFFFFF', display: 'block' }}>{tx.customer_name}</span>
                    <span style={{ fontSize: '12px', color: '#B8B8B8' }}>{tx.customer_email}</span>
                  </td>
                  <td style={{ padding: '14px 20px', fontWeight: 600, color: '#B8B8B8' }}>{tx.activity_type}</td>
                  <td style={{ padding: '14px 20px', fontWeight: 800, color: '#F2D675' }}>+{tx.points} Pts</td>
                  <td style={{ padding: '14px 20px', fontSize: '12px', color: '#B8B8B8' }}>
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
