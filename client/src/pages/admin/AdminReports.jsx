import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { parseApiResponse } from '../../utils/api';
import { downloadAuthenticatedCsv } from '../../utils/csvExport';
import { formatInr, formatCoins, formatNumber } from '../../utils/formatters';
import {
  BarChart3,
  Download,
  Calendar,
  Users,
  Store,
  Coins,
  ShoppingBag,
  CreditCard,
  Share2,
  Headphones,
  RefreshCw,
  FileText,
  Clock,
  Tv,
  ArrowLeftRight,
  AlertTriangle,
  X
} from 'lucide-react';

export default function AdminReports() {
  const { token } = useAuth();
  const { t, locale } = useI18n();
  const [reportType, setReportType] = useState('customers');
  const [dateRange, setDateRange] = useState('30d');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportError, setExportError] = useState(null);

  const reportModules = [
    { id: 'customers', label: t('reportMod_customers'), icon: Users },
    { id: 'merchants', label: t('reportMod_merchants'), icon: Store },
    { id: 'coins', label: t('reportMod_coins'), icon: Coins },
    { id: 'sessions', label: t('reportMod_sessions'), icon: Clock },
    { id: 'admob', label: t('reportMod_admob'), icon: Tv },
    { id: 'transfers', label: t('reportMod_transfers'), icon: ArrowLeftRight },
    { id: 'orders', label: t('reportMod_orders'), icon: ShoppingBag },
    { id: 'payments', label: t('reportMod_payments'), icon: CreditCard },
    { id: 'referrals', label: t('reportMod_referrals'), icon: Share2 },
    { id: 'support', label: t('reportMod_support'), icon: Headphones },
  ];

  const dateFilterOptions = [
    { id: 'today', label: t('adminRangeToday') },
    { id: 'yesterday', label: t('adminRangeYesterday') },
    { id: '7d', label: t('adminRange7d') },
    { id: '30d', label: t('adminRange30d') },
    { id: 'this_month', label: t('adminRangeThisMonth') },
    { id: 'prev_month', label: t('adminRangePrevMonth') },
    { id: 'all', label: t('adminRangeAllTime') }
  ];

  const fetchReport = (type = reportType, range = dateRange) => {
    setLoading(true);
    fetch(`/api/admin/reports/${type}?range=${range}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(parseApiResponse)
      .then(parsed => {
        const d = parsed.data;
        if (parsed.ok && d && d.success) setReportData(d);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) fetchReport(reportType, dateRange);
  }, [token, reportType, dateRange]);

  const handleExportCSV = async () => {
    if (exportingCsv) return;
    setExportError(null);
    setExportingCsv(true);
    try {
      await downloadAuthenticatedCsv({
        url: `/api/admin/reports/${encodeURIComponent(reportType)}/export?range=${encodeURIComponent(dateRange)}`,
        token,
        fallbackFilename: `vp52_${reportType}_report_${dateRange}.csv`,
        t
      });
    } catch (err) {
      setExportError(err.message || t('csvExportFailed'));
    } finally {
      setExportingCsv(false);
    }
  };

  const summary = reportData?.summary || {};
  const dataRows = reportData?.rows || reportData?.data || [];
  const activeModuleLabel = reportModules.find(m => m.id === reportType)?.label || reportType.toUpperCase();
  const activeRangeLabel = dateFilterOptions.find(opt => opt.id === dateRange)?.label || dateRange;

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
            {t('adminReportsTitle')}
          </h1>
          <p style={{ fontSize: '12px', color: '#A0A0A0', margin: '4px 0 0 0' }}>
            {t('adminReportsSub')}
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCSV}
          disabled={exportingCsv}
          style={{
            background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)',
            border: 'none', color: '#050505', padding: '8px 18px', borderRadius: '10px',
            fontSize: '12px', fontWeight: 900,
            cursor: exportingCsv ? 'wait' : 'pointer',
            opacity: exportingCsv ? 0.7 : 1,
            display: 'flex', alignItems: 'center', gap: '6px'
          }}
        >
          <Download size={15} /> {exportingCsv ? t('exportingCsvProgress') : t('exportTypeCsvBtn', { type: activeModuleLabel })}
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

      {/* Date Range Selector Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        background: '#121212',
        border: '1px solid rgba(212, 175, 55, 0.15)',
        borderRadius: '12px',
        padding: '10px 16px',
        marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <Calendar size={14} color="#D4AF37" style={{ marginRight: '6px' }} />
          {dateFilterOptions.map(opt => (
            <button
              type="button"
              key={opt.id}
              onClick={() => setDateRange(opt.id)}
              style={{
                background: dateRange === opt.id ? 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)' : '#1A1A1A',
                color: dateRange === opt.id ? '#050505' : '#A0A0A0',
                border: 'none', padding: '5px 12px', borderRadius: '6px', fontSize: '11px',
                fontWeight: dateRange === opt.id ? 800 : 600, cursor: 'pointer'
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => fetchReport(reportType, dateRange)}
          style={{ background: 'none', border: 'none', color: '#D4AF37', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <RefreshCw size={13} className={loading ? 'spin' : ''} /> {t('refreshDataBtn')}
        </button>
      </div>

      {/* Report Dimension Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid rgba(212, 175, 55, 0.2)',
        marginBottom: '20px',
        background: '#0D0D0D',
        borderRadius: '12px 12px 0 0',
        padding: '0 10px',
        overflowX: 'auto'
      }}>
        {reportModules.map(m => {
          const Icon = m.icon;
          return (
            <button
              type="button"
              key={m.id}
              onClick={() => setReportType(m.id)}
              style={{
                padding: '14px 18px',
                background: 'none',
                border: 'none',
                borderBottom: reportType === m.id ? '3px solid #D4AF37' : '3px solid transparent',
                color: reportType === m.id ? '#F2D675' : '#888',
                fontWeight: reportType === m.id ? 800 : 600,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                whiteSpace: 'nowrap'
              }}
            >
              <Icon size={16} /> {m.label}
            </button>
          );
        })}
      </div>

      {/* Aggregated KPI Summary Cards for Current Report */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '14px',
        marginBottom: '24px'
      }}>
        {Object.entries(summary).map(([key, val], idx) => {
          const INR_KEYS = new Set(['recorded_revenue', 'total_refunds', 'net_revenue', 'amount', 'refund_amount', 'total_amount']);
          const COIN_KEYS = new Set([
            'total_coins_issued', 'total_coins_redeemed', 'outstanding_liability',
            'total_coins_earned', 'total_coins_transferred', 'points',
            'previous_balance', 'new_balance', 'coins_awarded', 'coins_earned',
            'coins_amount', 'total_discount_inr', 'discount_inr'
          ]);
          const headingText = key === 'total_discount_inr'
            ? 'total coins discount'
            : key === 'discount_inr'
              ? 'coins discount'
              : key.replace(/_/g, ' ');
          const displayVal = val === null || val === undefined
            ? '—'
            : INR_KEYS.has(key)
              ? formatInr(val, locale)
              : COIN_KEYS.has(key)
                ? formatCoins(val, locale, t('coinsUnit'))
                : typeof val === 'number'
                  ? formatNumber(val, locale)
                  : String(val);

          return (
            <div
              key={idx}
              style={{
                background: '#0E0E0E',
                border: '1px solid rgba(212, 175, 55, 0.2)',
                borderRadius: '14px',
                padding: '16px'
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0', textTransform: 'uppercase' }}>
                {headingText}
              </span>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#F2D675', marginTop: '4px' }}>
                {displayVal}
              </div>
            </div>
          );
        })}
      </div>

      {/* Report Data Table */}
      <div style={{
        background: '#0D0D0D',
        borderRadius: '16px',
        border: '1px solid rgba(212, 175, 55, 0.2)',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
            {t('reportDataRecordsHeading', { type: activeModuleLabel })}
          </h3>
          <span style={{ fontSize: '11px', color: '#A0A0A0' }}>
            {t('rowsLoadedForTimeframe', { count: dataRows.length, range: activeRangeLabel })}
          </span>
        </div>

        <div style={{ overflowX: 'auto', maxHeight: '500px' }}>
          {dataRows.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#121212', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', color: '#A0A0A0', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase' }}>
                  {Object.keys(dataRows[0]).slice(0, 8).map((col, idx) => (
                    <th key={idx} style={{ padding: '12px 14px' }}>
                      {col === 'total_discount_inr' ? 'total coins discount' : col === 'discount_inr' ? 'coins discount' : col.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.map((row, rIdx) => (
                  <tr key={rIdx} style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.08)' }}>
                    {Object.keys(dataRows[0]).slice(0, 8).map((col, cIdx) => {
                      const raw = row[col];
                      const INR_COLS = new Set(['amount', 'refund_amount', 'total_amount']);
                      const COIN_COLS = new Set(['points', 'previous_balance', 'new_balance', 'coins_awarded', 'coins_earned', 'coins_amount', 'discount_inr']);
                      let formattedCell = '—';
                      if (raw !== null && raw !== undefined) {
                        if (INR_COLS.has(col)) formattedCell = formatInr(raw, locale);
                        else if (COIN_COLS.has(col)) formattedCell = formatCoins(raw, locale, t('coinsUnit'));
                        else formattedCell = String(raw);
                      }
                      return (
                        <td key={cIdx} style={{ padding: '10px 14px', color: cIdx === 0 ? '#D4AF37' : '#E0E0E0' }}>
                          {formattedCell}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: '#888', fontSize: '13px' }}>
              {loading ? t('compilingReportMetrics') : t('noRecordsSelectedTimeframe')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
