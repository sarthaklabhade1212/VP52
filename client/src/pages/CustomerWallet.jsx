import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Wallet, ArrowDownLeft, ArrowUpRight, Clock, Sparkles, ShoppingBag, AlertTriangle, Calendar, IndianRupee } from 'lucide-react';

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
    expiring_soon_3_days: 0
  });
  const [expiringSoonLots, setExpiringSoonLots] = useState([]);
  const [rewardHistory, setRewardHistory] = useState([]);
  const [redemptionHistory, setRedemptionHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('earned'); // 'earned' | 'redeemed' | 'expiring'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/customer/wallet', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setWallet(data.wallet || {});
          setExpiringSoonLots(data.expiringSoonLots || []);
          setRewardHistory(data.rewardHistory || []);
          setRedemptionHistory(data.redemptionHistory || []);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '22px', color: '#0f172a', marginBottom: '16px' }}>
        My Coin Wallet & Ledger
      </h2>

      {/* Main Balance Card */}
      <div className="wallet-gradient-card" style={{ marginBottom: '20px', padding: '24px', borderRadius: '24px' }}>
        <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#c7d2fe', fontWeight: 700 }}>
          AVAILABLE COIN BALANCE (NON-EXPIRED)
        </span>
        <h1 style={{ fontSize: '38px', fontWeight: 800, marginTop: '4px', lineHeight: 1, marginBottom: '4px' }}>
          🪙 {(wallet.available_coins || wallet.balance || 0).toLocaleString()} <span style={{ fontSize: '20px', fontWeight: 600 }}>Coins</span>
        </h1>
        <div style={{ fontSize: '14px', color: '#a7f3d0', fontWeight: 800, marginBottom: '16px' }}>
          Discount Value: ₹{(wallet.discount_value_inr || wallet.available_coins || 0).toLocaleString()} (1 Coin = ₹1)
        </div>

        {/* 2x2 Grid Summary */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px',
          paddingTop: '16px',
          borderTop: '1px solid rgba(255,255,255,0.2)'
        }}>
          <div style={{ background: 'rgba(255,255,255,0.12)', padding: '10px 14px', borderRadius: '12px' }}>
            <span style={{ fontSize: '11px', color: '#e0e7ff', display: 'block' }}>Earned Today</span>
            <strong style={{ fontSize: '15px', color: '#ffffff' }}>+{(wallet.earned_today || 0)} Coins</strong>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.12)', padding: '10px 14px', borderRadius: '12px' }}>
            <span style={{ fontSize: '11px', color: '#e0e7ff', display: 'block' }}>Earned This Month</span>
            <strong style={{ fontSize: '15px', color: '#ffffff' }}>+{(wallet.earned_this_month || 0)} Coins</strong>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.12)', padding: '10px 14px', borderRadius: '12px' }}>
            <span style={{ fontSize: '11px', color: '#e0e7ff', display: 'block' }}>Lifetime Earned</span>
            <strong style={{ fontSize: '15px', color: '#ffffff' }}>{(wallet.total_earned || 0)} Coins</strong>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.12)', padding: '10px 14px', borderRadius: '12px' }}>
            <span style={{ fontSize: '11px', color: '#fca5a5', display: 'block' }}>Expired Coins</span>
            <strong style={{ fontSize: '15px', color: '#ffffff' }}>{(wallet.total_expired || 0)} Coins</strong>
          </div>
        </div>
      </div>

      {/* COINS EXPIRING SOON WARNING BANNER */}
      {expiringSoonLots.length > 0 && (
        <div style={{
          background: '#fff7ed', border: '1.5px solid #ffedd5', borderRadius: '18px',
          padding: '16px', marginBottom: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#c2410c', fontWeight: 800, fontSize: '14px', marginBottom: '8px' }}>
            <AlertTriangle size={18} /> COINS EXPIRING SOON (30-DAY LOT EXPIRY)
          </div>
          <p style={{ fontSize: '12px', color: '#9a3412', margin: '0 0 10px 0' }}>
            Each coin lot expires 30 days after being earned. Redeem coins at physical partner stores before they expire!
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {expiringSoonLots.map(lot => (
              <div key={lot.id} style={{ background: '#ffffff', padding: '8px 12px', borderRadius: '10px', border: '1px solid #fed7aa', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ fontWeight: 700, color: '#c2410c' }}>🪙 {lot.coins_remaining} Coins (₹{lot.coins_remaining} Discount)</span>
                <span style={{ color: '#9a3412', fontWeight: 600 }}>Expires in ~{Math.max(1, Math.floor(lot.hours_left / 24))} days</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs Selector */}
      <div style={{
        display: 'flex',
        background: '#e2e8f0',
        borderRadius: '12px',
        padding: '4px',
        marginBottom: '16px'
      }}>
        <button
          onClick={() => setActiveTab('earned')}
          style={{
            flex: 1, padding: '10px', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
            background: activeTab === 'earned' ? '#ffffff' : 'transparent',
            color: activeTab === 'earned' ? '#4f46e5' : '#64748b'
          }}
        >
          Earned ({rewardHistory.length})
        </button>

        <button
          onClick={() => setActiveTab('redeemed')}
          style={{
            flex: 1, padding: '10px', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
            background: activeTab === 'redeemed' ? '#ffffff' : 'transparent',
            color: activeTab === 'redeemed' ? '#4f46e5' : '#64748b'
          }}
        >
          Redeemed ({redemptionHistory.length})
        </button>

        <button
          onClick={() => setActiveTab('expiring')}
          style={{
            flex: 1, padding: '10px', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
            background: activeTab === 'expiring' ? '#ffffff' : 'transparent',
            color: activeTab === 'expiring' ? '#c2410c' : '#64748b'
          }}
        >
          Expiring Soon ({expiringSoonLots.length})
        </button>
      </div>

      {/* Tab Contents */}
      <div>
        {activeTab === 'earned' && (
          rewardHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
              No earned coins history yet. Watch demo reward ads to earn coins!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {rewardHistory.map((item) => (
                <div key={item.id} style={{ background: '#ffffff', borderRadius: '14px', padding: '14px 16px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
                      <Sparkles size={20} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', margin: 0 }}>{item.activity_type}</h4>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>{new Date(item.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#16a34a' }}>+{item.points} Coins</span>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 'redeemed' && (
          redemptionHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
              No redemptions yet. Visit physical stores and redeem coins for discounts!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {redemptionHistory.map((item) => (
                <div key={item.id} style={{ background: '#ffffff', borderRadius: '14px', padding: '14px 16px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
                      <ShoppingBag size={20} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', margin: 0 }}>{item.discount_percent}% OFF — {item.shop_name}</h4>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Code: {item.redemption_code} • {item.status}</span>
                    </div>
                  </div>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#dc2626' }}>-{item.points_deducted} Coins</span>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 'expiring' && (
          expiringSoonLots.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#16a34a', fontWeight: 700 }}>
              🎉 No coins expiring in the next 7 days!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {expiringSoonLots.map((lot) => (
                <div key={lot.id} style={{ background: '#fff7ed', borderRadius: '14px', padding: '14px 16px', border: '1px solid #fed7aa', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#c2410c', margin: 0 }}>🪙 {lot.coins_remaining} Coins Lot</h4>
                    <span style={{ fontSize: '11px', color: '#9a3412' }}>Expires on {new Date(lot.expires_at).toLocaleDateString()}</span>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#ea580c', background: '#ffedd5', padding: '4px 10px', borderRadius: '6px' }}>
                    In {Math.max(1, Math.floor(lot.hours_left / 24))} Days
                  </span>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
