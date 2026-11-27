import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { parseApiResponse, resolveApiErrorMessage, resolveMediaUrl, resolveNetworkErrorMessage } from '../utils/api';
import {
  Sparkles,
  ShoppingBag,
  QrCode,
  Store,
  Coins,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  X,
  Receipt,
  Camera,
  ArrowRight
} from 'lucide-react';
import CustomerCoinRedemptionModal from '../components/CustomerCoinRedemptionModal';
import CustomerScanPayModal from '../components/CustomerScanPayModal';

const TIER_METADATA = [
  { name: 'Bronze', color: '#CD7F32', badgeKey: 'tierMetaBadge1' },
  { name: 'Silver', color: '#C0C0C0', badgeKey: 'tierMetaBadge2' },
  { name: 'Gold', color: '#FFD700', badgeKey: 'tierMetaBadge3' },
  { name: 'Platinum', color: '#E5E4E2', badgeKey: 'tierMetaBadge4' },
  { name: 'Diamond', color: '#B9F2FF', badgeKey: 'tierMetaBadge5' },
  { name: 'Titanium', color: '#878681', badgeKey: 'tierMetaBadge6' },
  { name: 'Ruby', color: '#E0115F', badgeKey: 'tierMetaBadge7' },
  { name: 'Crown', color: '#F4BB44', badgeKey: 'tierMetaBadge8' },
  { name: 'Royal', color: '#4169E1', badgeKey: 'tierMetaBadge9' },
  { name: 'Elite', color: '#9370DB', badgeKey: 'tierMetaBadge10' },
  { name: 'Legend', color: '#FF4500', badgeKey: 'tierMetaBadge11' },
  { name: 'VIP', color: '#F2D675', badgeKey: 'tierMetaBadge12' }
];

