import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
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
  const { t } = useI18n();

  const [dateRange, setDateRange] = useState('30d');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchDashboardStats = (range = dateRange) => {
    setIsRefreshing(true);
    fetch(`/api/admin/dashboard-stats?range=${range}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(d => {
        if (d.success) setStats(d.stats);
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
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: '7d', label: 'Last 7 Days' },
    { id: '30d', label: 'Last 30 Days' },
    { id: 'this_month', label: 'This Month' },
    { id: 'prev_month', label: 'Previous Month' },
    { id: 'all', label: 'All Time' }
  ];

  const COLORS = ['#D4AF37', '#F2D675', '#3b82f6', '#22c55e', '#ec4899', '#8b5cf6', '#f97316'];

  if (loading && !stats) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#B8B8B8' }}>
        <RefreshCw size={32} className="spin" style={{ margin: '0 auto 16px', color: '#D4AF37' }} />
        <div>Loading Centralized Platform Metrics...</div>
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
            Platform Overview & Analytics
          </h1>
          <p style={{ fontSize: '12px', color: '#A0A0A0', margin: '4px 0 0 0' }}>
            Real-time multi-portal monitoring: Customers, Merchants, Coins, Orders & Compliance
          </p>
        </div>

        {/* Date Filter Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#141414', padding: '4px', borderRadius: '10px', border: '1px solid rgba(212, 175, 55, 0.2)' }}>
            <Calendar size={14} color="#D4AF37" style={{ marginLeft: '6px' }} />
            {dateFilterOptions.map(opt => (
              <button
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
            Refresh
          </button>
        </div>
      </div>

      {/* Critical Attention Banners (Pending approvals / Fraud alerts) */}
      {(s.pendingMerchants > 0 || s.fraudAlerts > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          {s.pendingMerchants > 0 && (
            <div
              onClick={() => navigate('/admin/shops')}
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
                    {s.pendingMerchants} Merchant Registration{s.pendingMerchants > 1 ? 's' : ''} Pending
                  </h4>
                  <span style={{ fontSize: '11px', color: '#F2D675' }}>Review and approve merchant verification submissions</span>
                </div>
              </div>
              <ArrowRight size={18} color="#eab308" />
            </div>
          )}

          {s.fraudAlerts > 0 && (
            <div
              onClick={() => navigate('/admin/security')}
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
                    {s.fraudAlerts} Security / Fraud Alert{s.fraudAlerts > 1 ? 's' : ''} Flagged
                  </h4>
                  <span style={{ fontSize: '11px', color: '#fca5a5' }}>Heuristic security anomalies requiring review</span>
                </div>
              </div>
              <ArrowRight size={18} color="#ef4444" />
            </div>
          )}
        </div>
      )}

      {/* 14 Centralized Management Metrics Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: '14px',
        marginBottom: '28px'
      }}>
        {/* Card 1: Total Customers */}
        <div onClick={() => navigate('/admin/customers')} className="kpi-card" style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>TOTAL CUSTOMERS</span>
            <Users size={16} color="#3b82f6" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#FFFFFF' }}>{s.totalCustomers || 0}</div>
          <div style={{ fontSize: '10px', color: '#22c55e', marginTop: '4px', fontWeight: 600 }}>Active registered accounts</div>
        </div>

        {/* Card 2: Total Merchants */}
        <div onClick={() => navigate('/admin/shops')} className="kpi-card" style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>TOTAL MERCHANTS</span>
            <Store size={16} color="#D4AF37" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#D4AF37' }}>{s.totalMerchants || 0}</div>
          <div style={{ fontSize: '10px', color: '#D4AF37', marginTop: '4px', fontWeight: 600 }}>100% Free shop registrations</div>
        </div>

        {/* Card 3: Approved Merchants */}
        <div onClick={() => navigate('/admin/shops')} className="kpi-card" style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>APPROVED SHOPS</span>
            <CheckCircle2 size={16} color="#22c55e" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#22c55e' }}>{s.approvedMerchants || 0}</div>
          <div style={{ fontSize: '10px', color: '#A0A0A0', marginTop: '4px', fontWeight: 600 }}>Verified & discoverable</div>
        </div>

        {/* Card 4: Pending Approvals */}
        <div onClick={() => navigate('/admin/shops')} className="kpi-card" style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>PENDING SHOPS</span>
            <Clock size={16} color="#eab308" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#eab308' }}>{s.pendingMerchants || 0}</div>
          <div style={{ fontSize: '10px', color: '#eab308', marginTop: '4px', fontWeight: 600 }}>Awaiting verification</div>
        </div>

        {/* Card 5: Total Coins Issued */}
        <div onClick={() => navigate('/admin/coins')} className="kpi-card" style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>COINS ISSUED</span>
            <Coins size={16} color="#F2D675" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#F2D675' }}>{s.totalCoinsIssued?.toLocaleString() || 0}</div>
          <div style={{ fontSize: '10px', color: '#A0A0A0', marginTop: '4px', fontWeight: 600 }}>1 coin = ₹1 discount value</div>
        </div>

        {/* Card 6: Coins Redeemed */}
        <div onClick={() => navigate('/admin/coins')} className="kpi-card" style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>COINS REDEEMED</span>
            <CheckCircle2 size={16} color="#22c55e" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#22c55e' }}>{s.totalCoinsRedeemed?.toLocaleString() || 0}</div>
          <div style={{ fontSize: '10px', color: '#22c55e', marginTop: '4px', fontWeight: 600 }}>Verified physical store discounts</div>
        </div>

        {/* Card 7: Active Liability (INR) */}
        <div onClick={() => navigate('/admin/coins')} className="kpi-card" style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>OUTSTANDING LIABILITY</span>
            <Coins size={16} color="#ec4899" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#ec4899' }}>₹{(s.outstandingCoinsLiability || 0).toLocaleString()}</div>
          <div style={{ fontSize: '10px', color: '#A0A0A0', marginTop: '4px', fontWeight: 600 }}>Circulating wallet balances</div>
        </div>

        {/* Card 8: Active Offers */}
        <div onClick={() => navigate('/admin/offers')} className="kpi-card" style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>ACTIVE OFFERS</span>
            <Percent size={16} color="#8b5cf6" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#8b5cf6' }}>{s.activeOffers || 0}</div>
          <div style={{ fontSize: '10px', color: '#A0A0A0', marginTop: '4px', fontWeight: 600 }}>Live promotions</div>
        </div>

        {/* Card 9: Total Orders */}
        <div onClick={() => navigate('/admin/orders')} className="kpi-card" style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>TOTAL ORDERS</span>
            <ShoppingBag size={16} color="#3b82f6" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#FFFFFF' }}>{s.totalOrders || 0}</div>
          <div style={{ fontSize: '10px', color: '#A0A0A0', marginTop: '4px', fontWeight: 600 }}>{s.pendingOrders || 0} pending processing</div>
        </div>

        {/* Card 10: Service Bookings */}
        <div onClick={() => navigate('/admin/orders')} className="kpi-card" style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>SERVICE BOOKINGS</span>
            <Clock size={16} color="#06b6d4" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#06b6d4' }}>{s.totalBookings || 0}</div>
          <div style={{ fontSize: '10px', color: '#A0A0A0', marginTop: '4px', fontWeight: 600 }}>Appointments & services</div>
        </div>

        {/* Card 11: Recorded Payments */}
        <div onClick={() => navigate('/admin/payments')} className="kpi-card" style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>RECORDED PAYMENTS</span>
            <CreditCard size={16} color="#10b981" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#10b981' }}>₹{(s.totalPaymentsRecorded || 0).toLocaleString()}</div>
          <div style={{ fontSize: '10px', color: '#10b981', marginTop: '4px', fontWeight: 600 }}>Actual ledger transactions</div>
        </div>

        {/* Card 12: Total Referrals */}
        <div onClick={() => navigate('/admin/referrals')} className="kpi-card" style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>REFERRAL INVITES</span>
            <Share2 size={16} color="#f97316" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#f97316' }}>{s.totalReferrals || 0}</div>
          <div style={{ fontSize: '10px', color: '#A0A0A0', marginTop: '4px', fontWeight: 600 }}>Customer referral codes</div>
        </div>

        {/* Card 13: Open Complaints */}
        <div onClick={() => navigate('/admin/complaints')} className="kpi-card" style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>OPEN COMPLAINTS</span>
            <Headphones size={16} color="#ef4444" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#ef4444' }}>{s.openComplaints || 0}</div>
          <div style={{ fontSize: '10px', color: '#A0A0A0', marginTop: '4px', fontWeight: 600 }}>Support tickets pending</div>
        </div>

        {/* Card 14: Merchant Subscriptions Status */}
        <div onClick={() => navigate('/admin/memberships')} className="kpi-card" style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>MERCHANT FEE</span>
            <CheckCircle2 size={16} color="#22c55e" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#22c55e' }}>FREE</div>
          <div style={{ fontSize: '10px', color: '#22c55e', marginTop: '4px', fontWeight: 600 }}>No paywall / ₹0 subscription</div>
        </div>

        {/* Card 15: Active 6-Hr Sessions */}
        <div onClick={() => navigate('/admin/coins')} className="kpi-card" style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>ACTIVE 6-HR SESSIONS</span>
            <Clock size={16} color="#F2D675" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#F2D675' }}>{s.activeCustomerSessions || 0}</div>
          <div style={{ fontSize: '10px', color: '#A0A0A0', marginTop: '4px', fontWeight: 600 }}>{s.totalSessionsStarted || 0} sequential sessions started</div>
        </div>

        {/* Card 16: AdMob & Native Ads */}
        <div onClick={() => navigate('/admin/advertisements')} className="kpi-card" style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>ADMOB IMPRESSIONS</span>
            <Tv size={16} color="#3b82f6" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#3b82f6' }}>{s.confirmedAdImpressions || 0}</div>
          <div style={{ fontSize: '10px', color: '#A0A0A0', marginTop: '4px', fontWeight: 600 }}>{s.totalAdRequests || 0} ad placements requested</div>
        </div>

        {/* Card 17: Merchant Coin Balances */}
        <div onClick={() => navigate('/admin/coins')} className="kpi-card" style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>MERCHANT WALLETS</span>
            <Store size={16} color="#10b981" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#10b981' }}>{(s.merchantCoinsBalance || 0).toLocaleString()}</div>
          <div style={{ fontSize: '10px', color: '#10b981', marginTop: '4px', fontWeight: 600 }}>₹{(s.merchantCoinsReceived || 0).toLocaleString()} total coins collected</div>
        </div>

        {/* Card 18: QR Coin Transfers */}
        <div onClick={() => navigate('/admin/coins')} className="kpi-card" style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>QR REDEMPTIONS</span>
            <ArrowLeftRight size={16} color="#D4AF37" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#D4AF37' }}>{s.successfulTransactions || 0}</div>
          <div style={{ fontSize: '10px', color: '#A0A0A0', marginTop: '4px', fontWeight: 600 }}>{s.totalQrRedemptions || 0} total merchant transfers</div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px', marginBottom: '28px' }}>
        
        {/* Trend Chart: Customer Registrations & Growth */}
        <div style={{ background: '#0D0D0D', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>Customer Registration Trends</h3>
              <span style={{ fontSize: '11px', color: '#A0A0A0' }}>New account creation timeline</span>
            </div>
            <span style={{ fontSize: '11px', color: '#D4AF37', fontWeight: 700 }}>{dateRange.toUpperCase()}</span>
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
                  <Area type="monotone" dataKey="count" name="New Customers" stroke="#D4AF37" fillOpacity={1} fill="url(#custGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666', fontSize: '12px' }}>
                No customer registration events in selected timeframe
              </div>
            )}
          </div>
        </div>

        {/* Bar Chart: Coin Economy (Issued vs Redeemed) */}
        <div style={{ background: '#0D0D0D', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>Coin Economy Ledger</h3>
              <span style={{ fontSize: '11px', color: '#A0A0A0' }}>Issuance vs Shop Redemptions</span>
            </div>
            <span style={{ fontSize: '11px', color: '#F2D675', fontWeight: 700 }}>1 Coin = ₹1</span>
          </div>

          <div style={{ height: '240px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: 'Coins Issued', amount: s.totalCoinsIssued || 0, fill: '#D4AF37' },
                { name: 'Redeemed', amount: s.totalCoinsRedeemed || 0, fill: '#22c55e' },
                { name: 'Liability', amount: s.outstandingCoinsLiability || 0, fill: '#ec4899' }
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
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>Category Distribution</h3>
              <span style={{ fontSize: '11px', color: '#A0A0A0' }}>Merchants across 17 master categories</span>
            </div>
            <span style={{ fontSize: '11px', color: '#D4AF37', fontWeight: 700 }}>{s.categoryDistribution?.length || 0} Active</span>
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
                    label={({ category, count }) => `${category?.substring(0, 10)} (${count})`}
                    fontSize={10}
                  >
                    {s.categoryDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#111', border: '1px solid #D4AF37', borderRadius: '8px', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666', fontSize: '12px' }}>
                No category data available
              </div>
            )}
          </div>
        </div>

        {/* Quick Administrative Actions Card */}
        <div style={{ background: '#0D0D0D', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', margin: '0 0 16px 0' }}>Quick Actions & Workflows</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', flex: 1 }}>
            <button
              onClick={() => navigate('/admin/shops')}
              className="quick-action-btn"
              style={{ padding: '12px', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '10px', color: '#FFFFFF', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            >
              <Store size={16} color="#D4AF37" />
              <span>Add Merchant</span>
            </button>

            <button
              onClick={() => navigate('/admin/customers')}
              className="quick-action-btn"
              style={{ padding: '12px', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '10px', color: '#FFFFFF', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            >
              <Coins size={16} color="#F2D675" />
              <span>Adjust Coins</span>
            </button>

            <button
              onClick={() => navigate('/admin/offers')}
              className="quick-action-btn"
              style={{ padding: '12px', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '10px', color: '#FFFFFF', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            >
              <Percent size={16} color="#8b5cf6" />
              <span>Create Offer</span>
            </button>

            <button
              onClick={() => navigate('/admin/notifications')}
              className="quick-action-btn"
              style={{ padding: '12px', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '10px', color: '#FFFFFF', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            >
              <Send size={16} color="#3b82f6" />
              <span>Broadcast Alert</span>
            </button>

            <button
              onClick={() => navigate('/admin/reports')}
              className="quick-action-btn"
              style={{ padding: '12px', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '10px', color: '#FFFFFF', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            >
              <FileText size={16} color="#22c55e" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => navigate('/admin/security')}
              className="quick-action-btn"
              style={{ padding: '12px', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '10px', color: '#FFFFFF', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            >
              <ShieldAlert size={16} color="#f97316" />
              <span>Fraud Scan</span>
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
