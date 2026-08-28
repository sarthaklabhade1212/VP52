import React from 'react';
import { useNavigate } from 'react-router-dom';
import vp52Logo from '../assets/vp52-logo.png';

export default function WelcomeScreen() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#050505',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <style>{`
        @keyframes wsLogoIn {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes wsHeadingIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes wsBtnIn {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .ws-logo-anim {
          animation: wsLogoIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .ws-heading-anim {
          opacity: 0;
          animation: wsHeadingIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.25s forwards;
        }
        .ws-btn-anim {
          opacity: 0;
          animation: wsBtnIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.5s forwards;
        }
        .ws-btn-active:active {
          transform: scale(0.98);
          filter: brightness(0.92);
        }
      `}</style>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          maxWidth: '420px',
          margin: 'auto 0'
        }}
      >
        {/* 1. VP52 Logo */}
        <div className="ws-logo-anim" style={{ marginBottom: '40px', textAlign: 'center' }}>
          <img
            src={vp52Logo}
            alt="VP52"
            draggable="false"
            style={{
              width: '120px',
              height: 'auto',
              maxHeight: '120px',
              objectFit: 'contain',
              display: 'block',
              margin: '0 auto'
            }}
          />
        </div>

        {/* 2. Welcome to VP52 Heading */}
        <h1
          className="ws-heading-anim"
          style={{
            fontSize: '26px',
            fontWeight: 700,
            color: '#D4AF37',
            margin: '0 0 48px 0',
            textAlign: 'center',
            letterSpacing: '0.3px',
            fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          }}
        >
          Welcome to VP52
        </h1>

        {/* 3. Get Started Button */}
        <div className="ws-btn-anim" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => navigate('/user-type-selection')}
            className="ws-btn-active"
            style={{
              width: '85%',
              maxWidth: '360px',
              height: '54px',
              background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)',
              color: '#000000',
              border: 'none',
              borderRadius: '14px',
              fontSize: '16px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(212, 175, 55, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.15s ease, filter 0.15s ease',
              outline: 'none',
              fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            }}
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}
