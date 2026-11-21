import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, ArrowLeft, CheckCircle2, AlertTriangle, ShieldCheck, Mail } from 'lucide-react';
import LanguageSwitcher from '../components/LanguageSwitcher';
import vp52Logo from '../assets/vp52-logo.png';

export default function DeleteAccount() {
  const [identifier, setIdentifier] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError('Please provide your registered email address or phone number.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/request-account-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), reason: reason.trim() })
      });

      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
      } else {
        setError(data.error || 'Failed to submit request. Please try again or contact support.');
      }
    } catch (err) {
      console.error(err);
      setError('Network error. Please email shindesanket.vp52@gmail.com directly.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: '#E0E0E0', padding: '24px 16px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        {/* Navigation */}
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
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <img
            src={vp52Logo}
            alt="VP52"
            style={{
              width: '84px',
              height: '84px',
              objectFit: 'contain',
              marginBottom: '14px',
              filter: 'drop-shadow(0 6px 20px rgba(212, 175, 55, 0.3))'
            }}
          />
          <h1 style={{ fontSize: '26px', color: '#FFFFFF', fontWeight: 800, margin: '0 0 6px 0' }}>
            Request VP52 Account & Data Deletion
          </h1>
          <p style={{ fontSize: '13px', color: '#A0A0A0', margin: 0 }}>
            Official account deletion portal operated by developer Sanket Shinde
          </p>
        </div>

        {/* Informational Guidance */}
        <div style={{
          background: '#111111',
          border: '1px solid rgba(212, 175, 55, 0.25)',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '24px'
        }}>
          <h2 style={{ fontSize: '16px', color: '#F2D675', fontWeight: 700, margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={18} color="#D4AF37" /> Your Data Deletion Rights
          </h2>
          <p style={{ fontSize: '13px', lineHeight: '1.6', color: '#CCCCCC', margin: '0 0 10px 0' }}>
            In accordance with Google Play Developer Policies and data protection standards, you have the right to request the complete deletion of your VP52 account and personal information even if you have already uninstalled the application.
          </p>
          <div style={{ fontSize: '12px', color: '#A0A0A0', lineHeight: '1.5' }}>
            <strong style={{ color: '#FFFFFF' }}>What data is permanently erased:</strong>
            <ul style={{ margin: '4px 0 0 0', paddingLeft: '18px' }}>
              <li>Your name, email address, phone number, and password hashes.</li>
              <li>Your reward wallet, accumulated coin balances, and tier batches.</li>
              <li>Your ad viewing sessions, active QR tokens, and redemption history.</li>
              <li>Customer-merchant chat conversations and customer feedback.</li>
            </ul>
          </div>
          <p style={{ fontSize: '11px', color: '#777777', margin: '10px 0 0 0' }}>
            * Past store transaction receipts are retained in an anonymized format for merchant accounting and statutory compliance with customer identity unlinked.
          </p>
        </div>

        {/* Submission Form / Success State */}
        {submitted ? (
          <div style={{
            background: '#111111',
            border: '1px solid #10b981',
            borderRadius: '20px',
            padding: '30px 20px',
            textAlign: 'center'
          }}>
            <CheckCircle2 size={48} color="#10b981" style={{ marginBottom: '14px' }} />
            <h3 style={{ fontSize: '20px', color: '#FFFFFF', fontWeight: 800, margin: '0 0 8px 0' }}>
              Deletion Request Submitted
            </h3>
            <p style={{ fontSize: '14px', color: '#CCCCCC', lineHeight: '1.6', margin: '0 0 20px 0' }}>
              Your request has been securely recorded in the operator review queue. The application operator (Sanket Shinde) will review your submission and contact you at <strong>{identifier}</strong> to verify your identity before processing permanent account deletion.
            </p>
            <p style={{ fontSize: '12px', color: '#888888', margin: '0 0 24px 0' }}>
              If you have further questions, you can contact the developer directly at <a href="mailto:shindesanket.vp52@gmail.com" style={{ color: '#D4AF37' }}>shindesanket.vp52@gmail.com</a>.
            </p>
            <Link
              to="/"
              className="btn-primary"
              style={{ padding: '12px 24px', display: 'inline-block', textDecoration: 'none' }}
            >
              Return to VP52 Home
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{
              background: '#111111',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '20px',
              padding: '24px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#ef4444' }}>
              <Trash2 size={20} color="#ef4444" />
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>
                Account Deletion Form
              </h3>
            </div>

            {error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5',
                padding: '12px',
                borderRadius: '10px',
                fontSize: '13px',
                marginBottom: '16px'
              }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#FFFFFF', marginBottom: '6px' }}>
                Registered Email Address or Phone Number *
              </label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. yourname@example.com or 9876543210"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: '#050505',
                  border: '1px solid rgba(212, 175, 55, 0.3)',
                  borderRadius: '10px',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#B8B8B8', marginBottom: '6px' }}>
                Reason for Deletion (Optional)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Help us understand why you are leaving (optional)..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: '#050505',
                  border: '1px solid #333333',
                  borderRadius: '10px',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '10px',
              padding: '12px',
              marginBottom: '20px',
              display: 'flex',
              gap: '10px'
            }}>
              <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '12px', color: '#fca5a5', lineHeight: '1.4' }}>
                <strong>Permanent Action:</strong> Once processed, this action cannot be undone. All reward coins and access to your account will be lost forever.
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                background: '#dc2626',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '15px',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Trash2 size={18} />
              {loading ? 'Submitting Request...' : 'Submit Permanent Deletion Request'}
            </button>
          </form>
        )}

        {/* Footer Support Notice */}
        <div style={{ textAlign: 'center', marginTop: '28px', fontSize: '12px', color: '#777777' }}>
          Operated by Sanket Shinde • Support Contact:{' '}
          <a href="mailto:shindesanket.vp52@gmail.com" style={{ color: '#D4AF37' }}>
            shindesanket.vp52@gmail.com
          </a>
        </div>
      </div>
    </div>
  );
}
