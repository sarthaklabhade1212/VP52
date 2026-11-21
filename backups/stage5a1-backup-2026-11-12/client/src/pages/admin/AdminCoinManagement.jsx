import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import {
  Coins,
  Search,
  Filter,
  Download,
  RotateCcw,
  Plus,
  Minus,
  Clock,
  QrCode,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  X,
  FileText,
  User,
  Store,
  ArrowLeftRight
} from 'lucide-react';

export default function AdminCoinManagement() {
  const { token } = useAuth();
  const { t, locale, translateCategory } = useI18n();
  const [activeTab, setActiveTab] = useState('ledger'); // ledger, sessions, lots, redemptions

  const getStatusLabel = (status) => {
    const key = `adminStatusLabel_${String(status || '').toLowerCase()}`;
    const res = t(key);
    return res === key ? status : res;
  };
  const getTierLabel = (tierName) => {
    const key = `tier_${tierName || 'Bronze'}`;
    const res = t(key);
    return res === key ? (tierName || 'Bronze') : res;
  };
  
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  // Tab 1: Ledger state
  const [ledger, setLedger] = useState([]);
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerType, setLedgerType] = useState('all');

  // Tab 2: Sessions state
  const [sessions, setSessions] = useState([]);
  
  // Tab 3: Lots state
  const [lots, setLots] = useState([]);
  const [lotStatusFilter, setLotStatusFilter] = useState('all');

  // Tab 4: Redemptions state
  const [redemptions, setRedemptions] = useState([]);

  // Tab 5: Transfers state (Customer-to-Merchant)
  const [transfers, setTransfers] = useState([]);
  const [transferStatusFilter, setTransferStatusFilter] = useState('all');
  const [transferSearch, setTransferSearch] = useState('');

  // Tab 6: Merchant Wallets state
  const [merchantWallets, setMerchantWallets] = useState([]);
  const [merchantWalletsSummary, setMerchantWalletsSummary] = useState(null);
  const [merchantWalletSearch, setMerchantWalletSearch] = useState('');

  // Coin Adjustment Modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjUserId, setAdjUserId] = useState('');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjType, setAdjType] = useState('credit');
  const [adjReason, setAdjReason] = useState('');
  const [adjSubmitting, setAdjSubmitting] = useState(false);
  const [adjMsg, setAdjMsg] = useState({ type: '', text: '' });

  // Reversal Modal
  const [reversingTx, setReversingTx] = useState(null);
  const [reversalReason, setReversalReason] = useState('');
  const [revSubmitting, setRevSubmitting] = useState(false);

  const fetchOverview = () => {
    fetch('/api/admin/coins/overview', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(d => { if (d.success) setOverview(d.overview); })
      .catch(console.error);
  };

  const fetchLedger = () => {
    setLoading(true);
    let url = `/api/admin/coins/ledger?limit=100`;
    if (ledgerType !== 'all') url += `&type=${ledgerType}`;
    if (ledgerSearch.trim()) url += `&search=${encodeURIComponent(ledgerSearch.trim())}`;

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(d => { if (d.success) setLedger(d.ledger || []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const fetchSessions = () => {
    setLoading(true);
    fetch('/api/admin/coins/sessions?limit=100', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(d => { if (d.success) setSessions(d.sessions || []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const fetchLots = () => {
    setLoading(true);
    let url = '/api/admin/coins/lots?limit=100';
    if (lotStatusFilter !== 'all') url += `&status=${lotStatusFilter}`;

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(d => { if (d.success) setLots(d.lots || []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const fetchRedemptions = () => {
    setLoading(true);
    fetch('/api/admin/coins/redemptions?limit=100', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(d => { if (d.success) setRedemptions(d.redemptions || []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const fetchTransfers = () => {
    setLoading(true);
    let url = `/api/admin/coins/transfers?limit=100`;
    if (transferStatusFilter !== 'all') url += `&status=${transferStatusFilter}`;
    if (transferSearch.trim()) url += `&search=${encodeURIComponent(transferSearch.trim())}`;

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(d => { if (d.success) setTransfers(d.transfers || []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const fetchMerchantWallets = () => {
    setLoading(true);
    fetch('/api/admin/coins/merchant-wallets', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(d => {
        if (d.success) {
          setMerchantWallets(d.wallets || []);
          setMerchantWalletsSummary({
            balance: d.totalMerchantCoinsBalance || 0,
            received: d.totalMerchantCoinsReceived || 0,
            spent: d.totalMerchantCoinsSpent || 0
          });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!token) return;
    fetchOverview();
    if (activeTab === 'ledger') fetchLedger();
    else if (activeTab === 'sessions') fetchSessions();
    else if (activeTab === 'lots') fetchLots();
    else if (activeTab === 'redemptions') fetchRedemptions();
    else if (activeTab === 'transfers') fetchTransfers();
    else if (activeTab === 'merchant_wallets') fetchMerchantWallets();
  }, [token, activeTab, ledgerType, lotStatusFilter, transferStatusFilter]);

  const handleExportCSV = () => {
    window.open(`/api/admin/coins/export?token=${token}`, '_blank');
  };

  const handleReversalSubmit = async (e) => {
    e.preventDefault();
    if (!reversingTx || !reversalReason.trim()) return;
    setRevSubmitting(true);

    try {
      const res = await fetch('/api/admin/coins/reversal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          transaction_id: reversingTx.transaction_id,
          reason: reversalReason.trim()
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message);
        setReversingTx(null);
        setReversalReason('');
        fetchOverview();
        fetchLedger();
      } else {
        alert(data.error || t('reversalFailedErr'));
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setRevSubmitting(false);
    }
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    setAdjMsg({ type: '', text: '' });
    const amt = parseInt(adjAmount);
    if (!amt || amt <= 0 || !adjUserId) {
      setAdjMsg({ type: 'error', text: t('enterValidCustomerAmountErr') });
      return;
    }
    if (!adjReason.trim()) {
      setAdjMsg({ type: 'error', text: t('auditReasonRequiredErr') });
      return;
    }

    setAdjSubmitting(true);
    const finalAmount = adjType === 'debit' ? -amt : amt;

    try {
      const res = await fetch(`/api/admin/customers/${adjUserId}/coin-adjustment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: finalAmount,
          reason: adjReason.trim()
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAdjMsg({ type: 'success', text: data.message });
        fetchOverview();
        if (activeTab === 'ledger') fetchLedger();
        setTimeout(() => {
          setShowAdjustModal(false);
          setAdjUserId('');
          setAdjAmount('');
          setAdjReason('');
          setAdjMsg({ type: '', text: '' });
        }, 1200);
      } else {
        setAdjMsg({ type: 'error', text: data.error || t('adjFailedErr') });
      }
    } catch (err) {
      setAdjMsg({ type: 'error', text: err.message });
    } finally {
      setAdjSubmitting(false);
    }
  };

  const getTxTypeLabel = (type) => {
    const map = {
      earned: t('ledgerEarnedOption'),
      redeemed: t('ledgerRedeemedOption'),
      admin_adjustment: t('ledgerAdminAdjOption'),
      reversal: t('ledgerReversalOption')
    };
    return map[type] || getStatusLabel(type);
  };

  const ov = overview || {};

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Header */}
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
            {t('adminCoinsTitle')}
          </h1>
          <p style={{ fontSize: '12px', color: '#A0A0A0', margin: '4px 0 0 0' }}>
            {t('adminCoinsSub')}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setShowAdjustModal(true)}
            style={{
              background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)',
              border: 'none', color: '#050505', padding: '8px 16px', borderRadius: '10px',
              fontSize: '12px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <Coins size={15} /> {t('adminAdjustCoinsBtn')}
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            style={{
              background: '#181818', border: '1px solid rgba(212, 175, 55, 0.3)',
              color: '#D4AF37', padding: '8px 16px', borderRadius: '10px',
              fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <Download size={15} /> {t('adminExportLedgerCsv')}
          </button>
        </div>
      </div>

      {/* 6 Economy Overview Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '14px',
        marginBottom: '24px'
      }}>
        <div style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('ovTotalIssuedUpper')}</span>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#F2D675', marginTop: '4px' }}>
            🪙 {(ov.total_issued || 0).toLocaleString(locale)}
          </div>
          <span style={{ fontSize: '10px', color: '#D4AF37' }}>{t('ovRewardedAdjSub')}</span>
        </div>

        <div style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('ovTotalRedeemedUpper')}</span>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#22c55e', marginTop: '4px' }}>
            {(ov.total_redeemed || 0).toLocaleString(locale)}
          </div>
          <span style={{ fontSize: '10px', color: '#22c55e' }}>{t('ovBillDiscountsSub')}</span>
        </div>

        <div style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('kpiOutstandingLiabilityUpper')}</span>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#ec4899', marginTop: '4px' }}>
            {(ov.outstanding_liability || 0).toLocaleString(locale)} {t('coinsUnit')}
          </div>
          <span style={{ fontSize: '10px', color: '#ec4899' }}>{t('ovActiveCoinsWalletsSub')}</span>
        </div>

        <div style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('ovTotalExpiredUpper')}</span>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#ef4444', marginTop: '4px' }}>
            {(ov.total_expired || 0).toLocaleString(locale)}
          </div>
          <span style={{ fontSize: '10px', color: '#888' }}>{t('ovPast30FifoSub')}</span>
        </div>

        <div style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('ovActiveCoinLotsUpper')}</span>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#3b82f6', marginTop: '4px' }}>
            {(ov.active_lots_count || 0).toLocaleString(locale)}
          </div>
          <span style={{ fontSize: '10px', color: '#3b82f6' }}>{t('ovFifoBatchesSub')}</span>
        </div>

        <div style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('ovRewardedSessionsUpper')}</span>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#06b6d4', marginTop: '4px' }}>
            {(ov.total_sessions || 0).toLocaleString(locale)}
          </div>
          <span style={{ fontSize: '10px', color: '#06b6d4' }}>{t('ov6HrCyclesSub')}</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        borderBottom: '1px solid rgba(212, 175, 55, 0.2)',
        marginBottom: '20px',
        background: '#0D0D0D',
        borderRadius: '12px 12px 0 0',
        padding: '0 12px'
      }}>
        {[
          { id: 'ledger', label: t('tabAuditedLedger'), icon: FileText },
          { id: 'sessions', label: t('tab6HrSessions'), icon: Clock },
          { id: 'lots', label: t('tab30DayLots'), icon: Coins },
          { id: 'redemptions', label: t('tabShopQrRedemptions'), icon: QrCode },
          { id: 'transfers', label: t('tabC2MTransfers'), icon: ArrowLeftRight },
          { id: 'merchant_wallets', label: t('tabMerchantCoinWallets'), icon: Store }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '14px 18px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.id ? '3px solid #D4AF37' : '3px solid transparent',
                color: activeTab === tab.id ? '#F2D675' : '#888',
                fontWeight: activeTab === tab.id ? 800 : 600,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Icon size={16} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: AUDITED COIN LEDGER */}
      {activeTab === 'ledger' && (
        <div style={{ background: '#0D0D0D', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '16px', overflow: 'hidden' }}>
          {/* Controls */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <select
                value={ledgerType}
                onChange={e => setLedgerType(e.target.value)}
                style={{
                  background: '#141414', border: '1px solid rgba(212, 175, 55, 0.25)',
                  color: '#FFFFFF', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', outline: 'none'
                }}
              >
                <option value="all">{t('adminAllTypes')}</option>
                <option value="earned">{t('ledgerEarnedOption')}</option>
                <option value="redeemed">{t('ledgerRedeemedOption')}</option>
                <option value="admin_adjustment">{t('ledgerAdminAdjOption')}</option>
                <option value="reversal">{t('ledgerReversalOption')}</option>
              </select>

              <div style={{ position: 'relative', width: '260px' }}>
                <Search size={14} color="#D4AF37" style={{ position: 'absolute', left: '10px', top: '9px' }} />
                <input
                  type="text"
                  placeholder={t('searchUserReasonPlaceholder')}
                  value={ledgerSearch}
                  onChange={e => setLedgerSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') fetchLedger(); }}
                  style={{
                    width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.25)',
                    color: '#FFFFFF', borderRadius: '8px', padding: '6px 10px 6px 32px', fontSize: '12px', outline: 'none'
                  }}
                />
              </div>

              <button
                type="button"
                onClick={fetchLedger}
                style={{ background: '#1A1A1A', border: '1px solid rgba(212, 175, 55, 0.3)', color: '#F2D675', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}
              >
                {t('adminFilterBtn')}
              </button>
            </div>

            <span style={{ fontSize: '12px', color: '#888' }}>
              {t('showingRecentTx', { count: ledger.length })}
            </span>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#121212', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', color: '#A0A0A0', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>{t('colTxId')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colCustomer')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colType')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colAmount')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colBalanceFlow')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colAuditReasonAuthorizer')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colTimestamp')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>{t('colAction')}</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map(tx => (
                  <tr key={tx.id} style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.08)' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '11px', color: '#D4AF37' }}>
                      {tx.transaction_id}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#FFF' }}>{tx.customer_name || t('userFallbackLabel', { id: tx.user_id })}</div>
                      <div style={{ fontSize: '10px', color: '#888' }}>{tx.customer_email}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase',
                        background: tx.type === 'admin_adjustment' ? 'rgba(212, 175, 55, 0.15)' :
                                    tx.type === 'reversal' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                        color: tx.type === 'admin_adjustment' ? '#F2D675' :
                               tx.type === 'reversal' ? '#ef4444' : '#22c55e'
                      }}>
                        {getTxTypeLabel(tx.type)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: (tx.points || 0) >= 0 ? '#22c55e' : '#ef4444' }}>
                      {(tx.points || 0) >= 0 ? `+${tx.points}` : tx.points}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '11px', color: '#888' }}>
                      {tx.previous_balance !== null ? `${tx.previous_balance} ➔ ${tx.new_balance}` : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ color: '#E0E0E0', fontSize: '12px' }}>{tx.reason || '—'}</div>
                      {tx.admin_authorizer_name && (
                        <div style={{ fontSize: '10px', color: '#D4AF37', marginTop: '2px' }}>
                          {t('byAuthorizerPrefix', { name: tx.admin_authorizer_name })}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '11px', color: '#888' }}>
                      {new Date(tx.created_at).toLocaleString(locale)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {tx.source === 'admin' && tx.type === 'admin_adjustment' && (
                        <button
                          type="button"
                          onClick={() => setReversingTx(tx)}
                          style={{
                            padding: '4px 8px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid #ef4444', color: '#ef4444', fontSize: '11px', fontWeight: 700, cursor: 'pointer'
                          }}
                        >
                          {t('reverseBtn')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: 6-HOUR REWARDED AD SESSIONS */}
      {activeTab === 'sessions' && (
        <div style={{ background: '#0D0D0D', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                {t('sessionsSubheading')}
              </h3>
              <span style={{ fontSize: '11px', color: '#A0A0A0' }}>
                {t('sessionsInvariantDesc')}
              </span>
            </div>
            <button type="button" onClick={fetchSessions} style={{ background: '#1A1A1A', border: '1px solid rgba(212, 175, 55, 0.3)', color: '#D4AF37', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
              {t('adminRefreshBtn')}
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#121212', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', color: '#A0A0A0', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>{t('colSessionId')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colCustomer')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colAdsWatched')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colCoinsAwarded')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colStartedAt')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colSessionExpiration')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.08)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#D4AF37' }}>#{s.id}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#FFF' }}>{s.customer_name || t('userFallbackLabel', { id: s.user_id })}</div>
                      <div style={{ fontSize: '10px', color: '#888' }}>{s.customer_email}</div>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: '#FFFFFF' }}>
                      {t('adsWatchedRatio', { watched: s.ads_watched })}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 900, color: '#F2D675' }}>
                      🪙 {s.coins_awarded}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '11px', color: '#888' }}>
                      {new Date(s.session_start).toLocaleString(locale)}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '11px', color: '#888' }}>
                      {new Date(s.session_end).toLocaleString(locale)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 800,
                        background: s.completed ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                        color: s.completed ? '#22c55e' : '#eab308'
                      }}>
                        {s.completed ? t('adminStatusLabel_completed') : t('sessionStateInProgress')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: 30-DAY COIN LOTS (FIFO) */}
      {activeTab === 'lots' && (
        <div style={{ background: '#0D0D0D', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                {t('lotsTrackingHeading')}
              </h3>
              <span style={{ fontSize: '11px', color: '#A0A0A0' }}>
                {t('lotsTrackingSub')}
              </span>
            </div>

            <select
              value={lotStatusFilter}
              onChange={e => setLotStatusFilter(e.target.value)}
              style={{
                background: '#141414', border: '1px solid rgba(212, 175, 55, 0.25)',
                color: '#FFFFFF', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', outline: 'none'
              }}
            >
              <option value="all">{t('allLotStatusesOption')}</option>
              <option value="ACTIVE">{t('adminStatusLabel_active')}</option>
              <option value="USED">{t('adminStatusLabel_used')}</option>
              <option value="EXPIRED">{t('adminStatusLabel_expired')}</option>
            </select>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#121212', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', color: '#A0A0A0', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>{t('colLotId')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colCustomer')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colSource')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colEarnedRemaining')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colTier')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colExpiresAt')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {lots.map(lot => (
                  <tr key={lot.id} style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.08)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#D4AF37' }}>#{lot.id}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#FFF' }}>{lot.customer_name || t('userFallbackLabel', { id: lot.user_id })}</div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '11px', color: '#A0A0A0' }}>{lot.source}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 800 }}>
                      <span style={{ color: '#F2D675' }}>{lot.coins_remaining}</span> / <span style={{ color: '#888' }}>{lot.coins_earned}</span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#D4AF37', fontWeight: 700, fontSize: '11px' }}>
                      {getTierLabel(lot.tier)}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '11px', color: '#888' }}>
                      {new Date(lot.expires_at).toLocaleDateString(locale)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 800,
                        background: lot.status === 'ACTIVE' ? 'rgba(34, 197, 94, 0.15)' :
                                    lot.status === 'USED' ? 'rgba(100, 100, 100, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: lot.status === 'ACTIVE' ? '#22c55e' : lot.status === 'USED' ? '#888' : '#ef4444'
                      }}>
                        {getStatusLabel(lot.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: SHOP QR REDEMPTIONS */}
      {activeTab === 'redemptions' && (
        <div style={{ background: '#0D0D0D', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                {t('redemptionsHeading')}
              </h3>
              <span style={{ fontSize: '11px', color: '#A0A0A0' }}>
                {t('redemptionsSub')}
              </span>
            </div>
            <button type="button" onClick={fetchRedemptions} style={{ background: '#1A1A1A', border: '1px solid rgba(212, 175, 55, 0.3)', color: '#D4AF37', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
              {t('adminRefreshBtn')}
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#121212', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', color: '#A0A0A0', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>{t('colRedemptionId')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colCustomer')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colMerchantShop')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colBillAmount')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colCoinsDeducted')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colDiscountGiven')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colTimestamp')}</th>
                </tr>
              </thead>
              <tbody>
                {redemptions.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.08)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#D4AF37' }}>#{r.id}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#FFF' }}>{r.customer_name || t('userFallbackLabel', { id: r.user_id })}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#FFFFFF' }}>{r.shop_name}</div>
                      <div style={{ fontSize: '10px', color: '#888' }}>{r.shop_code}</div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#FFFFFF' }}>{(r.bill_amount || 0).toLocaleString(locale)}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: '#ef4444' }}>
                      -{r.points_deducted} {t('coinsUnit')}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: '#22c55e' }}>
                      {(r.discount_amount || 0).toLocaleString(locale)}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '11px', color: '#888' }}>
                      {new Date(r.created_at).toLocaleString(locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: CUSTOMER-TO-MERCHANT COIN TRANSFERS */}
      {activeTab === 'transfers' && (
        <div style={{ background: '#0D0D0D', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                {t('transfersHeading')}
              </h3>
              <span style={{ fontSize: '11px', color: '#A0A0A0' }}>
                {t('transfersDoubleEntrySub')}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder={t('searchCustomerOrShopPlaceholder')}
                  value={transferSearch}
                  onChange={e => setTransferSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchTransfers()}
                  style={{
                    background: '#141414', border: '1px solid rgba(212, 175, 55, 0.25)',
                    color: '#FFFFFF', borderRadius: '8px', padding: '6px 12px 6px 30px', fontSize: '12px', outline: 'none'
                  }}
                />
                <Search size={14} color="#888" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              </div>

              <select
                value={transferStatusFilter}
                onChange={e => setTransferStatusFilter(e.target.value)}
                style={{
                  background: '#141414', border: '1px solid rgba(212, 175, 55, 0.25)',
                  color: '#FFFFFF', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', outline: 'none'
                }}
              >
                <option value="all">{t('adminStatusAll')}</option>
                <option value="COMPLETED">{t('adminStatusLabel_completed')}</option>
                <option value="PENDING">{t('adminStatusLabel_pending')}</option>
                <option value="FAILED">{t('adminStatusLabel_failed')}</option>
              </select>

              <button
                type="button"
                onClick={fetchTransfers}
                style={{
                  background: '#1A1A1A', border: '1px solid rgba(212, 175, 55, 0.3)',
                  color: '#D4AF37', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '4px'
                }}
              >
                <RefreshCw size={13} /> {t('adminRefreshBtn')}
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#121212', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', color: '#A0A0A0', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>{t('colTransferId')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colCustomer')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colMerchantShop')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colCoinsTransferred')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colDiscountGranted')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colStatus')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colLedgerDoubleRef')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colTimestamp')}</th>
                </tr>
              </thead>
              <tbody>
                {transfers.length > 0 ? (
                  transfers.map(tr => (
                    <tr key={tr.id} style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.08)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#D4AF37' }}>#{tr.id}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#FFF' }}>{tr.customer_name || t('userFallbackLabel', { id: tr.customer_id })}</div>
                        <div style={{ fontSize: '10px', color: '#888' }}>{tr.customer_phone || tr.customer_email || '—'}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#FFF' }}>{tr.shop_name || t('shopFallbackLabel', { id: tr.shop_id })}</div>
                        {tr.merchant_qr_code && (
                          <div style={{ fontSize: '10px', color: '#F2D675', fontFamily: 'monospace' }}>
                            QR: {tr.merchant_qr_code}
                          </div>
                        )}
                        <div style={{ fontSize: '10px', color: '#888' }}>{tr.shop_contact_phone || '—'}</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: '#F2D675' }}>
                        🪙 {tr.coins_amount}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: '#22c55e' }}>
                        {t('coinsDiscountAmount', { coins: tr.discount_inr })}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 800,
                          background: tr.status === 'COMPLETED' ? 'rgba(34, 197, 94, 0.15)' :
                                      tr.status === 'PENDING' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: tr.status === 'COMPLETED' ? '#22c55e' : tr.status === 'PENDING' ? '#eab308' : '#ef4444'
                        }}>
                          {getStatusLabel(tr.status)}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '11px', color: '#A0A0A0' }}>
                        <div>{t('custLedgerPrefix')} <span style={{ color: '#D4AF37' }}>#{tr.customer_ledger_id || '—'}</span></div>
                        <div>{t('merchLedgerPrefix')} <span style={{ color: '#F2D675' }}>#{tr.merchant_ledger_id || '—'}</span></div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '11px', color: '#888' }}>
                        {new Date(tr.created_at).toLocaleString(locale)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: '#888' }}>
                      {t('noTransfersFound')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: MERCHANT COIN WALLETS */}
      {activeTab === 'merchant_wallets' && (
        <div style={{ background: '#0D0D0D', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '16px', padding: '20px' }}>
          {/* Summary Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <div style={{ background: '#121212', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '12px', padding: '14px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('ovMerchantBalUpper')}</span>
              <div style={{ fontSize: '22px', fontWeight: 900, color: '#10b981', marginTop: '4px' }}>
                🪙 {(merchantWalletsSummary?.balance || 0).toLocaleString(locale)}
              </div>
              <span style={{ fontSize: '10px', color: '#A0A0A0' }}>{t('ovMerchantBalSub')}</span>
            </div>

            <div style={{ background: '#121212', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '12px', padding: '14px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('ovLifetimeReceivedUpper')}</span>
              <div style={{ fontSize: '22px', fontWeight: 900, color: '#F2D675', marginTop: '4px' }}>
                🪙 {(merchantWalletsSummary?.received || 0).toLocaleString(locale)}
              </div>
              <span style={{ fontSize: '10px', color: '#A0A0A0' }}>{t('ovLifetimeReceivedSub')}</span>
            </div>

            <div style={{ background: '#121212', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '12px', padding: '14px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('ovLifetimeSpentUpper')}</span>
              <div style={{ fontSize: '22px', fontWeight: 900, color: '#3b82f6', marginTop: '4px' }}>
                🪙 {(merchantWalletsSummary?.spent || 0).toLocaleString(locale)}
              </div>
              <span style={{ fontSize: '10px', color: '#A0A0A0' }}>{t('ovLifetimeSpentSub')}</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                {t('merchantWalletsDirHeading')}
              </h3>
              <span style={{ fontSize: '11px', color: '#A0A0A0' }}>
                {t('merchantWalletsDirSub')}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder={t('filterShopOwnerPlaceholder')}
                  value={merchantWalletSearch}
                  onChange={e => setMerchantWalletSearch(e.target.value)}
                  style={{
                    background: '#141414', border: '1px solid rgba(212, 175, 55, 0.25)',
                    color: '#FFFFFF', borderRadius: '8px', padding: '6px 12px 6px 30px', fontSize: '12px', outline: 'none'
                  }}
                />
                <Search size={14} color="#888" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              </div>

              <button
                type="button"
                onClick={fetchMerchantWallets}
                style={{
                  background: '#1A1A1A', border: '1px solid rgba(212, 175, 55, 0.3)',
                  color: '#D4AF37', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '4px'
                }}
              >
                <RefreshCw size={13} /> {t('adminRefreshBtn')}
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#121212', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', color: '#A0A0A0', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>{t('colShopId')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colShopName')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colCategory')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colOwnerContact')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colCurrentBalance')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colTotalReceived')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colTotalSpent')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colLastUpdated')}</th>
                </tr>
              </thead>
              <tbody>
                {merchantWallets
                  .filter(w => !merchantWalletSearch ||
                    (w.shop_name && w.shop_name.toLowerCase().includes(merchantWalletSearch.toLowerCase())) ||
                    (w.owner_name && w.owner_name.toLowerCase().includes(merchantWalletSearch.toLowerCase()))
                  )
                  .map(w => (
                    <tr key={w.shop_id} style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.08)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#D4AF37' }}>#{w.shop_id}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#FFF' }}>{w.shop_name}</div>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#A0A0A0', fontSize: '12px' }}>
                        {w.category ? translateCategory(w.category) : t('generalCategoryFallback')}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ color: '#FFFFFF', fontWeight: 600 }}>{w.owner_name || '—'}</div>
                        <div style={{ fontSize: '10px', color: '#888' }}>{w.phone || w.email || '—'}</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: '#10b981' }}>
                        🪙 {(w.balance || 0).toLocaleString(locale)}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#F2D675' }}>
                        🪙 {(w.total_received || 0).toLocaleString(locale)}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#888' }}>
                        🪙 {(w.total_spent || 0).toLocaleString(locale)}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '11px', color: '#888' }}>
                        {new Date(w.updated_at).toLocaleString(locale)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Adjust Modal */}
      {showAdjustModal && (
        <div role="dialog" aria-modal="true" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#0E0E0E', border: '1px solid #D4AF37', borderRadius: '16px',
            width: '460px', maxWidth: '100%', padding: '24px', boxShadow: '0 16px 40px rgba(0,0,0,0.9)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>{t('adminCoinAdjTitle')}</h3>
              <button type="button" aria-label={t('closeModalAria')} onClick={() => setShowAdjustModal(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {adjMsg.text && (
              <div style={{
                padding: '10px', borderRadius: '8px', fontSize: '12px', marginBottom: '14px',
                background: adjMsg.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                color: adjMsg.type === 'error' ? '#ef4444' : '#22c55e',
                border: `1px solid ${adjMsg.type === 'error' ? '#ef4444' : '#22c55e'}`
              }}>
                {adjMsg.text}
              </div>
            )}

            <form onSubmit={handleAdjustSubmit}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                  {t('customerIdRequiredLabel')}
                </label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 1"
                  value={adjUserId}
                  onChange={e => setAdjUserId(e.target.value)}
                  style={{
                    width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.3)',
                    borderRadius: '8px', padding: '8px 12px', color: '#FFFFFF', fontSize: '13px', outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                <button
                  type="button"
                  onClick={() => setAdjType('credit')}
                  style={{
                    padding: '8px', borderRadius: '8px', border: 'none',
                    background: adjType === 'credit' ? '#22c55e' : '#1A1A1A',
                    color: adjType === 'credit' ? '#050505' : '#888',
                    fontWeight: 800, fontSize: '11px', cursor: 'pointer'
                  }}
                >
                  {t('creditCoinsPlusBtn')}
                </button>
                <button
                  type="button"
                  onClick={() => setAdjType('debit')}
                  style={{
                    padding: '8px', borderRadius: '8px', border: 'none',
                    background: adjType === 'debit' ? '#ef4444' : '#1A1A1A',
                    color: adjType === 'debit' ? '#FFFFFF' : '#888',
                    fontWeight: 800, fontSize: '11px', cursor: 'pointer'
                  }}
                >
                  {t('debitCoinsMinusBtn')}
                </button>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                  {t('coinQuantityRequiredLabel')}
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="e.g. 100"
                  value={adjAmount}
                  onChange={e => setAdjAmount(e.target.value)}
                  style={{
                    width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.3)',
                    borderRadius: '8px', padding: '8px 12px', color: '#FFFFFF', fontSize: '13px', outline: 'none'
                  }}
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                  {t('auditReasonMandatoryLabel')}
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder={t('auditReasonAdjPlaceholder')}
                  value={adjReason}
                  onChange={e => setAdjReason(e.target.value)}
                  style={{
                    width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.3)',
                    borderRadius: '8px', padding: '8px 12px', color: '#FFFFFF', fontSize: '12px', outline: 'none', resize: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  style={{ padding: '8px 14px', borderRadius: '8px', background: '#1A1A1A', border: '1px solid #333', color: '#888', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  {t('cancelBtn')}
                </button>
                <button
                  type="submit"
                  disabled={adjSubmitting}
                  style={{
                    padding: '8px 18px', borderRadius: '8px',
                    background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)',
                    border: 'none', color: '#050505', fontSize: '12px', fontWeight: 900, cursor: 'pointer'
                  }}
                >
                  {adjSubmitting ? t('adminSavingProgress') : t('authorizeBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reversal Confirmation Modal */}
      {reversingTx && (
        <div role="dialog" aria-modal="true" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#0E0E0E', border: '1px solid #ef4444', borderRadius: '16px',
            width: '460px', maxWidth: '100%', padding: '24px', boxShadow: '0 16px 40px rgba(0,0,0,0.9)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <RotateCcw size={22} color="#ef4444" />
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                {t('reverseTxModalTitle', { id: reversingTx.transaction_id })}
              </h3>
            </div>

            <p style={{ fontSize: '12px', color: '#C0C0C0', margin: '0 0 14px 0', lineHeight: 1.4 }}>
              {t('reverseTxWarning', { points: -reversingTx.points, userId: reversingTx.user_id })}
            </p>

            <form onSubmit={handleReversalSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                  {t('reversalReasonRequiredLabel')}
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder={t('reversalReasonPlaceholder')}
                  value={reversalReason}
                  onChange={e => setReversalReason(e.target.value)}
                  style={{
                    width: '100%', background: '#141414', border: '1px solid #ef4444',
                    borderRadius: '8px', padding: '8px 12px', color: '#FFFFFF', fontSize: '12px', outline: 'none', resize: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setReversingTx(null)}
                  style={{ padding: '8px 14px', borderRadius: '8px', background: '#1A1A1A', border: '1px solid #333', color: '#888', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  {t('cancelBtn')}
                </button>
                <button
                  type="submit"
                  disabled={revSubmitting}
                  style={{
                    padding: '8px 18px', borderRadius: '8px', background: '#ef4444',
                    border: 'none', color: '#FFFFFF', fontSize: '12px', fontWeight: 900, cursor: 'pointer'
                  }}
                >
                  {revSubmitting ? t('reversingProgress') : t('executeReversalBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
