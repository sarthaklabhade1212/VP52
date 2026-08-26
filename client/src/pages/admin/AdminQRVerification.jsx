import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { QrCode, Search, CheckCircle2, XCircle, AlertTriangle, Store, User, Award, ShieldCheck } from 'lucide-react';

export default function AdminQRVerification() {
  const { token } = useAuth();
  const [inputCode, setInputCode] = useState('RW-2026-000123'); // Default test code as per prompt spec!
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
    // Auto lookup demo code on load
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
      // Refresh lookup to reflect USED status
      handleVerify(result.redemption.redemption_code);
    } catch (err) {
      setError(err.message);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <QrCode size={28} color="#4f46e5" /> Physical Shop QR Verification
        </h2>
        <p style={{ fontSize: '14px', color: '#64748b' }}>
          Enter or scan a customer's redemption code (e.g. RW-2026-000123) to verify and apply shop discount.
        </p>
      </div>

      {/* Code Search Input Box */}
      <div style={{
        background: '#ffffff',
        borderRadius: '20px',
        padding: '24px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
        marginBottom: '28px'
      }}>
        <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '8px', display: 'block' }}>
          ENTER REDEMPTION CODE / SCAN PAYLOAD
        </label>

        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={20} color="#94a3b8" style={{ position: 'absolute', left: '16px', top: '16px' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '48px', fontSize: '18px', fontWeight: 800, letterSpacing: '0.05em' }}
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
          background: '#fef2f2', border: '1.5px solid #fecaca', color: '#b91c1c', padding: '16px', borderRadius: '16px',
          marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', fontWeight: 600
        }}>
          <XCircle size={24} style={{ flexShrink: 0 }} />
          <div>{error}</div>
        </div>
      )}

      {successMsg && (
        <div style={{
          background: '#ecfdf5', border: '1.5px solid #a7f3d0', color: '#047857', padding: '16px', borderRadius: '16px',
          marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '15px', fontWeight: 700
        }}>
          <CheckCircle2 size={26} style={{ flexShrink: 0 }} />
          <div>{successMsg}</div>
        </div>
      )}

      {/* Verification Result Details Card */}
      {result && result.redemption && (
        <div style={{
          background: '#ffffff',
          borderRadius: '24px',
          padding: '28px',
          border: '1.5px solid #e2e8f0',
          boxShadow: '0 10px 30px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', fontWeight: 700 }}>
                REDEMPTION VERIFICATION RESULT
              </span>
              <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>
                {result.redemption.redemption_code}
              </h2>
            </div>

            {result.redemption.status === 'ACTIVE' ? (
              <span className="badge badge-active" style={{ fontSize: '14px', padding: '8px 16px' }}>
                <CheckCircle2 size={16} /> VALID & ACTIVE
              </span>
            ) : result.redemption.status === 'USED' ? (
              <span className="badge badge-used" style={{ fontSize: '14px', padding: '8px 16px' }}>
                <CheckCircle2 size={16} /> ALREADY USED
              </span>
            ) : (
              <span className="badge badge-expired" style={{ fontSize: '14px', padding: '8px 16px' }}>
                <XCircle size={16} /> EXPIRED
              </span>
            )}
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            background: '#f8fafc',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '24px',
            border: '1px solid #e2e8f0'
          }}>
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                <Store size={14} /> Physical Shop
              </span>
              <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{result.redemption.shop_name}</h4>
              <span style={{ fontSize: '12px', color: '#64748b' }}>{result.redemption.shop_address}</span>
            </div>

            <div>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                <User size={14} /> Customer Name
              </span>
              <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{result.redemption.customer_name}</h4>
              <span style={{ fontSize: '12px', color: '#64748b' }}>{result.redemption.customer_email}</span>
            </div>

            <div>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '2px' }}>Discount Offered</span>
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#10b981' }}>{result.redemption.discount_percent}% OFF</h3>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Max Discount: ₹{result.redemption.max_discount_inr}</span>
            </div>

            <div>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '2px' }}>Points Deducted</span>
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#4f46e5' }}>{result.redemption.points_deducted} Pts</h3>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                {result.redemption.redeemed_at ? `Used at ${new Date(result.redemption.redeemed_at).toLocaleString()}` : `Created ${new Date(result.redemption.created_at).toLocaleString()}`}
              </span>
            </div>
          </div>

          {/* Action Button */}
          {result.redemption.status === 'ACTIVE' ? (
            <button
              onClick={handleMarkAsUsed}
              disabled={verifying}
              className="btn-success"
              style={{ width: '100%', padding: '18px', fontSize: '16px', justifyContent: 'center' }}
            >
              <ShieldCheck size={22} />
              {verifying ? 'Verifying & Applying...' : 'MARK AS USED (APPROVE DISCOUNT)'}
            </button>
          ) : (
            <div style={{ background: '#f1f5f9', color: '#64748b', padding: '14px', borderRadius: '12px', textAlign: 'center', fontWeight: 700, fontSize: '14px' }}>
              ⚠️ Redemption cannot be used again (Status: {result.redemption.status})
            </div>
          )}
        </div>
      )}
    </div>
  );
}
