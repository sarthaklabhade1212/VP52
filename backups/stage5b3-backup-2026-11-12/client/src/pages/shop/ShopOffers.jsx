import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { parseApiResponse } from '../../utils/api';
import { Tag, Calendar, ShieldCheck, Plus, Trash2 } from 'lucide-react';

export default function ShopOffers() {
  const { token } = useAuth();
  const { t, locale } = useI18n();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/merchant/offers', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(parseApiResponse)
      .then(parsed => {
        const data = parsed.data;
        if (parsed.ok && data && data.success) setOffers(data.offers || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div style={{ maxWidth: '900px', background: '#050505' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '24px', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
            <Tag size={26} color="#D4AF37" /> {t('storePromotionalOffersTitle')}
          </h2>
          <p style={{ fontSize: '14px', color: '#B8B8B8', margin: 0 }}>
            {t('storePromotionalOffersSub')}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
        {offers.map(o => (
          <div key={o.id} style={{ background: '#111111', borderRadius: '20px', padding: '20px', border: '1px solid rgba(212, 175, 55, 0.15)', boxShadow: '0 8px 30px rgba(0,0,0,0.35)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <span style={{ fontSize: '26px', fontWeight: 800, color: '#F2D675' }}>{o.discount_percent}% {t('offUpper')}</span>
              <span className="badge badge-active">
                {String(o.status || '').toLowerCase() === 'active' ? t('statusActive') : o.status}
              </span>
            </div>

            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF', marginBottom: '4px' }}>{o.title}</h3>
            <p style={{ fontSize: '13px', color: '#B8B8B8', marginBottom: '14px' }}>
              {t('maxDiscountLabel')}: <strong style={{ color: '#F2D675' }}>{Number(o.max_discount_inr || 0).toLocaleString(locale)}</strong>
            </p>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid rgba(212, 175, 55, 0.15)', fontSize: '12px', color: '#B8B8B8' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                <Calendar size={14} color="#D4AF37" /> {t('validUntilLabel')} {new Date(o.valid_until).toLocaleDateString(locale)}
              </span>
              <span style={{ color: '#F2D675', fontWeight: 700 }}>{t('statusActive')}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '24px', background: '#151515', padding: '16px', borderRadius: '16px', border: '1px solid rgba(212, 175, 55, 0.3)', fontSize: '12px', color: '#F2D675', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <ShieldCheck size={20} color="#D4AF37" style={{ flexShrink: 0 }} />
        <span style={{ color: '#B8B8B8' }}>{t('offersHowItWorksNotice')}</span>
      </div>
    </div>
  );
}
