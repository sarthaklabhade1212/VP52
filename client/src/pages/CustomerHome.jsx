import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { APP_NAME } from '../config/brand';
import { CATEGORIES, getCategoryById } from '../config/categories';
import CategoryIcon from '../components/CategoryIcon';
import MerchantMap from '../components/MerchantMap';
import vp52Logo from '../assets/vp52-logo.png';
import confetti from 'canvas-confetti';
import GoogleNativeAdCard from '../components/GoogleNativeAdCard';
import CustomerScanPayModal from '../components/CustomerScanPayModal';
import { loadSessionStartNativeAds, runSequentialRewardedAdFlow } from '../services/admobService';
import { parseApiResponse, resolveApiErrorMessage, resolveMediaUrl, resolveNetworkErrorMessage } from '../utils/api';
import { formatNumber } from '../utils/formatters';
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
  MessageCircle,
  QrCode
} from 'lucide-react';

export default function CustomerHome() {
  const navigate = useNavigate();
  const { user, token, updateUserBalance } = useAuth();
  const { t, locale, translateCategory, translateSubcategory } = useI18n();

  const translateTierName = (name) => {
    if (!name) return '';
    if (name === 'Max Level') return t('maxLevelLabel');
    const key = `tier_${name}`;
    const translated = t(key);
    return translated === key ? name : translated;
  };

  const translateLevelBenefit = (benefits) => {
    if (!benefits) return '';
    const map = {
      'Standard Membership & Access to local shop offers': 'levelBenefitBasic',
      'Silver Member & Up to 7% Max Discount Cap': 'levelBenefitSilver',
      'Gold Member & Up to 10% Max Discount Cap': 'levelBenefitGold',
      'Diamond Member & Up to 15% Max Discount Cap': 'levelBenefitDiamond',
      'Platinum VIP Member & Up to 20% Max Discount Cap': 'levelBenefitPlatinum'
    };
    const key = map[benefits];
    return key ? t(key) : benefits;
  };

  const translateSessionStatus = (status) => {
    const k = `sessionStatus_${String(status || '').toLowerCase()}`;
    const res = t(k);
    return res === k ? status : res;
  };

  const [shops, setShops] = useState([]);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters State
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [selectedSubcategory, setSelectedSubcategory] = useState('All');
  const [minRating, setMinRating] = useState('all');
  const [openNow, setOpenNow] = useState(false);
  const [sortBy, setSortBy] = useState('distance');
  const [distanceFilter, setDistanceFilter] = useState('all');
  const [viewMode, setViewMode] = useState('list');
  const [isScanPayModalOpen, setIsScanPayModalOpen] = useState(false);
  const [scanModalInitialQr, setScanModalInitialQr] = useState('');
  const [avatarImgError, setAvatarImgError] = useState(false);

  useEffect(() => {
    setAvatarImgError(false);
  }, [user?.profile_photo]);

  // VP52 6-Hour Coin Session System State
  const [sessionState, setSessionState] = useState('NO_SESSION'); // NO_SESSION, ADS_IN_PROGRESS, READY_TO_START, ACTIVE, COMPLETED_PENDING_CLAIM
  const [coinSession, setCoinSession] = useState(null);
  const [liveEarnedCoins, setLiveEarnedCoins] = useState(0.0);
  const [liveRemainingSeconds, setLiveRemainingSeconds] = useState(0);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [isClaimingSession, setIsClaimingSession] = useState(false);
  const [sessionAdMsg, setSessionAdMsg] = useState(null);
  const [sessionNativeAds, setSessionNativeAds] = useState([]);
  const [isSessionStartedModalOpen, setIsSessionStartedModalOpen] = useState(false);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [showSessionHistory, setShowSessionHistory] = useState(false);

  // SSV-Verified Rewarded Ads State (1 Coin per verified ad, max 3 per 6h session)
  const [rewardAdSession, setRewardAdSession] = useState(null);
  const [isWatchingRewardedAd, setIsWatchingRewardedAd] = useState(false);
  const [rewardAdStatusMsg, setRewardAdStatusMsg] = useState(null);

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
      .then(res => parseApiResponse(res))
      .then(parsed => {
        const d = parsed.data;
        if (parsed.ok && d && d.success && d.conversation) {
          navigate(`/customer/messages/${d.conversation.id}`);
        } else {
          setSessionAdMsg(resolveApiErrorMessage(parsed, t, 'serverErrorFallback'));
        }
      })
      .catch(err => setSessionAdMsg(resolveNetworkErrorMessage(err, t, 'networkErrorGeneric')))
      .finally(() => setStartingChatShopId(null));
  };

  const fetchShops = () => {
    const params = { search, category };
    if (selectedSubcategory && selectedSubcategory !== 'All') {
      params.subcategory = selectedSubcategory;
    }
    if (minRating && minRating !== 'all') {
      params.minRating = minRating;
    }
    if (openNow) {
      params.openNow = 'true';
    }
    if (sortBy) {
      params.sortBy = sortBy;
    }
    if (userLocation) {
      params.lat = userLocation.lat;
      params.lng = userLocation.lng;
      params.maxDistance = distanceFilter;
    }
    const query = new URLSearchParams(params).toString();

    fetch(`/api/customer/shops?${query}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => parseApiResponse(res))
      .then(parsed => {
        const d = parsed.data;
        if (parsed.ok && d && d.success) {
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
      .then(res => parseApiResponse(res))
      .then(parsed => {
        const d = parsed.data;
        if (parsed.ok && d && d.success) {
          setSessionState(d.session_state || 'NO_SESSION');
          setCoinSession(d.session || null);
          if (d.session_history) setSessionHistory(d.session_history);
        }
      })
      .catch(console.error);
  };

  const fetchRewardSessionStatus = () => {
    fetch('/api/customer/reward-session/status', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => parseApiResponse(res))
      .then(parsed => {
        const d = parsed.data;
        if (parsed.ok && d && d.success && d.session) {
          setRewardAdSession(d.session);
        }
      })
      .catch(console.error);
  };

  const fetchLevelInfo = () => {
    fetch('/api/customer/level', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => parseApiResponse(res))
      .then(parsed => {
        const d = parsed.data;
        if (parsed.ok && d && d.success) setLevelInfo(d);
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

  const handleStartSession = async () => {
    setIsStartingSession(true);
    setSessionAdMsg(null);
    try {
      const res = await fetch('/api/customer/coin-session/start', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      const parsed = await parseApiResponse(res);
      const data = parsed.data;
      if (parsed.ok && data && data.success) {
        setSessionAdMsg(data.message);
        fetchCoinSession();
        // Load up to 3 Google Native Ads for post-start confirmation screen
        const ads = await loadSessionStartNativeAds(token, 3);
        setSessionNativeAds(ads || []);
        setIsSessionStartedModalOpen(true);
      } else {
        setSessionAdMsg(resolveApiErrorMessage(parsed, t, 'serverErrorFallback'));
      }
    } catch (err) {
      setSessionAdMsg(resolveNetworkErrorMessage(err, t, 'networkErrorGeneric'));
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
      const parsed = await parseApiResponse(res);
      const data = parsed.data;
      if (parsed.ok && data && data.success) {
        try { confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } }); } catch (_) {}
        setSessionAdMsg(data.message);
        if (data.newBalance !== undefined) updateUserBalance(data.newBalance);
        fetchCoinSession();
        fetchRewardSessionStatus();
        fetchShops();
        fetchLevelInfo();
      } else {
        setSessionAdMsg(resolveApiErrorMessage(parsed, t, 'serverErrorFallback'));
      }
    } catch (err) {
      setSessionAdMsg(resolveNetworkErrorMessage(err, t, 'networkErrorGeneric'));
    } finally {
      setIsClaimingSession(false);
    }
  };

  const handleWatchRewardedAd = async () => {
    if (isWatchingRewardedAd || !token) return;
    setIsWatchingRewardedAd(true);
    setRewardAdStatusMsg(null);
    try {
      const result = await runSequentialRewardedAdFlow({
        token,
        sessionType: 'reward_session'
      });

      if (result && result.status === 'verified') {
        if (result.walletBalance !== null && result.walletBalance !== undefined) {
          updateUserBalance(result.walletBalance);
        }
        setRewardAdStatusMsg({ type: 'success', text: t('rewardedAdVerifiedSuccess') });
        fetchRewardSessionStatus();
        fetchLevelInfo();
      } else if (result && result.status === 'ssv_pending') {
        // Delayed SSV callback: NEVER grant speculative coins on client
        setRewardAdStatusMsg({ type: 'pending', text: t('rewardedAdPendingSsvNotice') });
        fetchRewardSessionStatus();
      } else {
        setRewardAdStatusMsg({
          type: 'error',
          text: (result && result.error) || t('serverErrorFallback')
        });
        fetchRewardSessionStatus();
      }
    } catch (err) {
      setRewardAdStatusMsg({
        type: 'error',
        text: resolveNetworkErrorMessage(err, t, 'networkErrorGeneric')
      });
    } finally {
      setIsWatchingRewardedAd(false);
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
      fetchRewardSessionStatus();
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchShops();
      fetchCoinSession();
      fetchLevelInfo();
    }
  }, [token, search, category, selectedSubcategory, minRating, openNow, sortBy, distanceFilter, userLocation]);

  const isShopOpenNow = (shop) => {
    if (shop.is_temporarily_closed) return false;
    if (!shop.opening_time || !shop.closing_time) return true;
    try {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const [oH, oM] = shop.opening_time.split(':').map(Number);
      const [cH, cM] = shop.closing_time.split(':').map(Number);
      const openMinutes = oH * 60 + (oM || 0);
      const closeMinutes = cH * 60 + (cM || 0);
      if (closeMinutes >= openMinutes) {
        return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
      } else {
        return currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
      }
    } catch (e) {
      return true;
    }
  };

  const formatTime = (seconds) => {
    if (!seconds || seconds <= 0) return '00:00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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
            <div
              onClick={() => navigate('/customer/profile')}
              style={{ position: 'relative', width: '52px', height: '52px', flexShrink: 0, cursor: 'pointer' }}
              title={t('viewProfileSettings')}
            >
              {user?.profile_photo && !avatarImgError ? (
                <img
                  src={resolveMediaUrl(user.profile_photo)}
                  alt={user.full_name || t('navProfile')}
                  onError={() => setAvatarImgError(true)}
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2px solid #D4AF37',
                    boxShadow: '0 4px 15px rgba(212, 175, 55, 0.35)',
                    display: 'block'
                  }}
                />
              ) : (
                <div style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)',
                  color: '#050505',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '22px',
                  border: '2px solid #D4AF37',
                  boxShadow: '0 4px 15px rgba(212, 175, 55, 0.35)'
                }}>
                  {user && user.full_name ? user.full_name.charAt(0).toUpperCase() : 'C'}
                </div>
              )}
            </div>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>{user ? user.full_name : t('customerLabel')}</h2>
              <span style={{ fontSize: '12px', color: '#B8B8B8', fontWeight: 600 }}>
                {user ? user.email : ''}
              </span>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#B8B8B8', display: 'block' }}>
              {t('availableCoins')}
            </span>
            <span style={{ fontSize: '28px', fontWeight: 800, color: '#F2D675' }}>
              🪙 {user ? formatNumber(user.balance || 0, locale) : 0} <span style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF' }}>{t('coinsUnit')}</span>
            </span>
          </div>
        </div>

        {/* Level Progression & Discount Cap Card */}
        {levelInfo && (
          <div style={{ background: '#111111', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '16px', padding: '14px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 800, marginBottom: '6px', color: '#FFFFFF', gap: '8px', flexWrap: 'wrap' }}>
              <span>🏆 {t('tierLabel')}: <span style={{ color: '#F2D675' }}>{translateTierName(levelInfo.currentLevel)}</span> ({t('capPercentLabel', { cap: levelInfo.discountCapPercent })})</span>
              <span style={{ color: '#B8B8B8' }}>{t('nextTierLabel')}: {translateTierName(levelInfo.nextLevel)} ({(levelInfo.lifetimeCoins || 0).toLocaleString(locale)}/{(levelInfo.minForNext || 0).toLocaleString(locale)} {t('coinsUnit')})</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: '#1A1A1A', borderRadius: '4px', overflow: 'hidden', marginBottom: '6px' }}>
              <div style={{ width: `${levelInfo.progressPercent}%`, height: '100%', background: 'linear-gradient(90deg, #C9A227 0%, #F2D675 100%)', transition: 'width 0.3s ease' }} />
            </div>
            <div style={{ fontSize: '11px', color: '#B8B8B8' }}>
              {translateLevelBenefit(levelInfo.benefits)} • {t('lifetimeCoinsLabel')}: <strong style={{ color: '#F2D675' }}>{(levelInfo.lifetimeCoins || 0).toLocaleString(locale)}</strong>
            </div>
          </div>
        )}

        {/* Scan & Pay Coins at Merchant Button */}
        <button
          type="button"
          onClick={() => {
            setScanModalInitialQr('');
            setIsScanPayModalOpen(true);
          }}
          style={{
            width: '100%',
            marginTop: '16px',
            background: 'linear-gradient(135deg, #F2D675 0%, #D4AF37 100%)',
            color: '#050505',
            border: 'none',
            borderRadius: '16px',
            padding: '14px 18px',
            fontSize: '15px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            boxShadow: '0 6px 20px rgba(212, 175, 55, 0.35)',
            transition: 'all 0.15s ease'
          }}
        >
          <QrCode size={20} color="#050505" aria-hidden="true" />
          <span>{t('scanPayAtAnyShop')}</span>
        </button>
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
            <img src={vp52Logo} alt="VP52" style={{ width: '44px', height: '44px', objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(212, 175, 55, 0.3))' }} />
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>{t('vp52EarningSession')}</h3>
              <span style={{ fontSize: '12px', color: '#B8B8B8' }}>{t('earn100Coins6Hrs')}</span>
            </div>
          </div>

          {(sessionState === 'ACTIVE' || sessionState === 'COMPLETED_PENDING_CLAIM') && (
            <div style={{ background: '#151515', padding: '8px 14px', borderRadius: '12px', border: '1px solid rgba(212, 175, 55, 0.3)', textAlign: 'center' }}>
              <span style={{ fontSize: '10px', color: '#B8B8B8', textTransform: 'uppercase', fontWeight: 800, display: 'block' }}>
                {t('timeRemainingUpper')}
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

        {/* STATE 1, 2, 3: SESSION START (UNLIMITED 6-HOUR SESSIONS, IMMEDIATE ACTIVATION) */}
        {(sessionState === 'NO_SESSION' || sessionState === 'ADS_IN_PROGRESS' || sessionState === 'READY_TO_START') && (
          <div>
            <div style={{ background: '#151515', border: '1px solid rgba(212, 175, 55, 0.25)', padding: '18px', borderRadius: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#FFFFFF' }}>{t('unlimited6HrSessions')}</span>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#10B981', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 8px', borderRadius: '6px' }}>
                  {t('availableNowBadge')}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#B8B8B8', margin: '0 0 14px 0', lineHeight: 1.4 }}>
                {t('start6HrSessionDesc')}
              </p>

              <button
                type="button"
                onClick={handleStartSession}
                disabled={isStartingSession}
                className="btn-primary pulse-glow"
                style={{ width: '100%', padding: '16px', fontSize: '16px', borderRadius: '14px', justifyContent: 'center' }}
              >
                🚀 {isStartingSession ? t('startingSessionBtn') : t('start6HrSessionBtn')}
              </button>
            </div>

            {/* Session History Toggle Button */}
            {sessionHistory && sessionHistory.length > 0 && (
              <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowSessionHistory(!showSessionHistory)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#D4AF37',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  {showSessionHistory ? t('hideSessionHistory') : t('viewPastSessions', { count: sessionHistory.length })}
                </button>

                {showSessionHistory && (
                  <div style={{ background: '#151515', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '12px', marginTop: '10px', textAlign: 'left' }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#FFFFFF', marginBottom: '8px' }}>{t('recentEarningSessions')}</div>
                    {sessionHistory.slice(0, 5).map(s => (
                      <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', fontSize: '11px' }}>
                        <div>
                          <span style={{ color: '#FFFFFF', fontWeight: 700 }}>{t('sessionNumber', { id: s.id })}</span>
                          <span style={{ color: '#888888', display: 'block' }}>{new Date(s.started_at || s.created_at).toLocaleDateString(locale)}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ color: '#F2D675', fontWeight: 800 }}>+{s.coins_earned || 100} {t('coinsUnit')}</span>
                          <span style={{ color: '#10B981', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>{translateSessionStatus(s.status)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* STATE 4: ACTIVE LIVE EARNING SESSION */}
        {sessionState === 'ACTIVE' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ background: 'radial-gradient(circle, rgba(212, 175, 55, 0.15) 0%, #151515 80%)', border: '1px solid rgba(212, 175, 55, 0.3)', borderRadius: '20px', padding: '24px 16px', marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#B8B8B8', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>
                {t('vp52CoinsEarnedUpper')}
              </div>

              <div style={{ fontSize: '36px', fontWeight: 900, color: '#F2D675', fontFamily: 'monospace', letterSpacing: '0.02em', margin: '4px 0' }}>
                {liveEarnedCoins.toFixed(5)}
              </div>

              <div style={{ fontSize: '12px', fontWeight: 700, color: '#D4AF37', display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#111111', padding: '4px 12px', borderRadius: '99px', border: '1px solid rgba(212, 175, 55, 0.2)', marginBottom: '14px' }}>
                <Sparkles size={14} color="#F2D675" aria-hidden="true" /> {t('coinsPerSecondRate')}
              </div>

              {/* Progress Bar */}
              <div style={{ width: '100%', height: '10px', background: '#050505', borderRadius: '5px', overflow: 'hidden', border: '1px solid rgba(212, 175, 55, 0.2)', marginBottom: '8px' }}>
                <div style={{ width: `${Math.min(100, Math.max(0, liveEarnedCoins))}%`, height: '100%', background: 'linear-gradient(90deg, #C9A227 0%, #F2D675 100%)', transition: 'width 0.5s linear' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, color: '#B8B8B8' }}>
                <span>{t('sessionProgressUpper')}</span>
                <span style={{ color: '#F2D675' }}>{Math.min(100, Math.max(0, liveEarnedCoins)).toFixed(2)}%</span>
              </div>
            </div>

            <div style={{ background: '#111111', borderRadius: '12px', padding: '8px 12px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Sparkles size={14} color="#D4AF37" aria-hidden="true" />
              <span style={{ fontSize: '11px', color: '#B8B8B8', fontWeight: 600 }}>
                {t('unlimitedSequentialDesc')}
              </span>
            </div>

            <span style={{ fontSize: '11px', color: '#777777', fontWeight: 600 }}>
              {t('earningRateSyncNotice')}
            </span>
          </div>
        )}

        {/* STATE 5: SESSION COMPLETED / CLAIM REWARD */}
        {sessionState === 'COMPLETED_PENDING_CLAIM' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ background: 'linear-gradient(135deg, #151515 0%, #1F190B 100%)', border: '1px solid #D4AF37', borderRadius: '20px', padding: '24px 16px', marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#F2D675', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>
                {t('sessionCompleteUpper')}
              </div>

              <div style={{ fontSize: '38px', fontWeight: 900, color: '#FFFFFF', margin: '6px 0' }}>
                100.00000
              </div>

              <div style={{ fontSize: '14px', fontWeight: 800, color: '#F2D675', marginBottom: '16px' }}>
                {t('vp52CoinsEarnedUpper')}
              </div>

              <button
                type="button"
                onClick={handleClaimSessionReward}
                disabled={isClaimingSession}
                className="btn-primary pulse-glow"
                style={{ width: '100%', padding: '16px', fontSize: '16px', borderRadius: '14px', justifyContent: 'center' }}
              >
                🎁 {isClaimingSession ? t('claiming100Coins') : t('claim100CoinsBtn')}
              </button>
            </div>
          </div>
        )}

        {/* BONUS REWARDED ADS (SSV VERIFIED - 1 COIN PER VERIFIED AD, MAX 3 PER 6H SESSION) */}
        {rewardAdSession && (
          <div style={{
            marginTop: '16px',
            background: '#151515',
            border: '1px solid rgba(212, 175, 55, 0.25)',
            borderRadius: '16px',
            padding: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '14px', fontWeight: 800, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <PlayCircle size={16} color="#F2D675" aria-hidden="true" />
                {t('rewardedAdsSectionTitle')}
              </span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#F2D675' }}>
                {t('rewardedAdsProgress', { verified: rewardAdSession.ads_watched || 0 })}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
              {[1, 2, 3].map((slot) => {
                const done = (rewardAdSession.ads_watched || 0) >= slot;
                return (
                  <div
                    key={slot}
                    style={{
                      flex: 1,
                      height: '6px',
                      borderRadius: '4px',
                      background: done ? 'linear-gradient(90deg, #C9A227 0%, #F2D675 100%)' : '#262626'
                    }}
                  />
                );
              })}
            </div>

            {rewardAdStatusMsg && (
              <div style={{
                marginBottom: '12px',
                padding: '10px 12px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 700,
                background: rewardAdStatusMsg.type === 'success'
                  ? 'rgba(16, 185, 129, 0.14)'
                  : rewardAdStatusMsg.type === 'error'
                  ? 'rgba(239, 68, 68, 0.14)'
                  : 'rgba(212, 175, 55, 0.14)',
                border: `1px solid ${
                  rewardAdStatusMsg.type === 'success'
                    ? 'rgba(16, 185, 129, 0.35)'
                    : rewardAdStatusMsg.type === 'error'
                    ? 'rgba(239, 68, 68, 0.35)'
                    : 'rgba(212, 175, 55, 0.35)'
                }`,
                color: rewardAdStatusMsg.type === 'success'
                  ? '#10B981'
                  : rewardAdStatusMsg.type === 'error'
                  ? '#FCA5A5'
                  : '#F2D675'
              }}>
                {rewardAdStatusMsg.text}
              </div>
            )}

            {(rewardAdSession.ads_watched || 0) >= (rewardAdSession.max_ads || 3) ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '10px',
                borderRadius: '12px',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.28)',
                color: '#10B981',
                fontSize: '12px',
                fontWeight: 800
              }}>
                <CheckCircle2 size={15} aria-hidden="true" />
                {t('rewardedAdsAllCompleted')}
              </div>
            ) : (
              <button
                type="button"
                onClick={handleWatchRewardedAd}
                disabled={isWatchingRewardedAd || !rewardAdSession.can_watch_ad}
                className="btn-secondary"
                style={{ width: '100%', padding: '12px 14px', fontSize: '14px', borderRadius: '12px', justifyContent: 'center' }}
              >
                <PlayCircle size={16} aria-hidden="true" />
                {isWatchingRewardedAd ? t('watchingRewardedAdBtn') : t('watchRewardedAdBtn')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* GOOGLE ADMOB SESSION-START NATIVE ADS MODAL (PARTS 1, 3, 11) */}
      {isSessionStartedModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('sessionActivatedTitle')}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.88)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            style={{
              background: '#0D0D0D',
              border: '1px solid #D4AF37',
              borderRadius: '24px',
              padding: '24px',
              width: '100%',
              maxWidth: '440px',
              maxHeight: '90vh',
              overflowY: 'auto',
              position: 'relative',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)'
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '18px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'rgba(212, 175, 55, 0.15)',
                  border: '1px solid #D4AF37',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px auto'
                }}
              >
                <Sparkles size={28} color="#F2D675" aria-hidden="true" />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 900, color: '#FFFFFF', margin: '0 0 4px 0' }}>
                {t('sessionActivatedTitle')}
              </h3>
              <p style={{ fontSize: '12px', color: '#B8B8B8', margin: 0 }}>
                {t('sessionActivatedDesc')}
              </p>
            </div>

            {/* Up to 3 Google Native Ads Placements (AdMob) */}
            {sessionNativeAds && sessionNativeAds.length > 0 && (
              <div style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {t('sponsoredByGoogle')}
                  </span>
                  <span style={{ fontSize: '10px', color: '#777777' }}>{t('googleMobileAds')}</span>
                </div>
                {sessionNativeAds.map((ad, idx) => (
                  <GoogleNativeAdCard key={ad.id || idx} ad={ad} token={token} index={idx} />
                ))}
              </div>
            )}

            {/* Non-blocking Dismiss / Continue Button */}
            <button
              type="button"
              onClick={() => setIsSessionStartedModalOpen(false)}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #F2D675 0%, #D4AF37 100%)',
                color: '#050505',
                border: 'none',
                borderRadius: '14px',
                padding: '14px',
                fontSize: '15px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              {t('continueToVp52')}
            </button>
          </div>
        </div>
      )}

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
                  ℹ️ {t('locDeniedHelp', { app: APP_NAME })}
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

      {/* Active Category / Subcategory Filter Badge */}
      {category !== 'All' && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 14px',
            background: 'rgba(212, 175, 55, 0.08)',
            border: '1px solid rgba(212, 175, 55, 0.25)',
            borderRadius: '12px',
            marginBottom: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: '#B8B8B8' }}>{t('filteringByLabel')}</span>
            <strong style={{ fontSize: '13px', color: '#F2D675' }}>{translateCategory(category)}</strong>
            {selectedSubcategory !== 'All' && (
              <>
                <span style={{ color: '#777777' }}>›</span>
                <strong style={{ fontSize: '13px', color: '#FFFFFF' }}>{translateSubcategory(selectedSubcategory)}</strong>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setCategory('All');
              setSelectedSubcategory('All');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#D4AF37',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            {t('clearFilterBtn')}
          </button>
        </div>
      )}

      {/* Filter and View Mode Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Min Rating Filter */}
          <button
            type="button"
            onClick={() => setMinRating(minRating === '4' ? 'all' : '4')}
            style={{
              padding: '6px 12px',
              borderRadius: '99px',
              fontSize: '11px',
              fontWeight: 700,
              border: minRating === '4' ? '1px solid #D4AF37' : '1px solid rgba(212, 175, 55, 0.15)',
              background: minRating === '4' ? '#1A1A1A' : '#111111',
              color: minRating === '4' ? '#F2D675' : '#888888',
              cursor: 'pointer'
            }}
          >
            {t('filterRating4Plus')}
          </button>

          {/* Open Now Filter */}
          <button
            type="button"
            onClick={() => setOpenNow(!openNow)}
            style={{
              padding: '6px 12px',
              borderRadius: '99px',
              fontSize: '11px',
              fontWeight: 700,
              border: openNow ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
              background: openNow ? 'rgba(16, 185, 129, 0.15)' : '#111111',
              color: openNow ? '#10b981' : '#888888',
              cursor: 'pointer'
            }}
          >
            {t('filterOpenNow')}
          </button>

          {/* Sort By Toggle */}
          <button
            type="button"
            onClick={() => setSortBy(sortBy === 'distance' ? 'rating' : 'distance')}
            style={{
              padding: '6px 12px',
              borderRadius: '99px',
              fontSize: '11px',
              fontWeight: 700,
              border: '1px solid rgba(212, 175, 55, 0.15)',
              background: '#111111',
              color: '#B8B8B8',
              cursor: 'pointer'
            }}
          >
            {t('sortLabel')} <strong style={{ color: '#F2D675' }}>{sortBy === 'distance' ? t('sortNearest') : t('sortTopRated')}</strong>
          </button>
        </div>

        {/* View Mode Toggle: List / Map */}
        <div style={{ display: 'flex', background: '#151515', borderRadius: '12px', padding: '3px', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
          <button
            type="button"
            aria-label={t('listView')}
            onClick={() => setViewMode('list')}
            style={{
              padding: '6px 12px', borderRadius: '99px', border: 'none',
              background: viewMode === 'list' ? '#111111' : 'transparent',
              color: viewMode === 'list' ? '#D4AF37' : '#777777', cursor: 'pointer'
            }}
          >
            <List size={16} aria-hidden="true" color={viewMode === 'list' ? '#D4AF37' : '#777777'} />
          </button>
          <button
            type="button"
            aria-label={t('mapView')}
            onClick={() => setViewMode('map')}
            style={{
              padding: '6px 12px', borderRadius: '99px', border: 'none',
              background: viewMode === 'map' ? '#111111' : 'transparent',
              color: viewMode === 'map' ? '#D4AF37' : '#777777', cursor: 'pointer'
            }}
          >
            <Map size={16} aria-hidden="true" color={viewMode === 'map' ? '#D4AF37' : '#777777'} />
          </button>
        </div>
      </div>

      {/* Radius Filter */}
      {locationStatus === 'granted' && (
        <div style={{ marginBottom: '16px' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: '#B8B8B8', display: 'block', marginBottom: '8px' }}>{t('radiusLabel')}</span>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
            {['1', '3', '5', '10', '25', '50', 'all'].map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setDistanceFilter(r)}
                style={{
                  flexShrink: 0,
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
      <div id="discovery-results" style={{ scrollMarginTop: '80px' }}>
      {viewMode === 'map' ? (
        <MerchantMap
          shops={shops}
          merchants={shops}
          userLat={mapCenter.lat}
          userLng={mapCenter.lng}
          userLocation={mapCenter}
          onSelectShop={(s) => navigate('/customer/shops/' + s.id)}
          onSelectMerchant={(s) => navigate('/customer/shops/' + s.id)}
        />
      ) : (
        /* Shops & Services List */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {shops.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: '36px 16px', color: '#B8B8B8', background: '#111111', borderRadius: '20px', border: '1px dashed rgba(212, 175, 55, 0.3)', fontSize: '13px', fontWeight: 600 }}>
              <Store size={36} color="#D4AF37" style={{ margin: '0 auto 12px auto', opacity: 0.6 }} />
              <div>{t('noBusinessesFound')}</div>
              <span style={{ fontSize: '11px', color: '#777777', display: 'block', marginTop: '4px' }}>{t('tryAllShopsHint')}</span>
            </div>
          )}
          {shops.map(shop => {
            const isOpen = isShopOpenNow(shop);
            const imageSrc = resolveMediaUrl(
              shop.cover_photo_url || shop.logo_url || shop.image_url || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80'
            );
            const avgRating = shop.rating_avg && Number(shop.rating_avg) > 0 ? Number(shop.rating_avg).toFixed(1) : null;

            return (
              <div
                key={shop.id}
                style={{
                  background: '#111111',
                  borderRadius: '20px',
                  padding: '16px',
                  border: '1px solid rgba(212, 175, 55, 0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.45)',
                  transition: 'transform 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  <img
                    src={imageSrc}
                    alt={shop.name}
                    style={{
                      width: '92px',
                      height: '92px',
                      borderRadius: '16px',
                      objectFit: 'cover',
                      border: '1px solid rgba(212, 175, 55, 0.25)',
                      flexShrink: 0
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Header Badges */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '10px', fontWeight: 800, color: '#D4AF37', background: 'rgba(212, 175, 55, 0.1)', border: '1px solid rgba(212, 175, 55, 0.25)', padding: '2px 8px', borderRadius: '6px', textTransform: 'uppercase' }}>
                          {translateCategory(shop.category)}
                        </span>
                        {shop.subcategory && (
                          <span style={{ fontSize: '10px', fontWeight: 600, color: '#FFFFFF', background: '#1A1A1A', padding: '2px 8px', borderRadius: '6px' }}>
                            {translateSubcategory(shop.subcategory)}
                          </span>
                        )}
                      </div>

                      {/* Open / Closed Status Badge */}
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: shop.is_temporarily_closed ? 'rgba(239, 68, 68, 0.15)' : isOpen ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: shop.is_temporarily_closed ? '#ef4444' : isOpen ? '#10b981' : '#ef4444',
                          border: `1px solid ${shop.is_temporarily_closed ? 'rgba(239, 68, 68, 0.3)' : isOpen ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                        }}
                      >
                        {shop.is_temporarily_closed ? t('temporarilyClosed') : isOpen ? t('statusOpenNow') : t('statusClosedNow')}
                      </span>
                    </div>

                    <h3
                      onClick={() => navigate(`/customer/shops/${shop.id}`)}
                      style={{ fontSize: '17px', fontWeight: 800, color: '#FFFFFF', margin: '2px 0 4px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      {shop.name}
                    </h3>

                    {/* Ratings & Distance */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', marginBottom: '6px' }}>
                      <span style={{ color: '#F2D675', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                        ⭐ {avgRating ? avgRating : t('ratingNew')} <span style={{ color: '#888888', fontWeight: 500 }}>({shop.rating_count || 0})</span>
                      </span>
                      {shop.distance_km != null && (
                        <span style={{ color: '#B8B8B8', fontWeight: 600 }}>
                          📍 {shop.distance_km} {t('kmAway')}
                        </span>
                      )}
                    </div>

                    <span style={{ fontSize: '11px', color: '#888888', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {shop.area_locality ? `${shop.area_locality}, ` : ''}{shop.address}
                    </span>
                  </div>
                </div>

                {/* VP52 Rewards & Discount Reminder Pill */}
                <div style={{
                  background: 'linear-gradient(90deg, rgba(212, 175, 55, 0.1) 0%, rgba(212, 175, 55, 0.02) 100%)',
                  border: '1px dashed rgba(212, 175, 55, 0.3)',
                  borderRadius: '10px',
                  padding: '6px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '11px'
                }}>
                  <span style={{ color: '#F2D675', fontWeight: 700 }}>
                    🪙 {t('useVp52CoinsDiscountHere')}
                  </span>
                  <span style={{ color: '#D4AF37', fontWeight: 800 }}>
                    {t('upTo20PercentOff')}
                  </span>
                </div>

                {/* Action Buttons Row */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', paddingTop: '4px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <button
                    type="button"
                    onClick={() => navigate(`/customer/shops/${shop.id}`)}
                    className="btn-primary"
                    style={{ flex: 1, padding: '8px 12px', fontSize: '12px', borderRadius: '10px', justifyContent: 'center' }}
                  >
                    {t('viewStoreAndMenu')} <ArrowRight size={14} color="#050505" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (shop.permanent_qr_code) {
                        setScanModalInitialQr(shop.permanent_qr_code);
                      } else {
                        setScanModalInitialQr('');
                      }
                      setIsScanPayModalOpen(true);
                    }}
                    style={{
                      padding: '8px 12px',
                      fontSize: '12px',
                      borderRadius: '10px',
                      border: '1px solid #D4AF37',
                      background: 'linear-gradient(135deg, #F2D675 0%, #D4AF37 100%)',
                      color: '#050505',
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    <QrCode size={14} color="#050505" /> {t('payCoinsBtn')}
                  </button>
                  <button
                    type="button"
                    onClick={() => startChat(shop.id)}
                    disabled={startingChatShopId === shop.id}
                    className="btn-secondary"
                    style={{ padding: '8px 12px', fontSize: '12px', borderRadius: '10px', cursor: startingChatShopId === shop.id ? 'wait' : 'pointer' }}
                  >
                    <MessageCircle size={14} color="#D4AF37" /> {t('chatBtn')}
                  </button>
                  {shop.latitude != null && shop.longitude != null && (
                    <button
                      type="button"
                      onClick={() => handleGetDirections(shop)}
                      style={{ padding: '8px 12px', fontSize: '12px', borderRadius: '10px', border: '1px solid rgba(212, 175, 55, 0.3)', background: '#151515', color: '#F2D675', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                    >
                      <Navigation size={14} color="#F2D675" /> {t('directionsBtn')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>

      {/* EXPLORE ALL CATEGORIES (17) — LAST SECTION */}
      <div id="all-categories-section" style={{ marginTop: '32px' }}>
        {/* Master 17 Categories Vertical Navigation */}
        <div
          style={{
            background: '#111111',
            borderRadius: '20px',
            border: '1px solid rgba(212, 175, 55, 0.2)',
            overflow: 'hidden',
            marginBottom: '20px',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.35)'
          }}
        >
          {/* Section Heading */}
          <div
            style={{
              padding: '16px 18px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'linear-gradient(180deg, rgba(212, 175, 55, 0.08) 0%, rgba(17, 17, 17, 0) 100%)'
            }}
          >
            <span
              style={{
                fontSize: '13px',
                fontWeight: 800,
                color: '#FFFFFF',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
            >
              {t('exploreAllCategories', { count: CATEGORIES.length })}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {category !== 'All' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      document.getElementById('discovery-results')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    style={{
                      background: 'rgba(212, 175, 55, 0.15)',
                      border: '1px solid rgba(212, 175, 55, 0.35)',
                      borderRadius: '99px',
                      color: '#F2D675',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '4px 10px',
                      cursor: 'pointer'
                    }}
                  >
                    {t('viewResultsUp')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCategory('All');
                      setSelectedSubcategory('All');
                    }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '99px',
                      color: '#B8B8B8',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '4px 10px',
                      cursor: 'pointer'
                    }}
                  >
                    {t('resetBtn')}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Vertical Category Rows */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Row 0: All Shops & Services (VP52 Golden / Yellow Branding) */}
            {(() => {
              const isAllActive = category === 'All';
              return (
                <div
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    background: isAllActive
                      ? 'linear-gradient(135deg, rgba(201, 162, 39, 0.22) 0%, rgba(242, 214, 117, 0.08) 100%)'
                      : 'transparent',
                    borderLeft: isAllActive ? '4px solid #D4AF37' : '4px solid transparent',
                    transition: 'background 0.2s ease, border-color 0.2s ease'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setCategory('All');
                      setSelectedSubcategory('All');
                    }}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      minHeight: '52px',
                      background: 'none',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: isAllActive
                            ? 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)'
                            : 'rgba(212, 175, 55, 0.12)',
                          boxShadow: isAllActive ? '0 2px 10px rgba(212, 175, 55, 0.35)' : 'none',
                          flexShrink: 0
                        }}
                      >
                        <Store size={19} color={isAllActive ? '#050505' : '#D4AF37'} />
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: '14px',
                            fontWeight: 700,
                            color: isAllActive ? '#F2D675' : '#FFFFFF',
                            letterSpacing: '0.01em'
                          }}
                        >
                          {t('allShopsServices')}
                        </div>
                        <div style={{ fontSize: '11px', color: isAllActive ? '#D4AF37' : '#888888', marginTop: '1px' }}>
                          {t('allApprovedMerchants')}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {isAllActive && (
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            padding: '3px 8px',
                            borderRadius: '99px',
                            background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)',
                            color: '#050505'
                          }}
                        >
                          {t('activeChipBadge')}
                        </span>
                      )}
                      <ChevronRight size={18} color={isAllActive ? '#F2D675' : '#777777'} />
                    </div>
                  </button>
                </div>
              );
            })()}

            {/* Rows 1-17: Master Categories */}
            {CATEGORIES.map((cat, index) => {
              const isSelected = category.toLowerCase() === cat.name.toLowerCase() || category === cat.id;
              const isLast = index === CATEGORIES.length - 1;
              const displayCatName = translateCategory(cat.name);

              return (
                <div
                  key={cat.id}
                  style={{
                    borderBottom: isLast ? 'none' : '1px solid rgba(255, 255, 255, 0.06)',
                    background: isSelected
                      ? 'linear-gradient(135deg, rgba(212, 175, 55, 0.14) 0%, rgba(212, 175, 55, 0.04) 100%)'
                      : 'transparent',
                    borderLeft: isSelected ? '4px solid #D4AF37' : '4px solid transparent',
                    transition: 'background 0.2s ease, border-color 0.2s ease'
                  }}
                >
                  {/* Category Row - Fully Clickable */}
                  <button
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setCategory('All');
                        setSelectedSubcategory('All');
                      } else {
                        setCategory(cat.name);
                        setSelectedSubcategory('All');
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      minHeight: '52px',
                      background: 'none',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: isSelected
                            ? 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)'
                            : 'rgba(255, 255, 255, 0.05)',
                          boxShadow: isSelected ? '0 2px 10px rgba(212, 175, 55, 0.3)' : 'none',
                          flexShrink: 0
                        }}
                      >
                        <CategoryIcon
                          name={cat.icon}
                          size={19}
                          color={isSelected ? '#050505' : '#D4AF37'}
                        />
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: '14px',
                            fontWeight: isSelected ? 700 : 600,
                            color: isSelected ? '#F2D675' : '#FFFFFF',
                            letterSpacing: '0.01em'
                          }}
                        >
                          {displayCatName}
                        </div>
                        <div style={{ fontSize: '11px', color: isSelected ? '#D4AF37' : '#777777', marginTop: '1px' }}>
                          {cat.subcategories ? t('subcategoriesCount', { count: cat.subcategories.length }) : t('exploreShopsSub')}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {isSelected && (
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            padding: '3px 8px',
                            borderRadius: '99px',
                            background: 'rgba(212, 175, 55, 0.2)',
                            color: '#F2D675',
                            border: '1px solid rgba(212, 175, 55, 0.3)'
                          }}
                        >
                          {t('activeChipBadge')}
                        </span>
                      )}
                      <ChevronRight
                        size={18}
                        color={isSelected ? '#F2D675' : '#777777'}
                        style={{
                          transform: isSelected ? 'rotate(90deg)' : 'none',
                          transition: 'transform 0.2s ease'
                        }}
                      />
                    </div>
                  </button>

                  {/* Subcategories (Clean Wrapped Grid/Chips - Zero Horizontal Scroll) */}
                  {isSelected && cat.subcategories && cat.subcategories.length > 0 && (
                    <div
                      style={{
                        padding: '14px 16px 18px 16px',
                        background: '#0B0B0B',
                        borderTop: '1px solid rgba(212, 175, 55, 0.15)',
                        borderBottom: isLast ? 'none' : '1px solid rgba(212, 175, 55, 0.15)'
                      }}
                    >
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          color: '#D4AF37',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          marginBottom: '10px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <span>{t('subcategoriesIn', { category: displayCatName })}</span>
                        {selectedSubcategory !== 'All' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSubcategory('All');
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#F2D675',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              textDecoration: 'underline'
                            }}
                          >
                            {t('clearSubcategoryBtn')}
                          </button>
                        )}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '8px'
                        }}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSubcategory('All');
                          }}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '10px',
                            fontSize: '12px',
                            fontWeight: selectedSubcategory === 'All' ? 700 : 500,
                            border: selectedSubcategory === 'All' ? '1px solid #D4AF37' : '1px solid rgba(255, 255, 255, 0.12)',
                            background: selectedSubcategory === 'All'
                              ? 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)'
                              : '#161616',
                            color: selectedSubcategory === 'All' ? '#050505' : '#E0E0E0',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {t('allInCategory', { category: displayCatName })}
                        </button>

                        {cat.subcategories.map(sub => {
                          const isSubActive = selectedSubcategory === sub;
                          return (
                            <button
                              key={sub}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSubcategory(sub);
                              }}
                              style={{
                                padding: '8px 14px',
                                borderRadius: '10px',
                                fontSize: '12px',
                                fontWeight: isSubActive ? 700 : 500,
                                border: isSubActive ? '1px solid #D4AF37' : '1px solid rgba(255, 255, 255, 0.1)',
                                background: isSubActive ? '#1F1B0E' : '#141414',
                                color: isSubActive ? '#F2D675' : '#CCCCCC',
                                boxShadow: isSubActive ? '0 0 10px rgba(212, 175, 55, 0.25)' : 'none',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              {translateSubcategory(sub)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* CUSTOMER SCAN & PAY MERCHANT PERMANENT QR MODAL */}
      <CustomerScanPayModal
        isOpen={isScanPayModalOpen}
        initialQrCode={scanModalInitialQr}
        onClose={() => {
          setIsScanPayModalOpen(false);
          setScanModalInitialQr('');
        }}
        onPaymentSuccess={(tx) => {
          if (tx?.new_customer_balance !== undefined) {
            updateUserBalance(tx.new_customer_balance);
          }
        }}
      />
    </div>
  );
}
