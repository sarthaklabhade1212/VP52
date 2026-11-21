import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, ArrowLeft, Mail, Trash2, CheckCircle2, Lock } from 'lucide-react';
import LanguageSwitcher from '../components/LanguageSwitcher';
import vp52Logo from '../assets/vp52-logo.png';

export default function PrivacyPolicy() {
  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: '#E0E0E0', padding: '24px 16px' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>
        {/* Top Navigation Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: '#D4AF37',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 700
            }}
          >
            <ArrowLeft size={16} /> Home
          </Link>
          <LanguageSwitcher tone="dark" compact={true} />
        </div>

        {/* Header Hero */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img
            src={vp52Logo}
            alt="VP52"
            style={{
              width: '88px',
              height: '88px',
              objectFit: 'contain',
              marginBottom: '16px',
              filter: 'drop-shadow(0 6px 20px rgba(212, 175, 55, 0.3))'
            }}
          />
          <h1 style={{ fontSize: '28px', color: '#FFFFFF', fontWeight: 800, margin: '0 0 8px 0' }}>
            VP52 Privacy Policy
          </h1>
          <p style={{ fontSize: '14px', color: '#A0A0A0', margin: 0 }}>
            Last Updated: October 2026 • Effective Date: October 2026
          </p>
        </div>

        {/* Operator Identification Notice */}
        <div style={{
          background: '#111111',
          border: '1px solid rgba(212, 175, 55, 0.3)',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '28px'
        }}>
          <h2 style={{ fontSize: '18px', color: '#F2D675', fontWeight: 700, margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={20} color="#D4AF37" /> Application Operator & Scope
          </h2>
          <p style={{ fontSize: '14px', lineHeight: '1.6', margin: 0, color: '#CCCCCC' }}>
            <strong>VP52</strong> is developed and operated by <strong>Sanket Shinde</strong>, an individual independent software developer. This privacy policy transparently describes how VP52 collects, uses, protects, and deletes personal information when you use our mobile application and web services.
          </p>
          <div style={{ marginTop: '12px', fontSize: '13px', color: '#D4AF37' }}>
            Contact Email: <a href="mailto:shindesanket.vp52@gmail.com" style={{ color: '#F2D675', textDecoration: 'underline' }}>shindesanket.vp52@gmail.com</a>
          </div>
        </div>

        {/* Section 1: Data We Collect */}
        <div style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '20px', color: '#FFFFFF', fontWeight: 700, marginBottom: '12px' }}>
            1. Information We Collect
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ background: '#111111', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <strong style={{ color: '#F2D675', fontSize: '15px' }}>Account & Profile Information:</strong>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', lineHeight: '1.5', color: '#B8B8B8' }}>
                When you create an account or sign in with Google, we collect your full name, email address, phone number, and authentication tokens to securely identify your reward wallet and account.
              </p>
            </div>

            <div style={{ background: '#111111', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <strong style={{ color: '#F2D675', fontSize: '15px' }}>Location Data (Foreground Only):</strong>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', lineHeight: '1.5', color: '#B8B8B8' }}>
                With your explicit permission, we access your device GPS coordinates while using the app to calculate physical distances to nearby partner stores and show local discounts. We do NOT track location in the background, nor do we share your location history with third-party data brokers.
              </p>
            </div>

            <div style={{ background: '#111111', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <strong style={{ color: '#F2D675', fontSize: '15px' }}>Reward & Activity Records:</strong>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', lineHeight: '1.5', color: '#B8B8B8' }}>
                We record ad watch sessions, coin earnings across the 12 reward tiers, voucher generation, and merchant redemptions to maintain your authoritative ledger and prevent fraudulent reward claims.
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: How Data is Used */}
        <div style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '20px', color: '#FFFFFF', fontWeight: 700, marginBottom: '12px' }}>
            2. How We Use Your Information
          </h2>
          <ul style={{ paddingLeft: '20px', fontSize: '14px', lineHeight: '1.7', color: '#B8B8B8' }}>
            <li>To operate and maintain your customer loyalty points, coin tiers, and balance.</li>
            <li>To verify identity when redeeming discount vouchers with merchant QR codes.</li>
            <li>To show relevant nearby partner shops, menus, and discount offers.</li>
            <li>To protect against fraud, duplicate redemptions, and system abuse.</li>
            <li>To provide customer support and troubleshoot account issues.</li>
          </ul>
        </div>

        {/* Section 3: Data Sharing & Third Parties */}
        <div style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '20px', color: '#FFFFFF', fontWeight: 700, marginBottom: '12px' }}>
            3. Third-Party Services & Data Sharing
          </h2>
          <p style={{ fontSize: '14px', lineHeight: '1.6', color: '#B8B8B8' }}>
            We do NOT sell or monetize your personal information to third parties. We only share limited data with necessary infrastructure providers:
          </p>
          <ul style={{ paddingLeft: '20px', fontSize: '14px', lineHeight: '1.7', color: '#B8B8B8' }}>
            <li><strong>Google Identity Services:</strong> To facilitate secure, one-tap mobile and web authentication if you choose Google Sign-In.</li>
            <li><strong>Partner Merchants:</strong> Only during checkout verification when you present a QR code. Merchants only receive your verification status and applicable discount percentage.</li>
          </ul>
        </div>

        {/* Section 4: Data Retention & Account Deletion */}
        <div style={{
          background: '#151515',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '28px'
        }}>
          <h2 style={{ fontSize: '18px', color: '#f87171', fontWeight: 700, margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Trash2 size={20} color="#f87171" /> 4. Data Deletion & Your Rights (Google Play Compliance)
          </h2>
          <p style={{ fontSize: '14px', lineHeight: '1.6', color: '#E0E0E0', marginBottom: '12px' }}>
            You have full ownership of your personal data. You can delete your account and all associated personal data at any time:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: '#CCCCCC' }}>
            <div>
              <strong>1. In-App Immediate Deletion:</strong> Go to <em>Profile → Delete Account</em>. Confirming will permanently and immediately delete your account, balances, active batches, and profile.
            </div>
            <div>
              <strong>2. Web Deletion Request (Without App):</strong> If you have uninstalled the app or cannot log in, visit our dedicated public deletion page. Web deletion requests are placed in an administrative queue for manual identity verification and processing by the operator.
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            <Link
              to="/delete-account"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: '#dc2626',
                color: '#FFFFFF',
                padding: '10px 18px',
                borderRadius: '10px',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '13px'
              }}
            >
              <Trash2 size={16} /> Request Account Deletion Online
            </Link>
          </div>
          <p style={{ fontSize: '12px', color: '#888888', marginTop: '12px', margin: '12px 0 0 0' }}>
            * Note: Account deletion permanently purges customer identity, profile data, coin wallet balances, and reward vouchers. Merchant aggregate sales metrics remain intact while personal references are removed.
          </p>
        </div>

        {/* Section 5: Security */}
        <div style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '20px', color: '#FFFFFF', fontWeight: 700, marginBottom: '12px' }}>
            5. Data Security
          </h2>
          <p style={{ fontSize: '14px', lineHeight: '1.6', color: '#B8B8B8' }}>
            We implement strict security measures including bcrypt salted password hashing, signed JSON Web Tokens (JWT), HTTPS/TLS encrypted network communication, and cryptographically hashed QR tokens to safeguard your account against unauthorized access.
          </p>
        </div>

        {/* Section 6: Contact & Operator Details */}
        <div style={{
          background: '#111111',
          border: '1px solid rgba(212, 175, 55, 0.2)',
          borderRadius: '16px',
          padding: '20px',
          textAlign: 'center'
        }}>
          <h2 style={{ fontSize: '18px', color: '#FFFFFF', fontWeight: 700, marginBottom: '6px' }}>
            Questions or Privacy Requests?
          </h2>
          <p style={{ fontSize: '13px', color: '#B8B8B8', marginBottom: '14px' }}>
            For questions about this policy or to exercise your privacy rights, contact the developer directly:
          </p>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#F2D675' }}>
            Sanket Shinde (VP52 Developer)
          </div>
          <div style={{ fontSize: '13px', color: '#A0A0A0', marginTop: '4px' }}>
            Email: <a href="mailto:shindesanket.vp52@gmail.com" style={{ color: '#D4AF37' }}>shindesanket.vp52@gmail.com</a>
          </div>
        </div>
      </div>
    </div>
  );
}
