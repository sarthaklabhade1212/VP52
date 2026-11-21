import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Share2,
  Search,
  Filter,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Ban,
  RefreshCw,
  X,
  Users,
  Coins,
  ShieldAlert
} from 'lucide-react';

export default function AdminReferrals() {
  const { token } = useAuth();
  const [referrals, setReferrals] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Disable Code Modal State
  const [disablingCode, setDisablingCode] = useState(null);
  const [disableReason, setDisableReason] = useState('');
  const [isSubmittingDisable, setIsSubmittingDisable] = useState(false);

  const fetchOverview = () => {
    fetch('/api/admin/referrals/overview', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(d => { if (d.success) setOverview(d.overview); })
      .catch(console.error);
  };

  const fetchReferrals = () => {
    setLoading(true);
    let url = '/api/admin/referrals?limit=100';
    if (statusFilter !== 'all') url += `&status=${statusFilter}`;
    if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(d => { if (d.success) setReferrals(d.referrals || []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!token) return;
    fetchOverview();
    fetchReferrals();
  }, [token, statusFilter]);

  const handleExportCSV = () => {
    window.open(`/api/admin/referrals/export?token=${token}`, '_blank');
  };

  const handleUpdateStatus = async (id, newStatus) => {
    if (!window.confirm(`Set referral #${id} status to "${newStatus}"?`)) return;
    try {
      const res = await fetch(`/api/admin/referrals/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchOverview();
        fetchReferrals();
      } else {
        alert(data.error || 'Failed to update referral');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDisableCode = async (e) => {
    e.preventDefault();
    if (!disablingCode || !disableReason.trim()) return;
    setIsSubmittingDisable(true);

    try {
      const res = await fetch(`/api/admin/referrals/codes/${disablingCode}/disable`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason: disableReason.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message);
        setDisablingCode(null);
        setDisableReason('');
        fetchOverview();
        fetchReferrals();
      } else {
        alert(data.error || 'Failed to disable referral code');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmittingDisable(false);
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
            Referral & Growth Management
          </h1>
          <p style={{ fontSize: '12px', color: '#A0A0A0', margin: '4px 0 0 0' }}>
            Monitor customer invitation campaigns, referral code usage, coin awards & abuse detection
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          style={{
            background: '#181818', border: '1px solid rgba(212, 175, 55, 0.3)',
            color: '#D4AF37', padding: '8px 16px', borderRadius: '10px',
            fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
          }}
        >
          <Download size={15} /> Export Referrals CSV
        </button>
      </div>

      {/* Overview Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '14px',
        marginBottom: '24px'
      }}>
        <div style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>TOTAL REFERRALS</span>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#FFFFFF', marginTop: '4px' }}>
            {ov.total_referrals || 0}
          </div>
          <span style={{ fontSize: '10px', color: '#D4AF37' }}>Recorded invitations</span>
        </div>

        <div style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>COMPLETED INVITATIONS</span>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#22c55e', marginTop: '4px' }}>
            {ov.completed_referrals || 0}
          </div>
          <span style={{ fontSize: '10px', color: '#22c55e' }}>Profile setup finished</span>
        </div>

        <div style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>COINS AWARDED</span>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#F2D675', marginTop: '4px' }}>
            🪙 {(ov.coins_awarded || 0).toLocaleString()}
          </div>
          <span style={{ fontSize: '10px', color: '#F2D675' }}>Referral incentives issued</span>
        </div>

        <div style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>FLAGGED REFERRALS</span>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#ef4444', marginTop: '4px' }}>
            {ov.flagged_referrals || 0}
          </div>
          <span style={{ fontSize: '10px', color: '#ef4444' }}>Under abuse review</span>
        </div>
      </div>

      {/* Referrals Table */}
      <div style={{
        background: '#0D0D0D',
        borderRadius: '16px',
        border: '1px solid rgba(212, 175, 55, 0.2)',
        overflow: 'hidden'
      }}>
        {/* Filter Bar */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{
                background: '#141414', border: '1px solid rgba(212, 175, 55, 0.25)',
                color: '#FFFFFF', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', outline: 'none'
              }}
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="rewarded">Rewarded</option>
              <option value="rejected">Rejected</option>
              <option value="fraud_suspected">Fraud Suspected</option>
            </select>

            <div style={{ position: 'relative', width: '260px' }}>
              <Search size={14} color="#D4AF37" style={{ position: 'absolute', left: '10px', top: '9px' }} />
              <input
                type="text"
                placeholder="Search referrer, code, user..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') fetchReferrals(); }}
                style={{
                  width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.25)',
                  color: '#FFFFFF', borderRadius: '8px', padding: '6px 10px 6px 32px', fontSize: '12px', outline: 'none'
                }}
              />
            </div>

            <button
              onClick={fetchReferrals}
              style={{ background: '#1A1A1A', border: '1px solid rgba(212, 175, 55, 0.3)', color: '#F2D675', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}
            >
              Filter
            </button>
          </div>

          <span style={{ fontSize: '12px', color: '#888' }}>
            {referrals.length} referral record{referrals.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#121212', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', color: '#A0A0A0', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px' }}>Referral ID</th>
                <th style={{ padding: '12px 16px' }}>Referrer Customer</th>
                <th style={{ padding: '12px 16px' }}>Referred Customer</th>
                <th style={{ padding: '12px 16px' }}>Code Used</th>
                <th style={{ padding: '12px 16px' }}>Coins Awarded</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px' }}>Date</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {referrals.length > 0 ? (
                referrals.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.08)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: '#D4AF37' }}>
                      #{r.id}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#FFF' }}>{r.referrer_name || `User #${r.referrer_user_id}`}</div>
                      <div style={{ fontSize: '10px', color: '#888' }}>{r.referrer_email}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#FFF' }}>{r.referred_name || `User #${r.referred_user_id}`}</div>
                      <div style={{ fontSize: '10px', color: '#888' }}>{r.referred_email}</div>
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, color: '#F2D675' }}>
                      {r.referral_code}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: '#22c55e' }}>
                      🪙 {r.coins_awarded || 0}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase',
                        background: r.status === 'rewarded' || r.status === 'completed' ? 'rgba(34, 197, 94, 0.15)' :
                                    r.status === 'fraud_suspected' || r.status === 'rejected' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                        color: r.status === 'rewarded' || r.status === 'completed' ? '#22c55e' :
                               r.status === 'fraud_suspected' || r.status === 'rejected' ? '#ef4444' : '#eab308'
                      }}>
                        {r.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '11px', color: '#888' }}>
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        {r.status === 'pending' && (
                          <button
                            onClick={() => handleUpdateStatus(r.id, 'completed')}
                            style={{ padding: '4px 8px', borderRadius: '6px', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid #22c55e', color: '#22c55e', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Approve
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setDisablingCode(r.referral_code);
                            setDisableReason('');
                          }}
                          title="Disable Referral Code"
                          style={{ padding: '4px 8px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                        >
                          Disable Code
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: '#888' }}>
                    {loading ? 'Loading referral records...' : 'No referrals found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Disable Code Modal */}
      {disablingCode && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#0E0E0E', border: '1px solid #ef4444', borderRadius: '16px',
            width: '440px', maxWidth: '100%', padding: '24px', boxShadow: '0 16px 40px rgba(0,0,0,0.9)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <Ban size={22} color="#ef4444" />
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                Disable Code: {disablingCode}
              </h3>
            </div>

            <p style={{ fontSize: '12px', color: '#C0C0C0', margin: '0 0 14px 0', lineHeight: 1.4 }}>
              Disabling this referral code prevents any further customer signups from claiming reward coins through it.
            </p>

            <form onSubmit={handleDisableCode}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                  Abuse / Security Reason *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Suspected bot activity, multiple dummy registrations..."
                  value={disableReason}
                  onChange={e => setDisableReason(e.target.value)}
                  style={{
                    width: '100%', background: '#141414', border: '1px solid #ef4444',
                    borderRadius: '8px', padding: '8px 12px', color: '#FFFFFF', fontSize: '12px', outline: 'none', resize: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setDisablingCode(null)}
                  style={{ padding: '8px 14px', borderRadius: '8px', background: '#1A1A1A', border: '1px solid #333', color: '#888', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDisable}
                  style={{
                    padding: '8px 18px', borderRadius: '8px', background: '#ef4444',
                    border: 'none', color: '#FFFFFF', fontSize: '12px', fontWeight: 900, cursor: 'pointer'
                  }}
                >
                  {isSubmittingDisable ? 'Disabling...' : 'Confirm Disable'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
