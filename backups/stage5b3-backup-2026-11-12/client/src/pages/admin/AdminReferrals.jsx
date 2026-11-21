import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { parseApiResponse, resolveApiErrorMessage, resolveNetworkErrorMessage } from '../../utils/api';
import { downloadAuthenticatedCsv } from '../../utils/csvExport';
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
  const { t, locale } = useI18n();
  const [referrals, setReferrals] = useState([]);

  const getStatusLabel = (status) => {
    const normalized = String(status || '').toLowerCase();
    const key = `adminStatusLabel_${normalized}`;
    const label = t(key);
    return label === key ? String(status || '').replace(/_/g, ' ').toUpperCase() : label;
  };
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportError, setExportError] = useState(null);
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
      .then(parseApiResponse)
      .then(parsed => {
        const d = parsed.data;
        if (parsed.ok && d && d.success) setOverview(d.overview);
      })
      .catch(console.error);
  };

  const fetchReferrals = () => {
    setLoading(true);
    let url = '/api/admin/referrals?limit=100';
    if (statusFilter !== 'all') url += `&status=${statusFilter}`;
    if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(parseApiResponse)
      .then(parsed => {
        const d = parsed.data;
        if (parsed.ok && d && d.success) setReferrals(d.referrals || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!token) return;
    fetchOverview();
    fetchReferrals();
  }, [token, statusFilter]);

  const handleExportCSV = async () => {
    if (exportingCsv) return;
    setExportError(null);
    setExportingCsv(true);
    try {
      await downloadAuthenticatedCsv({
        url: '/api/admin/referrals/export',
        token,
        fallbackFilename: `vp52_referrals_${Date.now()}.csv`,
        t
      });
    } catch (err) {
      setExportError(err.message || t('csvExportFailed'));
    } finally {
      setExportingCsv(false);
    }
  };

  const handleUpdateStatus = async (id, newStatus) => {
    if (!window.confirm(t('confirmSetReferralStatus', { id, status: getStatusLabel(newStatus) }))) return;
    try {
      const res = await fetch(`/api/admin/referrals/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      const parsed = await parseApiResponse(res);
      const data = parsed.data;
      if (parsed.ok && data && data.success) {
        fetchOverview();
        fetchReferrals();
      } else {
        alert(resolveApiErrorMessage(parsed, t, 'failedUpdateReferralErr'));
      }
    } catch (err) {
      alert(resolveNetworkErrorMessage(err, t, 'failedUpdateReferralErr'));
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
      const parsed = await parseApiResponse(res);
      const data = parsed.data;
      if (parsed.ok && data && data.success) {
        alert(data.message);
        setDisablingCode(null);
        setDisableReason('');
        fetchOverview();
        fetchReferrals();
      } else {
        alert(resolveApiErrorMessage(parsed, t, 'failedDisableRefCodeErr'));
      }
    } catch (err) {
      alert(resolveNetworkErrorMessage(err, t, 'failedDisableRefCodeErr'));
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
            {t('adminReferralsTitle')}
          </h1>
          <p style={{ fontSize: '12px', color: '#A0A0A0', margin: '4px 0 0 0' }}>
            {t('adminReferralsSub')}
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCSV}
          disabled={exportingCsv}
          style={{
            background: '#181818', border: '1px solid rgba(212, 175, 55, 0.3)',
            color: '#D4AF37', padding: '8px 16px', borderRadius: '10px',
            fontSize: '12px', fontWeight: 700,
            cursor: exportingCsv ? 'wait' : 'pointer',
            opacity: exportingCsv ? 0.7 : 1,
            display: 'flex', alignItems: 'center', gap: '6px'
          }}
        >
          <Download size={15} /> {exportingCsv ? t('exportingCsvProgress') : t('exportReferralsCsvBtn')}
        </button>
      </div>

      {exportError && (
        <div role="alert" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
          background: 'rgba(239, 68, 68, 0.14)', border: '1px solid rgba(239, 68, 68, 0.45)',
          color: '#FCA5A5', borderRadius: '12px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} />
            <span>{exportError}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportError(null)}
            style={{ background: 'none', border: 'none', color: '#FCA5A5', cursor: 'pointer', padding: '2px' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Overview Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '14px',
        marginBottom: '24px'
      }}>
        <div style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('ovTotalReferralsUpper')}</span>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#FFFFFF', marginTop: '4px' }}>
            {(ov.total_referrals || 0).toLocaleString(locale)}
          </div>
          <span style={{ fontSize: '10px', color: '#D4AF37' }}>{t('recordedInvitationsSub')}</span>
        </div>

        <div style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('ovCompletedInvitationsUpper')}</span>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#22c55e', marginTop: '4px' }}>
            {(ov.completed_referrals || 0).toLocaleString(locale)}
          </div>
          <span style={{ fontSize: '10px', color: '#22c55e' }}>{t('profileSetupFinishedSub')}</span>
        </div>

        <div style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('ovCoinsAwardedUpper')}</span>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#F2D675', marginTop: '4px' }}>
            🪙 {(ov.coins_awarded || 0).toLocaleString(locale)}
          </div>
          <span style={{ fontSize: '10px', color: '#F2D675' }}>{t('referralIncentivesSub')}</span>
        </div>

        <div style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('ovFlaggedReferralsUpper')}</span>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#ef4444', marginTop: '4px' }}>
            {(ov.flagged_referrals || 0).toLocaleString(locale)}
          </div>
          <span style={{ fontSize: '10px', color: '#ef4444' }}>{t('underAbuseReviewSub')}</span>
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
              <option value="all">{t('adminStatusAll')}</option>
              <option value="pending">{t('orderFilterOpt_pending')}</option>
              <option value="completed">{t('bookingFilterOpt_completed')}</option>
              <option value="rewarded">{t('adminStatusLabel_rewarded')}</option>
              <option value="rejected">{t('bookingFilterOpt_rejected')}</option>
              <option value="fraud_suspected">{t('adminStatusLabel_fraud_suspected')}</option>
            </select>

            <div style={{ position: 'relative', width: '260px' }}>
              <Search size={14} color="#D4AF37" style={{ position: 'absolute', left: '10px', top: '9px' }} />
              <input
                type="text"
                placeholder={t('searchReferralsPlaceholder')}
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
              type="button"
              onClick={fetchReferrals}
              style={{ background: '#1A1A1A', border: '1px solid rgba(212, 175, 55, 0.3)', color: '#F2D675', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}
            >
              {t('adminFilterBtn')}
            </button>
          </div>

          <span style={{ fontSize: '12px', color: '#888' }}>
            {t(referrals.length === 1 ? 'referralRecordSingle' : 'referralRecordPlural', { count: referrals.length })}
          </span>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#121212', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', color: '#A0A0A0', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px' }}>{t('colReferralId')}</th>
                <th style={{ padding: '12px 16px' }}>{t('colReferrerCustomer')}</th>
                <th style={{ padding: '12px 16px' }}>{t('colReferredCustomer')}</th>
                <th style={{ padding: '12px 16px' }}>{t('colCodeUsed')}</th>
                <th style={{ padding: '12px 16px' }}>{t('colCoinsAwarded')}</th>
                <th style={{ padding: '12px 16px' }}>{t('colStatus')}</th>
                <th style={{ padding: '12px 16px' }}>{t('colDate')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>{t('colActions')}</th>
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
                      <div style={{ fontWeight: 700, color: '#FFF' }}>{r.referrer_name || t('userFallbackLabel', { id: r.referrer_user_id })}</div>
                      <div style={{ fontSize: '10px', color: '#888' }}>{r.referrer_email}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#FFF' }}>{r.referred_name || t('userFallbackLabel', { id: r.referred_user_id })}</div>
                      <div style={{ fontSize: '10px', color: '#888' }}>{r.referred_email}</div>
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, color: '#F2D675' }}>
                      {r.referral_code}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: '#22c55e' }}>
                      🪙 {(r.coins_awarded || 0).toLocaleString(locale)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase',
                        background: r.status === 'rewarded' || r.status === 'completed' ? 'rgba(34, 197, 94, 0.15)' :
                                    r.status === 'fraud_suspected' || r.status === 'rejected' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                        color: r.status === 'rewarded' || r.status === 'completed' ? '#22c55e' :
                               r.status === 'fraud_suspected' || r.status === 'rejected' ? '#ef4444' : '#eab308'
                      }}>
                        {getStatusLabel(r.status)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '11px', color: '#888' }}>
                      {new Date(r.created_at).toLocaleString(locale)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        {r.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(r.id, 'completed')}
                            style={{ padding: '4px 8px', borderRadius: '6px', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid #22c55e', color: '#22c55e', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                          >
                            {t('adminApproveBtn')}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setDisablingCode(r.referral_code);
                            setDisableReason('');
                          }}
                          title={t('disableCodeTitle')}
                          style={{ padding: '4px 8px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                        >
                          {t('disableCodeBtn')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: '#888' }}>
                    {loading ? t('loadingReferrals') : t('noReferralsFound')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Disable Code Modal */}
      {disablingCode && (
        <div role="dialog" aria-modal="true" style={{
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
                {t('disableCodeModalTitle', { code: disablingCode })}
              </h3>
            </div>

            <p style={{ fontSize: '12px', color: '#C0C0C0', margin: '0 0 14px 0', lineHeight: 1.4 }}>
              {t('disableCodeModalDesc')}
            </p>

            <form onSubmit={handleDisableCode}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                  {t('abuseSecurityReasonRequired')}
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder={t('abuseReasonPlaceholder')}
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
                  {t('cancelBtn')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDisable}
                  style={{
                    padding: '8px 18px', borderRadius: '8px', background: '#ef4444',
                    border: 'none', color: '#FFFFFF', fontSize: '12px', fontWeight: 900, cursor: 'pointer'
                  }}
                >
                  {isSubmittingDisable ? t('disablingProgress') : t('confirmDisableBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
