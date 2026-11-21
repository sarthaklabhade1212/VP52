import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { parseApiResponse, resolveApiErrorMessage, resolveNetworkErrorMessage } from '../../utils/api';
import { formatInr, formatCoins } from '../../utils/formatters';
import {
  Users,
  Search,
  UserCheck,
  UserX,
  Eye,
  Award,
  Coins,
  Receipt,
  ShoppingBag,
  Headphones,
  CheckCircle2,
  X,
  Plus,
  Minus,
  RefreshCw,
  AlertTriangle,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Clock,
  ShieldAlert
} from 'lucide-react';

export default function AdminCustomers() {
  const { token } = useAuth();
  const { t, locale } = useI18n();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const getStatusLabel = (status) => {
    const key = `adminStatusLabel_${String(status || 'active').toLowerCase()}`;
    const res = t(key);
    return res === key ? String(status || 'ACTIVE').toUpperCase() : res;
  };

  // Detail Modal State
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerDetail, setCustomerDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('profile'); // profile, coins, orders, complaints

  // Coin Adjustment Modal State
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustType, setAdjustType] = useState('credit'); // credit, debit
  const [adjustReason, setAdjustReason] = useState('');
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);
  const [adjustError, setAdjustError] = useState('');
  const [adjustSuccess, setAdjustSuccess] = useState('');

  const fetchCustomers = () => {
    setLoading(true);
    fetch('/api/admin/customers', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(parseApiResponse)
      .then(parsed => {
        const data = parsed.data;
        if (parsed.ok && data && data.success) setCustomers(data.customers || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) fetchCustomers();
  }, [token]);

  const fetchCustomerDetail = (id) => {
    setDetailLoading(true);
    fetch(`/api/admin/customers/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(parseApiResponse)
      .then(parsed => {
        const d = parsed.data;
        if (parsed.ok && d && d.success) {
          setCustomerDetail(d);
          setSelectedCustomer(d.customer);
        }
      })
      .catch(console.error)
      .finally(() => setDetailLoading(false));
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    const reason = window.prompt(t('promptReasonCustomerStatus', { status: getStatusLabel(newStatus) }));
    if (!reason) return;

    try {
      const res = await fetch(`/api/admin/customers/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus, reason })
      });
      if (res.ok) {
        fetchCustomers();
        if (selectedCustomer?.id === id) {
          fetchCustomerDetail(id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCoinAdjustment = async (e) => {
    e.preventDefault();
    setAdjustError('');
    setAdjustSuccess('');

    const parsed = parseInt(adjustAmount);
    if (!parsed || parsed <= 0) {
      setAdjustError(t('errPositiveIntAmount'));
      return;
    }
    if (!adjustReason.trim()) {
      setAdjustError(t('errAuditReasonCompliance'));
      return;
    }

    const finalAmount = adjustType === 'debit' ? -parsed : parsed;
    setIsSubmittingAdjust(true);

    try {
      const res = await fetch(`/api/admin/customers/${adjustTarget.id}/coin-adjustment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: finalAmount,
          reason: adjustReason.trim()
        })
      });
      const parsed = await parseApiResponse(res);
      const data = parsed.data;
      if (!parsed.ok || !data || !data.success) {
        setAdjustError(resolveApiErrorMessage(parsed, t, 'errFailedAdjustCoins'));
      } else {
        setAdjustSuccess(data.message);
        fetchCustomers();
        if (selectedCustomer?.id === adjustTarget.id) {
          fetchCustomerDetail(adjustTarget.id);
        }
        setTimeout(() => {
          setShowAdjustModal(false);
          setAdjustAmount('');
          setAdjustReason('');
          setAdjustSuccess('');
        }, 1200);
      }
    } catch (err) {
      setAdjustError(resolveNetworkErrorMessage(err, t, 'networkErrorGeneric'));
    } finally {
      setIsSubmittingAdjust(false);
    }
  };

  const filtered = customers.filter(c => {
    const matchesSearch = (c.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
                          (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
                          (c.phone || '').includes(search) ||
                          String(c.id).includes(search);
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Top Header */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '24px',
        background: '#0D0D0D',
        border: '1px solid rgba(212, 175, 55, 0.2)',
        borderRadius: '16px',
        padding: '16px 20px'
      }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
            {t('adminCustomersTitle')}
          </h1>
          <p style={{ fontSize: '12px', color: '#A0A0A0', margin: '4px 0 0 0' }}>
            {t('adminCustomersSub')}
          </p>
        </div>

        {/* Search & Filter Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{
              background: '#141414',
              border: '1px solid rgba(212, 175, 55, 0.25)',
              color: '#FFFFFF',
              borderRadius: '10px',
              padding: '8px 12px',
              fontSize: '12px',
              outline: 'none'
            }}
          >
            <option value="all">{t('adminStatusAll')}</option>
            <option value="active">{t('activeOnlyOption')}</option>
            <option value="suspended">{t('suspendedOnlyOption')}</option>
          </select>

          {/* Search Box */}
          <div style={{ position: 'relative', width: '260px' }}>
            <Search size={16} color="#D4AF37" style={{ position: 'absolute', left: '12px', top: '10px' }} />
            <input
              type="text"
              placeholder={t('searchCustomersPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                background: '#141414',
                border: '1px solid rgba(212, 175, 55, 0.25)',
                color: '#FFFFFF',
                borderRadius: '10px',
                padding: '8px 12px 8px 36px',
                fontSize: '12px',
                outline: 'none'
              }}
            />
          </div>

          <button
            type="button"
            onClick={fetchCustomers}
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
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            {t('adminRefreshBtn')}
          </button>
        </div>
      </div>

      {/* Customers Table */}
      <div style={{
        background: '#0D0D0D',
        borderRadius: '16px',
        border: '1px solid rgba(212, 175, 55, 0.2)',
        overflow: 'hidden'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#121212', borderBottom: '1px solid rgba(212, 175, 55, 0.2)', color: '#A0A0A0', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <th style={{ padding: '14px 18px' }}>{t('colCustomerId')}</th>
                <th style={{ padding: '14px 18px' }}>{t('colCustomerProfile')}</th>
                <th style={{ padding: '14px 18px' }}>{t('colPhoneNumber')}</th>
                <th style={{ padding: '14px 18px' }}>{t('colCoinBalance')}</th>
                <th style={{ padding: '14px 18px' }}>{t('colEarnedRedeemed')}</th>
                <th style={{ padding: '14px 18px' }}>{t('colStatus')}</th>
                <th style={{ padding: '14px 18px' }}>{t('colJoinedDate')}</th>
                <th style={{ padding: '14px 18px', textAlign: 'right' }}>{t('colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.08)' }} className="table-row-hover">
                    <td style={{ padding: '14px 18px', fontWeight: 800, color: '#D4AF37' }}>
                      #{c.id}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '50%',
                          background: '#1F1F1F', border: '1px solid rgba(212, 175, 55, 0.3)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#F2D675', fontWeight: 800, fontSize: '12px'
                        }}>
                          {(c.full_name || c.email || 'C').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#FFFFFF' }}>{c.full_name || t('anonymousUserFallback')}</div>
                          <div style={{ fontSize: '11px', color: '#888' }}>{c.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 18px', color: '#E0E0E0' }}>
                      {c.phone || <span style={{ color: '#666' }}>{t('notProvidedLabel')}</span>}
                    </td>
                    <td style={{ padding: '14px 18px', fontWeight: 900, color: '#F2D675', fontSize: '14px' }}>
                      🪙 {formatCoins(c.balance || 0, locale, t('coinsUnit'))}
                    </td>
                    <td style={{ padding: '14px 18px', fontSize: '12px' }}>
                      <span style={{ color: '#22c55e', fontWeight: 700 }}>+{(c.total_earned || 0).toLocaleString(locale)}</span>
                      <span style={{ color: '#555' }}> / </span>
                      <span style={{ color: '#ef4444', fontWeight: 700 }}>-{(c.total_redeemed || 0).toLocaleString(locale)}</span>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span style={{
                        padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800,
                        background: c.status === 'active' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: c.status === 'active' ? '#22c55e' : '#ef4444',
                        border: `1px solid ${c.status === 'active' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                      }}>
                        {getStatusLabel(c.status || 'active')}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px', color: '#888', fontSize: '12px' }}>
                      {c.created_at ? new Date(c.created_at).toLocaleDateString(locale) : '—'}
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                        {/* Adjust Coins Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setAdjustTarget(c);
                            setShowAdjustModal(true);
                            setAdjustError('');
                            setAdjustSuccess('');
                          }}
                          title={t('titleAdjustCustomerCoins')}
                          style={{
                            padding: '6px 10px', borderRadius: '8px',
                            background: '#1A180E', border: '1px solid rgba(212, 175, 55, 0.4)',
                            color: '#F2D675', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '4px'
                          }}
                        >
                          <Coins size={13} /> {t('adjustBtnShort')}
                        </button>

                        {/* View Details Button */}
                        <button
                          type="button"
                          onClick={() => fetchCustomerDetail(c.id)}
                          title={t('titleViewCustomerProfile')}
                          style={{
                            padding: '6px 10px', borderRadius: '8px',
                            background: '#1A1A1A', border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#FFFFFF', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '4px'
                          }}
                        >
                          <Eye size={13} /> {t('adminViewBtn')}
                        </button>

                        {/* Suspend / Reactivate */}
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(c.id, c.status)}
                          title={c.status === 'active' ? t('titleSuspendAccount') : t('titleReactivateAccount')}
                          style={{
                            padding: '6px 10px', borderRadius: '8px',
                            background: c.status === 'active' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                            border: `1px solid ${c.status === 'active' ? '#ef4444' : '#22c55e'}`,
                            color: c.status === 'active' ? '#ef4444' : '#22c55e',
                            fontSize: '11px', fontWeight: 700, cursor: 'pointer'
                          }}
                        >
                          {c.status === 'active' ? t('adminSuspendBtn') : t('adminActivateBtn')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: '#888' }}>
                    {loading ? t('loadingCustomers') : t('noCustomersMatch')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Detail Drawer / Modal */}
      {selectedCustomer && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          zIndex: 1000, display: 'flex', justifyContent: 'flex-end'
        }} onClick={() => setSelectedCustomer(null)}>
          <div role="dialog" aria-modal="true" style={{
            width: '640px', maxWidth: '100%', height: '100%', background: '#0D0D0D',
            borderLeft: '1px solid rgba(212, 175, 55, 0.3)', display: 'flex', flexDirection: 'column',
            boxShadow: '-10px 0 40px rgba(0,0,0,0.8)'
          }} onClick={e => e.stopPropagation()}>
            
            {/* Drawer Header */}
            <div style={{ padding: '20px', borderBottom: '1px solid rgba(212, 175, 55, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '42px', height: '42px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)',
                  color: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 900, fontSize: '18px'
                }}>
                  {(selectedCustomer.full_name || selectedCustomer.email || 'C').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>{selectedCustomer.full_name}</h3>
                  <span style={{ fontSize: '11px', color: '#D4AF37' }}>{t('idNumberLabel', { id: selectedCustomer.id })} • {selectedCustomer.email}</span>
                </div>
              </div>
              <button type="button" aria-label={t('closeModalAria')} onClick={() => setSelectedCustomer(null)} style={{ background: 'none', border: 'none', color: '#A0A0A0', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Drawer Navigation Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', background: '#121212' }}>
              {[
                { id: 'profile', label: t('tabProfileWallet'), icon: Users },
                { id: 'coins', label: t('tabCoinHistory'), icon: Coins },
                { id: 'orders', label: t('tabOrdersBookings'), icon: ShoppingBag },
                { id: 'complaints', label: t('tabComplaints'), icon: Headphones },
              ].map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    type="button"
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      flex: 1, padding: '12px 6px', background: 'none', border: 'none',
                      borderBottom: activeTab === tab.id ? '2px solid #D4AF37' : '2px solid transparent',
                      color: activeTab === tab.id ? '#F2D675' : '#888',
                      fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                    }}
                  >
                    <Icon size={14} /> {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Drawer Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {activeTab === 'profile' && (
                <div>
                  {/* Balance Card */}
                  <div style={{
                    background: 'linear-gradient(135deg, #1A150A 0%, #29200D 100%)',
                    border: '1px solid #D4AF37', borderRadius: '14px', padding: '16px', marginBottom: '20px'
                  }}>
                    <div style={{ fontSize: '11px', color: '#F2D675', fontWeight: 700 }}>{t('currentWalletBalanceUpper')}</div>
                    <div style={{ fontSize: '32px', fontWeight: 900, color: '#FFFFFF', margin: '4px 0' }}>
                      🪙 {(selectedCustomer.balance || 0).toLocaleString(locale)} <span style={{ fontSize: '14px', color: '#D4AF37' }}>{t('coinsUnit')}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#A0A0A0' }}>
                      {t('activeWalletRewardCoinsSub')}
                    </div>
                  </div>

                  {/* Profile Details List */}
                  <div style={{ background: '#141414', borderRadius: '12px', border: '1px solid rgba(212, 175, 55, 0.15)', padding: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '12px' }}>
                      <div>
                        <div style={{ color: '#888', marginBottom: '2px' }}>{t('fullName')}</div>
                        <div style={{ fontWeight: 700, color: '#FFF' }}>{selectedCustomer.full_name}</div>
                      </div>
                      <div>
                        <div style={{ color: '#888', marginBottom: '2px' }}>{t('emailAddress')}</div>
                        <div style={{ fontWeight: 700, color: '#FFF' }}>{selectedCustomer.email}</div>
                      </div>
                      <div>
                        <div style={{ color: '#888', marginBottom: '2px' }}>{t('colMobileNumber')}</div>
                        <div style={{ fontWeight: 700, color: '#FFF' }}>{selectedCustomer.phone || t('noneLabel')}</div>
                      </div>
                      <div>
                        <div style={{ color: '#888', marginBottom: '2px' }}>{t('colAccountStatus')}</div>
                        <div style={{ fontWeight: 700, color: selectedCustomer.status === 'active' ? '#22c55e' : '#ef4444' }}>
                          {getStatusLabel(selectedCustomer.status)}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: '#888', marginBottom: '2px' }}>{t('colReferralCode')}</div>
                        <div style={{ fontWeight: 800, color: '#F2D675' }}>{selectedCustomer.referral_code || t('noneLabel')}</div>
                      </div>
                      <div>
                        <div style={{ color: '#888', marginBottom: '2px' }}>{t('colJoinedDate')}</div>
                        <div style={{ fontWeight: 700, color: '#FFF' }}>{new Date(selectedCustomer.created_at).toLocaleString(locale)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'coins' && (
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#D4AF37', margin: '0 0 12px 0' }}>
                    {t('recentLedgerTxTitle')}
                  </h4>
                  {customerDetail?.transactions?.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {customerDetail.transactions.map((tx, idx) => (
                        <div key={idx} style={{ padding: '10px 14px', background: '#141414', borderRadius: '10px', border: '1px solid rgba(212, 175, 55, 0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#FFFFFF' }}>{tx.activity_type || tx.type || t('txFallbackLabel')}</div>
                            <div style={{ fontSize: '10px', color: '#888' }}>{new Date(tx.created_at).toLocaleString(locale)}</div>
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: (tx.points || 0) >= 0 ? '#22c55e' : '#ef4444' }}>
                            {formatCoins(tx.points || 0, locale, t('coinsUnit'), { signed: true })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#888', fontSize: '12px' }}>
                      {t('noCoinLedgerEntries')}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'orders' && (
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#D4AF37', margin: '0 0 12px 0' }}>
                    {t('ordersBookingsHeading')}
                  </h4>
                  {customerDetail?.orders?.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {customerDetail.orders.map(o => (
                        <div key={o.id} style={{ padding: '10px 14px', background: '#141414', borderRadius: '10px', border: '1px solid rgba(212, 175, 55, 0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#FFFFFF' }}>{t('orderNumberHeading', { id: o.order_number })}</div>
                            <div style={{ fontSize: '10px', color: '#888' }}>{t('shopIdStatusLine', { id: o.shop_id, status: getStatusLabel(o.status) })}</div>
                          </div>
                          <div style={{ fontSize: '13px', fontWeight: 800, color: '#22c55e' }}>
                            {formatInr(o.total_amount, locale)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#888', fontSize: '12px' }}>
                      {t('noOrdersPlacedYet')}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'complaints' && (
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#D4AF37', margin: '0 0 12px 0' }}>
                    {t('customerSupportTicketsHeading')}
                  </h4>
                  {customerDetail?.complaints?.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {customerDetail.complaints.map(c => (
                        <div key={c.id} style={{ padding: '12px', background: '#141414', borderRadius: '10px', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#D4AF37' }}>{c.ticket_id || t('ticketHashLabel', { id: c.id })}</span>
                            <span style={{ fontSize: '10px', color: c.status === 'resolved' ? '#22c55e' : '#ef4444', fontWeight: 700 }}>{getStatusLabel(c.status)}</span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#E0E0E0' }}>{c.description}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#888', fontSize: '12px' }}>
                      {t('noSupportComplaintsFiled')}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Audited Coin Adjustment Modal */}
      {showAdjustModal && adjustTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div role="dialog" aria-modal="true" style={{
            background: '#0E0E0E', border: '1px solid #D4AF37', borderRadius: '16px',
            width: '460px', maxWidth: '100%', padding: '24px', boxShadow: '0 16px 40px rgba(0,0,0,0.9)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Coins size={20} color="#D4AF37" />
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>{t('auditedCoinAdjTitle')}</h3>
              </div>
              <button type="button" aria-label={t('closeModalAria')} onClick={() => setShowAdjustModal(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '10px 14px', background: '#161616', borderRadius: '10px', marginBottom: '16px', fontSize: '12px' }}>
              <div style={{ color: '#888' }}>{t('targetCustomerColon')}</div>
              <div style={{ fontWeight: 700, color: '#FFFFFF', marginTop: '2px' }}>
                {adjustTarget.full_name} (#{adjustTarget.id})
              </div>
              <div style={{ color: '#D4AF37', marginTop: '2px' }}>
                {t('currentBalanceColon')} <strong>{(adjustTarget.balance || 0).toLocaleString(locale)} {t('coinsUnit')}</strong>
              </div>
            </div>

            {adjustError && (
              <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', color: '#ef4444', fontSize: '12px', marginBottom: '14px' }}>
                {adjustError}
              </div>
            )}
            {adjustSuccess && (
              <div style={{ padding: '10px', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid #22c55e', borderRadius: '8px', color: '#22c55e', fontSize: '12px', marginBottom: '14px' }}>
                {adjustSuccess}
              </div>
            )}

            <form onSubmit={handleCoinAdjustment}>
              {/* Type selector (Credit vs Debit) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                <button
                  type="button"
                  onClick={() => setAdjustType('credit')}
                  style={{
                    padding: '10px', borderRadius: '8px', border: 'none',
                    background: adjustType === 'credit' ? '#22c55e' : '#1A1A1A',
                    color: adjustType === 'credit' ? '#050505' : '#888',
                    fontWeight: 800, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                  }}
                >
                  <Plus size={14} /> {t('creditAddCoinsBtn')}
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustType('debit')}
                  style={{
                    padding: '10px', borderRadius: '8px', border: 'none',
                    background: adjustType === 'debit' ? '#ef4444' : '#1A1A1A',
                    color: adjustType === 'debit' ? '#FFFFFF' : '#888',
                    fontWeight: 800, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                  }}
                >
                  <Minus size={14} /> {t('debitDeductCoinsBtn')}
                </button>
              </div>

              {/* Amount input */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '6px' }}>
                  {t('coinAmountLabel')}
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="50"
                  value={adjustAmount}
                  onChange={e => setAdjustAmount(e.target.value)}
                  style={{
                    width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.3)',
                    borderRadius: '8px', padding: '10px 12px', color: '#FFFFFF', fontSize: '14px', outline: 'none'
                  }}
                />
              </div>

              {/* Reason input */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '6px' }}>
                  {t('complianceAuditReasonLabel')}
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder={t('complianceAuditPlaceholder')}
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  style={{
                    width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.3)',
                    borderRadius: '8px', padding: '10px 12px', color: '#FFFFFF', fontSize: '12px', outline: 'none', resize: 'none'
                  }}
                />
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  style={{
                    padding: '10px 16px', borderRadius: '8px', background: '#1A1A1A',
                    border: '1px solid #333', color: '#888', fontSize: '12px', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  {t('cancelBtn')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdjust}
                  style={{
                    padding: '10px 20px', borderRadius: '8px',
                    background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)',
                    border: 'none', color: '#050505', fontSize: '12px', fontWeight: 900, cursor: 'pointer'
                  }}
                >
                  {isSubmittingAdjust ? t('processingBtn') : t('authorizeAdjustmentBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .table-row-hover:hover {
          background: rgba(212, 175, 55, 0.04);
        }
      `}</style>
    </div>
  );
}
