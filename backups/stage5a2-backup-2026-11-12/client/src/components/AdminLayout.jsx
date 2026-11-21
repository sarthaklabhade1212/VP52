import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import LanguageSwitcher from './LanguageSwitcher';
import {
  LayoutDashboard,
  Users,
  Store,
  Tags,
  Coins,
  Percent,
  ShoppingBag,
  CreditCard,
  Share2,
  Crown,
  Bell,
  Tv,
  Headphones,
  BarChart3,
  ShieldAlert,
  Search,
  LogOut,
  Menu,
  X,
  Shield,
  ShieldCheck,
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  CheckCircle2
} from 'lucide-react';

export default function AdminLayout() {
  const { user, token, logout } = useAuth();
  const { t, translateCategory } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [badgeCounts, setBadgeCounts] = useState({
    pendingMerchants: 0,
    openComplaints: 0,
    fraudAlerts: 0
  });

  // Global Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchRef = useRef(null);

  // Notification center state
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [recentNotifs, setRecentNotifs] = useState([]);
  const notifRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearchDropdown(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch quick summary badges
  useEffect(() => {
    if (!token) return;
    fetch('/api/admin/dashboard-stats?range=all', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(d => {
        if (d.success && d.stats) {
          setBadgeCounts({
            pendingMerchants: d.stats.pendingMerchants || 0,
            openComplaints: d.stats.openComplaints || 0,
            fraudAlerts: d.stats.fraudAlerts || 0
          });
        }
      })
      .catch(console.error);

    // Fetch notifications
    fetch('/api/admin/notifications?limit=5', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(d => {
        if (d.success && d.notifications) {
          setRecentNotifs(d.notifications);
        }
      })
      .catch(console.error);
  }, [token, location.pathname]);

  // Debounced global search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(() => {
      fetch(`/api/admin/global-search?q=${encodeURIComponent(searchQuery.trim())}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(d => {
          if (d.success && d.results) {
            setSearchResults(d.results);
            setShowSearchDropdown(true);
          }
        })
        .catch(console.error)
        .finally(() => setIsSearching(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, token]);

  const handleLogout = () => {
    logout();
    window.location.href = '/admin/login';
  };

  // Exactly 15 Administrative Modules
  const navModules = [
    { id: 1, to: '/admin/dashboard', icon: LayoutDashboard, label: t('adminModOverview') },
    { id: 2, to: '/admin/customers', icon: Users, label: t('adminModCustomers') },
    { id: 3, to: '/admin/shops', icon: Store, label: t('adminModMerchants'), badge: badgeCounts.pendingMerchants > 0 ? badgeCounts.pendingMerchants : null, badgeColor: '#eab308' },
    { id: 4, to: '/admin/categories', icon: Tags, label: t('adminModCategories') },
    { id: 5, to: '/admin/coins', icon: Coins, label: t('adminModCoins') },
    { id: 6, to: '/admin/offers', icon: Percent, label: t('adminModOffers') },
    { id: 7, to: '/admin/orders', icon: ShoppingBag, label: t('adminModOrders') },
    { id: 8, to: '/admin/payments', icon: CreditCard, label: t('adminModPayments') },
    { id: 9, to: '/admin/referrals', icon: Share2, label: t('adminModReferrals') },
    { id: 10, to: '/admin/memberships', icon: Crown, label: t('adminModMemberships') },
    { id: 11, to: '/admin/notifications', icon: Bell, label: t('adminModNotifications') },
    { id: 12, to: '/admin/advertisements', icon: Tv, label: t('adminModAdvertisements') },
    { id: 13, to: '/admin/complaints', icon: Headphones, label: t('adminModComplaints'), badge: badgeCounts.openComplaints > 0 ? badgeCounts.openComplaints : null, badgeColor: '#ef4444' },
    { id: 14, to: '/admin/reports', icon: BarChart3, label: t('adminModReports') },
    { id: 15, to: '/admin/security', icon: ShieldAlert, label: t('adminModSecurity'), badge: badgeCounts.fraudAlerts > 0 ? '!' : null, badgeColor: '#f97316' },
  ];

  return (
    <div className="admin-container" style={{ display: 'flex', minHeight: '100vh', background: '#050505', color: '#FFFFFF' }}>
      
      {/* Desktop Persistent Sidebar (15 Modules) */}
      <aside className="admin-desktop-sidebar" style={{
        width: '260px',
        background: '#0B0B0B',
        borderRight: '1px solid rgba(212, 175, 55, 0.2)',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh',
        zIndex: 50
      }}>
        {/* Brand Header */}
        <div style={{
          padding: '20px 18px',
          borderBottom: '1px solid rgba(212, 175, 55, 0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(212, 175, 55, 0.3)'
          }}>
            <Shield size={22} color="#050505" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '16px', fontWeight: 900, color: '#FFFFFF', letterSpacing: '0.02em' }}>VP52</span>
              <span style={{ fontSize: '10px', background: 'rgba(212, 175, 55, 0.2)', color: '#F2D675', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>{t('adminBadgeTag')}</span>
            </div>
            <span style={{ fontSize: '10px', color: '#A0A0A0', fontWeight: 600 }}>{t('adminCentralizedMgmt')}</span>
          </div>
        </div>

        {/* 15 Modules Navigation List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div style={{ padding: '6px 10px', fontSize: '10px', fontWeight: 800, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {t('adminSystemModules')}
          </div>
          {navModules.map(m => {
            const Icon = m.icon;
            return (
              <NavLink
                key={m.id}
                to={m.to}
                className={({ isActive }) => `admin-sidebar-link ${isActive ? 'active' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Icon size={17} />
                  <span>{m.label}</span>
                </div>
                {m.badge && (
                  <span style={{
                    padding: '2px 7px',
                    borderRadius: '10px',
                    fontSize: '11px',
                    fontWeight: 800,
                    background: m.badgeColor || '#D4AF37',
                    color: '#050505',
                    minWidth: '18px',
                    textAlign: 'center'
                  }}>
                    {m.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Sidebar Footer User Info */}
        <div style={{
          padding: '14px 16px',
          borderTop: '1px solid rgba(212, 175, 55, 0.15)',
          background: '#080808',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: '#1F1F1F', border: '1px solid rgba(212, 175, 55, 0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#F2D675', fontWeight: 800, fontSize: '13px'
            }}>
              {(user?.full_name || user?.name || user?.email || 'A').charAt(0).toUpperCase()}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#FFFFFF', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {user?.full_name || user?.name || t('adminRoleFallback')}
              </div>
              <div style={{ fontSize: '10px', color: '#D4AF37', fontWeight: 600, textTransform: 'uppercase' }}>
                {user?.admin_role || user?.role || t('superAdmin')}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title={t('logout')}
            style={{
              background: 'none', border: 'none', color: '#ef4444',
              cursor: 'pointer', padding: '6px', borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Layout Body */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        
        {/* Top Sticky Header */}
        <header style={{
          height: '64px',
          background: '#0B0B0B',
          borderBottom: '1px solid rgba(212, 175, 55, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          position: 'sticky',
          top: 0,
          zIndex: 40
        }}>
          {/* Mobile hamburger + Breadcrumbs / Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="admin-mobile-toggle"
              style={{
                background: 'none', border: 'none', color: '#D4AF37',
                padding: '6px', cursor: 'pointer', display: 'none'
              }}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="admin-header-title">
              <span style={{ fontSize: '11px', color: '#D4AF37', fontWeight: 700, letterSpacing: '0.04em' }}>{t('adminCentralControl')}</span>
              <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>{t('adminPortalBrand')}</h2>
            </div>
          </div>

          {/* Center: Global Search Bar */}
          <div ref={searchRef} style={{ position: 'relative', width: '320px', maxWidth: '40%' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#141414',
              border: '1px solid rgba(212, 175, 55, 0.25)',
              borderRadius: '20px',
              padding: '6px 14px'
            }}>
              <Search size={15} color="#A0A0A0" />
              <input
                type="text"
                placeholder={t('adminGlobalSearchPlaceholder')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => { if (searchResults) setShowSearchDropdown(true); }}
                style={{
                  background: 'none', border: 'none', color: '#FFFFFF',
                  fontSize: '12px', width: '100%', outline: 'none'
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setSearchResults(null); }}
                  style={{ background: 'none', border: 'none', color: '#A0A0A0', cursor: 'pointer', padding: 0 }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Instant Search Dropdown */}
            {showSearchDropdown && searchResults && (
              <div style={{
                position: 'absolute', top: '44px', left: 0, right: 0,
                background: '#111111', border: '1px solid #D4AF37', borderRadius: '14px',
                boxShadow: '0 12px 36px rgba(0,0,0,0.8)', zIndex: 100,
                maxHeight: '400px', overflowY: 'auto', padding: '12px'
              }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#D4AF37', marginBottom: '8px' }}>
                  {t('adminSearchResultsHeader')}
                </div>

                {/* Customers */}
                {searchResults.customers?.length > 0 && (
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '10px', color: '#888', fontWeight: 700, marginBottom: '4px' }}>{t('adminSearchCustomersLabel')}</div>
                    {searchResults.customers.map(c => (
                      <div
                        key={c.id}
                        onClick={() => { setShowSearchDropdown(false); navigate('/admin/customers'); }}
                        style={{ padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        className="search-item-hover"
                      >
                        <span style={{ fontSize: '12px', color: '#FFF' }}>{c.full_name || c.email}</span>
                        <span style={{ fontSize: '10px', color: '#D4AF37' }}>{t('idNumberLabel', { id: c.id })}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Merchants */}
                {searchResults.merchants?.length > 0 && (
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '10px', color: '#888', fontWeight: 700, marginBottom: '4px' }}>{t('adminSearchMerchantsLabel')}</div>
                    {searchResults.merchants.map(s => (
                      <div
                        key={s.id}
                        onClick={() => { setShowSearchDropdown(false); navigate('/admin/shops'); }}
                        style={{ padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        className="search-item-hover"
                      >
                        <span style={{ fontSize: '12px', color: '#FFF' }}>{s.name}</span>
                        <span style={{ fontSize: '10px', color: '#F2D675' }}>{translateCategory(s.category)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Orders */}
                {searchResults.orders?.length > 0 && (
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '10px', color: '#888', fontWeight: 700, marginBottom: '4px' }}>{t('adminSearchOrdersLabel')}</div>
                    {searchResults.orders.map(o => (
                      <div
                        key={o.id}
                        onClick={() => { setShowSearchDropdown(false); navigate('/admin/orders'); }}
                        style={{ padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        className="search-item-hover"
                      >
                        <span style={{ fontSize: '12px', color: '#FFF' }}>{o.order_number}</span>
                        <span style={{ fontSize: '10px', color: '#22c55e' }}>{o.total_amount}</span>
                      </div>
                    ))}
                  </div>
                )}

                {(!searchResults.customers?.length && !searchResults.merchants?.length && !searchResults.orders?.length) && (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#888', fontSize: '12px' }}>
                    {t('adminSearchNoMatch')}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Quick actions, Notifications, Language, Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <LanguageSwitcher tone="dark" compact />

            {/* Notification Center */}
            <div ref={notifRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setShowNotifMenu(!showNotifMenu)}
                style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: '#141414', border: '1px solid rgba(212, 175, 55, 0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#D4AF37', cursor: 'pointer', position: 'relative'
                }}
              >
                <Bell size={17} />
                {(badgeCounts.pendingMerchants > 0 || badgeCounts.openComplaints > 0) && (
                  <span style={{
                    position: 'absolute', top: '-3px', right: '-3px',
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: '#ef4444', border: '2px solid #0B0B0B'
                  }} />
                )}
              </button>

              {showNotifMenu && (
                <div style={{
                  position: 'absolute', top: '44px', right: 0,
                  width: '300px', background: '#111111',
                  border: '1px solid rgba(212, 175, 55, 0.3)', borderRadius: '14px',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.8)', padding: '14px', zIndex: 100
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#D4AF37' }}>{t('adminNotifsHeader')}</span>
                    <button
                      onClick={() => navigate('/admin/notifications')}
                      style={{ background: 'none', border: 'none', color: '#F2D675', fontSize: '11px', cursor: 'pointer' }}
                    >
                      {t('viewAllBtn')}
                    </button>
                  </div>
                  {recentNotifs.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {recentNotifs.map(n => (
                        <div key={n.id} style={{ padding: '8px', background: '#181818', borderRadius: '8px', borderLeft: '3px solid #D4AF37' }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#FFFFFF' }}>{n.title}</div>
                          <div style={{ fontSize: '11px', color: '#A0A0A0', marginTop: '2px' }}>{n.message}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '16px', textAlign: 'center', color: '#888', fontSize: '12px' }}>
                      {t('noRecentNotifications')}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Profile Pill */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '4px 10px', background: '#141414',
              borderRadius: '20px', border: '1px solid rgba(212, 175, 55, 0.25)'
            }}>
              <div style={{
                width: '26px', height: '26px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)',
                color: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: '11px'
              }}>
                {(user?.full_name || user?.email || 'A').charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#FFFFFF' }}>
                {user?.full_name?.split(' ')[0] || t('adminShortFallback')}
              </span>
            </div>
          </div>
        </header>

        {/* Mobile Slide-out Menu Drawer */}
        {isMobileMenuOpen && (
          <div
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
              zIndex: 1500, display: 'flex', flexDirection: 'column'
            }}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <div
              style={{
                width: '280px', maxWidth: '85vw', height: '100%', background: '#0B0B0B',
                borderRight: '1px solid rgba(212, 175, 55, 0.3)', display: 'flex', flexDirection: 'column'
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ padding: '18px', borderBottom: '1px solid rgba(212, 175, 55, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Shield size={22} color="#D4AF37" />
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF' }}>{t('adminModulesMobileTitle')}</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} style={{ background: 'none', border: 'none', color: '#D4AF37', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {navModules.map(m => {
                  const Icon = m.icon;
                  return (
                    <NavLink
                      key={m.id}
                      to={m.to}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={({ isActive }) => `admin-sidebar-link ${isActive ? 'active' : ''}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        fontSize: '13px',
                        fontWeight: 600,
                        textDecoration: 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Icon size={18} />
                        <span>{m.label}</span>
                      </div>
                      {m.badge && (
                        <span style={{
                          padding: '2px 7px', borderRadius: '10px', fontSize: '11px',
                          fontWeight: 800, background: m.badgeColor || '#D4AF37', color: '#050505'
                        }}>
                          {m.badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>

              <div style={{ padding: '16px', borderTop: '1px solid rgba(212, 175, 55, 0.2)' }}>
                <button
                  onClick={handleLogout}
                  style={{
                    width: '100%', padding: '12px', borderRadius: '10px',
                    background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444',
                    color: '#ef4444', fontSize: '13px', fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer'
                  }}
                >
                  <LogOut size={16} /> {t('logout')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main style={{ flex: 1, padding: '24px 20px', overflowY: 'auto', background: '#050505' }}>
          <Outlet />
        </main>
      </div>

      <style>{`
        .admin-sidebar-link {
          color: #A0A0A0;
          background: transparent;
        }
        .admin-sidebar-link:hover {
          color: #F2D675;
          background: rgba(212, 175, 55, 0.08);
        }
        .admin-sidebar-link.active {
          color: #050505;
          background: linear-gradient(135deg, #C9A227 0%, #F2D675 100%);
          font-weight: 700;
        }
        .search-item-hover:hover {
          background: rgba(212, 175, 55, 0.15);
        }
        @media (max-width: 900px) {
          .admin-desktop-sidebar {
            display: none !important;
          }
          .admin-mobile-toggle {
            display: block !important;
          }
          .admin-header-title {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
