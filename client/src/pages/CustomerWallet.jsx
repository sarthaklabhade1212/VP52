import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { Sparkles, ShoppingBag } from 'lucide-react';

const TIER_METADATA = [
  { name: 'Bronze', color: '#CD7F32', badge: '🥉 Tier 1' },
  { name: 'Silver', color: '#C0C0C0', badge: '🥈 Tier 2' },
  { name: 'Gold', color: '#FFD700', badge: '🥇 Tier 3' },
  { name: 'Platinum', color: '#E5E4E2', badge: '💎 Tier 4' },
  { name: 'Diamond', color: '#B9F2FF', badge: '💠 Tier 5' },
  { name: 'Titanium', color: '#878681', badge: '⚡ Tier 6' },
  { name: 'Ruby', color: '#E0115F', badge: '🔻 Tier 7' },
  { name: 'Crown', color: '#F4BB44', badge: '👑 Tier 8' },
  { name: 'Royal', color: '#4169E1', badge: '⚜️ Tier 9' },
  { name: 'Elite', color: '#9370DB', badge: '🌟 Tier 10' },
  { name: 'Legend', color: '#FF4500', badge: '🔥 Tier 11' },
  { name: 'VIP', color: '#F2D675', badge: '🏆 Tier 12 VIP' }
];

