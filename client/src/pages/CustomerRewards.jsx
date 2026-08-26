import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Tag, Store, ShieldCheck, X, QrCode, MapPin, CheckCircle2, ChevronRight, Award, Info, Sparkles } from 'lucide-react';

export default function CustomerRewards() {
  const navigate = useNavigate();
  const { user, token } = useAuth();

  const [offers, setOffers] = useState([]);
  const [shops, setShops] = useState([]);
  const [levelInfo, setLevelInfo] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);

  // Selected Offer Modal State
  const [selectedOffer, setSelectedOffer] = useState(null);

  const fetchOffersAndShops = async () => {
    try {
      const res = await fetch('/api/customer/shops', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setOffers(data.offers || []);
        setShops(data.shops || []);
      }
    } catch (err) {
      console.error('Fetch offers error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLevelInfo = async () => {
    try {
      const res = await fetch('/api/customer/level', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setLevelInfo(data);
    } catch (err) {
      console.error('Fetch level error:', err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchOffersAndShops();
      fetchLevelInfo();
    }
  }, [token]);

  const categories = ['All', ...new Set(shops.map(s => s.category))];

  const filteredOffers = selectedCategory === 'All'
    ? offers
    : offers.filter(o => o.shop_category === selectedCategory);

  const availableCoins = user ? (user.available_coins || user.balance || 0) : 0;
  const currentLevel = levelInfo ? levelInfo.currentLevel : 'Basic';
  const discountCapPercent = levelInfo ? levelInfo.discountCapPercent : 5;

  return (
    <div style={{ padding: '20px', maxWidth: '700px', margin: '0 auto' }}>
      {/* Header & Level Summary */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '22px', color: '#0f172a', marginBottom: '4px', fontWeight: 800 }}>
          Merchant Offers & Discounts
        </h2>
        <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
          Visit partner stores, present your QR code, and redeem available coins for instant savings!
        </p>
      </div>

      {/* Customer Status Summary Bar */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        borderRadius: '20px',
        padding: '16px 20px',
        color: '#ffffff',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 8px 20px rgba(15,23,42,0.15)'
      }}>
        <div>
          <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em', display: 'block' }}>
            YOUR MEMBERSHIP TIER
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
            <span style={{ fontSize: '16px', fontWeight: 800, color: '#f59e0b' }}>🏆 {currentLevel} MEMBER</span>
            <span style={{ fontSize: '12px', background: '#334155', padding: '2px 8px', borderRadius: '6px', color: '#10b981', fontWeight: 700 }}>
              Up to {discountCapPercent}% Max Cap
            </span>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em', display: 'block' }}>
            AVAILABLE COINS
          </span>
          <span style={{ fontSize: '20px', fontWeight: 800, color: '#a7f3d0' }}>
            🪙 {availableCoins.toLocaleString()}
          </span>
          <span style={{ fontSize: '11px', color: '#cbd5e1', display: 'block' }}>
            (₹{availableCoins.toLocaleString()} Value)
          </span>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '20px' }}>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            style={{
              padding: '8px 16px',
              borderRadius: '99px',
              border: 'none',
              fontSize: '12px',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              background: selectedCategory === cat ? '#4f46e5' : '#ffffff',
              color: selectedCategory === cat ? '#ffffff' : '#64748b',
              boxShadow: selectedCategory === cat ? '0 4px 12px rgba(79, 70, 229, 0.2)' : 'none'
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Offers Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {filteredOffers.map((offer) => (
          <div
            key={offer.id}
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              overflow: 'hidden',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 15px rgba(0,0,0,0.03)'
            }}
          >
            <div style={{ position: 'relative', height: '130px' }}>
              <img
                src={offer.shop_image}
                alt={offer.shop_name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to top, rgba(15,23,42,0.85) 0%, transparent 60%)'
              }} />

              {/* Promotional Discount Badge */}
              <div style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                fontWeight: 800,
                fontSize: '14px',
                padding: '6px 14px',
                borderRadius: '99px',
                boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)'
              }}>
                {offer.discount_percent}% OFF
              </div>

              <div style={{ position: 'absolute', bottom: '12px', left: '16px', color: 'white' }}>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#c7d2fe', fontWeight: 800 }}>
                  {offer.shop_category}
                </span>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '2px 0 0 0' }}>{offer.shop_name}</h3>
              </div>
            </div>

            <div style={{ padding: '18px' }}>
              <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
                {offer.title}
              </h4>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '12px', color: '#64748b', marginBottom: '14px' }}>
                <span>Maximum Discount: <strong style={{ color: '#0f172a' }}>₹{offer.max_discount_inr}</strong></span>
                <span>•</span>
                <span>Valid until: <strong>{new Date(offer.valid_until).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></span>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '14px',
                borderTop: '1px solid #f1f5f9'
              }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: 700 }}>YOUR AVAILABLE COINS</span>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#4f46e5' }}>
                    🪙 {availableCoins.toLocaleString()} Coins (₹{availableCoins.toLocaleString()})
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedOffer(offer)}
                  className="btn-primary"
                  style={{ padding: '10px 18px', fontSize: '13px', borderRadius: '12px' }}
                >
                  View Offer Details <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* OFFER DETAILS MODAL */}
      {selectedOffer && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(6px)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{ background: '#ffffff', borderRadius: '24px', maxWidth: '440px', width: '100%', padding: '24px' }} className="animate-slide-up">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Store size={20} color="#4f46e5" />
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0 }}>{selectedOffer.shop_name}</h3>
              </div>
              <button type="button" onClick={() => setSelectedOffer(null)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <X size={20} color="#64748b" />
              </button>
            </div>

            <div style={{ background: 'linear-gradient(135deg, #ecfdf5 0%, #dcfce7 100%)', border: '1px solid #a7f3d0', borderRadius: '16px', padding: '16px', marginBottom: '16px' }}>
              <span style={{ fontSize: '11px', color: '#059669', fontWeight: 800, textTransform: 'uppercase' }}>{selectedOffer.shop_category}</span>
              <h4 style={{ fontSize: '17px', fontWeight: 800, color: '#065f46', margin: '4px 0' }}>
                {selectedOffer.discount_percent}% OFF — {selectedOffer.title}
              </h4>
              <span style={{ fontSize: '13px', color: '#047857', fontWeight: 700 }}>
                Maximum Discount: ₹{selectedOffer.max_discount_inr} • Valid until {new Date(selectedOffer.valid_until).toLocaleDateString()}
              </span>
            </div>

            {/* Contextual Calculation Breakdown */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Your Membership Tier:</span>
                <span style={{ fontWeight: 800, color: '#f59e0b' }}>🏆 {currentLevel}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Level Maximum Discount Cap:</span>
                <span style={{ fontWeight: 800, color: '#10b981' }}>Up to {discountCapPercent}% Max</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Your Available Coins:</span>
                <span style={{ fontWeight: 800, color: '#4f46e5' }}>🪙 {availableCoins} (₹{availableCoins} Value)</span>
              </div>

              <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '8px', fontSize: '12px', color: '#475569', lineHeight: 1.4 }}>
                💡 <strong>How it works at store checkout:</strong> When you present your Customer QR code, the merchant generates your itemized bill. The system automatically applies the offer discount (up to your {discountCapPercent}% level cap) using your available coins!
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                onClick={() => { setSelectedOffer(null); navigate('/customer/profile'); }}
                className="btn-primary"
                style={{ width: '100%', padding: '14px', fontSize: '15px', justifyContent: 'center' }}
              >
                <QrCode size={18} /> Show Customer QR to Merchant
              </button>

              <button
                type="button"
                onClick={() => setSelectedOffer(null)}
                className="btn-secondary"
                style={{ width: '100%', padding: '12px', fontSize: '13px', justifyContent: 'center' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
