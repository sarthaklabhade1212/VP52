import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { APP_NAME } from '../config/brand';
import MerchantMap from '../components/MerchantMap';
import SimulatedAdModal from '../components/SimulatedAdModal';
import vp52Logo from '../assets/vp52-logo.png';
import confetti from 'canvas-confetti';
import {
  checkLocationPermission,
  requestLocationPermission,
  getCurrentLocation
} from '../utils/location';
import {
  Gift,
  Award,
  Clock,
  Search,
  MapPin,
  List,
  Map,
  Tag,
  Star,
  ArrowRight,
  Sparkles,
  Phone,
  Store,
  ChevronRight,
  PlayCircle,
  CheckCircle2,
  Lock,
  Navigation,
  RefreshCw,
  AlertCircle,
  MessageCircle
} from 'lucide-react';

export default function CustomerHome() {
  const navigate = useNavigate();
  const { user, token, updateUserBalance } = useAuth();
  const { t } = useI18n();

  const [shops, setShops] = useState([]);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters State
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [distanceFilter, setDistanceFilter] = useState('5');
  const [viewMode, setViewMode] = useState('list');

  // VP52 6-Hour Coin Session System State
  const [sessionState, setSessionState] = useState('NO_SESSION'); // NO_SESSION, ADS_IN_PROGRESS, READY_TO_START, ACTIVE, COMPLETED_PENDING_CLAIM
  const [coinSession, setCoinSession] = useState(null);
  const [liveEarnedCoins, setLiveEarnedCoins] = useState(0.0);
  const [liveRemainingSeconds, setLiveRemainingSeconds] = useState(0);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [isClaimingSession, setIsClaimingSession] = useState(false);
  const [isAdModalOpen, setIsAdModalOpen] = useState(false);
  const [sessionAdMsg, setSessionAdMsg] = useState(null);

  // Level Progression State
  const [levelInfo, setLevelInfo] = useState(null);

  // GPS Location & Permission State
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('idle');
  const [locationErrorMessage, setLocationErrorMessage] = useState('');
  const [locationPromptDismissed, setLocationPromptDismissed] = useState(false);

  const MAP_FALLBACK = { lat: 18.5204, lng: 73.8567 };
  const mapCenter = userLocation || MAP_FALLBACK;

  const [startingChatShopId, setStartingChatShopId] = useState(null);

  const startChat = (shopId) => {
    if (startingChatShopId) return;
    setStartingChatShopId(shopId);
    fetch('/api/customer/conversations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop_id: shopId })
    })
      .then(res => res.json())
      .then(d => {
        if (d.success && d.conversation) {
          navigate(`/customer/messages/${d.conversation.id}`);
        }
      })
      .catch(console.error)
      .finally(() => setStartingChatShopId(null));
  };

  const fetchShops = () => {
    const params = { search, category };
    if (userLocation) {
      params.lat = userLocation.lat;
      params.lng = userLocation.lng;
      params.maxDistance = distanceFilter;
    }
    const query = new URLSearchParams(params).toString();

    fetch(`/api/customer/shops?${query}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(d => {
        if (d.success) {
          setShops(d.shops || []);
          setOffers(d.offers || []);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const fetchCoinSession = () => {
    fetch('/api/customer/coin-session', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(d => {
        if (d.success) {
          setSessionState(d.session_state || 'NO_SESSION');
          setCoinSession(d.session || null);
        }
      })
      .catch(console.error);
  };

  const fetchLevelInfo = () => {
    fetch('/api/customer/level', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(d => {
        if (d.success) setLevelInfo(d);
      })
      .catch(console.error);
  };

  // Timestamp-driven live coin generation calculations (Prevents timer drift & pauses)
  useEffect(() => {
    if (!coinSession || coinSession.status !== 'active' || !coinSession.started_at) return;

    const updateLiveCoins = () => {
      const now = Date.now();
      const startedMs = new Date(coinSession.started_at).getTime();
      const expiresMs = new Date(coinSession.expires_at).getTime();
      const durationSec = coinSession.duration_seconds || 21600;

      const elapsedSec = Math.max(0, (now - startedMs) / 1000);
      const remainingSec = Math.max(0, Math.ceil((expiresMs - now) / 1000));
      const coins = Math.min(100.0, Math.max(0.0, (elapsedSec / durationSec) * 100.0));

      setLiveEarnedCoins(coins);
      setLiveRemainingSeconds(remainingSec);

      if (remainingSec <= 0 || now >= expiresMs) {
        setLiveEarnedCoins(100.0);
        setLiveRemainingSeconds(0);
        fetchCoinSession();
      }
    };

    updateLiveCoins();
    const interval = setInterval(updateLiveCoins, 1000);
    return () => clearInterval(interval);
  }, [coinSession?.id, coinSession?.started_at, coinSession?.expires_at, coinSession?.status]);

  const handleWatchSessionAd = async () => {
    setIsAdModalOpen(false);
    setSessionAdMsg(null);
    try {
      const res = await fetch('/api/customer/coin-session/ad-complete', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        setSessionAdMsg(data.message);
        fetchCoinSession();
      } else {
        setSessionAdMsg(data.error);
      }
    } catch (err) {
      console.error('Session ad completion error:', err);
    }
  };

  const handleStartSession = async () => {
    setIsStartingSession(true);
    setSessionAdMsg(null);
    try {
      const res = await fetch('/api/customer/coin-session/start', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        setSessionAdMsg(data.message);
        fetchCoinSession();
      } else {
        setSessionAdMsg(data.error);
      }
    } catch (err) {
      console.error('Start session error:', err);
    } finally {
      setIsStartingSession(false);
    }
  };

  const handleClaimSessionReward = async () => {
    setIsClaimingSession(true);
    setSessionAdMsg(null);
    try {
      const res = await fetch('/api/customer/coin-session/complete', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        try { confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } }); } catch (_) {}
        setSessionAdMsg(data.message);
        if (data.newBalance !== undefined) updateUserBalance(data.newBalance);
        fetchCoinSession();
        fetchShops();
        fetchLevelInfo();
      } else {
        setSessionAdMsg(data.error);
      }
    } catch (err) {
      console.error('Claim session reward error:', err);
    } finally {
      setIsClaimingSession(false);
    }
  };

  const handleRequestLocation = async () => {
    setLocationStatus('requesting');
    setLocationErrorMessage('');
    setLocationPromptDismissed(false);
    try {
      const perm = await requestLocationPermission();
      if (perm === 'granted') {
        const coords = await getCurrentLocation();
        setUserLocation({ lat: coords.lat, lng: coords.lng });
        setLocationStatus('granted');
      } else {
        setLocationStatus('denied');
        setLocationErrorMessage(t('locDeniedMsg'));
      }
    } catch (err) {
      console.warn('[CustomerHome] Location request error:', err);
      setLocationStatus('error');
      setLocationErrorMessage(err.message || t('locUnavailableMsg'));
    }
  };

  const handleDismissLocation = () => {
    setLocationPromptDismissed(true);
  };

  const handleGetDirections = (shop) => {
    if (shop.latitude == null || shop.longitude == null) return;
    const dest = `${shop.latitude},${shop.longitude}`;
    const primary = `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
    try {
      const win = window.open(primary, '_blank', 'noopener,noreferrer');
      if (!win) {
        window.location.href = primary;
      }
    } catch (err) {
      window.location.href = `https://maps.google.com/?q=${dest}`;
    }
  };

  useEffect(() => {
    let cancelled = false;
    const initLocation = async () => {
      try {
        const perm = await checkLocationPermission();
        if (cancelled) return;
        if (perm === 'granted') {
          try {
            const coords = await getCurrentLocation();
            if (cancelled) return;
            setUserLocation({ lat: coords.lat, lng: coords.lng });
            setLocationStatus('granted');
          } catch (err) {
            if (cancelled) return;
            setLocationStatus('prompt');
          }
        } else if (perm === 'denied') {
          setLocationStatus('denied');
          setLocationErrorMessage(t('locDeniedMsg'));
        } else {
          setLocationStatus('prompt');
        }
      } catch (err) {
        if (!cancelled) setLocationStatus('prompt');
      }
    };

    initLocation();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (token) {
      fetchShops();
      fetchCoinSession();
      fetchLevelInfo();
    }
  }, [token, search, category, distanceFilter, userLocation]);

  const formatTime = (seconds) => {
    if (!seconds || seconds <= 0) return '00:00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const categories = ['All', 'Restaurant', 'Hotel', 'Food', 'Clothing', 'Paithani', 'Salon', 'Jewellery', 'Grocery'];

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '40px', background: '#050505' }}>
      {/* Top Profile & Points Card */}
      <div style={{
        background: 'linear-gradient(135deg, #0B0B0B 0%, #17130A 50%, #0B0B0B 100%)',
        borderRadius: '24px',
        padding: '24px',
        color: '#FFFFFF',
        marginBottom: '24px',
        border: '1px solid rgba(212, 175, 55, 0.25)',
        boxShadow: '0 15px 35px rgba(0, 0, 0, 0.8), 0 0 20px rgba(212, 175, 55, 0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '50%', background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)', color: '#050505',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '22px'
            }}>
              {user ? user.full_name.charAt(0).toUpperCase() : 'C'}
            </div>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>{user ? user.full_name : 'Customer'}</h2>
              <span style={{ fontSize: '12px', color: '#B8B8B8', fontWeight: 600 }}>
                {user ? user.email : ''}
              </span>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#B8B8B8', display: 'block' }}>
              AVAILABLE COINS
            </span>
            <span style={{ fontSize: '28px', fontWeight: 800, color: '#F2D675' }}>
              🪙 {user ? user.balance.toLocaleString() : 0}
            </span>
            <span style={{ fontSize: '11px', color: '#D4AF37', display: 'block', fontWeight: 700 }}>
              (₹{user ? user.balance.toLocaleString() : 0} Discount Value)
            </span>
          </div>
        </div>

        {/* Level Progression & Discount Cap Card */}
        {levelInfo && (
          <div style={{ background: '#111111', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '16px', padding: '14px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 800, marginBottom: '6px', color: '#FFFFFF' }}>
              <span>🏆 Tier: <span style={{ color: '#F2D675' }}>{levelInfo.currentLevel}</span> ({levelInfo.discountCapPercent}% Cap)</span>
              <span style={{ color: '#B8B8B8' }}>Next: {levelInfo.nextLevel} ({levelInfo.lifetimeCoins}/{levelInfo.minForNext} Coins)</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: '#1A1A1A', borderRadius: '4px', overflow: 'hidden', marginBottom: '6px' }}>
              <div style={{ width: `${levelInfo.progressPercent}%`, height: '100%', background: 'linear-gradient(90deg, #C9A227 0%, #F2D675 100%)', transition: 'width 0.3s ease' }} />
            </div>
            <div style={{ fontSize: '11px', color: '#B8B8B8' }}>
              {levelInfo.benefits} • Lifetime Coins: <strong style={{ color: '#F2D675' }}>{levelInfo.lifetimeCoins}</strong>
            </div>
          </div>
        )}
      </div>

      {/* VP52 6-HOUR COIN SESSION SYSTEM CARD */}
      <div style={{
        background: '#111111',
        borderRadius: '24px',
        padding: '24px',
        marginBottom: '24px',
        border: '1px solid rgba(212, 175, 55, 0.3)',
        boxShadow: '0 12px 35px rgba(0, 0, 0, 0.8), 0 0 25px rgba(212, 175, 55, 0.08)'
      }}>
        {/* Card Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src={vp52Logo} alt="VP52" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>VP52 Earning Session</h3>
              <span style={{ fontSize: '12px', color: '#B8B8B8' }}>Earn 100 VP52 Coins in 6 Hours</span>
            </div>
          </div>

          {(sessionState === 'ACTIVE' || sessionState === 'COMPLETED_PENDING_CLAIM') && (
            <div style={{ background: '#151515', padding: '8px 14px', borderRadius: '12px', border: '1px solid rgba(212, 175, 55, 0.3)', textAlign: 'center' }}>
              <span style={{ fontSize: '10px', color: '#B8B8B8', textTransform: 'uppercase', fontWeight: 800, display: 'block' }}>
                TIME REMAINING
              </span>
              <span style={{ fontSize: '16px', fontWeight: 800, color: '#F2D675', fontFamily: 'monospace' }}>
                {formatTime(liveRemainingSeconds)}
              </span>
            </div>
          )}
        </div>

        {sessionAdMsg && (
          <div style={{ background: 'rgba(212, 175, 55, 0.15)', border: '1px solid rgba(212, 175, 55, 0.3)', color: '#F2D675', padding: '12px', borderRadius: '14px', fontSize: '13px', fontWeight: 700, marginBottom: '16px', textAlign: 'center' }}>
            {sessionAdMsg}
          </div>
        )}

        {/* STATE 1, 2, 3: PRE-SESSION ADS REQUIREMENT */}
        {(sessionState === 'NO_SESSION' || sessionState === 'ADS_IN_PROGRESS' || sessionState === 'READY_TO_START') && (
          <div>
            <div style={{ background: '#151515', border: '1px solid rgba(212, 175, 55, 0.2)', padding: '16px', borderRadius: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#FFFFFF' }}>Watch 3 Ads to Start Session</span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#F2D675' }}>
                  Ads Completed: {coinSession?.ads_completed || 0} / 3
                </span>
              </div>

              {/* 3 Step Indicators */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                {[1, 2, 3].map(step => {
                  const done = step <= (coinSession?.ads_completed || 0);
                  return (
                    <div
                      key={step}
                      style={{
                        flex: 1,
                        height: '8px',
                        borderRadius: '4px',
                        background: done ? 'linear-gradient(90deg, #C9A227 0%, #F2D675 100%)' : '#222222',
                        transition: 'all 0.3s ease'
                      }}
                    />
                  );
                })}
              </div>
              <span style={{ fontSize: '11px', color: '#B8B8B8' }}>
                {coinSession?.ads_completed >= 3
                  ? '✅ All 3 ads completed! Unlock your 6-hour session now.'
                  : `Complete ${3 - (coinSession?.ads_completed || 0)} more advertisement(s) to unlock.`}
              </span>
            </div>

            {coinSession?.ads_completed >= 3 ? (
              <button
                type="button"
                onClick={handleStartSession}
                disabled={isStartingSession}
                className="btn-primary pulse-glow"
                style={{ width: '100%', padding: '16px', fontSize: '16px', borderRadius: '14px', justifyContent: 'center' }}
              >
                🚀 {isStartingSession ? 'Starting Session...' : 'Start 6-Hour Session (+100 Coins)'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsAdModalOpen(true)}
                className="btn-primary"
                style={{ width: '100%', padding: '16px', fontSize: '15px', borderRadius: '14px', justifyContent: 'center' }}
              >
                <PlayCircle size={20} color="#050505" /> Watch Ad ({coinSession?.ads_completed || 0}/3 Completed)
              </button>
            )}
          </div>
        )}

        {/* STATE 4: ACTIVE LIVE EARNING SESSION */}
        {sessionState === 'ACTIVE' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ background: 'radial-gradient(circle, rgba(212, 175, 55, 0.15) 0%, #151515 80%)', border: '1px solid rgba(212, 175, 55, 0.3)', borderRadius: '20px', padding: '24px 16px', marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#B8B8B8', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>
                VP52 COINS EARNED
              </div>

              <div style={{ fontSize: '36px', fontWeight: 900, color: '#F2D675', fontFamily: 'monospace', letterSpacing: '0.02em', margin: '4px 0' }}>
                {liveEarnedCoins.toFixed(5)}
              </div>

              <div style={{ fontSize: '12px', fontWeight: 700, color: '#D4AF37', display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#111111', padding: '4px 12px', borderRadius: '99px', border: '1px solid rgba(212, 175, 55, 0.2)', marginBottom: '14px' }}>
                <Sparkles size={14} color="#F2D675" /> +0.00463 COINS / SECOND
              </div>

              {/* Progress Bar */}
              <div style={{ width: '100%', height: '10px', background: '#050505', borderRadius: '5px', overflow: 'hidden', border: '1px solid rgba(212, 175, 55, 0.2)', marginBottom: '8px' }}>
                <div style={{ width: `${Math.min(100, Math.max(0, liveEarnedCoins))}%`, height: '100%', background: 'linear-gradient(90deg, #C9A227 0%, #F2D675 100%)', transition: 'width 0.5s linear' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, color: '#B8B8B8' }}>
                <span>SESSION PROGRESS</span>
                <span style={{ color: '#F2D675' }}>{Math.min(100, Math.max(0, liveEarnedCoins)).toFixed(2)}%</span>
              </div>
            </div>

            <span style={{ fontSize: '11px', color: '#777777', fontWeight: 600 }}>
              ⚡ Earning rate synced with server timestamps. Progress continues when app is closed.
            </span>
          </div>
        )}

        {/* STATE 5: SESSION COMPLETED / CLAIM REWARD */}
        {sessionState === 'COMPLETED_PENDING_CLAIM' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ background: 'linear-gradient(135deg, #151515 0%, #1F190B 100%)', border: '1px solid #D4AF37', borderRadius: '20px', padding: '24px 16px', marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#F2D675', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>
                🎉 SESSION COMPLETE!
              </div>

              <div style={{ fontSize: '38px', fontWeight: 900, color: '#FFFFFF', margin: '6px 0' }}>
                100.00000
              </div>

              <div style={{ fontSize: '14px', fontWeight: 800, color: '#F2D675', marginBottom: '16px' }}>
                VP52 COINS EARNED
              </div>

              <button
                type="button"
                onClick={handleClaimSessionReward}
                disabled={isClaimingSession}
                className="btn-primary pulse-glow"
                style={{ width: '100%', padding: '16px', fontSize: '16px', borderRadius: '14px', justifyContent: 'center' }}
              >
                🎁 {isClaimingSession ? 'Claiming 100 Coins...' : 'Claim 100 VP52 Coins to Wallet'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* LOCATION OPT-IN / STATUS CARD */}
      {locationStatus === 'granted' ? (
        <div style={{ background: '#111111', border: '1px solid rgba(212, 175, 55, 0.25)', borderRadius: '18px', padding: '14px 18px', marginBottom: '20px', fontSize: '13px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Navigation size={20} color="#D4AF37" />
              <div>
                <span style={{ fontWeight: 800, color: '#FFFFFF', display: 'block' }}>
                  {t('locActive')} ({userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)})
                </span>
                <span style={{ fontSize: '11px', color: '#B8B8B8' }}>{t('locGrantedSub')}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRequestLocation}
              style={{ padding: '8px 14px', borderRadius: '12px', border: '1px solid rgba(212, 175, 55, 0.3)', background: '#151515', color: '#F2D675', fontWeight: 800, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
            >
              <RefreshCw size={14} color="#D4AF37" /> {t('locRefresh')}
            </button>
          </div>
        </div>
      ) : locationStatus === 'requesting' ? (
        <div style={{ background: '#111111', border: '1px solid rgba(212, 175, 55, 0.25)', borderRadius: '18px', padding: '14px 18px', marginBottom: '20px', fontSize: '13px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <RefreshCw size={18} color="#D4AF37" style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontWeight: 800, color: '#FFFFFF' }}>{t('locObtaining')}</span>
          </div>
        </div>
      ) : locationPromptDismissed ? (
        <div style={{ background: '#111111', border: '1px solid rgba(212, 175, 55, 0.25)', borderRadius: '18px', padding: '12px 16px', marginBottom: '20px', fontSize: '12.5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: '#B8B8B8', fontWeight: 600 }}>{t('enableLocationForDistance')}</span>
          <button
            type="button"
            onClick={handleRequestLocation}
            className="btn-primary"
            style={{ padding: '8px 14px', fontSize: '12px', whiteSpace: 'nowrap' }}
          >
            {t('locEnable')}
          </button>
        </div>
      ) : (
        (() => {
          const isProblem = locationStatus === 'denied' || locationStatus === 'error';
          const sub = locationStatus === 'denied'
            ? (locationErrorMessage || t('locDenied'))
            : locationStatus === 'error'
            ? (locationErrorMessage || t('locUnavailableMsg'))
            : t('locEnableSub');
          return (
            <div style={{ background: '#111111', border: '1px solid rgba(212, 175, 55, 0.25)', borderRadius: '18px', padding: '16px 18px', marginBottom: '20px', fontSize: '13px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '12px' }}>
                <MapPin size={22} color="#D4AF37" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <span style={{ fontWeight: 800, color: '#FFFFFF', display: 'block', fontSize: '15px' }}>{t('locFindNearby')}</span>
                  <span style={{ fontSize: '12px', color: '#B8B8B8' }}>{sub}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleRequestLocation}
                  className="btn-primary"
                  style={{ flex: 1, padding: '11px', fontSize: '13px', justifyContent: 'center' }}
                >
                  <Navigation size={15} color="#050505" /> {isProblem ? t('locRetry') : t('locEnable')}
                </button>
                <button
                  type="button"
                  onClick={handleDismissLocation}
                  className="btn-secondary"
                  style={{ flex: 1, padding: '11px', fontSize: '13px', justifyContent: 'center' }}
                >
                  {t('locNotNow')}
                </button>
              </div>
              {locationStatus === 'denied' && (
                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed rgba(212, 175, 55, 0.3)', fontSize: '11px', color: '#F2D675' }}>
                  ℹ️ {t('locDeniedHelp').replace('{app}', APP_NAME)}
                </div>
              )}
            </div>
          );
        })()
      )}

      {/* Prominent Search Bar */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={20} color="#C9A227" style={{ position: 'absolute', left: '16px', top: '16px' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '48px', height: '52px', fontSize: '15px', borderRadius: '16px' }}
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Category Pills & View Mode Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', maxWidth: '75%' }}>
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              style={{
                padding: '8px 16px',
                borderRadius: '99px',
                fontSize: '12px',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                border: category === c ? '1px solid #D4AF37' : '1px solid rgba(212, 175, 55, 0.15)',
                background: category === c ? 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)' : '#111111',
                color: category === c ? '#050505' : '#B8B8B8',
                boxShadow: category === c ? '0 4px 12px rgba(212, 175, 55, 0.25)' : 'none',
                cursor: 'pointer'
              }}
            >
              {c}
            </button>
          ))}
        </div>

        {/* View Mode Toggle: List / Map */}
        <div style={{ display: 'flex', background: '#151515', borderRadius: '12px', padding: '3px', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
          <button
            onClick={() => setViewMode('list')}
            style={{
              padding: '6px 12px', borderRadius: '99px', border: 'none',
              background: viewMode === 'list' ? '#111111' : 'transparent',
              color: viewMode === 'list' ? '#D4AF37' : '#777777', cursor: 'pointer'
            }}
          >
            <List size={16} color={viewMode === 'list' ? '#D4AF37' : '#777777'} />
          </button>
          <button
            onClick={() => setViewMode('map')}
            style={{
              padding: '6px 12px', borderRadius: '99px', border: 'none',
              background: viewMode === 'map' ? '#111111' : 'transparent',
              color: viewMode === 'map' ? '#D4AF37' : '#777777', cursor: 'pointer'
            }}
          >
            <Map size={16} color={viewMode === 'map' ? '#D4AF37' : '#777777'} />
          </button>
        </div>
      </div>

      {/* Radius Filter */}
      {locationStatus === 'granted' && (
        <div style={{ marginBottom: '16px' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: '#B8B8B8', display: 'block', marginBottom: '8px' }}>{t('radiusLabel')}</span>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            {['1', '3', '5', '10', '25', '50', 'all'].map(r => (
              <button
                key={r}
                onClick={() => setDistanceFilter(r)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '99px',
                  fontSize: '12px',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  border: distanceFilter === r ? '1px solid #D4AF37' : '1px solid rgba(212, 175, 55, 0.15)',
                  background: distanceFilter === r ? '#111111' : '#151515',
                  color: distanceFilter === r ? '#F2D675' : '#B8B8B8',
                  boxShadow: distanceFilter === r ? '0 4px 12px rgba(212, 175, 55, 0.2)' : 'none',
                  cursor: 'pointer'
                }}
              >
                {r === 'all' ? t('radiusAll') : `${r} ${t('kmUnit')}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* View Mode Component Switch */}
      {viewMode === 'map' ? (
        <MerchantMap
          shops={shops}
          merchants={shops}
          userLat={mapCenter.lat}
          userLng={mapCenter.lng}
          userLocation={mapCenter}
          onSelectShop={(s) => navigate('/customer/rewards')}
          onSelectMerchant={(s) => navigate('/customer/rewards')}
        />
      ) : (
        /* Shops & Offers List */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {shops.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: '#B8B8B8', background: '#111111', borderRadius: '20px', border: '1px dashed rgba(212, 175, 55, 0.3)', fontSize: '13px', fontWeight: 600 }}>
              {t('noNearbyShops')}
            </div>
          )}
          {shops.map(shop => (
            <div key={shop.id} style={{ background: '#111111', borderRadius: '20px', padding: '16px', border: '1px solid rgba(212, 175, 55, 0.15)', display: 'flex', gap: '16px', boxShadow: '0 8px 30px rgba(0,0,0,0.35)' }}>
              <img src={shop.image_url} alt={shop.name} style={{ width: '90px', height: '90px', borderRadius: '14px', objectFit: 'cover' }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#D4AF37', textTransform: 'uppercase' }}>{shop.category}</span>
                  {shop.distance_km != null && (
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#F2D675', background: '#151515', border: '1px solid rgba(212, 175, 55, 0.3)', padding: '3px 8px', borderRadius: '8px', whiteSpace: 'nowrap' }}>
                      📍 {shop.distance_km} {t('kmAway')}
                    </span>
                  )}
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF', margin: '2px 0' }}>{shop.name}</h3>
                <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block', marginBottom: '8px' }}>📍 {shop.address}</span>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button onClick={() => navigate('/customer/rewards')} className="btn-primary" style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '8px' }}>
                    {t('viewOffers')} <ChevronRight size={14} color="#050505" />
                  </button>
                  <button
                    onClick={() => startChat(shop.id)}
                    disabled={startingChatShopId === shop.id}
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '8px', cursor: startingChatShopId === shop.id ? 'wait' : 'pointer' }}
                  >
                    <MessageCircle size={14} color="#D4AF37" /> {t('chatWithMerchant')}
                  </button>
                  {shop.latitude != null && shop.longitude != null && (
                    <button
                      onClick={() => handleGetDirections(shop)}
                      style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '8px', border: '1px solid rgba(212, 175, 55, 0.3)', background: '#151515', color: '#F2D675', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}
                    >
                      <Navigation size={14} color="#F2D675" /> ↗ {t('getDirections')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SIMULATED DEMO AD REWARD MODAL */}
      {isAdModalOpen && (
        <SimulatedAdModal
          isOpen={isAdModalOpen}
          onClose={() => setIsAdModalOpen(false)}
          onAdCompleted={handleWatchSessionAd}
        />
      )}
    </div>
  );
}
