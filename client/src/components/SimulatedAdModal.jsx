import React, { useState, useEffect } from 'react';
import { Play, CheckCircle2, Sparkles, X, Info, ShieldAlert, Award } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';

export default function SimulatedAdModal({ isOpen, onClose, onRewardClaimed }) {
  const { token, updateUserBalance } = useAuth();
  const [timeLeft, setTimeLeft] = useState(10);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let timer;
    if (isOpen) {
      setTimeLeft(10);
      setIsCompleted(false);
      setIsClaiming(false);
      setError(null);

      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setIsCompleted(true);
            triggerConfetti();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(timer);
  }, [isOpen]);

  const triggerConfetti = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  const handleFastForward = () => {
    setTimeLeft(0);
    setIsCompleted(true);
    triggerConfetti();
  };

  const handleClaim = async () => {
    setIsClaiming(true);
    setError(null);
    try {
      const res = await fetch('/api/customer/watch-ad', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to claim reward');
      }

      updateUserBalance(data.newBalance);
      if (onRewardClaimed) onRewardClaimed(data.pointsAwarded, data.newBalance);
      onClose();
    } catch (err) {
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
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(8px)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '24px',
        maxWidth: '440px',
        width: '100%',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        position: 'relative'
      }} className="animate-slide-up">

        {/* Top Disclaimer Bar */}
        <div style={{
          background: '#fffbebfb',
          borderBottom: '1px solid #fef3c7',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '11px',
          color: '#92400e',
          fontWeight: 600
        }}>
          <ShieldAlert size={16} color="#d97706" style={{ flexShrink: 0 }} />
          <span>PROTOTYPE SIMULATION: Real ad network integration will be connected after policy validation.</span>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', marginLeft: 'auto', color: '#92400e' }}>
            <X size={18} />
          </button>
        </div>

        {/* Ad Header Tag */}
        <div style={{ padding: '16px 20px 8px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{
            background: '#e0e7ff',
            color: '#4338ca',
            fontSize: '11px',
            fontWeight: 800,
            padding: '4px 10px',
            borderRadius: '99px',
            letterSpacing: '0.05em'
          }}>
            SPONSORED CONTENT
          </span>

          {!isCompleted ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#4f46e5' }}>
                Reward in {timeLeft}s
              </span>
              <button
                onClick={handleFastForward}
                title="Fast Forward Demo"
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '2px 8px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  color: '#475569'
                }}
              >
                Skip ⏩
              </button>
            </div>
          ) : (
            <span style={{ color: '#10b981', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={14} /> Completed
            </span>
          )}
        </div>

        {/* Simulated Ad Video/Banner Placeholder */}
        <div style={{ padding: '0 20px 16px 20px' }}>
          <div style={{
            height: '200px',
            background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            textAlign: 'center',
            padding: '20px',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.15,
              backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
              backgroundSize: '16px 16px'
            }} />

            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '12px'
            }}>
              {isCompleted ? <Award size={32} color="#34d399" /> : <Play size={28} color="#a5b4fc" style={{ marginLeft: '4px' }} />}
            </div>

            <h4 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '4px' }}>
              {isCompleted ? 'Advertisement Watched!' : 'Discover Smart Local Shopping'}
            </h4>
            <p style={{ fontSize: '12px', color: '#c7d2fe', maxWidth: '280px' }}>
              {isCompleted ? 'Your points are ready to be claimed into your wallet.' : 'Earn points every day and redeem instant discounts at top local stores.'}
            </p>

            {/* Progress bar */}
            {!isCompleted && (
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '5px',
                background: 'rgba(255,255,255,0.2)'
              }}>
                <div style={{
                  height: '100%',
                  background: '#10b981',
                  width: `${((10 - timeLeft) / 10) * 100}%`,
                  transition: 'width 1s linear'
                }} />
              </div>
            )}
          </div>
        </div>

        {/* Claim / Completion Footer */}
        <div style={{ padding: '0 20px 20px 20px' }}>
          {error && (
            <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px', borderRadius: '10px', fontSize: '12px', marginBottom: '12px', textAlign: 'center' }}>
              {error}
            </div>
          )}

          {isCompleted ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#ecfdf5', color: '#047857', padding: '8px 16px', borderRadius: '99px', fontWeight: 800, fontSize: '16px', marginBottom: '16px' }}>
                <Sparkles size={20} color="#10b981" /> +100 Points Earned!
              </div>

              <button
                onClick={handleClaim}
                disabled={isClaiming}
                className="btn-success"
                style={{ width: '100%', padding: '16px', fontSize: '16px', justifyContent: 'center' }}
              >
                {isClaiming ? 'Claiming Points...' : 'Claim Reward to Wallet 🎉'}
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
                background: '#e2e8f0',
                color: '#94a3b8',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'not-allowed'
              }}
            >
              Please watch video ({timeLeft}s remaining)
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
