import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Users, Search, UserCheck, UserX, Eye, Award } from 'lucide-react';

export default function AdminCustomers() {
  const { token } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const fetchCustomers = () => {
    fetch('/api/admin/customers', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) setCustomers(data.customers || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCustomers();
  }, [token]);

  const toggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      const res = await fetch(`/api/admin/customers/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) fetchCustomers();
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = customers.filter(c =>
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '24px', color: '#0f172a' }}>Customer Management</h2>
          <p style={{ fontSize: '14px', color: '#64748b' }}>View customer accounts, points balances, and manage account statuses.</p>
        </div>

        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '12px' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '38px', padding: '10px 10px 10px 38px' }}
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Customer Table */}
      <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase' }}>
              <th style={{ padding: '14px 20px' }}>ID</th>
              <th style={{ padding: '14px 20px' }}>Customer</th>
              <th style={{ padding: '14px 20px' }}>Current Balance</th>
              <th style={{ padding: '14px 20px' }}>Earned / Redeemed</th>
              <th style={{ padding: '14px 20px' }}>Status</th>
              <th style={{ padding: '14px 20px' }}>Joined Date</th>
              <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '14px 20px', fontWeight: 700, color: '#64748b' }}>#{c.id}</td>
                <td style={{ padding: '14px 20px' }}>
                  <span style={{ fontWeight: 700, color: '#0f172a', display: 'block' }}>{c.full_name}</span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>{c.email}</span>
                </td>
                <td style={{ padding: '14px 20px', fontWeight: 800, color: '#10b981' }}>
                  {(c.balance || 0).toLocaleString()} Pts
                </td>
                <td style={{ padding: '14px 20px', fontSize: '13px' }}>
                  <span style={{ color: '#16a34a', fontWeight: 600 }}>+{(c.total_earned || 0).toLocaleString()}</span>
                  <span style={{ color: '#94a3b8' }}> / </span>
                  <span style={{ color: '#dc2626', fontWeight: 600 }}>-{(c.total_redeemed || 0).toLocaleString()}</span>
                </td>
                <td style={{ padding: '14px 20px' }}>
                  <span className={`badge ${c.status === 'active' ? 'badge-active' : 'badge-suspended'}`}>
                    {c.status}
                  </span>
                </td>
                <td style={{ padding: '14px 20px', fontSize: '13px', color: '#64748b' }}>
                  {new Date(c.created_at).toLocaleDateString('en-IN')}
                </td>
                <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                  <button
                    onClick={() => toggleStatus(c.id, c.status)}
                    style={{
                      border: 'none',
                      background: c.status === 'active' ? '#fef2f2' : '#ecfdf5',
                      color: c.status === 'active' ? '#dc2626' : '#059669',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    {c.status === 'active' ? 'Suspend' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
