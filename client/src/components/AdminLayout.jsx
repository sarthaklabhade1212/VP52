import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import LanguageSwitcher from './LanguageSwitcher';
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
  const { t } = useI18n();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    window.location.href = '/admin/login';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#050505', color: '#FFFFFF' }}>
      {/* Mobile Top Header */}
      <header style={{
        height: '60px',
        background: '#0B0B0B',
        borderBottom: '1px solid rgba(212, 175, 55, 0.2)',
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
            background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#050505', fontWeight: 800
          }}>
            <Shield size={20} color="#050505" />
          </div>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', margin: 0, lineHeight: 1.1 }}>{t('superAdmin')}</h3>
            <span style={{ fontSize: '10px', color: '#D4AF37', fontWeight: 600 }}>{t('platformControlPanel')}</span>
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

      {/* Slide-out Mobile Menu Drawer */}
      {isMobileMenuOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(10px)', zIndex: 1500,
          display: 'flex', flexDirection: 'column'
        }} className="animate-slide-up">
          <div style={{ padding: '20px', background: '#0B0B0B', borderBottom: '1px solid rgba(212, 175, 55, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Shield size={24} color="#D4AF37" />
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>{t('adminRole')}</h3>
                <span style={{ fontSize: '11px', color: '#B8B8B8' }}>{user ? user.email : 'admin@example.com'}</span>
              </div>
            </div>
            <button onClick={() => setIsMobileMenuOpen(false)} style={{ background: 'none', border: 'none', color: '#D4AF37', cursor: 'pointer' }}>
              <X size={24} color="#D4AF37" />
            </button>
          </div>

          <div style={{ flex: 1, padding: '16px', background: '#111111', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
            <NavLink to="/admin/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="admin-nav-item">
              <LayoutDashboard size={18} /> {t('navDashboardOverview')}
            </NavLink>

            <NavLink to="/admin/merchant-verification" onClick={() => setIsMobileMenuOpen(false)} className="admin-nav-item">
              <ShieldCheck size={18} /> {t('navMerchantVerification')}
            </NavLink>

            <NavLink to="/admin/customers" onClick={() => setIsMobileMenuOpen(false)} className="admin-nav-item">
              <Users size={18} /> {t('navCustomersManagement')}
            </NavLink>

            <NavLink to="/admin/shops" onClick={() => setIsMobileMenuOpen(false)} className="admin-nav-item">
              <Store size={18} /> {t('navShopsMerchants')}
            </NavLink>

            <NavLink to="/admin/offers" onClick={() => setIsMobileMenuOpen(false)} className="admin-nav-item">
              <Tag size={18} /> {t('navDiscountOffers')}
            </NavLink>

            <NavLink to="/admin/transactions" onClick={() => setIsMobileMenuOpen(false)} className="admin-nav-item">
              <Receipt size={18} /> {t('navAuditTransactions')}
            </NavLink>

            <NavLink to="/admin/settings" onClick={() => setIsMobileMenuOpen(false)} className="admin-nav-item">
              <Settings size={18} /> {t('navPlatformSettings')}
            </NavLink>

            <button
              onClick={handleLogout}
              style={{
                padding: '14px', borderRadius: '12px', background: '#151515', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)',
                fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: 'auto', cursor: 'pointer'
              }}
            >
              <LogOut size={18} color="#ef4444" /> {t('signOutAdmin')}
            </button>
          </div>
        </div>
      )}

      {/* Main Responsive Content */}
      <main style={{ flex: 1, padding: '16px', overflowY: 'auto', background: '#050505' }}>
        <Outlet />
      </main>

      <style>{`
        .admin-nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          border-radius: 12px;
          color: #B8B8B8;
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          background: #111111;
          border: 1px solid rgba(212, 175, 55, 0.15);
          transition: all 0.2s ease;
        }
        .admin-nav-item:hover, .admin-nav-item.active {
          background: rgba(212, 175, 55, 0.15);
          color: #F2D675;
          border-color: #D4AF37;
        }
      `}</style>
    </div>
  );
}