export default function CustomerWallet() {
  const { token } = useAuth();
  const { t } = useI18n();
  const [wallet, setWallet] = useState({
    balance: 0,
    available_coins: 0,
    discount_value_inr: 0,
    total_earned: 0,
    total_redeemed: 0,
    total_expired: 0,
    earned_today: 0,
    earned_this_month: 0,
    tier_breakdown: {}
  });
  const [tierSummary, setTierSummary] = useState([]);
  const [activeLots, setActiveLots] = useState([]);
  const [rewardHistory, setRewardHistory] = useState([]);
  const [redemptionHistory, setRedemptionHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('tiers');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/customer/wallet', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setWallet(data.wallet || {});
          setTierSummary(data.tierSummary || []);
          setActiveLots(data.activeLots || []);
          setRewardHistory(data.rewardHistory || []);
          setRedemptionHistory(data.redemptionHistory || []);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div style={{ padding: '20px', maxWidth: '680px', margin: '0 auto', background: '#050505', minHeight: '100vh' }}>
      {/* Header Title */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '24px', color: '#FFFFFF', marginBottom: '4px', fontWeight: 800 }}>
          {t('walletTitle')}
        </h2>
        <p style={{ fontSize: '13px', color: '#B8B8B8', margin: 0 }}>
          {t('walletSubtitle')}
        </p>
      </div>

      {/* Main Balance Hero Card */}
      <div className="wallet-gradient-card" style={{ marginBottom: '24px', padding: '24px', borderRadius: '24px' }}>
        <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#B8B8B8', fontWeight: 700 }}>
          {t('totalCoinBalanceAllTiers')}
        </span>
        <h1 style={{ fontSize: '38px', fontWeight: 800, marginTop: '4px', lineHeight: 1, marginBottom: '6px', color: '#F2D675' }}>
          🪙 {(wallet.available_coins || wallet.balance || 0).toLocaleString()} <span style={{ fontSize: '18px', fontWeight: 600, color: '#FFFFFF' }}>VP52 Coins</span>
        </h1>
        <div style={{ fontSize: '13px', color: '#D4AF37', fontWeight: 600, marginBottom: '18px' }}>
          {t('activeLoyaltyCoins')}
        </div>

        {/* 2x2 Grid Summary */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px',
          paddingTop: '16px',
          borderTop: '1px solid rgba(212, 175, 55, 0.2)'
        }}>
          <div style={{ background: '#111111', border: '1px solid rgba(212, 175, 55, 0.15)', padding: '10px 14px', borderRadius: '12px' }}>
            <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block' }}>{t('earnedToday')}</span>
            <strong style={{ fontSize: '15px', color: '#F2D675' }}>+{(wallet.earned_today || 0)} Coins</strong>
          </div>

          <div style={{ background: '#111111', border: '1px solid rgba(212, 175, 55, 0.15)', padding: '10px 14px', borderRadius: '12px' }}>
            <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block' }}>{t('earnedThisMonth')}</span>
            <strong style={{ fontSize: '15px', color: '#F2D675' }}>+{(wallet.earned_this_month || 0)} Coins</strong>
          </div>

          <div style={{ background: '#111111', border: '1px solid rgba(212, 175, 55, 0.15)', padding: '10px 14px', borderRadius: '12px' }}>
            <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block' }}>{t('totalEarned')}</span>
            <strong style={{ fontSize: '15px', color: '#FFFFFF' }}>{(wallet.total_earned || 0)} Coins</strong>
          </div>

          <div style={{ background: '#111111', border: '1px solid rgba(212, 175, 55, 0.15)', padding: '10px 14px', borderRadius: '12px' }}>
            <span style={{ fontSize: '11px', color: '#ef4444', display: 'block' }}>{t('totalRedeemed')}</span>
            <strong style={{ fontSize: '15px', color: '#FFFFFF' }}>{(wallet.total_redeemed || 0)} Coins</strong>
          </div>
        </div>
      </div>

      {/* Tabs Selector */}
      <div style={{
        display: 'flex',
        background: '#151515',
        borderRadius: '12px',
        padding: '4px',
        marginBottom: '20px',
        border: '1px solid rgba(212, 175, 55, 0.15)'
      }}>
        <button
          onClick={() => setActiveTab('tiers')}
          style={{
            flex: 1, padding: '10px', border: activeTab === 'tiers' ? '1px solid #D4AF37' : 'none', borderRadius: '8px', fontWeight: 700, fontSize: '12px', cursor: 'pointer',
            background: activeTab === 'tiers' ? '#111111' : 'transparent',
            color: activeTab === 'tiers' ? '#F2D675' : '#777777'
          }}
        >
          {t('tabTiersBreakdown')}
        </button>

        <button
          onClick={() => setActiveTab('batches')}
          style={{
            flex: 1, padding: '10px', border: activeTab === 'batches' ? '1px solid #D4AF37' : 'none', borderRadius: '8px', fontWeight: 700, fontSize: '12px', cursor: 'pointer',
            background: activeTab === 'batches' ? '#111111' : 'transparent',
            color: activeTab === 'batches' ? '#F2D675' : '#777777'
          }}
        >
          {t('tabActiveBatches')} ({activeLots.length})
        </button>

        <button
          onClick={() => setActiveTab('earned')}
          style={{
            flex: 1, padding: '10px', border: activeTab === 'earned' ? '1px solid #D4AF37' : 'none', borderRadius: '8px', fontWeight: 700, fontSize: '12px', cursor: 'pointer',
            background: activeTab === 'earned' ? '#111111' : 'transparent',
            color: activeTab === 'earned' ? '#F2D675' : '#777777'
          }}
        >
          {t('tabEarnHistory')}
        </button>

        <button
          onClick={() => setActiveTab('redeemed')}
          style={{
            flex: 1, padding: '10px', border: activeTab === 'redeemed' ? '1px solid #D4AF37' : 'none', borderRadius: '8px', fontWeight: 700, fontSize: '12px', cursor: 'pointer',
            background: activeTab === 'redeemed' ? '#111111' : 'transparent',
            color: activeTab === 'redeemed' ? '#F2D675' : '#777777'
          }}
        >
          {t('tabRedeemedHistory')}
        </button>
      </div>

      {/* TAB CONTENT: 12 COIN TIERS HIERARCHY */}
      {activeTab === 'tiers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {TIER_METADATA.map((tierMeta) => {
            const summary = tierSummary.find(s => s.tier === tierMeta.name) || { coins: 0, unit_value: 1, lots_count: 0 };
            return (
              <div
                key={tierMeta.name}
                style={{
                  background: '#111111',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  border: summary.coins > 0 ? `1px solid ${tierMeta.color}` : '1px solid rgba(212, 175, 55, 0.15)',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: '#151515',
                    border: `1px solid ${tierMeta.color}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px'
                  }}>
                    🪙
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                        {tierMeta.name} Coins
                      </h4>
                      <span style={{ fontSize: '10px', background: '#151515', border: `1px solid ${tierMeta.color}`, color: tierMeta.color, padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                        {tierMeta.badge}
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#B8B8B8', marginTop: '2px', display: 'block' }}>
                      {summary.lots_count} {t('activeBatchesLabel')}
                    </span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '18px', fontWeight: 800, color: summary.coins > 0 ? tierMeta.color : '#666666' }}>
                    {summary.coins.toLocaleString()}
                  </span>
                  <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block' }}>
                    Coins
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB CONTENT: ACTIVE BATCHES */}
      {activeTab === 'batches' && (
        activeLots.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#B8B8B8' }}>
            {t('noActiveBatches')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {activeLots.map((lot) => (
              <div key={lot.id} style={{ background: '#111111', borderRadius: '14px', padding: '14px 16px', border: '1px solid rgba(212, 175, 55, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ color: '#F2D675', fontSize: '15px' }}>🪙 {lot.coins_remaining} {lot.tier || 'Bronze'} Coins</strong>
                    <span style={{ fontSize: '10px', background: '#151515', border: '1px solid rgba(212, 175, 55, 0.3)', color: '#D4AF37', padding: '1px 6px', borderRadius: '4px' }}>
                      {lot.source}
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#B8B8B8', marginTop: '4px', display: 'block' }}>
                    Earned: {new Date(lot.earned_at).toLocaleDateString()} • {t('nextTransitionLabel')}: {new Date(lot.next_transition_at || lot.expires_at).toLocaleDateString()}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '11px', color: '#F2D675', background: '#151515', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(212, 175, 55, 0.2)' }}>
                    {t('inDaysLabel', { days: Math.max(1, Math.floor((lot.hours_until_transition || 720) / 24)) })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* TAB CONTENT: EARNED HISTORY */}
      {activeTab === 'earned' && (
        rewardHistory.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#B8B8B8' }}>
            {t('noEarnHistory')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {rewardHistory.map((item) => (
              <div key={item.id} style={{ background: '#111111', borderRadius: '14px', padding: '14px 16px', border: '1px solid rgba(212, 175, 55, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#151515', border: '1px solid rgba(212, 175, 55, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F2D675' }}>
                    <Sparkles size={20} color="#F2D675" />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>{item.activity_type}</h4>
                    <span style={{ fontSize: '11px', color: '#B8B8B8' }}>{new Date(item.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#F2D675' }}>+{item.points} Coins</span>
              </div>
            ))}
          </div>
        )
      )}

      {/* TAB CONTENT: REDEEMED HISTORY */}
      {activeTab === 'redeemed' && (
        redemptionHistory.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#B8B8B8' }}>
            {t('noRedemptionHistory')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {redemptionHistory.map((item) => (
              <div key={item.id} style={{ background: '#111111', borderRadius: '14px', padding: '14px 16px', border: '1px solid rgba(212, 175, 55, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#151515', border: '1px solid rgba(212, 175, 55, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D4AF37' }}>
                    <ShoppingBag size={20} color="#D4AF37" />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>{item.discount_percent}% OFF — {item.shop_name}</h4>
                    <span style={{ fontSize: '11px', color: '#B8B8B8' }}>Code: {item.redemption_code} • {item.coin_tier || 'Bronze'} Tier • {item.status}</span>
                  </div>
                </div>
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#D4AF37' }}>-{item.points_deducted} Coins</span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
