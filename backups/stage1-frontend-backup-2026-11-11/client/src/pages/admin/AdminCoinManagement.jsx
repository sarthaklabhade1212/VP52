import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
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
  const [activeTab, setActiveTab] = useState('ledger'); // ledger, sessions, lots, redemptions
  
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
        alert(data.error || 'Reversal failed');
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
      setAdjMsg({ type: 'error', text: 'Enter valid customer ID and amount' });
      return;
    }
    if (!adjReason.trim()) {
      setAdjMsg({ type: 'error', text: 'Audit reason is required' });
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
        setAdjMsg({ type: 'error', text: data.error || 'Adjustment failed' });
      }
    } catch (err) {
      setAdjMsg({ type: 'error', text: err.message });
    } finally {
      setAdjSubmitting(false);
    }
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
            VP52 Coin Management & Audit Ledger
          </h1>
          <p style={{ fontSize: '12px', color: '#A0A0A0', margin: '4px 0 0 0' }}>
            Auditable coin economy (1 Coin = ₹1 Discount), FIFO lots, 6-hr rewarded ad sessions & redemptions
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setShowAdjustModal(true)}
            style={{
              background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)',
              border: 'none', color: '#050505', padding: '8px 16px', borderRadius: '10px',
              fontSize: '12px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <Coins size={15} /> Adjust Coins
          </button>

          <button
            onClick={handleExportCSV}
            style={{
              background: '#181818', border: '1px solid rgba(212, 175, 55, 0.3)',
              color: '#D4AF37', padding: '8px 16px', borderRadius: '10px',
              fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <Download size={15} /> Export Ledger CSV
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
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>TOTAL COINS ISSUED</span>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#F2D675', marginTop: '4px' }}>
            🪙 {(ov.total_issued || 0).toLocaleString()}
          </div>
          <span style={{ fontSize: '10px', color: '#D4AF37' }}>Rewarded + Adjustments</span>
        </div>

        <div style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>TOTAL COINS REDEEMED</span>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#22c55e', marginTop: '4px' }}>
            {(ov.total_redeemed || 0).toLocaleString()}
          </div>
          <span style={{ fontSize: '10px', color: '#22c55e' }}>Physical shop bill discounts</span>
        </div>

        <div style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>OUTSTANDING LIABILITY</span>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#ec4899', marginTop: '4px' }}>
            ₹{(ov.outstanding_liability || 0).toLocaleString()}
          </div>
          <span style={{ fontSize: '10px', color: '#ec4899' }}>Active coins in user wallets</span>
        </div>

        <div style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>TOTAL COINS EXPIRED</span>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#ef4444', marginTop: '4px' }}>
            {(ov.total_expired || 0).toLocaleString()}
          </div>
          <span style={{ fontSize: '10px', color: '#888' }}>Past 30-day FIFO lots</span>
        </div>

        <div style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>ACTIVE COIN LOTS</span>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#3b82f6', marginTop: '4px' }}>
            {(ov.active_lots_count || 0).toLocaleString()}
          </div>
          <span style={{ fontSize: '10px', color: '#3b82f6' }}>FIFO batches tracking</span>
        </div>

        <div style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>REWARDED SESSIONS</span>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#06b6d4', marginTop: '4px' }}>
            {(ov.total_sessions || 0).toLocaleString()}
          </div>
          <span style={{ fontSize: '10px', color: '#06b6d4' }}>6-hour earning cycles</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid rgba(212, 175, 55, 0.2)',
        marginBottom: '20px',
        background: '#0D0D0D',
        borderRadius: '12px 12px 0 0',
        padding: '0 12px'
      }}>
        {[
          { id: 'ledger', label: 'Audited Coin Ledger', icon: FileText },
          { id: 'sessions', label: '6-Hour Rewarded Sessions', icon: Clock },
          { id: 'lots', label: '30-Day Coin Lots (FIFO)', icon: Coins },
          { id: 'redemptions', label: 'Shop QR Redemptions', icon: QrCode },
          { id: 'transfers', label: 'Customer-to-Merchant Transfers', icon: ArrowLeftRight },
          { id: 'merchant_wallets', label: 'Merchant Coin Wallets', icon: Store }
        ].map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '14px 18px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === t.id ? '3px solid #D4AF37' : '3px solid transparent',
                color: activeTab === t.id ? '#F2D675' : '#888',
                fontWeight: activeTab === t.id ? 800 : 600,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Icon size={16} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: AUDITED COIN LEDGER */}
      {activeTab === 'ledger' && (
        <div style={{ background: '#0D0D0D', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '16px', overflow: 'hidden' }}>
          {/* Controls */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <select
                value={ledgerType}
                onChange={e => setLedgerType(e.target.value)}
                style={{
                  background: '#141414', border: '1px solid rgba(212, 175, 55, 0.25)',
                  color: '#FFFFFF', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', outline: 'none'
                }}
              >
                <option value="all">All Types</option>
                <option value="earned">Earned (Session)</option>
                <option value="redeemed">Redeemed</option>
                <option value="admin_adjustment">Admin Adjustment</option>
                <option value="reversal">Reversal</option>
              </select>

              <div style={{ position: 'relative', width: '260px' }}>
                <Search size={14} color="#D4AF37" style={{ position: 'absolute', left: '10px', top: '9px' }} />
                <input
                  type="text"
                  placeholder="Search user, reason..."
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
                onClick={fetchLedger}
                style={{ background: '#1A1A1A', border: '1px solid rgba(212, 175, 55, 0.3)', color: '#F2D675', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}
              >
                Filter
              </button>
            </div>

            <span style={{ fontSize: '12px', color: '#888' }}>
              Showing {ledger.length} recent transactions
            </span>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#121212', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', color: '#A0A0A0', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>Tx ID</th>
                  <th style={{ padding: '12px 16px' }}>Customer</th>
                  <th style={{ padding: '12px 16px' }}>Type</th>
                  <th style={{ padding: '12px 16px' }}>Amount</th>
                  <th style={{ padding: '12px 16px' }}>Balance Flow</th>
                  <th style={{ padding: '12px 16px' }}>Audit Reason / Authorizer</th>
                  <th style={{ padding: '12px 16px' }}>Timestamp</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map(tx => (
                  <tr key={tx.id} style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.08)' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '11px', color: '#D4AF37' }}>
                      {tx.transaction_id}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#FFF' }}>{tx.customer_name || `User #${tx.user_id}`}</div>
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
                        {tx.type}
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
                          By: {tx.admin_authorizer_name}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '11px', color: '#888' }}>
                      {new Date(tx.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {tx.source === 'admin' && tx.type === 'admin_adjustment' && (
                        <button
                          onClick={() => setReversingTx(tx)}
                          style={{
                            padding: '4px 8px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid #ef4444', color: '#ef4444', fontSize: '11px', fontWeight: 700, cursor: 'pointer'
                          }}
                        >
                          Reverse
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
                6-Hour Rewarded Ad Earning Sessions
              </h3>
              <span style={{ fontSize: '11px', color: '#A0A0A0' }}>
                Strict invariant: Max 3 ads per 6-hr session awarding 100 coins total
              </span>
            </div>
            <button onClick={fetchSessions} style={{ background: '#1A1A1A', border: '1px solid rgba(212, 175, 55, 0.3)', color: '#D4AF37', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
              Refresh
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#121212', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', color: '#A0A0A0', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>Session ID</th>
                  <th style={{ padding: '12px 16px' }}>Customer</th>
                  <th style={{ padding: '12px 16px' }}>Ads Watched</th>
                  <th style={{ padding: '12px 16px' }}>Coins Awarded</th>
                  <th style={{ padding: '12px 16px' }}>Started At</th>
                  <th style={{ padding: '12px 16px' }}>Session Expiration</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.08)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#D4AF37' }}>#{s.id}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#FFF' }}>{s.customer_name || `User #${s.user_id}`}</div>
                      <div style={{ fontSize: '10px', color: '#888' }}>{s.customer_email}</div>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: '#FFFFFF' }}>
                      {s.ads_watched} / 3 Ads
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 900, color: '#F2D675' }}>
                      🪙 {s.coins_awarded}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '11px', color: '#888' }}>
                      {new Date(s.session_start).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '11px', color: '#888' }}>
                      {new Date(s.session_end).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 800,
                        background: s.completed ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                        color: s.completed ? '#22c55e' : '#eab308'
                      }}>
                        {s.completed ? 'COMPLETED' : 'IN PROGRESS'}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                30-Day FIFO Coin Lots Tracking
              </h3>
              <span style={{ fontSize: '11px', color: '#A0A0A0' }}>
                Monitors expiration dates, tier benefits & remaining coin quantities
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
              <option value="all">All Lot Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="USED">USED</option>
              <option value="EXPIRED">EXPIRED</option>
            </select>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#121212', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', color: '#A0A0A0', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>Lot ID</th>
                  <th style={{ padding: '12px 16px' }}>Customer</th>
                  <th style={{ padding: '12px 16px' }}>Source</th>
                  <th style={{ padding: '12px 16px' }}>Earned / Remaining</th>
                  <th style={{ padding: '12px 16px' }}>Tier</th>
                  <th style={{ padding: '12px 16px' }}>Expires At</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {lots.map(lot => (
                  <tr key={lot.id} style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.08)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#D4AF37' }}>#{lot.id}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#FFF' }}>{lot.customer_name || `User #${lot.user_id}`}</div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '11px', color: '#A0A0A0' }}>{lot.source}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 800 }}>
                      <span style={{ color: '#F2D675' }}>{lot.coins_remaining}</span> / <span style={{ color: '#888' }}>{lot.coins_earned}</span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#D4AF37', fontWeight: 700, fontSize: '11px' }}>
                      {lot.tier || 'Bronze'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '11px', color: '#888' }}>
                      {new Date(lot.expires_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 800,
                        background: lot.status === 'ACTIVE' ? 'rgba(34, 197, 94, 0.15)' :
                                    lot.status === 'USED' ? 'rgba(100, 100, 100, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: lot.status === 'ACTIVE' ? '#22c55e' : lot.status === 'USED' ? '#888' : '#ef4444'
                      }}>
                        {lot.status}
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
                Physical Shop QR Redemptions
              </h3>
              <span style={{ fontSize: '11px', color: '#A0A0A0' }}>
                Instant bill discount verification records across merchant counters
              </span>
            </div>
            <button onClick={fetchRedemptions} style={{ background: '#1A1A1A', border: '1px solid rgba(212, 175, 55, 0.3)', color: '#D4AF37', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
              Refresh
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#121212', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', color: '#A0A0A0', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>Redemption ID</th>
                  <th style={{ padding: '12px 16px' }}>Customer</th>
                  <th style={{ padding: '12px 16px' }}>Merchant Shop</th>
                  <th style={{ padding: '12px 16px' }}>Bill Amount</th>
                  <th style={{ padding: '12px 16px' }}>Coins Deducted</th>
                  <th style={{ padding: '12px 16px' }}>Discount Given (INR)</th>
                  <th style={{ padding: '12px 16px' }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {redemptions.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.08)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#D4AF37' }}>#{r.id}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#FFF' }}>{r.customer_name || `User #${r.user_id}`}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#FFFFFF' }}>{r.shop_name}</div>
                      <div style={{ fontSize: '10px', color: '#888' }}>{r.shop_code}</div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#FFFFFF' }}>₹{r.bill_amount}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: '#ef4444' }}>
                      -{r.points_deducted} Coins
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: '#22c55e' }}>
                      ₹{r.discount_amount}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '11px', color: '#888' }}>
                      {new Date(r.created_at).toLocaleString()}
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
                Customer-to-Merchant Coin Transfers (QR Collection)
              </h3>
              <span style={{ fontSize: '11px', color: '#A0A0A0' }}>
                Verifiable double-entry transfer records (Customer debit = Merchant credit, 1 coin = ₹1 discount)
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Search customer or shop..."
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
                <option value="all">All Statuses</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="PENDING">PENDING</option>
                <option value="FAILED">FAILED</option>
              </select>

              <button
                onClick={fetchTransfers}
                style={{
                  background: '#1A1A1A', border: '1px solid rgba(212, 175, 55, 0.3)',
                  color: '#D4AF37', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '4px'
                }}
              >
                <RefreshCw size={13} /> Refresh
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#121212', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', color: '#A0A0A0', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>Transfer ID</th>
                  <th style={{ padding: '12px 16px' }}>Customer</th>
                  <th style={{ padding: '12px 16px' }}>Merchant Shop</th>
                  <th style={{ padding: '12px 16px' }}>Coins Transferred</th>
                  <th style={{ padding: '12px 16px' }}>₹ Discount Value</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px' }}>Ledger Double-Entry Ref</th>
                  <th style={{ padding: '12px 16px' }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {transfers.length > 0 ? (
                  transfers.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.08)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#D4AF37' }}>#{t.id}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#FFF' }}>{t.customer_name || `User #${t.customer_id}`}</div>
                        <div style={{ fontSize: '10px', color: '#888' }}>{t.customer_phone || t.customer_email || '—'}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#FFF' }}>{t.shop_name || `Shop #${t.shop_id}`}</div>
                        {t.merchant_qr_code && (
                          <div style={{ fontSize: '10px', color: '#F2D675', fontFamily: 'monospace' }}>
                            QR: {t.merchant_qr_code}
                          </div>
                        )}
                        <div style={{ fontSize: '10px', color: '#888' }}>{t.shop_contact_phone || '—'}</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: '#F2D675' }}>
                        🪙 {t.coins_amount}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: '#22c55e' }}>
                        ₹{t.discount_inr}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 800,
                          background: t.status === 'COMPLETED' ? 'rgba(34, 197, 94, 0.15)' :
                                      t.status === 'PENDING' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: t.status === 'COMPLETED' ? '#22c55e' : t.status === 'PENDING' ? '#eab308' : '#ef4444'
                        }}>
                          {t.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '11px', color: '#A0A0A0' }}>
                        <div>Cust Ledger: <span style={{ color: '#D4AF37' }}>#{t.customer_ledger_id || '—'}</span></div>
                        <div>Merch Ledger: <span style={{ color: '#F2D675' }}>#{t.merchant_ledger_id || '—'}</span></div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '11px', color: '#888' }}>
                        {new Date(t.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: '#888' }}>
                      No customer-to-merchant coin transfers found.
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
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>TOTAL MERCHANT COIN BALANCE</span>
              <div style={{ fontSize: '22px', fontWeight: 900, color: '#10b981', marginTop: '4px' }}>
                🪙 {(merchantWalletsSummary?.balance || 0).toLocaleString()}
              </div>
              <span style={{ fontSize: '10px', color: '#A0A0A0' }}>Currently held by active shops</span>
            </div>

            <div style={{ background: '#121212', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '12px', padding: '14px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>LIFETIME COINS RECEIVED</span>
              <div style={{ fontSize: '22px', fontWeight: 900, color: '#F2D675', marginTop: '4px' }}>
                🪙 {(merchantWalletsSummary?.received || 0).toLocaleString()}
              </div>
              <span style={{ fontSize: '10px', color: '#A0A0A0' }}>Total accepted from customer QR scans</span>
            </div>

            <div style={{ background: '#121212', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '12px', padding: '14px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>LIFETIME COINS SPENT</span>
              <div style={{ fontSize: '22px', fontWeight: 900, color: '#3b82f6', marginTop: '4px' }}>
                🪙 {(merchantWalletsSummary?.spent || 0).toLocaleString()}
              </div>
              <span style={{ fontSize: '10px', color: '#A0A0A0' }}>Used for promotions & marketing</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                Merchant Shop Wallets Directory
              </h3>
              <span style={{ fontSize: '11px', color: '#A0A0A0' }}>
                Individual coin balances and transaction records per registered shop
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Filter by shop or owner..."
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
                onClick={fetchMerchantWallets}
                style={{
                  background: '#1A1A1A', border: '1px solid rgba(212, 175, 55, 0.3)',
                  color: '#D4AF37', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '4px'
                }}
              >
                <RefreshCw size={13} /> Refresh
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#121212', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', color: '#A0A0A0', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>Shop ID</th>
                  <th style={{ padding: '12px 16px' }}>Shop Name</th>
                  <th style={{ padding: '12px 16px' }}>Category</th>
                  <th style={{ padding: '12px 16px' }}>Owner & Contact</th>
                  <th style={{ padding: '12px 16px' }}>Current Balance</th>
                  <th style={{ padding: '12px 16px' }}>Total Received</th>
                  <th style={{ padding: '12px 16px' }}>Total Spent</th>
                  <th style={{ padding: '12px 16px' }}>Last Updated</th>
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
                        {w.category || 'General'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ color: '#FFFFFF', fontWeight: 600 }}>{w.owner_name || '—'}</div>
                        <div style={{ fontSize: '10px', color: '#888' }}>{w.phone || w.email || '—'}</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: '#10b981' }}>
                        🪙 {(w.balance || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#F2D675' }}>
                        🪙 {(w.total_received || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#888' }}>
                        🪙 {(w.total_spent || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '11px', color: '#888' }}>
                        {new Date(w.updated_at).toLocaleString()}
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
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#0E0E0E', border: '1px solid #D4AF37', borderRadius: '16px',
            width: '460px', maxWidth: '100%', padding: '24px', boxShadow: '0 16px 40px rgba(0,0,0,0.9)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>Admin Coin Adjustment</h3>
              <button onClick={() => setShowAdjustModal(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
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
                  Customer ID *
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
                  + Credit Coins
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
                  - Debit Coins
                </button>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                  Coin Quantity *
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
                  Audit Reason (Mandatory) *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Justify adjustment for ledger audit compliance..."
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
                  Cancel
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
                  {adjSubmitting ? 'Saving...' : 'Authorize'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reversal Confirmation Modal */}
      {reversingTx && (
        <div style={{
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
                Reverse Transaction {reversingTx.transaction_id}
              </h3>
            </div>

            <p style={{ fontSize: '12px', color: '#C0C0C0', margin: '0 0 14px 0', lineHeight: 1.4 }}>
              This will create an opposite-signed entry of <strong>{-reversingTx.points} coins</strong> for Customer #{reversingTx.user_id} and update their wallet balance.
            </p>

            <form onSubmit={handleReversalSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                  Reversal Audit Reason *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Explain why this adjustment is being reversed..."
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
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={revSubmitting}
                  style={{
                    padding: '8px 18px', borderRadius: '8px', background: '#ef4444',
                    border: 'none', color: '#FFFFFF', fontSize: '12px', fontWeight: 900, cursor: 'pointer'
                  }}
                >
                  {revSubmitting ? 'Reversing...' : 'Execute Reversal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
