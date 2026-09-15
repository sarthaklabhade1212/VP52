import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Wallet, Sparkles, ShoppingBag, Clock, ChevronRight, Award, ShieldCheck, Info } from 'lucide-react';

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
          VP52 Multi-Tier Wallet & Aging Ledger
        </h2>
        <p style={{ fontSize: '13px', color: '#B8B8B8', margin: 0 }}>
          12-Tier Monthly Coin Progression System • 30-Day Batch Aging
        </p>
      </div>

      {/* Main Balance Hero Card */}
      <div className="wallet-gradient-card" style={{ marginBottom: '24px', padding: '24px', borderRadius: '24px' }}>
        <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#B8B8B8', fontWeight: 700 }}>
          TOTAL COIN BALANCE (ALL TIERS)
        </span>
        <h1 style={{ fontSize: '38px', fontWeight: 800, marginTop: '4px', lineHeight: 1, marginBottom: '6px', color: '#F2D675' }}>
          🪙 {(wallet.available_coins || wallet.balance || 0).toLocaleString()} <span style={{ fontSize: '18px', fontWeight: 600, color: '#FFFFFF' }}>VP52 Coins</span>
        </h1>
        <div style={{ fontSize: '15px', color: '#D4AF37', fontWeight: 800, marginBottom: '18px' }}>
          Estimated Value: ₹{(wallet.discount_value_inr || wallet.available_coins || 0).toLocaleString()} INR
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
            <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block' }}>Earned Today</span>
            <strong style={{ fontSize: '15px', color: '#F2D675' }}>+{(wallet.earned_today || 0)} Coins</strong>
          </div>

          <div style={{ background: '#111111', border: '1px solid rgba(212, 175, 55, 0.15)', padding: '10px 14px', borderRadius: '12px' }}>
            <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block' }}>Earned This Month</span>
            <strong style={{ fontSize: '15px', color: '#F2D675' }}>+{(wallet.earned_this_month || 0)} Coins</strong>
          </div>

          <div style={{ background: '#111111', border: '1px solid rgba(212, 175, 55, 0.15)', padding: '10px 14px', borderRadius: '12px' }}>
            <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block' }}>Lifetime Earned</span>
            <strong style={{ fontSize: '15px', color: '#FFFFFF' }}>{(wallet.total_earned || 0)} Coins</strong>
          </div>

          <div style={{ background: '#111111', border: '1px solid rgba(212, 175, 55, 0.15)', padding: '10px 14px', borderRadius: '12px' }}>
            <span style={{ fontSize: '11px', color: '#ef4444', display: 'block' }}>Expired Coins</span>
            <strong style={{ fontSize: '15px', color: '#FFFFFF' }}>{(wallet.total_expired || 0)} Coins</strong>
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
          12 Coin Tiers
        </button>

        <button
          onClick={() => setActiveTab('batches')}
          style={{
            flex: 1, padding: '10px', border: activeTab === 'batches' ? '1px solid #D4AF37' : 'none', borderRadius: '8px', fontWeight: 700, fontSize: '12px', cursor: 'pointer',
            background: activeTab === 'batches' ? '#111111' : 'transparent',
            color: activeTab === 'batches' ? '#F2D675' : '#777777'
          }}
        >
          Active Batches ({activeLots.length})
        </button>

        <button
          onClick={() => setActiveTab('earned')}
          style={{
            flex: 1, padding: '10px', border: activeTab === 'earned' ? '1px solid #D4AF37' : 'none', borderRadius: '8px', fontWeight: 700, fontSize: '12px', cursor: 'pointer',
            background: activeTab === 'earned' ? '#111111' : 'transparent',
            color: activeTab === 'earned' ? '#F2D675' : '#777777'
          }}
        >
          Earned History
        </button>

        <button
          onClick={() => setActiveTab('redeemed')}
          style={{
            flex: 1, padding: '10px', border: activeTab === 'redeemed' ? '1px solid #D4AF37' : 'none', borderRadius: '8px', fontWeight: 700, fontSize: '12px', cursor: 'pointer',
            background: activeTab === 'redeemed' ? '#111111' : 'transparent',
            color: activeTab === 'redeemed' ? '#F2D675' : '#777777'
          }}
        >
          Redeemed
        </button>
      </div>

      {/* TAB CONTENT: 12 COIN TIERS HIERARCHY */}
      {activeTab === 'tiers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {TIER_METADATA.map((tierMeta, idx) => {
            const summary = tierSummary.find(s => s.tier === tierMeta.name) || { coins: 0, value_inr: 0, unit_value: 1, lots_count: 0 };
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
                      Value: ₹{summary.unit_value} / coin • {summary.lots_count} Active Batch{summary.lots_count !== 1 ? 'es' : ''}
                    </span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '18px', fontWeight: 800, color: summary.coins > 0 ? tierMeta.color : '#666666' }}>
                    {summary.coins.toLocaleString()}
                  </span>
                  <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block' }}>
                    ₹{summary.value_inr.toLocaleString()} Value
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
            No active coin batches. Start a 6-hour session to earn your first Bronze coin lot!
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
                    Earned: {new Date(lot.earned_at).toLocaleDateString()} • Next Matured Transition: {new Date(lot.next_transition_at || lot.expires_at).toLocaleDateString()}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '11px', color: '#F2D675', background: '#151515', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(212, 175, 55, 0.2)' }}>
                    In ~{Math.max(1, Math.floor((lot.hours_until_transition || 720) / 24))} Days
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
            No earned coins history yet. Complete sessions to earn coins!
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
            No redemptions yet. Visit physical stores and redeem coins for instant discounts!
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
