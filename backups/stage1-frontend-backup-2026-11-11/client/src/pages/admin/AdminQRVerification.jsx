import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { QrCode, Search, CheckCircle2, XCircle, AlertTriangle, Store, User, Award, ShieldCheck } from 'lucide-react';

export default function AdminQRVerification() {
  const { token } = useAuth();
  const [inputCode, setInputCode] = useState('RW-2026-000123');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleVerify = async (codeToVerify) => {
    const code = (codeToVerify || inputCode).trim();
    if (!code) return;

    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setResult(null);

    try {
      const res = await fetch(`/api/admin/verify-qr/${encodeURIComponent(code)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Redemption code not found');
      }
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleVerify('RW-2026-000123');
  }, []);

  const handleMarkAsUsed = async () => {
    if (!result || !result.redemption) return;
    setVerifying(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/admin/mark-used', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ redemption_code: result.redemption.redemption_code })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to verify redemption');
      }

      setSuccessMsg(data.message);
      handleVerify(result.redemption.redemption_code);
    } catch (err) {
      setError(err.message);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', background: '#050505' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 800 }}>
          <QrCode size={28} color="#D4AF37" /> Physical Shop QR Verification
        </h2>
        <p style={{ fontSize: '14px', color: '#B8B8B8' }}>
          Enter or scan a customer's redemption code (e.g. RW-2026-000123) to verify and apply shop discount.
        </p>
      </div>

      {/* Code Search Input Box */}
      <div style={{
        background: '#111111',
        borderRadius: '20px',
        padding: '24px',
        border: '1px solid rgba(212, 175, 55, 0.25)',
        boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
        marginBottom: '28px'
      }}>
        <label style={{ fontSize: '13px', fontWeight: 700, color: '#B8B8B8', marginBottom: '8px', display: 'block' }}>
          ENTER REDEMPTION CODE / SCAN PAYLOAD
        </label>

        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={20} color="#C9A227" style={{ position: 'absolute', left: '16px', top: '16px' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '48px', fontSize: '18px', fontWeight: 800, letterSpacing: '0.05em', color: '#F2D675' }}
              placeholder="e.g. RW-2026-000123"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
            />
          </div>

          <button
            onClick={() => handleVerify()}
            disabled={loading}
            className="btn-primary"
            style={{ padding: '0 24px', fontSize: '15px' }}
          >
            {loading ? 'Checking...' : 'Verify Code'}
          </button>
        </div>
      </div>

      {/* Verification Feedback Messages */}
      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '16px', borderRadius: '16px',
          marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', fontWeight: 600
        }}>
          <XCircle size={24} color="#fca5a5" style={{ flexShrink: 0 }} />
          <div>{error}</div>
        </div>
      )}

      {successMsg && (
        <div style={{
          background: '#151515', border: '1px solid rgba(212, 175, 55, 0.3)', color: '#F2D675', padding: '16px', borderRadius: '16px',
          marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '15px', fontWeight: 700
        }}>
          <CheckCircle2 size={26} color="#F2D675" style={{ flexShrink: 0 }} />
          <div>{successMsg}</div>
        </div>
      )}

      {/* Verification Result Details Card */}
      {result && result.redemption && (
        <div style={{
          background: '#111111',
          borderRadius: '24px',
          padding: '28px',
          border: '1px solid rgba(212, 175, 55, 0.3)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#B8B8B8', fontWeight: 700 }}>
                REDEMPTION VERIFICATION RESULT
              </span>
              <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#FFFFFF' }}>
                {result.redemption.redemption_code}
              </h2>
            </div>

            {result.redemption.status === 'ACTIVE' ? (
              <span className="badge badge-active" style={{ fontSize: '14px', padding: '8px 16px' }}>
                <CheckCircle2 size={16} color="#F2D675" /> VALID & ACTIVE
              </span>
            ) : result.redemption.status === 'USED' ? (
              <span className="badge badge-used" style={{ fontSize: '14px', padding: '8px 16px' }}>
                <CheckCircle2 size={16} color="#B8B8B8" /> ALREADY USED
              </span>
            ) : (
              <span className="badge badge-expired" style={{ fontSize: '14px', padding: '8px 16px' }}>
                <XCircle size={16} color="#ef4444" /> EXPIRED
              </span>
            )}
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            background: '#151515',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '24px',
            border: '1px solid rgba(212, 175, 55, 0.15)'
          }}>
            <div>
              <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                <Store size={14} color="#D4AF37" /> Physical Shop
              </span>
              <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF' }}>{result.redemption.shop_name}</h4>
              <span style={{ fontSize: '12px', color: '#B8B8B8' }}>{result.redemption.shop_address}</span>
            </div>

            <div>
              <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                <User size={14} color="#D4AF37" /> Customer Name
              </span>
              <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF' }}>{result.redemption.customer_name}</h4>
              <span style={{ fontSize: '12px', color: '#B8B8B8' }}>{result.redemption.customer_email}</span>
            </div>

            <div>
              <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block', marginBottom: '2px' }}>Discount Offered</span>
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#F2D675' }}>{result.redemption.discount_percent}% OFF</h3>
              <span style={{ fontSize: '12px', color: '#B8B8B8' }}>Max Discount: ₹{result.redemption.max_discount_inr}</span>
            </div>

            <div>
              <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block', marginBottom: '2px' }}>Points Deducted</span>
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#F2D675' }}>{result.redemption.points_deducted} Pts</h3>
              <span style={{ fontSize: '12px', color: '#B8B8B8' }}>
                {result.redemption.redeemed_at ? `Used at ${new Date(result.redemption.redeemed_at).toLocaleString()}` : `Created ${new Date(result.redemption.created_at).toLocaleString()}`}
              </span>
            </div>
          </div>

          {/* Action Button */}
          {result.redemption.status === 'ACTIVE' ? (
            <button
              onClick={handleMarkAsUsed}
              disabled={verifying}
              className="btn-primary"
              style={{ width: '100%', padding: '18px', fontSize: '16px', justifyContent: 'center' }}
            >
              <ShieldCheck size={22} color="#050505" />
              {verifying ? 'Verifying & Applying...' : 'MARK AS USED (APPROVE DISCOUNT)'}
            </button>
          ) : (
            <div style={{ background: '#151515', color: '#B8B8B8', padding: '14px', borderRadius: '12px', textAlign: 'center', fontWeight: 700, fontSize: '14px', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
              ⚠️ Redemption cannot be used again (Status: {result.redemption.status})
            </div>
          )}
        </div>
      )}
    </div>
  );
}
