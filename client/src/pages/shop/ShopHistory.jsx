import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { History, Filter, CheckCircle2, Clock } from 'lucide-react';

export default function ShopHistory() {
  const { token } = useAuth();
  const [history, setHistory] = useState([]);
  const [timeFilter, setTimeFilter] = useState('all'); // 'today' | 'week' | 'month' | 'all'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'USED' | 'ACTIVE'
  const [loading, setLoading] = useState(true);

  const fetchHistory = () => {
    const query = new URLSearchParams({ timeFilter, statusFilter }).toString();
    fetch(`/api/shop/history?${query}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => { if (data.success) setHistory(data.history || []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchHistory();
  }, [token, timeFilter, statusFilter]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '24px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={26} color="#10b981" /> Store Redemption History
          </h2>
          <p style={{ fontSize: '14px', color: '#64748b' }}>
            Audit log of all vouchers redeemed and processed at your store location.
          </p>
        </div>

        {/* Filter Controls */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <select
            className="form-input"
            style={{ padding: '8px 12px', fontSize: '13px', borderRadius: '10px' }}
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
          >
            <option value="all">Time: All Time</option>
            <option value="today">Time: Today</option>
            <option value="week">Time: This Week</option>
            <option value="month">Time: This Month</option>
          </select>

          <select
            className="form-input"
            style={{ padding: '8px 12px', fontSize: '13px', borderRadius: '10px' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Status: All</option>
            <option value="USED">Status: Used</option>
            <option value="ACTIVE">Status: Active</option>
          </select>
        </div>
      </div>

      {/* History Table */}
      <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase' }}>
              <th style={{ padding: '14px 20px' }}>Redemption ID</th>
              <th style={{ padding: '14px 20px' }}>Customer</th>
              <th style={{ padding: '14px 20px' }}>Offer Applied</th>
              <th style={{ padding: '14px 20px' }}>Discount</th>
              <th style={{ padding: '14px 20px' }}>Points Used</th>
              <th style={{ padding: '14px 20px' }}>Status</th>
              <th style={{ padding: '14px 20px' }}>Date & Time</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  No redemptions found for selected filters.
                </td>
              </tr>
            ) : (
              history.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '14px 20px', fontWeight: 800, color: '#4f46e5' }}>{r.redemption_code}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ fontWeight: 700, color: '#0f172a', display: 'block' }}>{r.customer_name}</span>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>{r.customer_email}</span>
                  </td>
                  <td style={{ padding: '14px 20px', color: '#475569' }}>{r.offer_title}</td>
                  <td style={{ padding: '14px 20px', fontWeight: 800, color: '#10b981' }}>{r.discount_percent}% OFF (Max ₹{r.max_discount_inr})</td>
                  <td style={{ padding: '14px 20px', fontWeight: 700, color: '#4f46e5' }}>🪙 {r.points_deducted} Pts</td>
                  <td style={{ padding: '14px 20px' }}>
                    <span className={`badge ${r.status === 'USED' ? 'badge-used' : r.status === 'ACTIVE' ? 'badge-active' : 'badge-expired'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: '12px', color: '#64748b' }}>
                    {new Date(r.redeemed_at || r.created_at).toLocaleString('en-IN')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
