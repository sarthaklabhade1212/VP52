import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Shield,
  LayoutDashboard,
  Users,
  Store,
  Tag,
  Settings,
  Receipt,
  QrCode,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  Award
} from 'lucide-react';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    window.location.href = '/admin/login';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#0f172a', color: '#f8fafc' }}>
      {/* Mobile Top Header */}
      <header style={{
        height: '60px',
        background: '#1e293b',
        borderBottom: '1px solid #334155',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800
          }}>
            <Shield size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff', margin: 0, lineHeight: 1.1 }}>Super Admin</h3>
            <span style={{ fontSize: '10px', color: '#c7d2fe', fontWeight: 600 }}>Platform Control Panel</span>
          </div>
        </div>

        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          style={{ background: 'none', border: 'none', color: '#ffffff', padding: '6px', cursor: 'pointer' }}
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Slide-out Mobile Menu Drawer */}
      {isMobileMenuOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(10px)', zIndex: 1500,
          display: 'flex', flexDirection: 'column'
        }} className="animate-slide-up">
          <div style={{ padding: '20px', background: '#1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Shield size={24} color="#7c3aed" />
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'white' }}>Administrator</h3>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>{user ? user.email : 'admin@example.com'}</span>
              </div>
            </div>
            <button onClick={() => setIsMobileMenuOpen(false)} style={{ background: 'none', border: 'none', color: 'white' }}>
              <X size={24} />
            </button>
          </div>

          <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
            <NavLink to="/admin/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="admin-nav-item">
              <LayoutDashboard size={18} /> Dashboard Overview
            </NavLink>

            <NavLink to="/admin/merchant-verification" onClick={() => setIsMobileMenuOpen(false)} className="admin-nav-item">
              <ShieldCheck size={18} /> Merchant Verification Queue
            </NavLink>

            <NavLink to="/admin/customers" onClick={() => setIsMobileMenuOpen(false)} className="admin-nav-item">
              <Users size={18} /> Customers Management
            </NavLink>

            <NavLink to="/admin/shops" onClick={() => setIsMobileMenuOpen(false)} className="admin-nav-item">
              <Store size={18} /> Shops & Merchants
            </NavLink>

            <NavLink to="/admin/offers" onClick={() => setIsMobileMenuOpen(false)} className="admin-nav-item">
              <Tag size={18} /> Discount Offers
            </NavLink>

            <NavLink to="/admin/transactions" onClick={() => setIsMobileMenuOpen(false)} className="admin-nav-item">
              <Receipt size={18} /> Audit Transactions
            </NavLink>

            <NavLink to="/admin/settings" onClick={() => setIsMobileMenuOpen(false)} className="admin-nav-item">
              <Settings size={18} /> Platform Settings
            </NavLink>

            <button
              onClick={handleLogout}
              style={{
                padding: '14px', borderRadius: '12px', background: '#7f1d1d', color: '#fca5a5', border: 'none',
                fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: 'auto'
              }}
            >
              <LogOut size={18} /> Sign Out Admin
            </button>
          </div>
        </div>
      )}

      {/* Main Responsive Content */}
      <main style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
        <Outlet />
      </main>

      <style>{`
        .admin-nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          border-radius: 12px;
          color: #cbd5e1;
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          background: #1e293b;
          transition: all 0.2s ease;
        }
        .admin-nav-item:hover, .admin-nav-item.active {
          background: #4f46e5;
          color: #ffffff;
        }
      `}</style>
    </div>
  );
}
