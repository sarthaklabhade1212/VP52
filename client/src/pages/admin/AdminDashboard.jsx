import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Users,
  Store,
  Receipt,
  Gift,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
  Award
} from 'lucide-react';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/dashboard', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(d => { if (d.success) setStats(d.stats || d.overview); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading admin dashboard...</div>;

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      {/* Top Banner */}
      <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', borderRadius: '20px', padding: '20px', marginBottom: '20px', border: '1px solid #4338ca' }}>
        <span style={{ fontSize: '10px', fontWeight: 800, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.08em', background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '6px' }}>
          SUPER ADMINISTRATOR PANEL
        </span>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff', marginTop: '6px', marginBottom: '4px' }}>
          Platform Analytics
        </h1>
        <p style={{ fontSize: '13px', color: '#c7d2fe', margin: 0 }}>
          Manage customers, verify physical merchants, and inspect audit logs.
        </p>
      </div>

      {/* Verification Queue Prompt Banner */}
      <div
        onClick={() => navigate('/admin/merchant-verification')}
        style={{
          background: '#1e293b', border: '2px solid #7c3aed', borderRadius: '18px', padding: '16px',
          marginBottom: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#7c3aed', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff', margin: 0 }}>Merchant Verification Queue</h3>
            <span style={{ fontSize: '11px', color: '#a7f3d0' }}>Approve newly registered store accounts</span>
          </div>
        </div>
        <ArrowRight size={18} color="#a5b4fc" />
      </div>

      {/* Mobile Stackable KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
        <div style={{ background: '#1e293b', borderRadius: '16px', padding: '16px', border: '1px solid #334155' }}>
          <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>Total Customers</span>
          <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#ffffff', margin: '4px 0 0 0' }}>
            {stats ? (stats.totalCustomers || stats.total_customers || 5) : 5}
          </h2>
        </div>

        <div style={{ background: '#1e293b', borderRadius: '16px', padding: '16px', border: '1px solid #334155' }}>
          <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>Verified Merchants</span>
          <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#10b981', margin: '4px 0 0 0' }}>
            {stats ? (stats.totalShops || stats.total_shops || 5) : 5}
          </h2>
        </div>

        <div style={{ background: '#1e293b', borderRadius: '16px', padding: '16px', border: '1px solid #334155' }}>
          <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>Total Transactions</span>
          <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#4f46e5', margin: '4px 0 0 0' }}>
            {stats ? (stats.totalRedemptions || stats.total_redemptions || 20) : 20}
          </h2>
        </div>

        <div style={{ background: '#1e293b', borderRadius: '16px', padding: '16px', border: '1px solid #334155' }}>
          <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>Reward Points</span>
          <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#f59e0b', margin: '4px 0 0 0' }}>
            🪙 {stats ? (stats.totalPoints || stats.total_points || '20.4K') : '20.4K'}
          </h2>
        </div>
      </div>

      {/* Quick Access Mobile Navigation Grid */}
      <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', marginBottom: '12px' }}>Admin Management Modules</h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div onClick={() => navigate('/admin/customers')} style={{ background: '#1e293b', borderRadius: '14px', padding: '14px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Users size={20} color="#4f46e5" />
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>Customer Accounts Management</span>
          </div>
          <ArrowRight size={16} color="#94a3b8" />
        </div>

        <div onClick={() => navigate('/admin/shops')} style={{ background: '#1e293b', borderRadius: '14px', padding: '14px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Store size={20} color="#10b981" />
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>Shops & Merchants Catalog</span>
          </div>
          <ArrowRight size={16} color="#94a3b8" />
        </div>

        <div onClick={() => navigate('/admin/transactions')} style={{ background: '#1e293b', borderRadius: '14px', padding: '14px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Receipt size={20} color="#f59e0b" />
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>Redemption Audit Logs</span>
          </div>
          <ArrowRight size={16} color="#94a3b8" />
        </div>
      </div>
    </div>
  );
}
