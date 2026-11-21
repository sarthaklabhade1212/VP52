import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { parseApiResponse } from '../../utils/api';
import { formatCoins } from '../../utils/formatters';
import { Receipt, Sparkles, ShoppingBag, Clock, CheckCircle2 } from 'lucide-react';

export default function AdminTransactions() {
  const { token } = useAuth();
  const { t, locale } = useI18n();
  const [activeTab, setActiveTab] = useState('redemptions');
  const [rewardTx, setRewardTx] = useState([]);
  const [redemptionTx, setRedemptionTx] = useState([]);
  const [loading, setLoading] = useState(true);

  const getStatusLabel = (status) => {
    const key = `adminStatusLabel_${String(status || '').toLowerCase()}`;
    const res = t(key);
    return res === key ? status : res;
  };

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/transactions/rewards', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/admin/transactions/redemptions', { headers: { Authorization: `Bearer ${token}` } })
    ])
      .then(async ([r1, r2]) => {
        const [p1, p2] = await Promise.all([parseApiResponse(r1), parseApiResponse(r2)]);
        const d1 = p1.data;
        const d2 = p2.data;
        if (p1.ok && d1 && d1.success) setRewardTx(d1.rewards || []);
        if (p2.ok && d2 && d2.success) setRedemptionTx(d2.redemptions || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div style={{ background: '#050505' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 800 }}>
          <Receipt size={26} color="#D4AF37" /> {t('adminAuditTxTitle')}
        </h2>
        <p style={{ fontSize: '14px', color: '#B8B8B8' }}>
          {t('adminAuditTxSub')}
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setActiveTab('redemptions')}
          className={activeTab === 'redemptions' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '10px 18px', fontSize: '13px', borderRadius: '10px' }}
        >
          <ShoppingBag size={16} color={activeTab === 'redemptions' ? '#050505' : '#D4AF37'} /> {t('tabShopRedemptionsCount', { count: redemptionTx.length })}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rewards')}
          className={activeTab === 'rewards' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '10px 18px', fontSize: '13px', borderRadius: '10px' }}
        >
          <Sparkles size={16} color={activeTab === 'rewards' ? '#050505' : '#D4AF37'} /> {t('tabRewardTransactionsCount', { count: rewardTx.length })}
        </button>
      </div>

      <div style={{ background: '#111111', borderRadius: '16px', border: '1px solid rgba(212, 175, 55, 0.15)', overflow: 'hidden' }}>
        {activeTab === 'redemptions' ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#151515', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', color: '#B8B8B8', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase' }}>
                <th style={{ padding: '14px 20px' }}>{t('colCode')}</th>
                <th style={{ padding: '14px 20px' }}>{t('colCustomer')}</th>
                <th style={{ padding: '14px 20px' }}>{t('physicalShopLabel')}</th>
                <th style={{ padding: '14px 20px' }}>{t('colDiscount')}</th>
                <th style={{ padding: '14px 20px' }}>{t('colPointsDeducted')}</th>
                <th style={{ padding: '14px 20px' }}>{t('colStatus')}</th>
                <th style={{ padding: '14px 20px' }}>{t('colDate')}</th>
              </tr>
            </thead>
            <tbody>
              {redemptionTx.map((tx) => (
                <tr key={tx.id} style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.1)' }}>
                  <td style={{ padding: '14px 20px', fontWeight: 800, color: '#F2D675' }}>{tx.redemption_code}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ fontWeight: 700, color: '#FFFFFF', display: 'block' }}>{tx.customer_name}</span>
                    <span style={{ fontSize: '12px', color: '#B8B8B8' }}>{tx.customer_email}</span>
                  </td>
                  <td style={{ padding: '14px 20px', fontWeight: 700, color: '#FFFFFF' }}>{tx.shop_name}</td>
                  <td style={{ padding: '14px 20px', fontWeight: 800, color: '#D4AF37' }}>{t('pctOffLabel', { pct: tx.discount_percent })}</td>
                  <td style={{ padding: '14px 20px', fontWeight: 700, color: '#ef4444' }}>-{formatCoins(tx.points_deducted, locale, t('coinsUnit'))}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <span className={`badge ${tx.status === 'ACTIVE' ? 'badge-active' : tx.status === 'USED' ? 'badge-used' : 'badge-expired'}`}>
                      {getStatusLabel(tx.status)}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: '12px', color: '#B8B8B8' }}>
                    {new Date(tx.created_at).toLocaleString(locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#151515', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', color: '#B8B8B8', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase' }}>
                <th style={{ padding: '14px 20px' }}>{t('colTxId')}</th>
                <th style={{ padding: '14px 20px' }}>{t('colCustomer')}</th>
                <th style={{ padding: '14px 20px' }}>{t('colActivity')}</th>
                <th style={{ padding: '14px 20px' }}>{t('colPointsEarned')}</th>
                <th style={{ padding: '14px 20px' }}>{t('colTimestamp')}</th>
              </tr>
            </thead>
            <tbody>
              {rewardTx.map((tx) => (
                <tr key={tx.id} style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.1)' }}>
                  <td style={{ padding: '14px 20px', fontWeight: 700, color: '#B8B8B8' }}>#{tx.id}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ fontWeight: 700, color: '#FFFFFF', display: 'block' }}>{tx.customer_name}</span>
                    <span style={{ fontSize: '12px', color: '#B8B8B8' }}>{tx.customer_email}</span>
                  </td>
                  <td style={{ padding: '14px 20px', fontWeight: 600, color: '#B8B8B8' }}>{tx.activity_type}</td>
                  <td style={{ padding: '14px 20px', fontWeight: 800, color: '#F2D675' }}>+{formatCoins(tx.points, locale, t('coinsUnit'))}</td>
                  <td style={{ padding: '14px 20px', fontSize: '12px', color: '#B8B8B8' }}>
                    {new Date(tx.created_at).toLocaleString(locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
