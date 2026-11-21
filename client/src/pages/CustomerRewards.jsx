import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { parseApiResponse, resolveApiErrorMessage, resolveMediaUrl, resolveNetworkErrorMessage } from '../utils/api';
import { formatInr, formatNumber } from '../utils/formatters';
import { Store, X, QrCode, CheckCircle2, ChevronRight } from 'lucide-react';

const VP52_TIERS = [
  'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Titanium',
  'Ruby', 'Crown', 'Royal', 'Elite', 'Legend', 'VIP'
];

export default function CustomerRewards() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const { t, locale, translateCategory } = useI18n();

  const [offers, setOffers] = useState([]);
  const [shops, setShops] = useState([]);
  const [levelInfo, setLevelInfo] = useState(null);
  const [tierBreakdown, setTierBreakdown] = useState({});
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);

  // Selected Offer Modal State
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [selectedTier, setSelectedTier] = useState('Bronze');
  const [redeemResult, setRedeemResult] = useState(null);
  const [redeemError, setRedeemError] = useState(null);
  const [isRedeeming, setIsRedeeming] = useState(false);

  const fetchOffersAndShops = async () => {
    try {
      const res = await fetch('/api/customer/shops', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = await parseApiResponse(res);
      const data = parsed.data;
      if (parsed.ok && data && data.success) {
        setOffers(data.offers || []);
        setShops(data.shops || []);
      }
    } catch (err) {
      console.error('Fetch offers error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchWalletAndLevel = async () => {
    try {
      const [levelRes, walletRes] = await Promise.all([
        fetch('/api/customer/level', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/customer/wallet', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const [levelParsed, walletParsed] = await Promise.all([
        parseApiResponse(levelRes),
        parseApiResponse(walletRes)
      ]);
      const levelData = levelParsed.data;
      const walletData = walletParsed.data;

      if (levelParsed.ok && levelData && levelData.success) setLevelInfo(levelData);
      if (walletParsed.ok && walletData && walletData.success && walletData.wallet) {
        setTierBreakdown(walletData.wallet.tier_breakdown || {});
      }
    } catch (err) {
      console.error('Fetch wallet/level error:', err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchOffersAndShops();
      fetchWalletAndLevel();
    }
  }, [token]);

  const categories = ['All', ...new Set(shops.map(s => s.category).filter(Boolean))];

  const filteredOffers = selectedCategory === 'All'
    ? offers
    : offers.filter(o => o.shop_category === selectedCategory);

  const availableCoins = user ? (user.available_coins || user.balance || 0) : 0;
  const currentLevel = levelInfo ? levelInfo.currentLevel : 'Basic';
  const discountCapPercent = levelInfo ? levelInfo.discountCapPercent : 5;

  const handleRedeemTierOffer = async () => {
    if (!selectedOffer) return;
    setIsRedeeming(true);
    setRedeemError(null);
    setRedeemResult(null);

    try {
      const res = await fetch('/api/customer/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          offer_id: selectedOffer.id,
          selected_tier: selectedTier
        })
      });

      const parsed = await parseApiResponse(res);
      const data = parsed.data;
      if (!parsed.ok || !data || !data.success) {
        setRedeemError(resolveApiErrorMessage(parsed, t, 'failedRedeemOffer'));
        return;
      }

      setRedeemResult(data.redemption);
      fetchWalletAndLevel();
    } catch (err) {
      setRedeemError(resolveNetworkErrorMessage(err, t, 'failedRedeemOffer'));
    } finally {
      setIsRedeeming(false);
    }
  };

  const getOfferDiscountForTier = (offer, tier) => {
    if (!offer) return 0;
    if (offer.tier_discounts) {
      try {
        const parsed = JSON.parse(offer.tier_discounts);
        if (parsed && parsed[tier] !== undefined) {
          return parseInt(parsed[tier], 10);
        }
      } catch (e) {}
    }
    return offer.discount_percent;
  };

  return (
    <div style={{ padding: '20px', maxWidth: '700px', margin: '0 auto', background: '#050505', minHeight: '100vh' }}>
      {/* Header & Summary */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '22px', color: '#FFFFFF', marginBottom: '4px', fontWeight: 800 }}>
          {t('merchantOffersTitle')}
        </h2>
        <p style={{ fontSize: '13px', color: '#B8B8B8', margin: 0 }}>
          {t('merchantOffersSubtitle')}
        </p>
      </div>

      {/* Customer Status Summary Bar */}
      <div style={{
        background: '#111111',
        border: '1px solid rgba(212, 175, 55, 0.25)',
        borderRadius: '20px',
        padding: '16px 20px',
        color: '#FFFFFF',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 8px 30px rgba(0,0,0,0.35)'
      }}>
        <div>
          <span style={{ fontSize: '11px', color: '#B8B8B8', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em', display: 'block' }}>
            {t('yourMembershipTier')}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
            <span style={{ fontSize: '16px', fontWeight: 800, color: '#F2D675' }}>🏆 {t(`tier_${currentLevel}`) !== `tier_${currentLevel}` ? t(`tier_${currentLevel}`) : currentLevel} {t('memberBadge')}</span>
            <span style={{ fontSize: '12px', background: '#151515', border: '1px solid rgba(212, 175, 55, 0.3)', padding: '2px 8px', borderRadius: '6px', color: '#D4AF37', fontWeight: 700 }}>
              {t('upToMaxCap', { cap: discountCapPercent })}
            </span>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '11px', color: '#B8B8B8', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em', display: 'block' }}>
            {t('totalCoinBalance')}
          </span>
          <span style={{ fontSize: '20px', fontWeight: 800, color: '#F2D675' }}>
            🪙 {formatNumber(availableCoins, locale)} <span style={{ fontSize: '13px', fontWeight: 700, color: '#FFFFFF' }}>{t('coinsUnit')}</span>
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
              border: selectedCategory === cat ? '1px solid #D4AF37' : '1px solid rgba(212, 175, 55, 0.15)',
              fontSize: '12px',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              background: selectedCategory === cat ? 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)' : '#111111',
              color: selectedCategory === cat ? '#050505' : '#B8B8B8',
              boxShadow: selectedCategory === cat ? '0 4px 12px rgba(212, 175, 55, 0.25)' : 'none'
            }}
          >
            {cat === 'All' ? t('categoryAll') : translateCategory(cat)}
          </button>
        ))}
      </div>

      {/* Offers Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {filteredOffers.map((offer) => (
          <div
            key={offer.id}
            style={{
              background: '#111111',
              borderRadius: '20px',
              overflow: 'hidden',
              border: '1px solid rgba(212, 175, 55, 0.15)',
              boxShadow: '0 8px 30px rgba(0,0,0,0.35)'
            }}
          >
            <div style={{ position: 'relative', height: '130px' }}>
              <img
                src={resolveMediaUrl(offer.shop_image)}
                alt={offer.shop_name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to top, #111111 0%, transparent 70%)'
              }} />

              <div style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)',
                color: '#050505',
                fontWeight: 800,
                fontSize: '14px',
                padding: '6px 14px',
                borderRadius: '99px',
                boxShadow: '0 4px 12px rgba(212, 175, 55, 0.3)'
              }}>
                {offer.discount_percent}% {t('offUpper')}
              </div>

              <div style={{ position: 'absolute', bottom: '12px', left: '16px', color: '#FFFFFF' }}>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#D4AF37', fontWeight: 800 }}>
                  {translateCategory(offer.shop_category)}
                </span>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '2px 0 0 0', color: '#FFFFFF' }}>{offer.shop_name}</h3>
              </div>
            </div>

            <div style={{ padding: '18px' }}>
              <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF', marginBottom: '6px' }}>
                {offer.title}
              </h4>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '12px', color: '#B8B8B8', marginBottom: '14px' }}>
                <span>{t('maxDiscountLabel')}: <strong style={{ color: '#F2D675' }}>{formatInr(offer.max_discount_inr, locale)}</strong></span>
                <span>•</span>
                <span>{t('validUntilLabel')}: <strong>{new Date(offer.valid_until).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}</strong></span>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '14px',
                borderTop: '1px solid rgba(212, 175, 55, 0.15)'
              }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block', fontWeight: 700 }}>{t('availableCoins')}</span>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#F2D675' }}>
                    🪙 {availableCoins.toLocaleString(locale)} {t('coinsUnit')}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => { setSelectedOffer(offer); setSelectedTier('Bronze'); setRedeemResult(null); setRedeemError(null); }}
                  className="btn-primary"
                  style={{ padding: '10px 18px', fontSize: '13px', borderRadius: '12px' }}
                >
                  {t('viewAndRedeem')} <ChevronRight size={16} color="#050505" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* OFFER DETAILS & TIER SELECTION MODAL */}
      {selectedOffer && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{ background: '#111111', border: '1px solid rgba(212, 175, 55, 0.3)', borderRadius: '24px', maxWidth: '460px', width: '100%', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }} className="animate-slide-up">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Store size={20} color="#D4AF37" />
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>{selectedOffer.shop_name}</h3>
              </div>
              <button type="button" aria-label={t('closeModalAria')} onClick={() => { setSelectedOffer(null); setRedeemResult(null); }} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <X size={20} color="#B8B8B8" />
              </button>
            </div>

            {/* Offer Header Card */}
            <div style={{ background: '#151515', border: '1px solid rgba(212, 175, 55, 0.3)', borderRadius: '16px', padding: '16px', marginBottom: '16px' }}>
              <span style={{ fontSize: '11px', color: '#D4AF37', fontWeight: 800, textTransform: 'uppercase' }}>{translateCategory(selectedOffer.shop_category)}</span>
              <h4 style={{ fontSize: '17px', fontWeight: 800, color: '#F2D675', margin: '4px 0' }}>
                {selectedOffer.title}
              </h4>
              <span style={{ fontSize: '13px', color: '#FFFFFF', fontWeight: 700 }}>
                {t('maxDiscountLabel')}: {formatInr(selectedOffer.max_discount_inr, locale)} • {t('validUntilLabel')} {new Date(selectedOffer.valid_until).toLocaleDateString(locale)}
              </span>
            </div>

            {/* REDEEMED RESULT DISCLOSURE */}
            {redeemResult ? (
              <div style={{ textAlign: 'center', background: '#151515', border: '1px solid #D4AF37', padding: '20px', borderRadius: '18px', marginBottom: '16px' }}>
                <CheckCircle2 size={40} color="#F2D675" style={{ marginBottom: '10px' }} />
                <h4 style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: 800, margin: '0 0 6px 0' }}>{t('redemptionQrReady')}</h4>
                <p style={{ color: '#B8B8B8', fontSize: '12px', margin: '0 0 14px 0' }}>
                  {t('showCodeToMerchant')}
                </p>
                <div style={{ background: '#050505', border: '1px dashed #D4AF37', padding: '12px', borderRadius: '12px', fontSize: '20px', fontWeight: 800, color: '#F2D675', letterSpacing: '0.1em', marginBottom: '14px' }}>
                  {redeemResult.redemption_code}
                </div>
                <div style={{ fontSize: '12px', color: '#FFFFFF', fontWeight: 700 }}>
                  {t('tierAndDiscountSummary', { tier: t(`tier_${redeemResult.coin_tier}`) !== `tier_${redeemResult.coin_tier}` ? t(`tier_${redeemResult.coin_tier}`) : redeemResult.coin_tier, percent: redeemResult.discount_percent })}
                </div>
              </div>
            ) : (
              <>
                {/* SELECT COIN TIER FOR REDEMPTION */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '12px', color: '#B8B8B8', fontWeight: 700, display: 'block', marginBottom: '8px' }}>
                    {t('selectCoinTierToRedeem')}
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                    {VP52_TIERS.map(tierName => {
                      const tierCoins = tierBreakdown[tierName] ? tierBreakdown[tierName].coins : 0;
                      const disc = getOfferDiscountForTier(selectedOffer, tierName);
                      const isSelected = selectedTier === tierName;
                      const tierDisplay = t(`tier_${tierName}`) !== `tier_${tierName}` ? t(`tier_${tierName}`) : tierName;

                      return (
                        <button
                          key={tierName}
                          type="button"
                          onClick={() => setSelectedTier(tierName)}
                          style={{
                            background: isSelected ? 'rgba(212, 175, 55, 0.15)' : '#151515',
                            border: isSelected ? '1px solid #D4AF37' : '1px solid rgba(212, 175, 55, 0.15)',
                            borderRadius: '12px',
                            padding: '10px',
                            textAlign: 'left',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ fontSize: '12px', fontWeight: 800, color: isSelected ? '#F2D675' : '#FFFFFF' }}>
                            🪙 {tierDisplay} ({tierCoins})
                          </div>
                          <div style={{ fontSize: '11px', color: '#B8B8B8', marginTop: '2px' }}>
                            {disc}% {t('tierDiscountBadge')}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* TIER REDEMPTION SUMMARY CARD */}
                <div style={{ background: '#151515', border: '1px solid rgba(212, 175, 55, 0.15)', borderRadius: '16px', padding: '16px', marginBottom: '20px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: '#B8B8B8' }}>{t('selectedCoinTier')}</span>
                    <span style={{ fontWeight: 800, color: '#F2D675' }}>🪙 {t(`tier_${selectedTier}`) !== `tier_${selectedTier}` ? t(`tier_${selectedTier}`) : selectedTier}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: '#B8B8B8' }}>{t('availableTierBalance')}</span>
                    <span style={{ fontWeight: 800, color: '#FFFFFF' }}>{(tierBreakdown[selectedTier]?.coins || 0)} {t('coinsUnit')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#B8B8B8' }}>{t('applicableTierDiscount')}</span>
                    <span style={{ fontWeight: 800, color: '#F2D675' }}>{getOfferDiscountForTier(selectedOffer, selectedTier)}% {t('offUpper')}</span>
                  </div>
                </div>

                {redeemError && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '10px', borderRadius: '10px', fontSize: '12px', marginBottom: '14px', textAlign: 'center' }}>
                    {redeemError}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={handleRedeemTierOffer}
                    disabled={isRedeeming}
                    className="btn-primary"
                    style={{ width: '100%', padding: '14px', fontSize: '15px', justifyContent: 'center' }}
                  >
                    {isRedeeming ? t('redeemingProgress') : t('redeemWithTierCoins', { tier: t(`tier_${selectedTier}`) !== `tier_${selectedTier}` ? t(`tier_${selectedTier}`) : selectedTier })}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setSelectedOffer(null); navigate('/customer/profile'); }}
                    className="btn-secondary"
                    style={{ width: '100%', padding: '12px', fontSize: '13px', justifyContent: 'center' }}
                  >
                    <QrCode size={16} color="#B8B8B8" /> {t('showIdentityQrBtn')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
