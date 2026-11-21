import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { parseApiResponse, resolveApiErrorMessage, resolveNetworkErrorMessage } from '../../utils/api';
import { downloadAuthenticatedCsv } from '../../utils/csvExport';
import {
  CreditCard,
  Search,
  Filter,
  Download,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  X,
  ShieldCheck,
  Store,
  User,
  Calendar
} from 'lucide-react';

export default function AdminPayments() {
  const { token } = useAuth();
  const { t, locale } = useI18n();
  const [payments, setPayments] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const getStatusLabel = (status) => {
    const key = `adminStatusLabel_${String(status || '').toLowerCase()}`;
    const res = t(key);
    return res === key ? status : res;
  };

  // Refund Modal & CSV Export State
  const [refundingPayment, setRefundingPayment] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);
  const [refundError, setRefundError] = useState('');
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportError, setExportError] = useState(null);

  const fetchOverview = () => {
    fetch('/api/admin/payments/overview', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(parseApiResponse)
      .then(parsed => {
        const d = parsed.data;
        if (parsed.ok && d && d.success) setOverview(d.overview);
      })
      .catch(console.error);
  };

  const fetchPayments = () => {
    setLoading(true);
    let url = '/api/admin/payments?limit=100';
    if (statusFilter !== 'all') url += `&status=${statusFilter}`;
    if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(parseApiResponse)
      .then(parsed => {
        const d = parsed.data;
        if (parsed.ok && d && d.success) setPayments(d.payments || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!token) return;
    fetchOverview();
    fetchPayments();
  }, [token, statusFilter]);

  const handleExportCSV = async () => {
    if (exportingCsv) return;
    setExportError(null);
    setExportingCsv(true);
    try {
      await downloadAuthenticatedCsv({
        url: '/api/admin/payments/export',
        token,
        fallbackFilename: `vp52_payments_${Date.now()}.csv`,
        t
      });
    } catch (err) {
      setExportError(err.message || t('csvExportFailed'));
    } finally {
      setExportingCsv(false);
    }
  };

  const handleRefundSubmit = async (e) => {
    e.preventDefault();
    if (!refundingPayment) return;
    setRefundError('');

    const amt = parseFloat(refundAmount);
    if (!amt || amt <= 0 || amt > refundingPayment.amount) {
      setRefundError(t('invalidRefundMaxError', { max: (refundingPayment.amount || 0).toLocaleString(locale) }));
      return;
    }
    if (!refundReason.trim()) {
      setRefundError(t('refundReasonRequiredErr'));
      return;
    }

    setIsSubmittingRefund(true);
    try {
      const res = await fetch('/api/admin/payments/refund', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          payment_id: refundingPayment.id,
          refund_amount: amt,
          reason: refundReason.trim()
        })
      });
      const parsed = await parseApiResponse(res);
      const data = parsed.data;
      if (parsed.ok && data && data.success) {
        alert(data.message);
        setRefundingPayment(null);
        setRefundAmount('');
        setRefundReason('');
        fetchOverview();
        fetchPayments();
      } else {
        setRefundError(resolveApiErrorMessage(parsed, t, 'refundFailedErr'));
      }
    } catch (err) {
      setRefundError(resolveNetworkErrorMessage(err, t, 'refundFailedErr'));
    } finally {
      setIsSubmittingRefund(false);
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
        marginBottom: '20px',
        background: '#0D0D0D',
        border: '1px solid rgba(212, 175, 55, 0.2)',
        borderRadius: '16px',
        padding: '16px 20px'
      }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
            {t('adminPaymentsTitle')}
          </h1>
          <p style={{ fontSize: '12px', color: '#A0A0A0', margin: '4px 0 0 0' }}>
            {t('adminPaymentsSub')}
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
          <Download size={15} /> {exportingCsv ? t('exportingCsvProgress') : t('exportPaymentsCsvBtn')}
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

      {/* Commercial Policy Guarantee Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0F1A12 0%, #16291C 100%)',
        border: '1px solid #22c55e',
        borderRadius: '14px',
        padding: '14px 18px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px'
      }}>
        <div style={{
          width: '38px', height: '38px', borderRadius: '10px', background: '#22c55e',
          color: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
        }}>
          <ShieldCheck size={22} color="#050505" />
        </div>
        <div>
          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#FFFFFF' }}>
            {t('merchantFreeBannerTitle')}
          </h4>
          <span style={{ fontSize: '11px', color: '#86efac', lineHeight: 1.4, display: 'block', marginTop: '2px' }}>
            {t('merchantFreeBannerDesc')}
          </span>
        </div>
      </div>

      {/* Overview Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '14px',
        marginBottom: '24px'
      }}>
        <div style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('ovRecordedRevenueUpper')}</span>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#22c55e', marginTop: '4px' }}>
            {(ov.recorded_revenue || 0).toLocaleString(locale)}
          </div>
          <span style={{ fontSize: '10px', color: '#22c55e' }}>{t('ovSuccessfulOrdersSub', { count: ov.successful_transactions || 0 })}</span>
        </div>

        <div style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('ovTotalRefundsUpper')}</span>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#ef4444', marginTop: '4px' }}>
            {(ov.total_refunds || 0).toLocaleString(locale)}
          </div>
          <span style={{ fontSize: '10px', color: '#888' }}>{t('ovAuditedReturnsSub')}</span>
        </div>

        <div style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('ovNetRevenueUpper')}</span>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#F2D675', marginTop: '4px' }}>
            {(ov.net_revenue || 0).toLocaleString(locale)}
          </div>
          <span style={{ fontSize: '10px', color: '#F2D675' }}>{t('ovRevenueMinusRefundsSub')}</span>
        </div>

        <div style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('ovMerchantFeePolicyUpper')}</span>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#22c55e', marginTop: '4px' }}>
            {t('adminFreeBadge')}
          </div>
          <span style={{ fontSize: '10px', color: '#22c55e' }}>{t('noPaywallZeroFeesDesc')}</span>
        </div>
      </div>

      {/* Payments Table */}
      <div style={{
        background: '#0D0D0D',
        borderRadius: '16px',
        border: '1px solid rgba(212, 175, 55, 0.2)',
        overflow: 'hidden'
      }}>
        {/* Filter Toolbar */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{
                background: '#141414', border: '1px solid rgba(212, 175, 55, 0.25)',
                color: '#FFFFFF', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', outline: 'none'
              }}
            >
              <option value="all">{t('allPaymentStatusesOption')}</option>
              <option value="successful">{t('adminStatusLabel_successful')}</option>
              <option value="refunded">{t('adminStatusLabel_refunded')}</option>
              <option value="failed">{t('adminStatusLabel_failed')}</option>
            </select>

            <div style={{ position: 'relative', width: '260px' }}>
              <Search size={14} color="#D4AF37" style={{ position: 'absolute', left: '10px', top: '9px' }} />
              <input
                type="text"
                placeholder={t('searchRefCustomerPlaceholder')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') fetchPayments(); }}
                style={{
                  width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.25)',
                  color: '#FFFFFF', borderRadius: '8px', padding: '6px 10px 6px 32px', fontSize: '12px', outline: 'none'
                }}
              />
            </div>

            <button
              type="button"
              onClick={fetchPayments}
              style={{ background: '#1A1A1A', border: '1px solid rgba(212, 175, 55, 0.3)', color: '#F2D675', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}
            >
              {t('adminFilterBtn')}
            </button>
          </div>

          <span style={{ fontSize: '12px', color: '#888' }}>
            {payments.length === 1 ? t('paymentRecordsSingle', { count: payments.length }) : t('paymentRecordsPlural', { count: payments.length })}
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#121212', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', color: '#A0A0A0', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px' }}>{t('colPaymentRef')}</th>
                <th style={{ padding: '12px 16px' }}>{t('colCustomer')}</th>
                <th style={{ padding: '12px 16px' }}>{t('colMerchantShop')}</th>
                <th style={{ padding: '12px 16px' }}>{t('colAmount')}</th>
                <th style={{ padding: '12px 16px' }}>{t('colMethod')}</th>
                <th style={{ padding: '12px 16px' }}>{t('colStatus')}</th>
                <th style={{ padding: '12px 16px' }}>{t('colTimestamp')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>{t('colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {payments.length > 0 ? (
                payments.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.08)' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 800, color: '#D4AF37' }}>
                      {p.payment_reference}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#FFF' }}>{p.customer_name || t('userFallbackLabel', { id: p.user_id })}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#FFF' }}>{p.shop_name || t('shopFallbackLabel', { id: p.shop_id || t('naLabel') })}</div>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: '#22c55e', fontSize: '14px' }}>
                      {(p.amount || 0).toLocaleString(locale)}
                      {p.refund_amount > 0 && (
                        <div style={{ fontSize: '10px', color: '#ef4444' }}>
                          {t('refundedPrefix', { amount: (p.refund_amount || 0).toLocaleString(locale) })}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textTransform: 'uppercase', fontSize: '11px', color: '#A0A0A0' }}>
                      {p.payment_method || 'UPI'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase',
                        background: p.status === 'successful' || p.status === 'completed' ? 'rgba(34, 197, 94, 0.15)' :
                                    p.status === 'refunded' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                        color: p.status === 'successful' || p.status === 'completed' ? '#22c55e' :
                               p.status === 'refunded' ? '#ef4444' : '#eab308'
                      }}>
                        {getStatusLabel(p.status)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '11px', color: '#888' }}>
                      {new Date(p.created_at).toLocaleString(locale)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {(p.status === 'successful' || p.status === 'completed') && (
                        <button
                          type="button"
                          onClick={() => {
                            setRefundingPayment(p);
                            setRefundAmount(String(p.amount));
                            setRefundReason('');
                            setRefundError('');
                          }}
                          style={{
                            padding: '4px 8px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid #ef4444', color: '#ef4444', fontSize: '11px', fontWeight: 700, cursor: 'pointer'
                          }}
                        >
                          {t('refundBtn')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: '#888' }}>
                    {loading ? t('loadingPaymentRecords') : t('noPaymentsFilterMatch')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Process Refund Modal */}
      {refundingPayment && (
        <div role="dialog" aria-modal="true" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#0E0E0E', border: '1px solid #ef4444', borderRadius: '16px',
            width: '460px', maxWidth: '100%', padding: '24px', boxShadow: '0 16px 40px rgba(0,0,0,0.9)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <RotateCcw size={20} color="#ef4444" />
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                  {t('processRefundModalTitle')}
                </h3>
              </div>
              <button type="button" aria-label={t('closeModalAria')} onClick={() => setRefundingPayment(null)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '10px 14px', background: '#161616', borderRadius: '10px', marginBottom: '14px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#888' }}>{t('paymentRefColon')}</span>
                <span style={{ color: '#D4AF37', fontWeight: 700 }}>{refundingPayment.payment_reference}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#888' }}>{t('originalAmountColon')}</span>
                <span style={{ color: '#22c55e', fontWeight: 800 }}>{(refundingPayment.amount || 0).toLocaleString(locale)}</span>
              </div>
            </div>

            {refundError && (
              <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', color: '#ef4444', fontSize: '12px', marginBottom: '14px' }}>
                {refundError}
              </div>
            )}

            <form onSubmit={handleRefundSubmit}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                  {t('refundAmountRequiredLabel')}
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  max={refundingPayment.amount}
                  value={refundAmount}
                  onChange={e => setRefundAmount(e.target.value)}
                  style={{
                    width: '100%', background: '#141414', border: '1px solid #ef4444',
                    borderRadius: '8px', padding: '8px 12px', color: '#FFFFFF', fontSize: '14px', outline: 'none'
                  }}
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                  {t('refundAuditReasonRequiredLabel')}
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder={t('refundReasonPlaceholder')}
                  value={refundReason}
                  onChange={e => setRefundReason(e.target.value)}
                  style={{
                    width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.3)',
                    borderRadius: '8px', padding: '8px 12px', color: '#FFFFFF', fontSize: '12px', outline: 'none', resize: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setRefundingPayment(null)}
                  style={{ padding: '8px 14px', borderRadius: '8px', background: '#1A1A1A', border: '1px solid #333', color: '#888', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  {t('cancelBtn')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRefund}
                  style={{
                    padding: '8px 18px', borderRadius: '8px', background: '#ef4444',
                    border: 'none', color: '#FFFFFF', fontSize: '12px', fontWeight: 900, cursor: 'pointer'
                  }}
                >
                  {isSubmittingRefund ? t('processingBtn') : t('authorizeRefundBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
