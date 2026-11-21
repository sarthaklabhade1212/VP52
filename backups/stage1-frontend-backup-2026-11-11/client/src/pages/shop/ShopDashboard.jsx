import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
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
  const { t } = useI18n();
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
        setScanError(resData.error || 'Failed to scan customer QR token.');
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
    return <div style={{ padding: '40px', color: '#B8B8B8', textAlign: 'center' }}>Loading merchant dashboard...</div>;
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
              Application Pending Verification
            </h4>
            <p style={{ fontSize: '12px', color: '#B8B8B8', margin: '4px 0 0 0', lineHeight: 1.4 }}>
              Your merchant profile is under review by administrator. You can configure your catalog, business hours, and gallery photos below in the meantime.
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
              Application Needs Revision
            </h4>
            <p style={{ fontSize: '12px', color: '#B8B8B8', margin: '4px 0 0 0', lineHeight: 1.4 }}>
              Reason: {shop.rejection_reason || 'Please verify your store address and contact information with VP52 administration.'}
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
              Store Suspended
            </h4>
            <p style={{ fontSize: '12px', color: '#B8B8B8', margin: '4px 0 0 0' }}>
              Your store is currently suspended from customer discovery. Contact administrator for assistance.
            </p>
          </div>
        </div>
      )}

      {/* Top Header & Store ID Badge */}
      <div style={{ background: '#111111', borderRadius: '20px', padding: '20px', border: '1px solid rgba(212, 175, 55, 0.25)', marginBottom: '16px', boxShadow: '0 8px 30px rgba(0,0,0,0.35)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '10px', fontWeight: 800, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.08em', background: '#151515', border: '1px solid rgba(212, 175, 55, 0.3)', padding: '4px 10px', borderRadius: '6px' }}>
            {shop.account_status === 'approved' || shop.status === 'active' ? 'VERIFIED MERCHANT STORE' : 'MERCHANT STORE'}
          </span>
          <span style={{ fontSize: '12px', fontWeight: 800, color: '#F2D675' }}>
            {shop.shop_code}
          </span>
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#FFFFFF', marginTop: '8px', marginBottom: '2px' }}>
          {shop.name}
        </h1>
        <p style={{ fontSize: '12px', color: '#B8B8B8', margin: 0 }}>
          {shop.address} • <strong style={{ color: '#D4AF37' }}>{shop.category}</strong>
          {shop.subcategory ? ` • ${shop.subcategory}` : ''}
        </p>
      </div>

      {/* Navigation Tabs: Overview | My VP52 QR | Alerts */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
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
          📊 Overview
        </button>
        <button
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
          🏷️ My VP52 QR
        </button>
        <button
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
          <Bell size={14} /> Alerts
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
        <div
          onClick={() => setActiveSection('notifications')}
          style={{
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
            <Bell size={20} color="#10B981" />
            <div>
              <strong style={{ fontSize: '13px', color: '#FFFFFF', display: 'block' }}>
                🎉 Coin Payment Received! ({unreadNotifCount} New)
              </strong>
              <span style={{ fontSize: '11px', color: '#B8B8B8' }}>
                Customer paid coins via your permanent QR code. Tap to view payment receipts.
              </span>
            </div>
          </div>
          <ChevronRight size={18} color="#10B981" />
        </div>
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
                In-App Payment Alerts
              </h3>
              <span style={{ fontSize: '11px', color: '#B8B8B8' }}>
                Instant notifications of customer coin transfers
              </span>
            </div>
            {unreadNotifCount > 0 && (
              <button
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
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: '#888888', fontSize: '13px' }}>
              No notifications yet. When customers pay with coins at your counter, alerts will show here in real time.
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
                        {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                  Permanent Counter QR
                </span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#FFFFFF' }}>
                  {shop.permanent_qr_code || 'VP52-MCH-XXXX'}
                </span>
              </div>
            </div>
            <button
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
              <Printer size={13} /> Print Poster
            </button>
          </div>

      {/* MERCHANT COIN WALLET & SCAN-AND-COLLECT HERO CARD (PARTS 5, 6, 7, 8, 9) */}
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
            Merchant Coin Wallet
          </span>
          <span style={{ fontSize: '11px', background: 'rgba(212, 175, 55, 0.2)', color: '#F2D675', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
            1 Coin = ₹1
          </span>
        </div>

        <h2 style={{ fontSize: '32px', fontWeight: 900, color: '#F2D675', margin: '0 0 6px 0', lineHeight: 1 }}>
          🪙 {(data.merchant_wallet?.balance || stats.merchantCoins || 0).toLocaleString()} <span style={{ fontSize: '16px', fontWeight: 700, color: '#FFFFFF' }}>Coins</span>
        </h2>
        <p style={{ fontSize: '12px', color: '#B8B8B8', margin: '0 0 16px 0' }}>
          Customer coins collected in exchange for in-store discounts
        </p>

        {/* 2 Stats Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
          <div style={{ background: '#111111', borderRadius: '12px', padding: '10px 14px', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
            <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block' }}>Total Received</span>
            <strong style={{ fontSize: '15px', color: '#10B981' }}>+{(data.merchant_wallet?.total_received || stats.merchantCoinsReceived || 0).toLocaleString()} Coins</strong>
          </div>
          <div style={{ background: '#111111', borderRadius: '12px', padding: '10px 14px', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
            <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block' }}>Platform Usage</span>
            <strong style={{ fontSize: '15px', color: '#FFFFFF' }}>{(data.merchant_wallet?.total_spent || stats.merchantCoinsSpent || 0).toLocaleString()} Coins</strong>
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
          <span>Scan & Collect Coins (Apply Discount)</span>
        </button>
      </div>

      {/* PROMINENT MOBILE CTA: SCAN CUSTOMER QR (IDENTITY LOOKUP) */}
      <button
        onClick={() => setIsCameraOpen(true)}
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
        <QrCode size={18} color="#D4AF37" />
        <span>{t('scanCustomerQrBtn')}</span>
      </button>

      {/* MARKETPLACE MANAGEMENT SHORTCUTS */}
      <div style={{ marginBottom: '20px' }}>
        <span style={{ fontSize: '12px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '10px' }}>
          Marketplace Management
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div
            onClick={() => navigate('/shop/products')}
            style={{ background: '#111111', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '16px', padding: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(212, 175, 55, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingBag size={20} color="#D4AF37" />
            </div>
            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>Catalog & Menu</h4>
              <span style={{ fontSize: '11px', color: '#888888' }}>Items & Pricing</span>
            </div>
          </div>

          <div
            onClick={() => navigate('/shop/photos')}
            style={{ background: '#111111', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '16px', padding: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(212, 175, 55, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Camera size={20} color="#D4AF37" />
            </div>
            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>Store Gallery</h4>
              <span style={{ fontSize: '11px', color: '#888888' }}>Photos & Cover</span>
            </div>
          </div>

          <div
            onClick={() => navigate('/shop/reviews')}
            style={{ background: '#111111', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '16px', padding: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(212, 175, 55, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Star size={20} color="#F2D675" />
            </div>
            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>Reviews & Ratings</h4>
              <span style={{ fontSize: '11px', color: '#888888' }}>View & Reply</span>
            </div>
          </div>

          <div
            onClick={() => navigate('/shop/orders')}
            style={{ background: '#111111', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '16px', padding: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(212, 175, 55, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={20} color="#10b981" />
            </div>
            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>Orders / Inquiries</h4>
              <span style={{ fontSize: '11px', color: '#888888' }}>Manage Customer Inquiries</span>
            </div>
          </div>
        </div>
      </div>

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
            <img src={scannedCustomer.profile_photo} alt={scannedCustomer.full_name} style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }} />
            <div>
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>{scannedCustomer.full_name}</h3>
              <span style={{ fontSize: '12px', color: '#B8B8B8' }}>{scannedCustomer.email} • {scannedCustomer.phone}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px', fontSize: '13px' }}>
            <div style={{ background: '#151515', padding: '12px', borderRadius: '12px', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
              <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block' }}>{t('availableCoins')}</span>
              <strong style={{ fontSize: '18px', color: '#F2D675' }}>🪙 {scannedCustomer.balance.toLocaleString()} Coins</strong>
            </div>

            <div style={{ background: '#151515', padding: '12px', borderRadius: '12px', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
              <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block' }}>{t('yourMembershipTier')}</span>
              <strong style={{ fontSize: '18px', color: '#D4AF37' }}>🏆 {scannedCustomer.current_level}</strong>
            </div>
          </div>

          <button
            onClick={handleProceedToBilling}
            className="btn-primary"
            style={{ width: '100%', padding: '14px', fontSize: '15px', justifyContent: 'center', borderRadius: '14px' }}
          >
            {t('createBillRedeemBtn')} <ArrowRight size={18} color="#050505" />
          </button>
        </div>
      )}

      {scanError && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '16px', borderRadius: '16px', marginBottom: '20px', fontSize: '13px', fontWeight: 700 }}>
          {scanError}
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
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#D4AF37', margin: '4px 0 0 0' }}>₹{stats.totalDiscountsGiven}</h2>
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
                  <span style={{ fontWeight: 800, color: '#D4AF37', fontSize: '13px' }}>{r.discount_percent}% OFF</span>
                  <span className={`badge ${r.status === 'USED' ? 'badge-used' : 'badge-active'}`} style={{ display: 'block', marginTop: '4px', fontSize: '10px' }}>{r.status}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Customer Coin Collections (1 Coin = ₹1) */}
      {data.recentCoinCollections && data.recentCoinCollections.length > 0 && (
        <div style={{ background: '#111111', borderRadius: '20px', padding: '20px', border: '1px solid rgba(212, 175, 55, 0.25)', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
              Recent Coin Collections (₹ Discount Given)
            </h3>
            <span style={{ fontSize: '11px', color: '#10B981', fontWeight: 700 }}>
              +{data.recentCoinCollections.reduce((s, c) => s + (c.coins_amount || 0), 0)} Coins
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
                    Ref: {c.redemption_id} • {new Date(c.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontWeight: 900, color: '#10B981', fontSize: '14px', display: 'block' }}>
                    +🪙 {c.coins_amount} Coins
                  </span>
                  <span style={{ fontSize: '11px', color: '#D4AF37', fontWeight: 700 }}>
                    ₹{c.discount_inr} OFF Given
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
          onScanSuccess={(qrPayload) => handleScanCustomerPayload(qrPayload)}
          onClose={() => setIsCameraOpen(false)}
        />
      )}
    </div>
  );
}
