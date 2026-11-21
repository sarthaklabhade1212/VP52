import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import useChatUnread from '../hooks/useChatUnread';
import LanguageSwitcher from './LanguageSwitcher';
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
  User,
  MessageCircle
} from 'lucide-react';

export default function ShopLayout() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const unread = useChatUnread('shop');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    window.location.href = '/shop/login';
  };

  const handleSwitchToCustomerMode = () => {
    window.location.href = '/customer/login';
  };

  if (user && user.must_change_password) {
    return <Navigate to="/shop/change-password" replace />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#050505' }}>
      {/* Mobile Top Header */}
      <header style={{
        height: '60px',
        background: '#0B0B0B',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        borderBottom: '1px solid rgba(212, 175, 55, 0.2)',
        boxShadow: '0 4px 15px rgba(0,0,0,0.8)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#050505', fontWeight: 800
          }}>
            <Store size={20} color="#050505" />
          </div>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', margin: 0, lineHeight: 1.1 }}>
              {user ? user.shop_name || user.full_name : t('shopMerchantFallback')}
            </h3>
            <span style={{ fontSize: '10px', color: '#D4AF37', fontWeight: 600 }}>
              {user ? user.shop_code || 'SHOP-001' : 'SHOP-001'} • {t('physicalVerifier')}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <LanguageSwitcher tone="dark" compact />
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            style={{ background: 'none', border: 'none', color: '#D4AF37', padding: '6px', cursor: 'pointer' }}
          >
            {isMobileMenuOpen ? <X size={24} color="#D4AF37" /> : <Menu size={24} color="#D4AF37" />}
          </button>
        </div>
      </header>

      {/* Slide-out Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(10px)', zIndex: 1500,
          display: 'flex', flexDirection: 'column'
        }} className="animate-slide-up">
          <div style={{ padding: '20px', background: '#0B0B0B', borderBottom: '1px solid rgba(212, 175, 55, 0.2)', color: '#FFFFFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Store size={24} color="#D4AF37" />
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>{user ? user.shop_name : t('shopStoreFallback')}</h3>
                <span style={{ fontSize: '11px', color: '#B8B8B8' }}>{user ? user.email : ''}</span>
              </div>
            </div>
            <button onClick={() => setIsMobileMenuOpen(false)} style={{ background: 'none', border: 'none', color: '#D4AF37', cursor: 'pointer' }}>
              <X size={24} color="#D4AF37" />
            </button>
          </div>

          <div style={{ flex: 1, padding: '20px', background: '#111111', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
            <NavLink
              to="/shop/dashboard"
              onClick={() => setIsMobileMenuOpen(false)}
              style={({ isActive }) => ({
                padding: '12px 16px',
                borderRadius: '12px',
                color: isActive ? '#F2D675' : '#FFFFFF',
                background: isActive ? '#1A1A1A' : 'transparent',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              })}
            >
              <QrCode size={18} color="#D4AF37" /> QR Scanner & Dashboard
            </NavLink>

            <NavLink
              to="/shop/products"
              onClick={() => setIsMobileMenuOpen(false)}
              style={({ isActive }) => ({
                padding: '12px 16px',
                borderRadius: '12px',
                color: isActive ? '#F2D675' : '#FFFFFF',
                background: isActive ? '#1A1A1A' : 'transparent',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              })}
            >
              <ShoppingBag size={18} color="#D4AF37" /> Products & Menu Catalog
            </NavLink>

            <NavLink
              to="/shop/photos"
              onClick={() => setIsMobileMenuOpen(false)}
              style={({ isActive }) => ({
                padding: '12px 16px',
                borderRadius: '12px',
                color: isActive ? '#F2D675' : '#FFFFFF',
                background: isActive ? '#1A1A1A' : 'transparent',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              })}
            >
              <Store size={18} color="#D4AF37" /> Shop Photo Gallery
            </NavLink>

            <NavLink
              to="/shop/reviews"
              onClick={() => setIsMobileMenuOpen(false)}
              style={({ isActive }) => ({
                padding: '12px 16px',
                borderRadius: '12px',
                color: isActive ? '#F2D675' : '#FFFFFF',
                background: isActive ? '#1A1A1A' : 'transparent',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              })}
            >
              <ShieldCheck size={18} color="#D4AF37" /> Customer Reviews & Ratings
            </NavLink>

            <NavLink
              to="/shop/orders"
              onClick={() => setIsMobileMenuOpen(false)}
              style={({ isActive }) => ({
                padding: '12px 16px',
                borderRadius: '12px',
                color: isActive ? '#F2D675' : '#FFFFFF',
                background: isActive ? '#1A1A1A' : 'transparent',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              })}
            >
              <Receipt size={18} color="#D4AF37" /> Customer Orders & Inquiries
            </NavLink>

            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '16px' }}>
              <button
                onClick={handleSwitchToCustomerMode}
                className="btn-secondary"
                style={{
                  padding: '14px', borderRadius: '12px', fontSize: '14px', fontWeight: 700, justifyContent: 'center'
                }}
              >
                <RefreshCw size={18} color="#D4AF37" /> {t('switchToCustomer')}
              </button>

              <button
                onClick={handleLogout}
                style={{
                  padding: '14px', borderRadius: '12px', background: '#151515', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)',
                  fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer'
                }}
              >
                <LogOut size={18} color="#ef4444" /> {t('signOutMerchant')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Responsive Content */}
      <main style={{ flex: 1, padding: '16px 16px 80px 16px', overflowY: 'auto', background: '#050505' }}>
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '64px',
        background: '#0B0B0B',
        borderTop: '1px solid rgba(212, 175, 55, 0.2)',
        display: 'flex',
        justify: 'space-around',
        alignItems: 'center',
        zIndex: 1000,
        boxShadow: '0 -4px 20px rgba(0,0,0,0.8)'
      }}>
        <NavLink to="/shop/dashboard" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
          <QrCode size={20} />
          <span>{t('navScanQr')}</span>
        </NavLink>

        <NavLink to="/shop/billing" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
          <Receipt size={20} />
          <span>{t('navBill')}</span>
        </NavLink>

        <NavLink to="/shop/products" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
          <ShoppingBag size={20} />
          <span>{t('navProducts')}</span>
        </NavLink>

        <NavLink to="/shop/offers" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
          <Tag size={20} />
          <span>{t('navOffers')}</span>
        </NavLink>

        <NavLink to="/shop/messages" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
          <div style={{ position: 'relative', display: 'inline-flex' }}>
            <MessageCircle size={20} />
            {unread > 0 && (
              <span style={{ position: 'absolute', top: '-6px', right: '-10px', background: '#ef4444', color: '#FFFFFF', fontSize: '10px', fontWeight: 800, borderRadius: '999px', minWidth: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </div>
          <span>{t('navMessages')}</span>
        </NavLink>

        <NavLink to="/shop/history" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
          <History size={20} />
          <span>{t('navHistory')}</span>
        </NavLink>
      </nav>

      <style>{`
        .mobile-nav-link {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          color: #777777;
          font-size: 10px;
          font-weight: 700;
          text-decoration: none;
          padding: 6px 10px;
          border-radius: 12px;
          transition: all 0.2s ease;
        }
        .mobile-nav-link.active {
          color: #D4AF37;
          background: rgba(212, 175, 55, 0.12);
          border: 1px solid rgba(212, 175, 55, 0.25);
        }
      `}</style>
    </div>
  );
}
