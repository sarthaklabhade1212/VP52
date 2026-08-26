import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Store,
  QrCode,
  Receipt,
  ShoppingBag,
  Tag,
  History,
  LogOut,
  ShieldCheck,
  RefreshCw,
  Menu,
  X,
  User
} from 'lucide-react';

export default function ShopLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    window.location.href = '/shop/login';
  };

  const handleSwitchToCustomerMode = () => {
    window.location.href = '/customer/login';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f8fafc' }}>
      {/* Mobile Top Header */}
      <header style={{
        height: '60px',
        background: '#064e3b',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800
          }}>
            <Store size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff', margin: 0, lineHeight: 1.1 }}>
              {user ? user.shop_name || user.full_name : 'Shop Merchant'}
            </h3>
            <span style={{ fontSize: '10px', color: '#a7f3d0', fontWeight: 600 }}>
              {user ? user.shop_code || 'SHOP-001' : 'SHOP-001'} • Physical Verifier
            </span>
          </div>
        </div>

        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          style={{ background: 'none', border: 'none', color: '#ffffff', padding: '6px', cursor: 'pointer' }}
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Slide-out Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(8px)', zIndex: 1500,
          display: 'flex', flexDirection: 'column'
        }} className="animate-slide-up">
          <div style={{ padding: '20px', background: '#064e3b', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Store size={24} color="#10b981" />
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>{user ? user.shop_name : 'Shop Store'}</h3>
                <span style={{ fontSize: '11px', color: '#a7f3d0' }}>{user ? user.email : ''}</span>
              </div>
            </div>
            <button onClick={() => setIsMobileMenuOpen(false)} style={{ background: 'none', border: 'none', color: 'white' }}>
              <X size={24} />
            </button>
          </div>

          <div style={{ flex: 1, padding: '20px', background: '#022c22', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={handleSwitchToCustomerMode}
              style={{
                padding: '14px', borderRadius: '12px', background: '#047857', color: 'white', border: 'none',
                fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}
            >
              <RefreshCw size={18} /> Switch to Customer Mode 👤
            </button>

            <button
              onClick={handleLogout}
              style={{
                padding: '14px', borderRadius: '12px', background: '#7f1d1d', color: '#fca5a5', border: 'none',
                fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: 'auto'
              }}
            >
              <LogOut size={18} /> Sign Out Merchant Account
            </button>
          </div>
        </div>
      )}

      {/* Main Responsive Content */}
      <main style={{ flex: 1, padding: '16px 16px 80px 16px', overflowY: 'auto' }}>
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '64px',
        background: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        zIndex: 1000,
        boxShadow: '0 -4px 15px rgba(0,0,0,0.05)'
      }}>
        <NavLink to="/shop/dashboard" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
          <QrCode size={20} />
          <span>Scan QR</span>
        </NavLink>

        <NavLink to="/shop/billing" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
          <Receipt size={20} />
          <span>Bill</span>
        </NavLink>

        <NavLink to="/shop/products" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
          <ShoppingBag size={20} />
          <span>Products</span>
        </NavLink>

        <NavLink to="/shop/offers" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
          <Tag size={20} />
          <span>Offers</span>
        </NavLink>

        <NavLink to="/shop/history" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
          <History size={20} />
          <span>History</span>
        </NavLink>
      </nav>

      <style>{`
        .mobile-nav-link {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          color: #64748b;
          font-size: 10px;
          font-weight: 700;
          text-decoration: none;
          padding: 6px 12px;
          border-radius: 12px;
          transition: all 0.2s ease;
        }
        .mobile-nav-link.active {
          color: #059669;
          background: #dcfce7;
        }
      `}</style>
    </div>
  );
}
