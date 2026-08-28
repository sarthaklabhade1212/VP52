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
    <div style={{ background: '#050505' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '24px', color: '#FFFFFF', fontWeight: 800 }}>Customer Management</h2>
          <p style={{ fontSize: '14px', color: '#B8B8B8' }}>View customer accounts, points balances, and manage account statuses.</p>
        </div>

        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={18} color="#C9A227" style={{ position: 'absolute', left: '12px', top: '12px' }} />
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
      <div style={{ background: '#111111', borderRadius: '16px', border: '1px solid rgba(212, 175, 55, 0.15)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: '#151515', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', color: '#B8B8B8', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase' }}>
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
              <tr key={c.id} style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.1)' }}>
                <td style={{ padding: '14px 20px', fontWeight: 700, color: '#B8B8B8' }}>#{c.id}</td>
                <td style={{ padding: '14px 20px' }}>
                  <span style={{ fontWeight: 700, color: '#FFFFFF', display: 'block' }}>{c.full_name}</span>
                  <span style={{ fontSize: '12px', color: '#B8B8B8' }}>{c.email}</span>
                </td>
                <td style={{ padding: '14px 20px', fontWeight: 800, color: '#F2D675' }}>
                  {(c.balance || 0).toLocaleString()} Pts
                </td>
                <td style={{ padding: '14px 20px', fontSize: '13px' }}>
                  <span style={{ color: '#D4AF37', fontWeight: 600 }}>+{(c.total_earned || 0).toLocaleString()}</span>
                  <span style={{ color: '#777777' }}> / </span>
                  <span style={{ color: '#ef4444', fontWeight: 600 }}>-{(c.total_redeemed || 0).toLocaleString()}</span>
                </td>
                <td style={{ padding: '14px 20px' }}>
                  <span className={`badge ${c.status === 'active' ? 'badge-active' : 'badge-suspended'}`}>
                    {c.status}
                  </span>
                </td>
                <td style={{ padding: '14px 20px', fontSize: '13px', color: '#B8B8B8' }}>
                  {new Date(c.created_at).toLocaleDateString('en-IN')}
                </td>
                <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                  <button
                    onClick={() => toggleStatus(c.id, c.status)}
                    style={{
                      border: c.status === 'active' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(212, 175, 55, 0.3)',
                      background: '#151515',
                      color: c.status === 'active' ? '#ef4444' : '#F2D675',
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
