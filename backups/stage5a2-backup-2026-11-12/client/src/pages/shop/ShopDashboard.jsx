import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { resolveMediaUrl } from '../../utils/api';
import CameraQRScanner from '../../components/CameraQRScanner';
import MerchantScanCollectModal from '../../components/MerchantScanCollectModal';
import MerchantPermanentQrCard from '../../components/MerchantPermanentQrCard';
import {
  QrCode,
  CheckCircle2,
  ArrowRight,
  ShoppingBag,
  Camera,
  Star,
  Package,
  AlertCircle,
  Clock,
  ChevronRight,
  Coins,
  Store,
  Bell,
  Sparkles,
  Printer,
  Download,
  Share2
} from 'lucide-react';

export default function ShopDashboard() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const { t, locale, translateCategory, translateSubcategory } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Active Dashboard Section: 'overview' | 'qr' | 'notifications'
  const [activeSection, setActiveSection] = useState('overview');
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  // Real Camera Scanner Modal State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [scannedCustomer, setScannedCustomer] = useState(null);
  const [scanError, setScanError] = useState(null);
  const [scanningCode, setScanningCode] = useState(false);
  const [isScanCollectOpen, setIsScanCollectOpen] = useState(false);

  const fetchDashboard = () => {
    fetch('/api/shop/dashboard', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(d => {
        if (d.success) {
          setData(d);
          if (d.unread_notifications_count !== undefined) {
            setUnreadNotifCount(d.unread_notifications_count);
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const fetchNotifications = () => {
    fetch('/api/shop/notifications', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(d => {
        if (d.success) {
          setNotifications(d.notifications || []);
          setUnreadNotifCount(d.unread_count || 0);
        }
      })
      .catch(console.error);
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await fetch('/api/shop/notifications/read-all', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      setUnreadNotifCount(0);
      fetchNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (token) {
      fetchDashboard();
      fetchNotifications();

      // Poll every 8s for real-time customer coin payments & notifications
      const timer = setInterval(() => {
        fetchDashboard();
        fetchNotifications();
      }, 8000);

      return () => clearInterval(timer);
    }
  }, [token]);

  const handleScanCustomerPayload = async (qrPayload) => {
    setIsCameraOpen(false);
    setScanError(null);
    setScannedCustomer(null);
    setScanningCode(true);

    try {
      const res = await fetch('/api/shop/scan-customer-qr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ qr_payload: qrPayload })
      });

      const resData = await res.json();
      if (!res.ok || !resData.success || !resData.customer) {
        setScanError(resData.error || t('failedScanCustomerQr'));
      } else {
        setScannedCustomer(resData.customer);
      }
    } catch (err) {
      setScanError(err.message);
    } finally {
      setScanningCode(false);
    }
  };

  const handleProceedToBilling = () => {
    if (scannedCustomer) {
      navigate('/shop/billing', { state: { customer: scannedCustomer } });
    }
  };

  if (loading || !data) {
    return <div style={{ padding: '40px', color: '#B8B8B8', textAlign: 'center' }}>{t('loadingMerchantDashboard')}</div>;
  }

  const { shop, stats, recentRedemptions } = data;
  const isPending = shop.account_status === 'pending_approval' || shop.status === 'pending_approval';
  const isRejected = shop.account_status === 'rejected' || shop.status === 'rejected';
  const isSuspended = shop.account_status === 'suspended' || shop.status === 'suspended';

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', background: '#050505' }}>
      {/* Account Verification Status Banners */}
      {isPending && (
        <div style={{
          background: 'rgba(212, 175, 55, 0.12)',
          border: '1px solid rgba(212, 175, 55, 0.4)',
          borderRadius: '16px',
          padding: '14px 18px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px'
        }}>
          <Clock size={22} color="#F2D675" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#F2D675', margin: 0 }}>
              {t('pendingVerificationTitle')}
            </h4>
            <p style={{ fontSize: '12px', color: '#B8B8B8', margin: '4px 0 0 0', lineHeight: 1.4 }}>
              {t('pendingVerificationDesc')}
            </p>
          </div>
        </div>
      )}

      {isRejected && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '16px',
          padding: '14px 18px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px'
        }}>
          <AlertCircle size={22} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#ef4444', margin: 0 }}>
              {t('needsRevisionTitle')}
            </h4>
            <p style={{ fontSize: '12px', color: '#B8B8B8', margin: '4px 0 0 0', lineHeight: 1.4 }}>
              {t('rejectionReasonPrefix', { reason: shop.rejection_reason || t('defaultRevisionReason') })}
            </p>
          </div>
        </div>
      )}

      {isSuspended && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '16px',
          padding: '14px 18px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px'
        }}>
          <AlertCircle size={22} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#ef4444', margin: 0 }}>
              {t('storeSuspendedTitle')}
            </h4>
            <p style={{ fontSize: '12px', color: '#B8B8B8', margin: '4px 0 0 0' }}>
              {t('storeSuspendedDesc')}
            </p>
          </div>
        </div>
      )}

      {/* Top Header & Store ID Badge */}
      <div style={{ background: '#111111', borderRadius: '20px', padding: '20px', border: '1px solid rgba(212, 175, 55, 0.25)', marginBottom: '16px', boxShadow: '0 8px 30px rgba(0,0,0,0.35)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '10px', fontWeight: 800, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.08em', background: '#151515', border: '1px solid rgba(212, 175, 55, 0.3)', padding: '4px 10px', borderRadius: '6px' }}>
            {shop.account_status === 'approved' || shop.status === 'active' ? t('verifiedMerchantStoreBadge') : t('merchantStoreBadge')}
          </span>
          <span style={{ fontSize: '12px', fontWeight: 800, color: '#F2D675' }}>
            {shop.shop_code}
          </span>
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#FFFFFF', marginTop: '8px', marginBottom: '2px' }}>
          {shop.name}
        </h1>
        <p style={{ fontSize: '12px', color: '#B8B8B8', margin: 0 }}>
          {shop.address} • <strong style={{ color: '#D4AF37' }}>{translateCategory(shop.category)}</strong>
          {shop.subcategory ? ` • ${translateSubcategory(shop.subcategory)}` : ''}
        </p>
      </div>

      {/* Navigation Tabs: Overview | My VP52 QR | Alerts */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          type="button"
          onClick={() => setActiveSection('overview')}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '12px',
            border: activeSection === 'overview' ? '1px solid #D4AF37' : '1px solid rgba(212, 175, 55, 0.15)',
            background: activeSection === 'overview' ? 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)' : '#111111',
            color: activeSection === 'overview' ? '#050505' : '#B8B8B8',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          📊 {t('overviewTab')}
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('qr')}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '12px',
            border: activeSection === 'qr' ? '1px solid #D4AF37' : '1px solid rgba(212, 175, 55, 0.15)',
            background: activeSection === 'qr' ? 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)' : '#111111',
            color: activeSection === 'qr' ? '#050505' : '#B8B8B8',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          🏷️ {t('myVp52QrTab')}
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('notifications')}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '12px',
            border: activeSection === 'notifications' ? '1px solid #D4AF37' : '1px solid rgba(212, 175, 55, 0.15)',
            background: activeSection === 'notifications' ? 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)' : '#111111',
            color: activeSection === 'notifications' ? '#050505' : '#B8B8B8',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          <Bell size={14} aria-hidden="true" /> {t('alertsTab')}
          {unreadNotifCount > 0 && (
            <span style={{
              background: '#ef4444',
              color: '#fff',
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '99px',
              fontWeight: 900
            }}>
              {unreadNotifCount}
            </span>
          )}
        </button>
      </div>

      {/* IN-APP REAL-TIME PAYMENT ALERT BANNER */}
      {unreadNotifCount > 0 && activeSection !== 'notifications' && (
        <button
          type="button"
          onClick={() => setActiveSection('notifications')}
          style={{
            width: '100%',
            textAlign: 'left',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(212, 175, 55, 0.2) 100%)',
            border: '1px solid #10B981',
            borderRadius: '16px',
            padding: '14px 18px',
            marginBottom: '16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 20px rgba(16, 185, 129, 0.25)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Bell size={20} color="#10B981" aria-hidden="true" />
            <div>
              <strong style={{ fontSize: '13px', color: '#FFFFFF', display: 'block' }}>
                {t('coinPaymentReceivedBanner', { count: unreadNotifCount })}
              </strong>
              <span style={{ fontSize: '11px', color: '#B8B8B8' }}>
                {t('coinPaymentReceivedSub')}
              </span>
            </div>
          </div>
          <ChevronRight size={18} color="#10B981" aria-hidden="true" />
        </button>
      )}

      {/* SECTION: MY VP52 PERMANENT QR CODE */}
      {activeSection === 'qr' && (
        <div style={{ marginBottom: '24px' }}>
          <MerchantPermanentQrCard shop={shop} onRefresh={fetchDashboard} />
        </div>
      )}

      {/* SECTION: NOTIFICATIONS & PAYMENT ALERTS */}
      {activeSection === 'notifications' && (
        <div style={{ background: '#111111', borderRadius: '20px', padding: '20px', border: '1px solid rgba(212, 175, 55, 0.25)', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                {t('inAppPaymentAlertsTitle')}
              </h3>
              <span style={{ fontSize: '11px', color: '#B8B8B8' }}>
                {t('inAppPaymentAlertsSub')}
              </span>
            </div>
            {unreadNotifCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllNotificationsRead}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(212, 175, 55, 0.3)',
                  color: '#F2D675',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {t('markAllReadBtn')}
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: '#888888', fontSize: '13px' }}>
              {t('noNotificationsMerchant')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {notifications.map(n => (
                <div
                  key={n.id}
                  style={{
                    background: n.is_read ? '#151515' : 'rgba(212, 175, 55, 0.08)',
                    border: n.is_read ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(212, 175, 55, 0.35)',
                    padding: '14px',
                    borderRadius: '14px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px'
                  }}
                >
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: n.notification_type === 'COIN_PAYMENT_RECEIVED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(212, 175, 55, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Coins size={18} color={n.notification_type === 'COIN_PAYMENT_RECEIVED' ? '#10B981' : '#F2D675'} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '13px', color: '#FFFFFF' }}>{n.title}</strong>
                      <span style={{ fontSize: '10px', color: '#888888' }}>
                        {new Date(n.created_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#D4AF37', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                      {n.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION: OVERVIEW (DEFAULT) */}
      {activeSection === 'overview' && (
        <div>
          {/* Quick Permanent QR Code Summary Banner */}
          <div
            style={{
              background: '#111111',
              borderRadius: '18px',
              padding: '14px 18px',
              border: '1px solid rgba(212, 175, 55, 0.25)',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(212, 175, 55, 0.15)', border: '1px solid rgba(212, 175, 55, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <QrCode size={20} color="#F2D675" />
              </div>
              <div>
                <span style={{ fontSize: '10px', color: '#B8B8B8', textTransform: 'uppercase', fontWeight: 800, display: 'block' }}>
                  {t('permanentCounterQrLabel')}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#FFFFFF' }}>
                  {shop.permanent_qr_code || 'VP52-MCH-XXXX'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveSection('qr')}
              style={{
                background: 'linear-gradient(135deg, #F2D675 0%, #D4AF37 100%)',
                color: '#050505',
                border: 'none',
                borderRadius: '10px',
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Printer size={13} aria-hidden="true" /> {t('printPosterBtn')}
            </button>
          </div>

      {/* MERCHANT COIN WALLET & SCAN-AND-COLLECT HERO CARD */}
      <div
        style={{
          background: 'linear-gradient(135deg, #151515 0%, #1F190B 100%)',
          borderRadius: '24px',
          padding: '24px',
          border: '1px solid #D4AF37',
          marginBottom: '20px',
          boxShadow: '0 12px 35px rgba(212, 175, 55, 0.25)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {t('merchantCoinWalletTitle')}
          </span>
          <span style={{ fontSize: '11px', background: 'rgba(212, 175, 55, 0.2)', color: '#F2D675', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
            {t('vp52CoinsUnit')}
          </span>
        </div>

        <h2 style={{ fontSize: '32px', fontWeight: 900, color: '#F2D675', margin: '0 0 6px 0', lineHeight: 1 }}>
          🪙 {(data.merchant_wallet?.balance || stats.merchantCoins || 0).toLocaleString(locale)} <span style={{ fontSize: '16px', fontWeight: 700, color: '#FFFFFF' }}>{t('coinsUnit')}</span>
        </h2>
        <p style={{ fontSize: '12px', color: '#B8B8B8', margin: '0 0 16px 0' }}>
          {t('merchantWalletDesc')}
        </p>

        {/* 2 Stats Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
          <div style={{ background: '#111111', borderRadius: '12px', padding: '10px 14px', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
            <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block' }}>{t('totalReceivedLabel')}</span>
            <strong style={{ fontSize: '15px', color: '#10B981' }}>+{(data.merchant_wallet?.total_received || stats.merchantCoinsReceived || 0).toLocaleString(locale)} {t('coinsUnit')}</strong>
          </div>
          <div style={{ background: '#111111', borderRadius: '12px', padding: '10px 14px', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
            <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block' }}>{t('platformUsageLabel')}</span>
            <strong style={{ fontSize: '15px', color: '#FFFFFF' }}>{(data.merchant_wallet?.total_spent || stats.merchantCoinsSpent || 0).toLocaleString(locale)} {t('coinsUnit')}</strong>
          </div>
        </div>

        {/* Primary Action Button: Scan & Collect Coins */}
        <button
          type="button"
          onClick={() => setIsScanCollectOpen(true)}
          className="btn-primary pulse-glow"
          style={{
            width: '100%',
            padding: '16px',
            fontSize: '15px',
            borderRadius: '16px',
            justifyContent: 'center',
            gap: '10px'
          }}
        >
          <Coins size={20} color="#050505" />
          <span>{t('scanCollectCoinsBtn')}</span>
        </button>
      </div>

      {/* PROMINENT MOBILE CTA: SCAN CUSTOMER QR (IDENTITY LOOKUP) */}
      <button
        type="button"
        onClick={() => {
          setScanError(null);
          setIsCameraOpen(true);
        }}
        style={{
          width: '100%',
          padding: '14px',
          fontSize: '14px',
          fontWeight: 700,
          background: '#151515',
          color: '#F2D675',
          border: '1px solid rgba(212, 175, 55, 0.3)',
          borderRadius: '16px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          cursor: 'pointer'
        }}
      >
        <QrCode size={18} color="#D4AF37" aria-hidden="true" />
        <span>{t('scanCustomerQrBtn')}</span>
      </button>

      {/* MARKETPLACE MANAGEMENT SHORTCUTS */}
      <div style={{ marginBottom: '20px' }}>
        <span style={{ fontSize: '12px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '10px' }}>
          {t('marketplaceManagementUpper')}
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <button
            type="button"
            onClick={() => navigate('/shop/products')}
            style={{ width: '100%', textAlign: 'left', background: '#111111', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '16px', padding: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(212, 175, 55, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ShoppingBag size={20} color="#D4AF37" aria-hidden="true" />
            </div>
            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>{t('catalogMenuCard')}</h4>
              <span style={{ fontSize: '11px', color: '#888888' }}>{t('itemsAndPricingSub')}</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/shop/photos')}
            style={{ width: '100%', textAlign: 'left', background: '#111111', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '16px', padding: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(212, 175, 55, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Camera size={20} color="#D4AF37" aria-hidden="true" />
            </div>
            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>{t('storeGalleryCard')}</h4>
              <span style={{ fontSize: '11px', color: '#888888' }}>{t('photosAndCoverSub')}</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/shop/reviews')}
            style={{ width: '100%', textAlign: 'left', background: '#111111', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '16px', padding: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(212, 175, 55, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Star size={20} color="#F2D675" aria-hidden="true" />
            </div>
            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>{t('reviewsRatingsCard')}</h4>
              <span style={{ fontSize: '11px', color: '#888888' }}>{t('viewAndReplySub')}</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/shop/orders')}
            style={{ width: '100%', textAlign: 'left', background: '#111111', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '16px', padding: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(212, 175, 55, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Package size={20} color="#10b981" aria-hidden="true" />
            </div>
            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>{t('ordersInquiriesCard')}</h4>
              <span style={{ fontSize: '11px', color: '#888888' }}>{t('manageInquiriesSub')}</span>
            </div>
          </button>
        </div>
      </div>

      {scanningCode && (
        <div
          role="status"
          aria-live="polite"
          style={{
            background: '#111111',
            border: '1px solid rgba(212, 175, 55, 0.3)',
            color: '#F2D675',
            padding: '16px',
            borderRadius: '16px',
            marginBottom: '20px',
            fontSize: '13px',
            fontWeight: 700,
            textAlign: 'center'
          }}
        >
          {t('checkingCustomerQr')}
        </div>
      )}

      {/* Customer Found Card Modal / Banner */}
      {scannedCustomer && (
        <div style={{
          background: '#111111', borderRadius: '24px', padding: '24px', border: '1px solid rgba(212, 175, 55, 0.3)',
          marginBottom: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
        }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#151515', border: '1px solid rgba(212, 175, 55, 0.3)', color: '#F2D675', padding: '4px 12px', borderRadius: '99px', fontWeight: 800, fontSize: '12px', marginBottom: '16px' }}>
            <CheckCircle2 size={14} color="#F2D675" /> {t('verifiedCustomerBadge')}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
            <img src={resolveMediaUrl(scannedCustomer.profile_photo)} alt={scannedCustomer.full_name} style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }} />
            <div>
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>{scannedCustomer.full_name}</h3>
              <span style={{ fontSize: '12px', color: '#B8B8B8' }}>{scannedCustomer.email} • {scannedCustomer.phone}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px', fontSize: '13px' }}>
            <div style={{ background: '#151515', padding: '12px', borderRadius: '12px', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
              <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block' }}>{t('availableCoins')}</span>
              <strong style={{ fontSize: '18px', color: '#F2D675' }}>🪙 {scannedCustomer.balance.toLocaleString(locale)} {t('coinsUnit')}</strong>
            </div>

            <div style={{ background: '#151515', padding: '12px', borderRadius: '12px', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
              <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block' }}>{t('yourMembershipTier')}</span>
              <strong style={{ fontSize: '18px', color: '#D4AF37' }}>🏆 {t(`tier_${scannedCustomer.current_level}`) !== `tier_${scannedCustomer.current_level}` ? t(`tier_${scannedCustomer.current_level}`) : scannedCustomer.current_level}</strong>
            </div>
          </div>

          <button
            type="button"
            onClick={handleProceedToBilling}
            className="btn-primary"
            style={{ width: '100%', padding: '14px', fontSize: '15px', justifyContent: 'center', borderRadius: '14px' }}
          >
            {t('createBillRedeemBtn')} <ArrowRight size={18} color="#050505" />
          </button>
        </div>
      )}

      {scanError && (
        <div
          role="alert"
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5',
            padding: '16px',
            borderRadius: '16px',
            marginBottom: '20px',
            fontSize: '13px',
            fontWeight: 700,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <span>{scanError}</span>
          <button
            type="button"
            onClick={() => {
              setScanError(null);
              setIsCameraOpen(true);
            }}
            className="btn-secondary"
            style={{ alignSelf: 'flex-start', padding: '8px 14px', fontSize: '12px', borderRadius: '10px' }}
          >
            {t('scanAgainBtn')}
          </button>
        </div>
      )}

      {/* KPI Mobile Grid Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
        <div style={{ background: '#111111', borderRadius: '16px', padding: '16px', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
          <span style={{ fontSize: '11px', color: '#B8B8B8', fontWeight: 700 }}>{t('todaysRedemptions')}</span>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#FFFFFF', margin: '4px 0 0 0' }}>{stats.todayRedemptions}</h2>
        </div>

        <div style={{ background: '#111111', borderRadius: '16px', padding: '16px', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
          <span style={{ fontSize: '11px', color: '#B8B8B8', fontWeight: 700 }}>{t('totalRedeemed')}</span>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#FFFFFF', margin: '4px 0 0 0' }}>{stats.totalRedemptions}</h2>
        </div>

        <div style={{ background: '#111111', borderRadius: '16px', padding: '16px', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
          <span style={{ fontSize: '11px', color: '#B8B8B8', fontWeight: 700 }}>{t('rewardsTab')}</span>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#F2D675', margin: '4px 0 0 0' }}>{stats.activeOffersCount}</h2>
        </div>

        <div style={{ background: '#111111', borderRadius: '16px', padding: '16px', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
          <span style={{ fontSize: '11px', color: '#B8B8B8', fontWeight: 700 }}>{t('totalDiscountsApproved')}</span>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#D4AF37', margin: '4px 0 0 0' }}>{Number(stats.totalDiscountsGiven || 0).toLocaleString(locale)}</h2>
        </div>
      </div>

      {/* Recent Redemptions Card List */}
      <div style={{ background: '#111111', borderRadius: '20px', padding: '20px', border: '1px solid rgba(212, 175, 55, 0.15)', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF', marginBottom: '14px' }}>{t('recentStoreRedemptions')}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {recentRedemptions.length === 0 ? (
            <div style={{ color: '#888888', fontSize: '13px', textAlign: 'center', padding: '16px' }}>{t('noRedemptionsToday')}</div>
          ) : (
            recentRedemptions.map(r => (
              <div key={r.id} style={{ background: '#151515', padding: '12px', borderRadius: '14px', border: '1px solid rgba(212, 175, 55, 0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 800, color: '#F2D675', fontSize: '13px' }}>{r.redemption_code}</span>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#FFFFFF' }}>{r.customer_name}</div>
                  <span style={{ fontSize: '11px', color: '#B8B8B8' }}>{r.offer_title}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontWeight: 800, color: '#D4AF37', fontSize: '13px' }}>{r.discount_percent}% {t('offUpper')}</span>
                  <span className={`badge ${r.status === 'USED' ? 'badge-used' : 'badge-active'}`} style={{ display: 'block', marginTop: '4px', fontSize: '10px' }}>
                    {r.status === 'USED' ? t('statusUsed') : r.status === 'ACTIVE' ? t('statusActive') : t('statusExpired')}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Customer Coin Collections */}
      {data.recentCoinCollections && data.recentCoinCollections.length > 0 && (
        <div style={{ background: '#111111', borderRadius: '20px', padding: '20px', border: '1px solid rgba(212, 175, 55, 0.25)', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
              {t('recentCoinCollectionsTitle')}
            </h3>
            <span style={{ fontSize: '11px', color: '#10B981', fontWeight: 700 }}>
              +{data.recentCoinCollections.reduce((s, c) => s + (c.coins_amount || 0), 0).toLocaleString(locale)} {t('coinsUnit')}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {data.recentCoinCollections.map(c => (
              <div
                key={c.transfer_id || c.redemption_id}
                style={{
                  background: '#151515',
                  padding: '12px',
                  borderRadius: '14px',
                  border: '1px solid rgba(212, 175, 55, 0.2)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <span style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '13px' }}>{c.customer_name}</span>
                  <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block' }}>
                    {t('refLabel')} {c.redemption_id} • {new Date(c.created_at).toLocaleDateString(locale)}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontWeight: 900, color: '#10B981', fontSize: '14px', display: 'block' }}>
                    +🪙 {Number(c.coins_amount || 0).toLocaleString(locale)} {t('coinsUnit')}
                  </span>
                  <span style={{ fontSize: '11px', color: '#D4AF37', fontWeight: 700 }}>
                    {t('coinsDiscountGivenLabel', { coins: Number(c.coins_amount ?? c.discount_inr ?? 0).toLocaleString(locale) })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
        </div>
      )}

      {/* MERCHANT SCAN & COLLECT MODAL */}
      <MerchantScanCollectModal
        isOpen={isScanCollectOpen}
        onClose={() => setIsScanCollectOpen(false)}
        token={token}
        onCollectionSuccess={fetchDashboard}
      />

      {/* REAL CAMERA QR SCANNER MODAL */}
      {isCameraOpen && (
        <CameraQRScanner
          variant="modal"
          title={t('scanCustomerQrBtn')}
          subtitle={t('merchantDeviceScannerSubtitle')}
          guideText={t('cameraScanGuideCustomer')}
          scanButtonLabel={t('scanQrBtn')}
          manualLabel={t('manualCodeEntry')}
          manualPlaceholder={t('enterCustomerQrTokenPlaceholder')}
          manualSubmitLabel={t('verifyVoucherBtn')}
          isSubmitting={scanningCode}
          onScanSuccess={(qrPayload) => handleScanCustomerPayload(qrPayload)}
          onClose={() => setIsCameraOpen(false)}
        />
      )}
    </div>
  );
}
