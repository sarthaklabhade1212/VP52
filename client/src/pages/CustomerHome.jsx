import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { APP_NAME } from '../config/brand';
import MerchantMap from '../components/MerchantMap';
import SimulatedAdModal from '../components/SimulatedAdModal';
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
  const { user, token } = useAuth();
  const { t } = useI18n();

  const [shops, setShops] = useState([]);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters State
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [distanceFilter, setDistanceFilter] = useState('5'); // '1' | '3' | '5' | '10' | '25' | '50' | 'all' — default 5 km
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'map'

  // 6-Hour Reward Session State
  const [session, setSession] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [isAdModalOpen, setIsAdModalOpen] = useState(false);
  const [adRewardMsg, setAdRewardMsg] = useState(null);

  // Level Progression State
  const [levelInfo, setLevelInfo] = useState(null);

  // GPS Location & Permission State.
  // userLocation stays null until the customer explicitly shares it — we never
  // seed a silent default, so distance/radius only apply once location is real.
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('idle'); // 'idle' | 'prompt' | 'requesting' | 'granted' | 'denied' | 'error'
  const [locationErrorMessage, setLocationErrorMessage] = useState('');
  // Set when the customer taps "Not Now". We then stop showing the opt-in prompt
  // and never auto-request again this session (only an explicit tap re-asks).
  const [locationPromptDismissed, setLocationPromptDismissed] = useState(false);

  // Map view falls back to a neutral city center purely for framing the map when
  // no real location is shared. This is NOT sent to the server for distance math.
  const MAP_FALLBACK = { lat: 18.5204, lng: 73.8567 };
  const mapCenter = userLocation || MAP_FALLBACK;

  // Chat: create-or-reuse a one-to-one conversation with a shop, then open it.
  // The server derives the customer from the JWT and dedupes by (customer, shop),
  // so tapping this repeatedly always resolves to the same conversation.
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
    // Only send coordinates + radius when the customer has shared real location.
    // Without it, the server returns all valid-coordinate shops (no distance,
    // no radius filtering) — we never fabricate a location.
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

  const fetchSessionStatus = () => {
    fetch('/api/customer/reward-session/status', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(d => {
        if (d.success && d.active) {
          setSession(d.session);
        } else {
          setSession(null);
        }
      })
      .catch(console.error)
      .finally(() => setSessionLoading(false));
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
      // Permission may have been granted but the fix was unavailable/timed out.
      setLocationStatus('error');
      setLocationErrorMessage(err.message || t('locUnavailableMsg'));
    }
  };

  // "Not Now" — stop prompting for the rest of the session. We do not request
  // permission again unless the customer explicitly taps Enable Location.
  const handleDismissLocation = () => {
    setLocationPromptDismissed(true);
  };

  // Launch external turn-by-turn directions to the shop. Uses the universal
  // Google Maps URL (no SDK/API key required); falls back to a plain query URL.
  const handleGetDirections = (shop) => {
    if (shop.latitude == null || shop.longitude == null) return;
    const dest = `${shop.latitude},${shop.longitude}`;
    const primary = `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
    try {
      const win = window.open(primary, '_blank', 'noopener,noreferrer');
      if (!win) {
        // Popup blocked — fall back to navigating the current tab.
        window.location.href = primary;
      }
    } catch (err) {
      window.location.href = `https://maps.google.com/?q=${dest}`;
    }
  };

  useEffect(() => {
    let cancelled = false;
    // On load we only CHECK the existing permission. We never auto-request —
    // an un-granted state simply surfaces the opt-in prompt for the customer.
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
            setLocationStatus('prompt'); // permission ok, but no fix yet — let them retry
          }
        } else if (perm === 'denied') {
          setLocationStatus('denied');
          setLocationErrorMessage(t('locDeniedMsg'));
        } else {
          setLocationStatus('prompt'); // 'prompt' | 'error' → show opt-in, do NOT auto-request
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
      fetchSessionStatus();
      fetchLevelInfo();
    }
  }, [token, search, category, distanceFilter, userLocation]);

  // Session timer countdown effect
  useEffect(() => {
    if (!session || !session.remaining_seconds) return;
    const interval = setInterval(() => {
      setSession(prev => {
        if (!prev || prev.remaining_seconds <= 1) {
          fetchSessionStatus();
          return null;
        }
        return { ...prev, remaining_seconds: prev.remaining_seconds - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [session?.id]);

  const handleAdWatchComplete = async () => {
    setIsAdModalOpen(false);
    setAdRewardMsg(null);

    try {
      const res = await fetch('/api/customer/reward-session/watch-ad', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setAdRewardMsg(data.message);
        fetchSessionStatus();
        fetchLevelInfo();
        fetchShops();
      }
    } catch (err) {
      console.error('Watch ad error:', err);
    }
  };

  const formatTime = (seconds) => {
    if (!seconds) return '00:00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const categories = ['All', 'Restaurant', 'Hotel', 'Food', 'Clothing', 'Paithani', 'Salon', 'Jewellery', 'Grocery'];

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* Top Profile & Points Card */}
      <div style={{
        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
        borderRadius: '24px',
        padding: '24px',
        color: '#ffffff',
        marginBottom: '24px',
        boxShadow: '0 12px 30px rgba(79, 70, 229, 0.3)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '50%', background: '#ffffff', color: '#4f46e5',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '22px'
            }}>
              {user ? user.full_name.charAt(0).toUpperCase() : 'C'}
            </div>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>{user ? user.full_name : 'Customer'}</h2>
              <span style={{ fontSize: '12px', color: '#c7d2fe', fontWeight: 600 }}>
                {user ? user.email : ''}
              </span>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#e0e7ff', display: 'block' }}>
              AVAILABLE COINS
            </span>
            <span style={{ fontSize: '28px', fontWeight: 800 }}>
              🪙 {user ? user.balance.toLocaleString() : 0}
            </span>
            <span style={{ fontSize: '11px', color: '#a7f3d0', display: 'block', fontWeight: 700 }}>
              (₹{user ? user.balance.toLocaleString() : 0} Discount Value)
            </span>
          </div>
        </div>

        {/* Level Progression & Discount Cap Card */}
        {levelInfo && (
          <div style={{ background: 'rgba(255, 255, 255, 0.15)', borderRadius: '16px', padding: '14px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 800, marginBottom: '6px' }}>
              <span>🏆 Tier: {levelInfo.currentLevel} (Max {levelInfo.discountCapPercent}% Discount Cap)</span>
              <span>Next: {levelInfo.nextLevel} ({levelInfo.lifetimeCoins}/{levelInfo.minForNext} Coins)</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.2)', borderRadius: '4px', overflow: 'hidden', marginBottom: '6px' }}>
              <div style={{ width: `${levelInfo.progressPercent}%`, height: '100%', background: '#10b981', transition: 'width 0.3s ease' }} />
            </div>
            <div style={{ fontSize: '11px', color: '#c7d2fe' }}>
              {levelInfo.benefits} • Lifetime Coins: <strong>{levelInfo.lifetimeCoins}</strong>
            </div>
          </div>
        )}
      </div>

      {/* 6-HOUR REWARD SESSION CARD */}
      <div style={{
        background: '#ffffff',
        borderRadius: '24px',
        padding: '24px',
        marginBottom: '24px',
        border: '2px solid #a7f3d0',
        boxShadow: '0 8px 25px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '14px', background: '#dcfce7', color: '#059669',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Clock size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a', margin: 0 }}>6-Hour Reward Session</h3>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Watch up to 3 demo reward ads per session</span>
            </div>
          </div>

          {session && (
            <div style={{ background: '#ecfdf5', padding: '8px 16px', borderRadius: '12px', border: '1px solid #a7f3d0', textAlign: 'center' }}>
              <span style={{ fontSize: '10px', color: '#059669', textTransform: 'uppercase', fontWeight: 800, display: 'block' }}>
                SESSION TIMER
              </span>
              <span style={{ fontSize: '16px', fontWeight: 800, color: '#047857', fontFamily: 'monospace' }}>
                {formatTime(session.remaining_seconds)}
              </span>
            </div>
          )}
        </div>

        {adRewardMsg && (
          <div style={{ background: '#dcfce7', border: '1px solid #86efac', color: '#15803d', padding: '12px', borderRadius: '14px', fontSize: '13px', fontWeight: 700, marginBottom: '16px', textAlign: 'center' }}>
            {adRewardMsg}
          </div>
        )}

        {session ? (
          <div>
            {/* Ad Progress Dots */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '12px 16px', borderRadius: '14px', marginBottom: '16px', border: '1px solid #e2e8f0' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: 700 }}>ADS WATCHED IN SESSION</span>
                <div style={{ display: 'flex', gap: '6px', marginTop: '4px', alignItems: 'center' }}>
                  {[1, 2, 3].map(step => (
                    <span
                      key={step}
                      style={{
                        width: '14px', height: '14px', borderRadius: '50%',
                        background: step <= (session.ads_watched || 0) ? '#10b981' : '#cbd5e1',
                        display: 'inline-block'
                      }}
                    />
                  ))}
                  <strong style={{ fontSize: '13px', color: '#0f172a', marginLeft: '6px' }}>
                    {session.ads_watched || 0} / {session.max_ads || 3}
                  </strong>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: 700 }}>SESSION COINS</span>
                <strong style={{ fontSize: '16px', color: '#4f46e5' }}>
                  🪙 {session.coins_earned || 0} Coins
                </strong>
              </div>
            </div>

            {session.can_watch_ad ? (
              <button
                type="button"
                onClick={() => setIsAdModalOpen(true)}
                className="btn-success pulse-glow"
                style={{ width: '100%', padding: '14px', fontSize: '15px', borderRadius: '14px', justifyContent: 'center' }}
              >
                <PlayCircle size={20} /> Watch Demo Reward Ad (+{session.coins_per_ad || 2} Coins)
              </button>
            ) : (
              <div style={{ background: '#f1f5f9', padding: '14px', borderRadius: '14px', textAlign: 'center', fontSize: '13px', fontWeight: 700, color: '#475569', border: '1px solid #cbd5e1' }}>
                ✅ Session Ads Completed ({session.ads_watched}/{session.max_ads}). Next session will start automatically when eligible.
              </div>
            )}
          </div>
        ) : (
          <div style={{ background: '#fef3c7', border: '1px solid #fde68a', padding: '14px', borderRadius: '14px', textAlign: 'center', fontSize: '13px', color: '#b45309', fontWeight: 700 }}>
            ⏳ Daily session limit reached (2 sessions per 24 hours). Check back tomorrow for new reward sessions!
          </div>
        )}
      </div>

      {/* LOCATION OPT-IN / STATUS CARD */}
      {locationStatus === 'granted' ? (
        // Active: show coordinates + a manual refresh (no auto re-requesting).
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '18px', padding: '14px 18px', marginBottom: '20px', fontSize: '13px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Navigation size={20} color="#16a34a" />
              <div>
                <span style={{ fontWeight: 800, color: '#0f172a', display: 'block' }}>
                  {t('locActive')} ({userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)})
                </span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>{t('locGrantedSub')}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRequestLocation}
              style={{ padding: '8px 14px', borderRadius: '12px', border: 'none', background: '#dcfce7', color: '#15803d', fontWeight: 800, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
            >
              <RefreshCw size={14} /> {t('locRefresh')}
            </button>
          </div>
        </div>
      ) : locationStatus === 'requesting' ? (
        // Obtaining a fix.
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '18px', padding: '14px 18px', marginBottom: '20px', fontSize: '13px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <RefreshCw size={18} color="#4f46e5" style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontWeight: 800, color: '#0f172a' }}>{t('locObtaining')}</span>
          </div>
        </div>
      ) : locationPromptDismissed ? (
        // Customer chose "Not Now": slim, non-nagging bar with an opt-in later.
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '18px', padding: '12px 16px', marginBottom: '20px', fontSize: '12.5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: '#64748b', fontWeight: 600 }}>{t('enableLocationForDistance')}</span>
          <button
            type="button"
            onClick={handleRequestLocation}
            style={{ padding: '8px 14px', borderRadius: '12px', border: 'none', background: '#4f46e5', color: '#ffffff', fontWeight: 800, fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            {t('locEnable')}
          </button>
        </div>
      ) : (
        // Opt-in prompt for idle / prompt / denied / error. Never auto-requests.
        (() => {
          const isProblem = locationStatus === 'denied' || locationStatus === 'error';
          const bg = locationStatus === 'denied' ? '#fff1f2' : locationStatus === 'error' ? '#fefce8' : '#eef2ff';
          const border = locationStatus === 'denied' ? '#fecdd3' : locationStatus === 'error' ? '#fef08a' : '#c7d2fe';
          const sub = locationStatus === 'denied'
            ? (locationErrorMessage || t('locDenied'))
            : locationStatus === 'error'
            ? (locationErrorMessage || t('locUnavailableMsg'))
            : t('locEnableSub');
          return (
            <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: '18px', padding: '16px 18px', marginBottom: '20px', fontSize: '13px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '12px' }}>
                <MapPin size={22} color="#4f46e5" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <span style={{ fontWeight: 800, color: '#0f172a', display: 'block', fontSize: '15px' }}>{t('locFindNearby')}</span>
                  <span style={{ fontSize: '12px', color: '#475569' }}>{sub}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleRequestLocation}
                  style={{ flex: 1, padding: '11px', borderRadius: '12px', border: 'none', background: '#4f46e5', color: '#ffffff', fontWeight: 800, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <Navigation size={15} /> {isProblem ? t('locRetry') : t('locEnable')}
                </button>
                <button
                  type="button"
                  onClick={handleDismissLocation}
                  style={{ flex: 1, padding: '11px', borderRadius: '12px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 800, fontSize: '13px', cursor: 'pointer' }}
                >
                  {t('locNotNow')}
                </button>
              </div>
              {locationStatus === 'denied' && (
                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #fecdd3', fontSize: '11px', color: '#9f1239' }}>
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
          <Search size={20} color="#94a3b8" style={{ position: 'absolute', left: '16px', top: '16px' }} />
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
                border: 'none',
                background: category === c ? '#4f46e5' : '#ffffff',
                color: category === c ? '#ffffff' : '#64748b',
                boxShadow: category === c ? '0 4px 12px rgba(79, 70, 229, 0.2)' : 'none',
                cursor: 'pointer'
              }}
            >
              {c}
            </button>
          ))}
        </div>

        {/* View Mode Toggle: List / Map */}
        <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: '12px', padding: '3px' }}>
          <button
            onClick={() => setViewMode('list')}
            style={{
              padding: '6px 12px', borderRadius: '9px', border: 'none',
              background: viewMode === 'list' ? '#ffffff' : 'transparent',
              color: viewMode === 'list' ? '#0f172a' : '#64748b', cursor: 'pointer'
            }}
          >
            <List size={16} />
          </button>
          <button
            onClick={() => setViewMode('map')}
            style={{
              padding: '6px 12px', borderRadius: '9px', border: 'none',
              background: viewMode === 'map' ? '#ffffff' : 'transparent',
              color: viewMode === 'map' ? '#0f172a' : '#64748b', cursor: 'pointer'
            }}
          >
            <Map size={16} />
          </button>
        </div>
      </div>

      {/* Radius Filter — only meaningful once real location is shared. Changing
          it re-runs fetchShops (distanceFilter is an effect dep), so the shop
          list genuinely changes with the selected radius. */}
      {locationStatus === 'granted' && (
        <div style={{ marginBottom: '16px' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '8px' }}>{t('radiusLabel')}</span>
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
                  border: 'none',
                  background: distanceFilter === r ? '#059669' : '#ffffff',
                  color: distanceFilter === r ? '#ffffff' : '#64748b',
                  boxShadow: distanceFilter === r ? '0 4px 12px rgba(5, 150, 105, 0.2)' : 'none',
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
            <div style={{ textAlign: 'center', padding: '32px 16px', color: '#64748b', background: '#ffffff', borderRadius: '20px', border: '1px dashed #cbd5e1', fontSize: '13px', fontWeight: 600 }}>
              {t('noNearbyShops')}
            </div>
          )}
          {shops.map(shop => (
            <div key={shop.id} style={{ background: '#ffffff', borderRadius: '20px', padding: '16px', border: '1px solid #e2e8f0', display: 'flex', gap: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
              <img src={shop.image_url} alt={shop.name} style={{ width: '90px', height: '90px', borderRadius: '14px', objectFit: 'cover' }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#4f46e5', textTransform: 'uppercase' }}>{shop.category}</span>
                  {shop.distance_km != null && (
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#059669', background: '#ecfdf5', padding: '3px 8px', borderRadius: '8px', whiteSpace: 'nowrap' }}>
                      {shop.distance_km} {t('kmAway')}
                    </span>
                  )}
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: '2px 0' }}>{shop.name}</h3>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '8px' }}>📍 {shop.address}</span>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button onClick={() => navigate('/customer/rewards')} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '8px' }}>
                    {t('viewOffers')} <ChevronRight size={14} />
                  </button>
                  <button
                    onClick={() => startChat(shop.id)}
                    disabled={startingChatShopId === shop.id}
                    style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '8px', border: 'none', background: '#4f46e5', color: '#ffffff', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: startingChatShopId === shop.id ? 'wait' : 'pointer' }}
                  >
                    <MessageCircle size={14} /> {t('chatWithMerchant')}
                  </button>
                  {shop.latitude != null && shop.longitude != null && (
                    <button
                      onClick={() => handleGetDirections(shop)}
                      style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '8px', border: '1px solid #a7f3d0', background: '#f0fdf4', color: '#15803d', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}
                    >
                      <Navigation size={14} /> {t('getDirections')}
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
          onClose={() => setIsAdModalOpen(false)}
          onAdComplete={handleAdWatchComplete}
        />
      )}
    </div>
  );
}
