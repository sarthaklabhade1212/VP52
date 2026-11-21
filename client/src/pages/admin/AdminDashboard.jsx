import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { parseApiResponse } from '../../utils/api';
import { formatNumber } from '../../utils/formatters';
import {
  Users,
  Store,
  ShieldCheck,
  Coins,
  Percent,
  ShoppingBag,
  CreditCard,
  Share2,
  Headphones,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar,
  Send,
  Plus,
  Tv,
  QrCode,
  ArrowLeftRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const { t, locale, translateCategory } = useI18n();

  const [dateRange, setDateRange] = useState('30d');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchDashboardStats = (range = dateRange) => {
    setIsRefreshing(true);
    fetch(`/api/admin/dashboard-stats?range=${range}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(parseApiResponse)
      .then(parsed => {
        const d = parsed.data;
        if (parsed.ok && d && d.success) setStats(d.stats);
      })
      .catch(console.error)
      .finally(() => {
        setLoading(false);
        setIsRefreshing(false);
      });
  };

  useEffect(() => {
    if (token) fetchDashboardStats(dateRange);
  }, [token, dateRange]);

  const dateFilterOptions = [
    { id: 'today', label: t('adminRangeToday') },
    { id: 'yesterday', label: t('adminRangeYesterday') },
    { id: '7d', label: t('adminRange7d') },
    { id: '30d', label: t('adminRange30d') },
    { id: 'this_month', label: t('adminRangeThisMonth') },
    { id: 'prev_month', label: t('adminRangePrevMonth') },
    { id: 'all', label: t('adminRangeAllTime') }
  ];

  const COLORS = ['#D4AF37', '#F2D675', '#3b82f6', '#22c55e', '#ec4899', '#8b5cf6', '#f97316'];

  const handleCardKey = (e, path) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navigate(path);
    }
  };

  if (loading && !stats) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#B8B8B8' }}>
        <RefreshCw size={32} className="spin" style={{ margin: '0 auto 16px', color: '#D4AF37' }} />
        <div>{t('adminLoadingMetrics')}</div>
      </div>
    );
  }

  const s = stats || {};

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Header & Date Range Filter Toolbar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        marginBottom: '24px',
        background: '#0D0D0D',
        border: '1px solid rgba(212, 175, 55, 0.2)',
        borderRadius: '16px',
        padding: '16px 20px'
      }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
            {t('adminOverviewTitle')}
          </h1>
          <p style={{ fontSize: '12px', color: '#A0A0A0', margin: '4px 0 0 0' }}>
            {t('adminOverviewSub')}
          </p>
        </div>

        {/* Date Filter Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#141414', padding: '4px', borderRadius: '10px', border: '1px solid rgba(212, 175, 55, 0.2)' }}>
            <Calendar size={14} color="#D4AF37" style={{ marginLeft: '6px' }} />
            {dateFilterOptions.map(opt => (
              <button
                type="button"
                key={opt.id}
                onClick={() => setDateRange(opt.id)}
                style={{
                  background: dateRange === opt.id ? 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)' : 'transparent',
                  color: dateRange === opt.id ? '#050505' : '#A0A0A0',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: dateRange === opt.id ? 800 : 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => fetchDashboardStats(dateRange)}
            disabled={isRefreshing}
            style={{
              background: '#181818',
              border: '1px solid rgba(212, 175, 55, 0.3)',
              color: '#D4AF37',
              padding: '8px 12px',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 700
            }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
            {t('adminRefreshBtn')}
          </button>
        </div>
      </div>

      {/* Critical Attention Banners (Pending approvals / Fraud alerts) */}
      {(s.pendingMerchants > 0 || s.fraudAlerts > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          {s.pendingMerchants > 0 && (
            <div
              role="button"
              tabIndex={0}
              onClick={() => navigate('/admin/shops')}
              onKeyDown={(e) => handleCardKey(e, '/admin/shops')}
              style={{
                background: 'linear-gradient(135deg, #1C1905 0%, #292408 100%)',
                border: '1px solid #eab308',
                borderRadius: '14px',
                padding: '14px 18px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 4px 16px rgba(234, 179, 8, 0.15)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#eab308', color: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShieldCheck size={22} color="#050505" />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#FFFFFF' }}>
                    {s.pendingMerchants > 1
                      ? t('adminPendingMerchantsPlural', { count: s.pendingMerchants.toLocaleString(locale) })
                      : t('adminPendingMerchantsSingle', { count: s.pendingMerchants.toLocaleString(locale) })}
                  </h4>
                  <span style={{ fontSize: '11px', color: '#F2D675' }}>{t('adminPendingMerchantsSub')}</span>
                </div>
              </div>
              <ArrowRight size={18} color="#eab308" />
            </div>
          )}

          {s.fraudAlerts > 0 && (
            <div
              role="button"
              tabIndex={0}
              onClick={() => navigate('/admin/security')}
              onKeyDown={(e) => handleCardKey(e, '/admin/security')}
              style={{
                background: 'linear-gradient(135deg, #240909 0%, #360E0E 100%)',
                border: '1px solid #ef4444',
                borderRadius: '14px',
                padding: '14px 18px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 4px 16px rgba(239, 68, 68, 0.15)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#ef4444', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShieldAlert size={22} color="#FFFFFF" />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#FFFFFF' }}>
                    {s.fraudAlerts > 1
                      ? t('adminFraudAlertsPlural', { count: s.fraudAlerts.toLocaleString(locale) })
                      : t('adminFraudAlertsSingle', { count: s.fraudAlerts.toLocaleString(locale) })}
                  </h4>
                  <span style={{ fontSize: '11px', color: '#fca5a5' }}>{t('adminFraudAlertsSub')}</span>
                </div>
              </div>
              <ArrowRight size={18} color="#ef4444" />
            </div>
          )}
        </div>
      )}

      {/* 18 Centralized Management Metrics Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: '14px',
        marginBottom: '28px'
      }}>
        {/* Card 1: Total Customers */}
        <div role="button" tabIndex={0} onClick={() => navigate('/admin/customers')} onKeyDown={(e) => handleCardKey(e, '/admin/customers')} className="kpi-card" style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('kpiTotalCustomersUpper')}</span>
            <Users size={16} color="#3b82f6" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#FFFFFF' }}>{(s.totalCustomers || 0).toLocaleString(locale)}</div>
          <div style={{ fontSize: '10px', color: '#22c55e', marginTop: '4px', fontWeight: 600 }}>{t('kpiActiveRegisteredSub')}</div>
        </div>

        {/* Card 2: Total Merchants */}
        <div role="button" tabIndex={0} onClick={() => navigate('/admin/shops')} onKeyDown={(e) => handleCardKey(e, '/admin/shops')} className="kpi-card" style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('kpiTotalMerchantsUpper')}</span>
            <Store size={16} color="#D4AF37" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#D4AF37' }}>{(s.totalMerchants || 0).toLocaleString(locale)}</div>
          <div style={{ fontSize: '10px', color: '#D4AF37', marginTop: '4px', fontWeight: 600 }}>{t('kpiFreeShopRegSub')}</div>
        </div>

        {/* Card 3: Approved Merchants */}
        <div role="button" tabIndex={0} onClick={() => navigate('/admin/shops')} onKeyDown={(e) => handleCardKey(e, '/admin/shops')} className="kpi-card" style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('kpiApprovedShopsUpper')}</span>
            <CheckCircle2 size={16} color="#22c55e" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#22c55e' }}>{(s.approvedMerchants || 0).toLocaleString(locale)}</div>
          <div style={{ fontSize: '10px', color: '#A0A0A0', marginTop: '4px', fontWeight: 600 }}>{t('kpiVerifiedDiscSub')}</div>
        </div>

        {/* Card 4: Pending Approvals */}
        <div role="button" tabIndex={0} onClick={() => navigate('/admin/shops')} onKeyDown={(e) => handleCardKey(e, '/admin/shops')} className="kpi-card" style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('kpiPendingShopsUpper')}</span>
            <Clock size={16} color="#eab308" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#eab308' }}>{(s.pendingMerchants || 0).toLocaleString(locale)}</div>
          <div style={{ fontSize: '10px', color: '#eab308', marginTop: '4px', fontWeight: 600 }}>{t('kpiAwaitingVerSub')}</div>
        </div>

        {/* Card 5: Total Coins Issued */}
        <div role="button" tabIndex={0} onClick={() => navigate('/admin/coins')} onKeyDown={(e) => handleCardKey(e, '/admin/coins')} className="kpi-card" style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('kpiCoinsIssuedUpper')}</span>
            <Coins size={16} color="#F2D675" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#F2D675' }}>
            {formatNumber(s.totalCoinsIssued || 0, locale)} <span style={{ fontSize: '13px', fontWeight: 700 }}>{t('coinsUnit')}</span>
          </div>
          <div style={{ fontSize: '10px', color: '#A0A0A0', marginTop: '4px', fontWeight: 600 }}>{t('kpiCoinsIssuedSub')}</div>
        </div>

        {/* Card 6: Coins Redeemed */}
        <div role="button" tabIndex={0} onClick={() => navigate('/admin/coins')} onKeyDown={(e) => handleCardKey(e, '/admin/coins')} className="kpi-card" style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('kpiCoinsRedeemedUpper')}</span>
            <CheckCircle2 size={16} color="#22c55e" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#22c55e' }}>
            {formatNumber(s.totalCoinsRedeemed || 0, locale)} <span style={{ fontSize: '13px', fontWeight: 700 }}>{t('coinsUnit')}</span>
          </div>
          <div style={{ fontSize: '10px', color: '#22c55e', marginTop: '4px', fontWeight: 600 }}>{t('kpiVerifiedDiscountsSub')}</div>
        </div>

        {/* Card 7: Circulating Coin Balance */}
        <div role="button" tabIndex={0} onClick={() => navigate('/admin/coins')} onKeyDown={(e) => handleCardKey(e, '/admin/coins')} className="kpi-card" style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('kpiOutstandingLiabilityUpper')}</span>
            <Coins size={16} color="#ec4899" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#ec4899' }}>
            {(s.outstandingCoinsLiability || 0).toLocaleString(locale)} <span style={{ fontSize: '13px', fontWeight: 700 }}>{t('coinsUnit')}</span>
          </div>
          <div style={{ fontSize: '10px', color: '#A0A0A0', marginTop: '4px', fontWeight: 600 }}>{t('kpiCirculatingWalletsSub')}</div>
        </div>

        {/* Card 8: Active Offers */}
        <div role="button" tabIndex={0} onClick={() => navigate('/admin/offers')} onKeyDown={(e) => handleCardKey(e, '/admin/offers')} className="kpi-card" style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('kpiActiveOffersUpper')}</span>
            <Percent size={16} color="#8b5cf6" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#8b5cf6' }}>{(s.activeOffers || 0).toLocaleString(locale)}</div>
          <div style={{ fontSize: '10px', color: '#A0A0A0', marginTop: '4px', fontWeight: 600 }}>{t('kpiLivePromoSub')}</div>
        </div>

        {/* Card 9: Total Orders */}
        <div role="button" tabIndex={0} onClick={() => navigate('/admin/orders')} onKeyDown={(e) => handleCardKey(e, '/admin/orders')} className="kpi-card" style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('kpiTotalOrdersUpper')}</span>
            <ShoppingBag size={16} color="#3b82f6" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#FFFFFF' }}>{(s.totalOrders || 0).toLocaleString(locale)}</div>
          <div style={{ fontSize: '10px', color: '#A0A0A0', marginTop: '4px', fontWeight: 600 }}>{t('kpiPendingProcessingSub', { count: (s.pendingOrders || 0).toLocaleString(locale) })}</div>
        </div>

        {/* Card 10: Service Bookings */}
        <div role="button" tabIndex={0} onClick={() => navigate('/admin/orders')} onKeyDown={(e) => handleCardKey(e, '/admin/orders')} className="kpi-card" style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('kpiServiceBookingsUpper')}</span>
            <Clock size={16} color="#06b6d4" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#06b6d4' }}>{(s.totalBookings || 0).toLocaleString(locale)}</div>
          <div style={{ fontSize: '10px', color: '#A0A0A0', marginTop: '4px', fontWeight: 600 }}>{t('kpiAppointmentsServicesSub')}</div>
        </div>

        {/* Card 11: Recorded Payments */}
        <div role="button" tabIndex={0} onClick={() => navigate('/admin/payments')} onKeyDown={(e) => handleCardKey(e, '/admin/payments')} className="kpi-card" style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('kpiRecordedPaymentsUpper')}</span>
            <CreditCard size={16} color="#10b981" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#10b981' }}>{(s.totalPaymentsRecorded || 0).toLocaleString(locale)}</div>
          <div style={{ fontSize: '10px', color: '#10b981', marginTop: '4px', fontWeight: 600 }}>{t('kpiActualLedgerTxSub')}</div>
        </div>

        {/* Card 12: Total Referrals */}
        <div role="button" tabIndex={0} onClick={() => navigate('/admin/referrals')} onKeyDown={(e) => handleCardKey(e, '/admin/referrals')} className="kpi-card" style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('kpiReferralInvitesUpper')}</span>
            <Share2 size={16} color="#f97316" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#f97316' }}>{(s.totalReferrals || 0).toLocaleString(locale)}</div>
          <div style={{ fontSize: '10px', color: '#A0A0A0', marginTop: '4px', fontWeight: 600 }}>{t('kpiCustomerRefCodesSub')}</div>
        </div>

        {/* Card 13: Open Complaints */}
        <div role="button" tabIndex={0} onClick={() => navigate('/admin/complaints')} onKeyDown={(e) => handleCardKey(e, '/admin/complaints')} className="kpi-card" style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('kpiOpenComplaintsUpper')}</span>
            <Headphones size={16} color="#ef4444" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#ef4444' }}>{(s.openComplaints || 0).toLocaleString(locale)}</div>
          <div style={{ fontSize: '10px', color: '#A0A0A0', marginTop: '4px', fontWeight: 600 }}>{t('kpiSupportPendingSub')}</div>
        </div>

        {/* Card 14: Merchant Subscriptions Status */}
        <div role="button" tabIndex={0} onClick={() => navigate('/admin/memberships')} onKeyDown={(e) => handleCardKey(e, '/admin/memberships')} className="kpi-card" style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('kpiMerchantFeeUpper')}</span>
            <CheckCircle2 size={16} color="#22c55e" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#22c55e' }}>{t('adminFreeBadge')}</div>
          <div style={{ fontSize: '10px', color: '#22c55e', marginTop: '4px', fontWeight: 600 }}>{t('noPaywallZeroFeesDesc')}</div>
        </div>

        {/* Card 15: Active 6-Hr Sessions */}
        <div role="button" tabIndex={0} onClick={() => navigate('/admin/coins')} onKeyDown={(e) => handleCardKey(e, '/admin/coins')} className="kpi-card" style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('kpiActive6HrSessionsUpper')}</span>
            <Clock size={16} color="#F2D675" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#F2D675' }}>{(s.activeCustomerSessions || 0).toLocaleString(locale)}</div>
          <div style={{ fontSize: '10px', color: '#A0A0A0', marginTop: '4px', fontWeight: 600 }}>{t('kpiSequentialStartedSub', { count: (s.totalSessionsStarted || 0).toLocaleString(locale) })}</div>
        </div>

        {/* Card 16: AdMob & Native Ads */}
        <div role="button" tabIndex={0} onClick={() => navigate('/admin/advertisements')} onKeyDown={(e) => handleCardKey(e, '/admin/advertisements')} className="kpi-card" style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('kpiAdmobImpressionsUpper')}</span>
            <Tv size={16} color="#3b82f6" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#3b82f6' }}>{(s.confirmedAdImpressions || 0).toLocaleString(locale)}</div>
          <div style={{ fontSize: '10px', color: '#A0A0A0', marginTop: '4px', fontWeight: 600 }}>{t('kpiAdPlacementsReqSub', { count: (s.totalAdRequests || 0).toLocaleString(locale) })}</div>
        </div>

        {/* Card 17: Merchant Coin Balances */}
        <div role="button" tabIndex={0} onClick={() => navigate('/admin/coins')} onKeyDown={(e) => handleCardKey(e, '/admin/coins')} className="kpi-card" style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('kpiMerchantWalletsUpper')}</span>
            <Store size={16} color="#10b981" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#10b981' }}>
            {formatNumber(s.merchantCoinsBalance || 0, locale)} <span style={{ fontSize: '13px', fontWeight: 700 }}>{t('coinsUnit')}</span>
          </div>
          <div style={{ fontSize: '10px', color: '#10b981', marginTop: '4px', fontWeight: 600 }}>{t('merchantCoinsCollectedSub', { count: (s.merchantCoinsReceived || 0).toLocaleString(locale) })}</div>
        </div>

        {/* Card 18: QR Coin Transfers */}
        <div role="button" tabIndex={0} onClick={() => navigate('/admin/coins')} onKeyDown={(e) => handleCardKey(e, '/admin/coins')} className="kpi-card" style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('kpiQrRedemptionsUpper')}</span>
            <ArrowLeftRight size={16} color="#D4AF37" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#D4AF37' }}>{(s.successfulTransactions || 0).toLocaleString(locale)}</div>
          <div style={{ fontSize: '10px', color: '#A0A0A0', marginTop: '4px', fontWeight: 600 }}>{t('kpiTotalMerchantTransfersSub', { count: (s.totalQrRedemptions || 0).toLocaleString(locale) })}</div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px', marginBottom: '28px' }}>
        
        {/* Trend Chart: Customer Registrations & Growth */}
        <div style={{ background: '#0D0D0D', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>{t('chartCustomerTrendsTitle')}</h3>
              <span style={{ fontSize: '11px', color: '#A0A0A0' }}>{t('chartCustomerTrendsSub')}</span>
            </div>
            <span style={{ fontSize: '11px', color: '#D4AF37', fontWeight: 700 }}>{dateFilterOptions.find(o => o.id === dateRange)?.label || dateRange.toUpperCase()}</span>
          </div>

          <div style={{ height: '240px', width: '100%' }}>
            {s.customerTrends?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={s.customerTrends}>
                  <defs>
                    <linearGradient id="custGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#666" fontSize={10} />
                  <YAxis stroke="#666" fontSize={10} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: '#111', border: '1px solid #D4AF37', borderRadius: '8px', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="count" name={t('chartNewCustomersName')} stroke="#D4AF37" fillOpacity={1} fill="url(#custGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666', fontSize: '12px' }}>
                {t('chartNoRegEvents')}
              </div>
            )}
          </div>
        </div>

        {/* Bar Chart: Coin Economy (Issued vs Redeemed) */}
        <div style={{ background: '#0D0D0D', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>{t('chartCoinEconomyTitle')}</h3>
              <span style={{ fontSize: '11px', color: '#A0A0A0' }}>{t('chartCoinEconomySub')}</span>
            </div>
            <span style={{ fontSize: '11px', color: '#F2D675', fontWeight: 700 }}>{t('vp52CoinsUnit')}</span>
          </div>

          <div style={{ height: '240px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: t('chartBarIssued'), amount: s.totalCoinsIssued || 0, fill: '#D4AF37' },
                { name: t('chartBarRedeemed'), amount: s.totalCoinsRedeemed || 0, fill: '#22c55e' },
                { name: t('chartBarLiability'), amount: s.outstandingCoinsLiability || 0, fill: '#ec4899' }
              ]}>
                <XAxis dataKey="name" stroke="#666" fontSize={10} />
                <YAxis stroke="#666" fontSize={10} />
                <Tooltip contentStyle={{ background: '#111', border: '1px solid #D4AF37', borderRadius: '8px', fontSize: '12px' }} />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart: Category-wise Merchant Distribution */}
        <div style={{ background: '#0D0D0D', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>{t('chartCategoryDistTitle')}</h3>
              <span style={{ fontSize: '11px', color: '#A0A0A0' }}>{t('chartCategoryDistSub')}</span>
            </div>
            <span style={{ fontSize: '11px', color: '#D4AF37', fontWeight: 700 }}>{t('chartActiveCount', { count: s.categoryDistribution?.length || 0 })}</span>
          </div>

          <div style={{ height: '240px', width: '100%' }}>
            {s.categoryDistribution?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={s.categoryDistribution}
                    dataKey="count"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ category, count }) => `${(translateCategory(category) || '').substring(0, 12)} (${count})`}
                    fontSize={10}
                  >
                    {s.categoryDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val, name) => [val.toLocaleString(locale), translateCategory(name)]} contentStyle={{ background: '#111', border: '1px solid #D4AF37', borderRadius: '8px', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666', fontSize: '12px' }}>
                {t('chartNoCategoryData')}
              </div>
            )}
          </div>
        </div>

        {/* Quick Administrative Actions Card */}
        <div style={{ background: '#0D0D0D', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', margin: '0 0 16px 0' }}>{t('quickActionsTitle')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', flex: 1 }}>
            <button
              type="button"
              onClick={() => navigate('/admin/shops')}
              className="quick-action-btn"
              style={{ padding: '12px', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '10px', color: '#FFFFFF', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            >
              <Store size={16} color="#D4AF37" />
              <span>{t('qaAddMerchant')}</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/admin/customers')}
              className="quick-action-btn"
              style={{ padding: '12px', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '10px', color: '#FFFFFF', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            >
              <Coins size={16} color="#F2D675" />
              <span>{t('qaAdjustCoins')}</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/admin/offers')}
              className="quick-action-btn"
              style={{ padding: '12px', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '10px', color: '#FFFFFF', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            >
              <Percent size={16} color="#8b5cf6" />
              <span>{t('qaCreateOffer')}</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/admin/notifications')}
              className="quick-action-btn"
              style={{ padding: '12px', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '10px', color: '#FFFFFF', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            >
              <Send size={16} color="#3b82f6" />
              <span>{t('qaBroadcastAlert')}</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/admin/reports')}
              className="quick-action-btn"
              style={{ padding: '12px', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '10px', color: '#FFFFFF', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            >
              <FileText size={16} color="#22c55e" />
              <span>{t('qaExportCsv')}</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/admin/security')}
              className="quick-action-btn"
              style={{ padding: '12px', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '10px', color: '#FFFFFF', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            >
              <ShieldAlert size={16} color="#f97316" />
              <span>{t('qaFraudScan')}</span>
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .kpi-card:hover {
          transform: translateY(-2px);
          border-color: #D4AF37 !important;
          transition: all 0.2s ease;
        }
        .quick-action-btn:hover {
          background: rgba(212, 175, 55, 0.15) !important;
          border-color: #D4AF37 !important;
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