export default function CustomerWallet() {
  const { token, updateUserBalance } = useAuth();
  const { t, locale } = useI18n();
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
  const [merchantTransfers, setMerchantTransfers] = useState([]);
  const [activeTab, setActiveTab] = useState('transfers');
  const [loading, setLoading] = useState(true);
  const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);
  const [isScanPayModalOpen, setIsScanPayModalOpen] = useState(false);
  const [customerRedemptions, setCustomerRedemptions] = useState([]);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [copiedReceiptTx, setCopiedReceiptTx] = useState(false);
  const [walletError, setWalletError] = useState('');
  const [redemptionsError, setRedemptionsError] = useState('');
  const [transfersError, setTransfersError] = useState('');

  const fetchWallet = async () => {
    setWalletError('');
    setRedemptionsError('');
    setTransfersError('');

    const loadWallet = async () => {
      try {
        const res = await fetch('/api/customer/wallet', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const parsed = await parseApiResponse(res);
        const data = parsed.data;
        if (parsed.ok && data && data.success) {
          setWallet(data.wallet || {});
          setTierSummary(data.tierSummary || []);
          setActiveLots(data.activeLots || []);
          setRewardHistory(data.rewardHistory || []);
          setRedemptionHistory(data.redemptionHistory || []);
        } else {
          setWalletError(resolveApiErrorMessage(parsed, t, 'walletLoadFailed'));
        }
      } catch (err) {
        setWalletError(resolveNetworkErrorMessage(err, t, 'walletLoadFailed'));
      } finally {
        setLoading(false);
      }
    };

    const loadRedemptionsHistory = async () => {
      try {
        const res = await fetch('/api/customer/redemptions/history', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const parsed = await parseApiResponse(res);
        const data = parsed.data;
        if (parsed.ok && data && data.success) {
          setCustomerRedemptions(data.redemptions || []);
        } else {
          setRedemptionsError(resolveApiErrorMessage(parsed, t, 'redemptionHistoryLoadFailed'));
        }
      } catch (err) {
        setRedemptionsError(resolveNetworkErrorMessage(err, t, 'redemptionHistoryLoadFailed'));
      }
    };

    const loadTransfers = async () => {
      try {
        const res = await fetch('/api/customer/merchant-qr/transfers', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const parsed = await parseApiResponse(res);
        const data = parsed.data;
        if (parsed.ok && data && data.success) {
          setMerchantTransfers(data.transfers || []);
        } else {
          setTransfersError(resolveApiErrorMessage(parsed, t, 'transfersLoadFailed'));
        }
      } catch (err) {
        setTransfersError(resolveNetworkErrorMessage(err, t, 'transfersLoadFailed'));
      }
    };

    await Promise.all([loadWallet(), loadRedemptionsHistory(), loadTransfers()]);
  };

  useEffect(() => {
    if (token) fetchWallet();
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

      {walletError && (
        <div
          role="alert"
          style={{
            background: 'rgba(239, 68, 68, 0.14)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '12px',
            padding: '10px 14px',
            color: '#fca5a5',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px'
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} aria-hidden="true" />
          <span>{walletError}</span>
        </div>
      )}

      {/* Main Balance Hero Card */}
      <div className="wallet-gradient-card" style={{ marginBottom: '24px', padding: '24px', borderRadius: '24px' }}>
        <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#B8B8B8', fontWeight: 700 }}>
          {t('twoCoinBalanceTitle') || 'VP52 Two-Coin Balance'}
        </span>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '14px', marginTop: '6px', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '12px', color: '#B8B8B8', fontWeight: 700 }}>🪙 {t('normalCoins') || 'Normal Coins'} (1 Coin = ₹1)</div>
            <div style={{ fontSize: '32px', fontWeight: 900, color: '#F2D675', lineHeight: 1.1 }}>
              {(wallet.normal_coins != null ? wallet.normal_coins : (wallet.available_coins || wallet.balance || 0)).toLocaleString(locale)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#B8B8B8', fontWeight: 700 }}>👑 {t('vipCoins') || 'VIP Coins'} (10,000 : 1)</div>
            <div style={{ fontSize: '32px', fontWeight: 900, color: '#D4AF37', lineHeight: 1.1 }}>
              {(wallet.vip_coins || 0).toLocaleString(locale)}
            </div>
          </div>
        </div>
        <div style={{ fontSize: '12px', color: '#D4AF37', fontWeight: 600, marginBottom: '16px' }}>
          {t('twoCoinSystemTagline') || '10,000 Normal Coins = 1 VIP Coin • 365-Day Automatic Conversion'}
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
            <strong style={{ fontSize: '15px', color: '#F2D675' }}>+{(wallet.earned_today || 0).toLocaleString(locale)} {t('coinsUnit')}</strong>
          </div>

          <div style={{ background: '#111111', border: '1px solid rgba(212, 175, 55, 0.15)', padding: '10px 14px', borderRadius: '12px' }}>
            <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block' }}>{t('earnedThisMonth')}</span>
            <strong style={{ fontSize: '15px', color: '#F2D675' }}>+{(wallet.earned_this_month || 0).toLocaleString(locale)} {t('coinsUnit')}</strong>
          </div>

          <div style={{ background: '#111111', border: '1px solid rgba(212, 175, 55, 0.15)', padding: '10px 14px', borderRadius: '12px' }}>
            <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block' }}>{t('totalEarned')}</span>
            <strong style={{ fontSize: '15px', color: '#FFFFFF' }}>{(wallet.total_earned || 0).toLocaleString(locale)} {t('coinsUnit')}</strong>
          </div>

          <div style={{ background: '#111111', border: '1px solid rgba(212, 175, 55, 0.15)', padding: '10px 14px', borderRadius: '12px' }}>
            <span style={{ fontSize: '11px', color: '#ef4444', display: 'block' }}>{t('totalRedeemed')}</span>
            <strong style={{ fontSize: '15px', color: '#FFFFFF' }}>{(wallet.total_redeemed || 0).toLocaleString(locale)} {t('coinsUnit')}</strong>
          </div>
        </div>

        {/* Scan & Pay Merchant Permanent QR Primary CTA */}
        <div style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            onClick={() => setIsScanPayModalOpen(true)}
            disabled={(wallet.available_coins || wallet.balance || 0) <= 0}
            style={{
              width: '100%',
              background: (wallet.available_coins || wallet.balance || 0) > 0
                ? 'linear-gradient(135deg, #F2D675 0%, #D4AF37 100%)'
                : '#333333',
              color: (wallet.available_coins || wallet.balance || 0) > 0 ? '#050505' : '#888888',
              border: 'none',
              borderRadius: '16px',
              padding: '16px',
              fontSize: '16px',
              fontWeight: 800,
              cursor: (wallet.available_coins || wallet.balance || 0) > 0 ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: (wallet.available_coins || wallet.balance || 0) > 0
                ? '0 6px 22px rgba(212, 175, 55, 0.4)'
                : 'none'
            }}
          >
            <Camera size={20} color="#050505" />
            <span>{t('scanPayCoinsTitle')}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsRedeemModalOpen(true)}
            disabled={(wallet.available_coins || wallet.balance || 0) <= 0}
            style={{
              width: '100%',
              background: '#151515',
              color: (wallet.available_coins || wallet.balance || 0) > 0 ? '#F2D675' : '#777777',
              border: '1px solid rgba(212, 175, 55, 0.3)',
              borderRadius: '14px',
              padding: '12px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: (wallet.available_coins || wallet.balance || 0) > 0 ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <QrCode size={16} />
            <span>{t('generateOfflineVoucherQr')}</span>
          </button>
        </div>
      </div>

      {/* Tabs Selector */}
      <div style={{
        display: 'flex',
        background: '#151515',
        borderRadius: '12px',
        padding: '4px',
        marginBottom: '20px',
        border: '1px solid rgba(212, 175, 55, 0.15)',
        overflowX: 'auto',
        scrollbarWidth: 'none'
      }}>
        <button
          onClick={() => setActiveTab('transfers')}
          style={{
            flex: '1 0 auto', padding: '10px 14px', border: activeTab === 'transfers' ? '1px solid #D4AF37' : 'none', borderRadius: '8px', fontWeight: 700, fontSize: '12px', cursor: 'pointer',
            background: activeTab === 'transfers' ? '#111111' : 'transparent',
            color: activeTab === 'transfers' ? '#F2D675' : '#777777',
            whiteSpace: 'nowrap'
          }}
        >
          {t('tabQrPayments', { count: merchantTransfers.length })}
        </button>

        <button
          onClick={() => setActiveTab('two_coins')}
          style={{
            flex: '1 0 auto', padding: '10px 14px', border: (activeTab === 'two_coins' || activeTab === 'tiers') ? '1px solid #D4AF37' : 'none', borderRadius: '8px', fontWeight: 700, fontSize: '12px', cursor: 'pointer',
            background: (activeTab === 'two_coins' || activeTab === 'tiers') ? '#111111' : 'transparent',
            color: (activeTab === 'two_coins' || activeTab === 'tiers') ? '#F2D675' : '#777777',
            whiteSpace: 'nowrap'
          }}
        >
          {t('tabTwoCoinSystem') || 'Two-Coin System'}
        </button>

        <button
          onClick={() => setActiveTab('batches')}
          style={{
            flex: '1 0 auto', padding: '10px 14px', border: activeTab === 'batches' ? '1px solid #D4AF37' : 'none', borderRadius: '8px', fontWeight: 700, fontSize: '12px', cursor: 'pointer',
            background: activeTab === 'batches' ? '#111111' : 'transparent',
            color: activeTab === 'batches' ? '#F2D675' : '#777777',
            whiteSpace: 'nowrap'
          }}
        >
          {t('tabActiveBatches')} ({activeLots.length})
        </button>

        <button
          onClick={() => setActiveTab('earned')}
          style={{
            flex: '1 0 auto', padding: '10px 14px', border: activeTab === 'earned' ? '1px solid #D4AF37' : 'none', borderRadius: '8px', fontWeight: 700, fontSize: '12px', cursor: 'pointer',
            background: activeTab === 'earned' ? '#111111' : 'transparent',
            color: activeTab === 'earned' ? '#F2D675' : '#777777',
            whiteSpace: 'nowrap'
          }}
        >
          {t('tabEarnHistory')}
        </button>

        <button
          onClick={() => setActiveTab('redeemed')}
          style={{
            flex: '1 0 auto', padding: '10px 14px', border: activeTab === 'redeemed' ? '1px solid #D4AF37' : 'none', borderRadius: '8px', fontWeight: 700, fontSize: '12px', cursor: 'pointer',
            background: activeTab === 'redeemed' ? '#111111' : 'transparent',
            color: activeTab === 'redeemed' ? '#F2D675' : '#777777',
            whiteSpace: 'nowrap'
          }}
        >
          {t('tabRedeemedHistory')}
        </button>
      </div>

      {/* TAB CONTENT: QR PAYMENTS TO MERCHANTS (PHONEPE / GPAY STYLE) */}
      {activeTab === 'transfers' && (
        transfersError ? (
          <div
            role="alert"
            style={{
              background: 'rgba(239, 68, 68, 0.14)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '16px',
              padding: '16px',
              color: '#fca5a5',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0 }} aria-hidden="true" />
            <span>{transfersError}</span>
          </div>
        ) : merchantTransfers.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '48px 20px',
            background: '#111111',
            borderRadius: '20px',
            border: '1px solid rgba(212, 175, 55, 0.15)'
          }}>
            <Camera size={36} color="#D4AF37" style={{ marginBottom: '12px', opacity: 0.7 }} />
            <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF', margin: '0 0 6px 0' }}>
              {t('noMerchantPaymentsYet')}
            </h4>
            <p style={{ fontSize: '13px', color: '#B8B8B8', margin: '0 0 16px 0', maxWidth: '380px', marginLeft: 'auto', marginRight: 'auto' }}>
              {t('scanMerchantQrWalletDesc')}
            </p>
            <button
              type="button"
              onClick={() => setIsScanPayModalOpen(true)}
              disabled={(wallet.available_coins || wallet.balance || 0) <= 0}
              className="btn-primary"
              style={{ padding: '10px 20px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <Camera size={16} /> {t('scanMerchantQrNow')}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {merchantTransfers.map((item) => (
              <div
                key={item.id || item.transfer_id}
                style={{
                  background: '#111111',
                  borderRadius: '16px',
                  padding: '16px 18px',
                  border: '1px solid rgba(212, 175, 55, 0.22)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '12px',
                      background: 'rgba(212, 175, 55, 0.12)',
                      border: '1px solid rgba(212, 175, 55, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    {item.shop_logo ? (
                      <img
                        src={resolveMediaUrl(item.shop_logo)}
                        alt=""
                        style={{ width: '100%', height: '100%', borderRadius: '12px', objectFit: 'cover' }}
                      />
                    ) : (
                      <Store size={22} color="#F2D675" />
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <h4 style={{ fontSize: '14.5px', fontWeight: 800, color: '#FFFFFF', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.shop_name || t('vp52MerchantFallback')}
                    </h4>
                    <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block', marginTop: '2px' }}>
                      {new Date(item.created_at).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })} • <span style={{ color: '#10B981', fontWeight: 700 }}>{t('paidUpperBadge')}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedReceipt(item)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#D4AF37',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: 0,
                        marginTop: '4px',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}
                    >
                      <Receipt size={12} /> {t('viewReceiptBtn')}
                    </button>
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ fontSize: '16px', fontWeight: 900, color: '#EF4444', display: 'block' }}>
                    -🪙 {item.coins_transferred}
                  </span>
                  <span style={{ fontSize: '12px', color: '#10B981', fontWeight: 800, display: 'block' }}>
                    {t('coinsDiscountAmount', { coins: item.coins_transferred })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* TAB CONTENT: TWO-COIN SYSTEM & 365-DAY CONVERSION */}
      {(activeTab === 'two_coins' || activeTab === 'tiers') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Conversion Rule Explanation Banner */}
          <div style={{
            background: 'linear-gradient(135deg, #151515 0%, #1A1608 100%)',
            borderRadius: '16px',
            padding: '18px 20px',
            border: '1px solid rgba(212, 175, 55, 0.35)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <Sparkles size={20} color="#F2D675" />
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#F2D675', margin: 0 }}>
                {t('coinConversionTitle') || 'Automatic 365-Day VIP Coin Conversion'}
              </h3>
            </div>
            <p style={{ fontSize: '13px', color: '#D4D4D4', lineHeight: 1.5, margin: '0 0 10px 0' }}>
              {t('coinConversionDesc') || 'VP52 operates on a strict Two-Coin System. Every 10,000 Normal Coins automatically convert into 1 VIP Coin exactly 365 days after they are earned.'}
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '12px', fontWeight: 700 }}>
              <span style={{ background: '#111111', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(212, 175, 55, 0.25)', color: '#FFFFFF' }}>
                ⚖️ 10,000 Normal Coins = 1 VIP Coin
              </span>
              <span style={{ background: '#111111', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(212, 175, 55, 0.25)', color: '#F2D675' }}>
                ⏳ 365 Days Conversion Period
              </span>
            </div>
          </div>

          {/* Coin 1: Normal Coins Card */}
          <div style={{
            background: '#111111',
            borderRadius: '16px',
            padding: '20px',
            border: '1px solid rgba(212, 175, 55, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: '#151515',
                border: '1px solid #F2D675',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px'
              }}>
                🪙
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h4 style={{ fontSize: '17px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                    {t('normalCoins') || 'Normal Coins'}
                  </h4>
                  <span style={{ fontSize: '10px', background: '#181818', border: '1px solid #F2D675', color: '#F2D675', padding: '2px 8px', borderRadius: '4px', fontWeight: 800 }}>
                    1 Coin = ₹1
                  </span>
                </div>
                <span style={{ fontSize: '12px', color: '#B8B8B8', marginTop: '4px', display: 'block' }}>
                  {t('normalCoinsDesc') || 'Instant merchant discounts • Converts to VIP Coins after 365 days'}
                </span>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '22px', fontWeight: 900, color: '#F2D675' }}>
                {(wallet.normal_coins != null ? wallet.normal_coins : (wallet.available_coins || wallet.balance || 0)).toLocaleString(locale)}
              </div>
              <span style={{ fontSize: '11px', color: '#888888', fontWeight: 600 }}>Normal</span>
            </div>
          </div>

          {/* Coin 2: VIP Coins Card */}
          <div style={{
            background: '#111111',
            borderRadius: '16px',
            padding: '20px',
            border: '1px solid rgba(212, 175, 55, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: '#151515',
                border: '1px solid #D4AF37',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px'
              }}>
                👑
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h4 style={{ fontSize: '17px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                    {t('vipCoins') || 'VIP Coins'}
                  </h4>
                  <span style={{ fontSize: '10px', background: '#181818', border: '1px solid #D4AF37', color: '#D4AF37', padding: '2px 8px', borderRadius: '4px', fontWeight: 800 }}>
                    PRESTIGE
                  </span>
                </div>
                <span style={{ fontSize: '12px', color: '#B8B8B8', marginTop: '4px', display: 'block' }}>
                  {t('vipCoinsDesc') || 'Long-term loyalty holdings from matured Normal Coins'}
                </span>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '22px', fontWeight: 900, color: '#D4AF37' }}>
                {(wallet.vip_coins || 0).toLocaleString(locale)}
              </div>
              <span style={{ fontSize: '11px', color: '#888888', fontWeight: 600 }}>VIP</span>
            </div>
          </div>

          {/* Upcoming Conversions Schedule */}
          <div style={{
            background: '#0E0E0E',
            borderRadius: '16px',
            padding: '18px',
            border: '1px solid rgba(212, 175, 55, 0.2)'
          }}>
            <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#FFFFFF', margin: '0 0 12px 0' }}>
              📅 {t('upcomingConversionsTitle') || 'Upcoming 365-Day Conversions'}
            </h4>
            {activeLots.filter(l => l.coin_type !== 'VIP').length === 0 ? (
              <div style={{ fontSize: '12px', color: '#777777', textAlign: 'center', padding: '16px' }}>
                {t('noUpcomingConversions') || 'No active Normal Coins currently scheduled for conversion.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activeLots.filter(l => l.coin_type !== 'VIP').slice(0, 5).map(lot => {
                  const daysRemaining = Math.max(0, Math.ceil((new Date(lot.convert_at || lot.expires_at).getTime() - Date.now()) / (86400 * 1000)));
                  return (
                    <div key={lot.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: '#141414',
                      borderRadius: '10px',
                      border: '1px solid rgba(212, 175, 55, 0.1)'
                    }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#F2D675' }}>
                          🪙 {lot.coins_remaining.toLocaleString(locale)} Normal Coins
                        </div>
                        <div style={{ fontSize: '11px', color: '#888888' }}>
                          Earned on: {new Date(lot.earned_at).toLocaleDateString(locale)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '11px', color: '#D4AF37', fontWeight: 700, background: '#1A1A1A', padding: '3px 8px', borderRadius: '6px' }}>
                          {daysRemaining > 0 ? `${daysRemaining} days left` : 'Ready to convert'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
            {activeLots.map((lot) => {
              const isVip = lot.coin_type === 'VIP' || lot.tier === 'VIP';
              const coinTypeName = isVip ? (t('vipCoins') || 'VIP Coins') : (t('normalCoins') || 'Normal Coins');
              return (
              <div key={lot.id} style={{ background: '#111111', borderRadius: '14px', padding: '14px 16px', border: isVip ? '1px solid rgba(212, 175, 55, 0.4)' : '1px solid rgba(212, 175, 55, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ color: isVip ? '#D4AF37' : '#F2D675', fontSize: '15px' }}>{isVip ? '👑' : '🪙'} {lot.coins_remaining} {coinTypeName}</strong>
                    <span style={{ fontSize: '10px', background: '#151515', border: '1px solid rgba(212, 175, 55, 0.3)', color: '#D4AF37', padding: '1px 6px', borderRadius: '4px' }}>
                      {lot.source}
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#B8B8B8', marginTop: '4px', display: 'block' }}>
                    {t('earnedOnDateLabel')} {new Date(lot.earned_at).toLocaleDateString(locale)} • {isVip ? 'Permanent VIP' : `Converts at: ${new Date(lot.convert_at || lot.expires_at).toLocaleDateString(locale)}`}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '11px', color: '#F2D675', background: '#151515', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(212, 175, 55, 0.2)' }}>
                    {isVip ? 'VIP Tier' : `${Math.max(0, Math.ceil((new Date(lot.convert_at || lot.expires_at).getTime() - Date.now()) / (86400 * 1000)))} days left`}
                  </span>
                </div>
              </div>
              );
            })}
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
                    <span style={{ fontSize: '11px', color: '#B8B8B8' }}>{new Date(item.created_at).toLocaleString(locale)}</span>
                  </div>
                </div>
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#F2D675' }}>+{item.points} {t('coinsUnit')}</span>
              </div>
            ))}
          </div>
        )
      )}

      {/* TAB CONTENT: REDEEMED HISTORY (CUSTOMER COIN COLLECTIONS & COUPONS) */}
      {activeTab === 'redeemed' && (
        <>
          {redemptionsError && (
            <div
              role="alert"
              style={{
                background: 'rgba(239, 68, 68, 0.14)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '14px',
                padding: '12px 14px',
                color: '#fca5a5',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px'
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} aria-hidden="true" />
              <span>{redemptionsError}</span>
            </div>
          )}
          {(customerRedemptions.length === 0 && redemptionHistory.length === 0) ? (
            !redemptionsError && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#B8B8B8' }}>
                {t('noRedemptionHistory')}
              </div>
            )
          ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Customer Direct Redemptions */}
            {customerRedemptions.map((item) => (
              <div
                key={item.id}
                style={{
                  background: '#111111',
                  borderRadius: '14px',
                  padding: '14px 16px',
                  border: '1px solid rgba(212, 175, 55, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: 'rgba(212, 175, 55, 0.15)',
                      border: '1px solid rgba(212, 175, 55, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#F2D675'
                    }}
                  >
                    <Store size={20} color="#F2D675" />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                      {t('coinsDiscountAtMerchant', { coins: item.coins_amount, merchant: item.merchant_name || t('participatingMerchantFallback') })}
                    </h4>
                    <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block', marginTop: '2px' }}>
                      {t('refLabel')} {item.redemption_id} • {new Date(item.completed_at || item.created_at).toLocaleDateString(locale)} • <strong style={{ color: item.status === 'completed' ? '#10B981' : item.status === 'pending' ? '#F2D675' : '#EF4444', textTransform: 'uppercase' }}>{item.status}</strong>
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '15px', fontWeight: 900, color: '#EF4444' }}>
                    -{item.coins_amount} {t('coinsUnit')}
                  </span>
                  <span style={{ fontSize: '11px', color: '#10B981', display: 'block', fontWeight: 700 }}>
                    {t('coinsDiscountAmount', { coins: item.coins_amount })}
                  </span>
                </div>
              </div>
            ))}

            {/* Legacy Offer Coupon Redemptions */}
            {redemptionHistory.map((item) => (
              <div key={item.id} style={{ background: '#111111', borderRadius: '14px', padding: '14px 16px', border: '1px solid rgba(212, 175, 55, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#151515', border: '1px solid rgba(212, 175, 55, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D4AF37' }}>
                    <ShoppingBag size={20} color="#D4AF37" />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>{item.discount_percent}% {t('offUpper')} — {item.shop_name}</h4>
                    <span style={{ fontSize: '11px', color: '#B8B8B8' }}>{t('legacyTierLine', { code: item.redemption_code, tier: item.coin_tier || 'Bronze', status: item.status })}</span>
                  </div>
                </div>
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#D4AF37' }}>-{item.points_deducted} {t('coinsUnit')}</span>
              </div>
            ))}
          </div>
          )}
        </>
      )}

      {/* Customer Coin Redemption Modal (Parts 3, 4, 5, 8) */}
      <CustomerCoinRedemptionModal
        isOpen={isRedeemModalOpen}
        onClose={() => setIsRedeemModalOpen(false)}
        token={token}
        availableBalance={wallet.available_coins || wallet.balance || 0}
        onRedemptionCompleted={fetchWallet}
      />

      {/* CUSTOMER SCAN & PAY MERCHANT PERMANENT QR MODAL */}
      <CustomerScanPayModal
        isOpen={isScanPayModalOpen}
        onClose={() => setIsScanPayModalOpen(false)}
        onPaymentSuccess={(tx) => {
          fetchWallet();
          if (tx?.new_customer_balance !== undefined && updateUserBalance) {
            updateUserBalance(tx.new_customer_balance);
          }
        }}
      />

      {/* DIGITAL RECEIPT MODAL */}
      {selectedReceipt && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setSelectedReceipt(null)}
        >
          <div
            style={{
              background: '#0D0D0D',
              border: '1px solid #D4AF37',
              borderRadius: '24px',
              padding: '24px',
              width: '100%',
              maxWidth: '420px',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(212, 175, 55, 0.2)',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              aria-label={t('closeModalAria')}
              onClick={() => setSelectedReceipt(null)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: '#B8B8B8',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={16} />
            </button>

            <div style={{ textAlign: 'center', marginBottom: '18px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid #10B981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px auto'
                }}
              >
                <CheckCircle2 size={30} color="#10B981" />
              </div>
              <span style={{ fontSize: '11px', color: '#10B981', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {t('paymentSuccessfulTitle')}
              </span>
              <h3 style={{ fontSize: '20px', fontWeight: 900, color: '#FFFFFF', margin: '4px 0 2px 0' }}>
                {selectedReceipt.shop_name || t('merchantLabel')}
              </h3>
              <span style={{ fontSize: '12px', color: '#B8B8B8' }}>
                {new Date(selectedReceipt.created_at).toLocaleString(locale)}
              </span>
            </div>

            <div
              style={{
                background: '#151515',
                border: '1px solid rgba(212, 175, 55, 0.25)',
                borderRadius: '16px',
                padding: '16px',
                marginBottom: '16px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', color: '#B8B8B8' }}>{t('coinsSentLabel')}</span>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#F2D675' }}>
                  🪙 {selectedReceipt.coins_transferred} {t('vp52CoinsUnit')}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', color: '#B8B8B8' }}>{t('rewardDiscountAppliedLabel')}</span>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#10B981' }}>
                  {t('coinsDiscountAmount', { coins: selectedReceipt.coins_transferred })}
                </span>
              </div>
              <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '10px', marginTop: '10px' }}>
                <span style={{ fontSize: '11px', color: '#888888', display: 'block', marginBottom: '4px' }}>
                  {t('transactionReferenceLabel')}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0D0D0D', padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
                  <code style={{ fontSize: '11px', color: '#F2D675', fontFamily: 'monospace' }}>
                    {selectedReceipt.transfer_id}
                  </code>
                  <button
                    aria-label={t('copyTransactionIdAria')}
                    onClick={() => {
                      navigator.clipboard.writeText(selectedReceipt.transfer_id);
                      setCopiedReceiptTx(true);
                      setTimeout(() => setCopiedReceiptTx(false), 2000);
                    }}
                    style={{ background: 'none', border: 'none', color: '#D4AF37', cursor: 'pointer', padding: 0 }}
                  >
                    {copiedReceiptTx ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedReceipt(null)}
              className="btn-primary"
              style={{ width: '100%', padding: '12px', borderRadius: '12px', fontSize: '14px', justifyContent: 'center' }}
            >
              {t('doneBtn')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
