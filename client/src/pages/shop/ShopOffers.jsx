import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Tag, Calendar, ShieldCheck, Plus, Trash2 } from 'lucide-react';

export default function ShopOffers() {
  const { token } = useAuth();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/merchant/offers', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => { if (data.success) setOffers(data.offers || []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '24px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
            <Tag size={26} color="#10b981" /> Store Promotional Offers
          </h2>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
            Active discount percentage offers available for customer coin redemptions at checkout.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
        {offers.map(o => (
          <div key={o.id} style={{ background: '#ffffff', borderRadius: '20px', padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <span style={{ fontSize: '26px', fontWeight: 800, color: '#10b981' }}>{o.discount_percent}% OFF</span>
              <span className="badge badge-active">{o.status}</span>
            </div>

            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>{o.title}</h3>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '14px' }}>
              Maximum Discount: <strong style={{ color: '#0f172a' }}>₹{o.max_discount_inr}</strong>
            </p>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #f1f5f9', fontSize: '12px', color: '#64748b' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                <Calendar size={14} /> Valid until {new Date(o.valid_until).toLocaleDateString()}
              </span>
              <span style={{ color: '#059669', fontWeight: 700 }}>Active</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '24px', background: '#ecfdf5', padding: '16px', borderRadius: '16px', border: '1px solid #a7f3d0', fontSize: '12px', color: '#047857', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <ShieldCheck size={20} color="#059669" style={{ flexShrink: 0 }} />
        <span>How it works: When a customer visits your store, your promotional offer percentage (e.g. 10%) combines with their membership tier cap and available coins to calculate their instant bill discount!</span>
      </div>
    </div>
  );
}
