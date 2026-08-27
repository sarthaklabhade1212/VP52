import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Home, Gift, Wallet, History, User, MessageCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import useChatUnread from '../hooks/useChatUnread';
import LanguageSwitcher from './LanguageSwitcher';
import { APP_NAME } from '../config/brand';

export default function CustomerLayout() {
  const { user } = useAuth();
  const { t } = useI18n();
  const unread = useChatUnread('customer');

  return (
    <div className="app-container">
      {/* Top Header */}
      <header style={{
        padding: '16px 20px',
        background: '#ffffff',
        borderBottom: '1px solid #f1f5f9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 40
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 800,
            fontSize: '18px',
            boxShadow: '0 4px 10px rgba(79, 70, 229, 0.3)'
          }}>
            {APP_NAME.charAt(0)}
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>{APP_NAME}</h3>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{t('physicalShopDiscounts')}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <LanguageSwitcher tone="light" compact />
          <div style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            padding: '6px 12px',
            borderRadius: '99px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span style={{ fontSize: '14px' }}>🪙</span>
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#15803d' }}>
              {user ? (user.balance || 0).toLocaleString() : 0} {t('ptsSuffix')}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, paddingBottom: '80px', background: '#f8fafc' }}>
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <NavLink to="/customer/home" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Home size={22} />
          <span>{t('navHome')}</span>
        </NavLink>

        <NavLink to="/customer/rewards" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Gift size={22} />
          <span>{t('navOffers')}</span>
        </NavLink>

        <NavLink to="/customer/wallet" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Wallet size={22} />
          <span>{t('navWallet')}</span>
        </NavLink>

        <NavLink to="/customer/history" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <History size={22} />
          <span>{t('navHistory')}</span>
        </NavLink>

        <NavLink to="/customer/messages" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <div style={{ position: 'relative', display: 'inline-flex' }}>
            <MessageCircle size={22} />
            {unread > 0 && (
              <span style={{ position: 'absolute', top: '-6px', right: '-10px', background: '#ef4444', color: '#fff', fontSize: '10px', fontWeight: 800, borderRadius: '999px', minWidth: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </div>
          <span>{t('navMessages')}</span>
        </NavLink>

        <NavLink to="/customer/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <User size={22} />
          <span>{t('navProfile')}</span>
        </NavLink>
      </nav>
    </div>
  );
}
