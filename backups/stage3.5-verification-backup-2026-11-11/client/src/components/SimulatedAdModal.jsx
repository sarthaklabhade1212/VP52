import React, { useState, useEffect } from 'react';
import { Play, CheckCircle2, Sparkles, X, ShieldAlert, Award } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';

export default function SimulatedAdModal({ isOpen, onClose, onRewardClaimed, onAdCompleted }) {
  const { token, updateUserBalance } = useAuth();
  const { t } = useI18n();
  const AD_DURATION_SECONDS = 10;
  const POINTS_PER_AD = 100;
  const POINTS_PER_SECOND = POINTS_PER_AD / AD_DURATION_SECONDS; // 10 points per second

  const [timeLeft, setTimeLeft] = useState(AD_DURATION_SECONDS);
  const [secondsWatched, setSecondsWatched] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let timer;
    if (isOpen) {
      setTimeLeft(AD_DURATION_SECONDS);
      setSecondsWatched(0);
      setIsCompleted(false);
      setIsClaiming(false);
      setError(null);
      console.log('[Ads] Advertisement started. Duration:', AD_DURATION_SECONDS, 's');

      timer = setInterval(() => {
        setSecondsWatched((prevWatched) => {
          const nextWatched = prevWatched + 1;
          const remaining = Math.max(0, AD_DURATION_SECONDS - nextWatched);
          setTimeLeft(remaining);

          if (remaining <= 0) {
            clearInterval(timer);
            setIsCompleted(true);
            triggerConfetti();
            const earned = Math.min(POINTS_PER_AD, Math.floor(nextWatched * POINTS_PER_SECOND));
            console.log('[Ads] Advertisement reached completion. Watch duration:', nextWatched, 'seconds. Calculated reward:', earned, 'points.');
          }
          return nextWatched;
        });
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isOpen]);

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (_) {}
  };

  const handleFastForward = () => {
    setTimeLeft(0);
    setSecondsWatched(AD_DURATION_SECONDS);
    setIsCompleted(true);
    triggerConfetti();
    console.log('[Ads] Fast-forwarded demo ad to', AD_DURATION_SECONDS, 'seconds.');
  };

  const calculatedPoints = Math.min(POINTS_PER_AD, Math.floor(secondsWatched * POINTS_PER_SECOND));

  const handleClaim = async () => {
    if (isClaiming) return;
    setIsClaiming(true);
    setError(null);

    try {
      // 1. If custom onAdCompleted handler passed (e.g. from 6-hour coin session flow)
      if (typeof onAdCompleted === 'function') {
        console.log('[Ads] Calling custom onAdCompleted callback with duration:', secondsWatched, 'seconds.');
        await onAdCompleted({ watch_duration_seconds: secondsWatched, points_earned: calculatedPoints });
        onClose();
        return;
      }

      // 2. Standard Ad Reward Flow: Post watch duration to backend
      console.log('[Ads] Submitting ad watch completion to backend. Watch duration:', secondsWatched, 'seconds.');
      const res = await fetch('/api/customer/watch-ad', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          watch_duration_seconds: secondsWatched
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || t('adClaimFailed'));
      }

      console.log('[Ads] Reward successfully credited by backend:', data.pointsAwarded, 'points. New balance:', data.newBalance);
      updateUserBalance(data.newBalance);
      if (typeof onRewardClaimed === 'function') {
        onRewardClaimed(data.pointsAwarded, data.newBalance);
      }
      onClose();
    } catch (err) {
      console.error('[Ads] Ad claim error:', err.message);
      setError(err.message);
    } finally {
      setIsClaiming(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.88)',
      backdropFilter: 'blur(10px)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: '#111111',
        border: '1px solid rgba(212, 175, 55, 0.3)',
        borderRadius: '24px',
        maxWidth: '440px',
        width: '100%',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9)',
        position: 'relative'
      }} className="animate-slide-up">

        {/* Top Disclaimer Bar */}
        <div style={{
          background: '#151515',
          borderBottom: '1px solid rgba(212, 175, 55, 0.15)',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '11px',
          color: '#F2D675',
          fontWeight: 600
        }}>
          <ShieldAlert size={16} color="#D4AF37" style={{ flexShrink: 0 }} />
          <span>{t('adPrototypeDisclaimer')}</span>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', marginLeft: 'auto', color: '#B8B8B8' }}>
            <X size={18} />
          </button>
        </div>

        {/* Ad Header Tag */}
        <div style={{ padding: '16px 20px 8px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{
            background: '#151515',
            border: '1px solid rgba(212, 175, 55, 0.3)',
            color: '#F2D675',
            fontSize: '11px',
            fontWeight: 800,
            padding: '4px 10px',
            borderRadius: '99px',
            letterSpacing: '0.05em'
          }}>
            {t('adSponsoredContent')}
          </span>

          {!isCompleted ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#F2D675' }}>
                {t('adRewardInSeconds', { seconds: timeLeft })}
              </span>
              <button
                onClick={handleFastForward}
                title={t('adFastForwardTooltip')}
                style={{
                  background: '#151515',
                  border: '1px solid rgba(212, 175, 55, 0.3)',
                  borderRadius: '6px',
                  padding: '2px 8px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  color: '#B8B8B8'
                }}
              >
                {t('adSkipBtn')}
              </button>
            </div>
          ) : (
            <span style={{ color: '#F2D675', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={14} color="#F2D675" /> {t('adCompletedBadge')}
            </span>
          )}
        </div>

        {/* Simulated Ad Video/Banner Placeholder */}
        <div style={{ padding: '0 20px 16px 20px' }}>
          <div style={{
            height: '200px',
            background: 'linear-gradient(135deg, #0B0B0B 0%, #1A1A1A 100%)',
            borderRadius: '16px',
            border: '1px solid rgba(212, 175, 55, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            textAlign: 'center',
            padding: '20px',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.1,
              backgroundImage: 'radial-gradient(#D4AF37 1px, transparent 1px)',
              backgroundSize: '16px 16px'
            }} />

            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '12px'
            }}>
              {isCompleted ? <Award size={32} color="#050505" /> : <Play size={28} color="#050505" style={{ marginLeft: '4px' }} />}
            </div>

            <h4 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '4px', color: '#FFFFFF' }}>
              {isCompleted ? t('adWatchedTitle') : t('adDiscoverTitle')}
            </h4>
            <p style={{ fontSize: '12px', color: '#B8B8B8', maxWidth: '280px' }}>
              {isCompleted ? t('adWatchedDesc') : t('adDiscoverDesc')}
            </p>

            {!isCompleted && (
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '5px',
                background: 'rgba(255,255,255,0.1)'
              }}>
                <div style={{
                  height: '100%',
                  background: 'linear-gradient(90deg, #C9A227 0%, #F2D675 100%)',
                  width: `${((AD_DURATION_SECONDS - timeLeft) / AD_DURATION_SECONDS) * 100}%`,
                  transition: 'width 1s linear'
                }} />
              </div>
            )}
          </div>
        </div>

        {/* Claim / Completion Footer */}
        <div style={{ padding: '0 20px 20px 20px' }}>
          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '10px', borderRadius: '10px', fontSize: '12px', marginBottom: '12px', textAlign: 'center' }}>
              {error}
            </div>
          )}

          {isCompleted ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#151515', border: '1px solid rgba(212, 175, 55, 0.3)', color: '#F2D675', padding: '8px 16px', borderRadius: '99px', fontWeight: 800, fontSize: '16px', marginBottom: '16px' }}>
                <Sparkles size={20} color="#F2D675" /> {t('adPointsEarnedBadge', { points: calculatedPoints })}
              </div>

              <button
                onClick={handleClaim}
                disabled={isClaiming}
                className="btn-primary"
                style={{ width: '100%', padding: '16px', fontSize: '16px', justifyContent: 'center' }}
              >
                {isClaiming ? t('adClaimingPoints') : t('adClaimRewardBtn')}
              </button>
            </div>
          ) : (
            <button
              disabled
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                border: 'none',
                background: '#151515',
                color: '#777777',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'not-allowed'
              }}
            >
              {t('adWatchRemainingBtn', { seconds: timeLeft })}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
