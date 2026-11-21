import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { parseApiResponse } from '../../utils/api';
import { History, Filter, CheckCircle2, Clock } from 'lucide-react';

export default function ShopHistory() {
  const { token } = useAuth();
  const { t, locale } = useI18n();
  const [history, setHistory] = useState([]);
  const [timeFilter, setTimeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const fetchHistory = () => {
    const query = new URLSearchParams({ timeFilter, statusFilter }).toString();
    fetch(`/api/shop/history?${query}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(parseApiResponse)
      .then(parsed => {
        const data = parsed.data;
        if (parsed.ok && data && data.success) setHistory(data.history || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchHistory();
  }, [token, timeFilter, statusFilter]);

  return (
    <div style={{ background: '#050505' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '24px', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
            <History size={26} color="#D4AF37" /> {t('storeRedemptionHistoryTitle')}
          </h2>
          <p style={{ fontSize: '14px', color: '#B8B8B8' }}>
            {t('storeRedemptionHistorySub')}
          </p>
        </div>

        {/* Filter Controls */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <select
            className="form-input"
            style={{ padding: '8px 12px', fontSize: '13px', borderRadius: '10px', background: '#111111', color: '#FFFFFF', border: '1px solid #303030' }}
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
          >
            <option value="all">{t('timeAllTime')}</option>
            <option value="today">{t('timeToday')}</option>
            <option value="week">{t('timeThisWeek')}</option>
            <option value="month">{t('timeThisMonth')}</option>
          </select>

          <select
            className="form-input"
            style={{ padding: '8px 12px', fontSize: '13px', borderRadius: '10px', background: '#111111', color: '#FFFFFF', border: '1px solid #303030' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">{t('statusAllOption')}</option>
            <option value="USED">{t('statusUsedOption')}</option>
            <option value="ACTIVE">{t('statusActiveOption')}</option>
          </select>
        </div>
      </div>

      {/* History Table */}
      <div style={{ background: '#111111', borderRadius: '16px', border: '1px solid rgba(212, 175, 55, 0.15)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: '#151515', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', color: '#B8B8B8', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase' }}>
              <th style={{ padding: '14px 20px' }}>{t('redemptionIdCol')}</th>
              <th style={{ padding: '14px 20px' }}>{t('customerLabel')}</th>
              <th style={{ padding: '14px 20px' }}>{t('offerAppliedCol')}</th>
              <th style={{ padding: '14px 20px' }}>{t('discountCol')}</th>
              <th style={{ padding: '14px 20px' }}>{t('pointsUsedCol')}</th>
              <th style={{ padding: '14px 20px' }}>{t('statusCol')}</th>
              <th style={{ padding: '14px 20px' }}>{t('dateTimeCol')}</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#B8B8B8' }}>
                  {t('noRedemptionsFiltered')}
                </td>
              </tr>
            ) : (
              history.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.1)' }}>
                  <td style={{ padding: '14px 20px', fontWeight: 800, color: '#F2D675' }}>{r.redemption_code}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ fontWeight: 700, color: '#FFFFFF', display: 'block' }}>{r.customer_name}</span>
                    <span style={{ fontSize: '12px', color: '#B8B8B8' }}>{r.customer_email}</span>
                  </td>
                  <td style={{ padding: '14px 20px', color: '#B8B8B8' }}>{r.offer_title}</td>
                  <td style={{ padding: '14px 20px', fontWeight: 800, color: '#D4AF37' }}>{r.discount_percent}% {t('offUpper')} ({t('maxCapShort')} {Number(r.max_discount_inr || 0).toLocaleString(locale)})</td>
                  <td style={{ padding: '14px 20px', fontWeight: 700, color: '#F2D675' }}>🪙 {Number(r.points_deducted || 0).toLocaleString(locale)} {t('ptsSuffix')}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <span className={`badge ${r.status === 'USED' ? 'badge-used' : r.status === 'ACTIVE' ? 'badge-active' : 'badge-expired'}`}>
                      {r.status === 'USED' ? t('statusUsed') : r.status === 'ACTIVE' ? t('statusActive') : t('statusExpired')}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: '12px', color: '#B8B8B8' }}>
                    {new Date(r.redeemed_at || r.created_at).toLocaleString(locale)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
