import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { parseApiResponse, resolveApiErrorMessage, resolveNetworkErrorMessage } from '../../utils/api';
import { Store, CheckCircle2, XCircle, AlertTriangle, ShieldCheck, MapPin } from 'lucide-react';

export default function AdminMerchantVerification() {
  const { token } = useAuth();
  const { t, translateCategory } = useI18n();
  const [pendingShops, setPendingShops] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPendingQueue = () => {
    fetch('/api/admin/merchants/pending', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(parseApiResponse)
      .then(parsed => {
        const d = parsed.data;
        if (parsed.ok && d && d.success) setPendingShops(d.shops || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPendingQueue();
  }, [token]);

  const handleVerifyAction = async (shopId, action) => {
    try {
      let url = `/api/admin/shops/${shopId}/approve`;
      let body = {};
      if (action === 'rejected') {
        const reason = prompt(t('promptRejectMerchantReason'));
        if (!reason) return;
        url = `/api/admin/shops/${shopId}/reject`;
        body = { reason };
      }

      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      const parsed = await parseApiResponse(res);
      const data = parsed.data;
      if (parsed.ok && data && data.success) {
        fetchPendingQueue();
      } else {
        alert(resolveApiErrorMessage(parsed, t, 'failedUpdateMerchantStatus'));
      }
    } catch (e) {
      console.error(e);
      alert(resolveNetworkErrorMessage(e, t, 'failedUpdateMerchantStatus'));
    }
  };

  return (
    <div style={{ background: '#050505' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
          <ShieldCheck size={26} color="#D4AF37" /> {t('adminMerchantVerifTitle')}
        </h2>
        <p style={{ fontSize: '14px', color: '#B8B8B8' }}>
          {t('adminMerchantVerifSub')}
        </p>
      </div>

      {pendingShops.length === 0 ? (
        <div style={{ background: '#111111', borderRadius: '20px', padding: '40px', textAlign: 'center', color: '#B8B8B8', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
          <CheckCircle2 size={38} color="#F2D675" style={{ margin: '0 auto 10px auto' }} />
          <h3 style={{ fontSize: '18px', color: '#FFFFFF', fontWeight: 800 }}>{t('verifQueueClearTitle')}</h3>
          <p style={{ fontSize: '13px', color: '#B8B8B8' }}>{t('verifQueueClearDesc')}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {pendingShops.map(s => (
            <div key={s.id} style={{ background: '#111111', borderRadius: '20px', padding: '24px', border: '1px solid rgba(212, 175, 55, 0.3)', boxShadow: '0 8px 30px rgba(0,0,0,0.35)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <span className="badge badge-expired" style={{ background: '#151515', border: '1px solid rgba(212, 175, 55, 0.3)', color: '#F2D675', fontWeight: 800 }}>
                  {t('pendingVerificationBadge')}
                </span>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#F2D675' }}>{s.shop_code}</span>
              </div>

              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#FFFFFF', marginBottom: '2px' }}>{s.name}</h3>
              <p style={{ fontSize: '12px', color: '#B8B8B8', marginBottom: '12px' }}>
                {t('ownerPrefixLabel')} <strong style={{ color: '#FFFFFF' }}>{s.owner_name || t('naLabel')}</strong> • {t('categoryPrefixLabel')} <strong style={{ color: '#D4AF37' }}>{s.category ? translateCategory(s.category) : t('naLabel')}</strong>
              </p>

              <div style={{ fontSize: '12px', color: '#B8B8B8', background: '#151515', padding: '10px', borderRadius: '10px', marginBottom: '16px', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
                <div>📍 <strong>{t('addressBoldLabel')}</strong> {s.address}</div>
                <div>📧 <strong>{t('emailBoldLabel')}</strong> {s.email}</div>
                <div>📞 <strong>{t('phoneBoldLabel')}</strong> {s.phone || t('naLabel')}</div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => handleVerifyAction(s.id, 'approved')}
                  className="btn-primary"
                  style={{ flex: 1, padding: '10px', fontSize: '13px', justifyContent: 'center' }}
                >
                  <CheckCircle2 size={16} color="#050505" /> {t('adminApproveBtn')}
                </button>
                <button
                  type="button"
                  onClick={() => handleVerifyAction(s.id, 'rejected')}
                  style={{ flex: 1, padding: '10px', fontSize: '13px', justifyContent: 'center', background: '#151515', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <XCircle size={16} color="#ef4444" /> {t('adminRejectBtn')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
