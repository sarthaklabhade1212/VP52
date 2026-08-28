import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import { History, CheckCircle2, Clock, XCircle, QrCode, ArrowUpRight, Sparkles } from 'lucide-react';

export default function CustomerHistory() {
  const { token } = useAuth();
  const [redemptions, setRedemptions] = useState([]);
  const [selectedQR, setSelectedQR] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/customer/redemptions', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) setRedemptions(data.redemptions || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="badge badge-active"><CheckCircle2 size={12} color="#F2D675" /> Active</span>;
      case 'USED':
        return <span className="badge badge-used"><Clock size={12} color="#B8B8B8" /> Used</span>;
      case 'EXPIRED':
        return <span className="badge badge-expired"><XCircle size={12} color="#fca5a5" /> Expired</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', background: '#050505' }}>
      <h2 style={{ fontSize: '22px', color: '#FFFFFF', marginBottom: '4px', fontWeight: 800 }}>
        Redemption History
      </h2>
      <p style={{ fontSize: '13px', color: '#B8B8B8', marginBottom: '16px' }}>
        View all your active and past redeemed shop discount vouchers.
      </p>

      {redemptions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#B8B8B8' }}>
          <History size={48} color="#777777" style={{ marginBottom: '12px' }} />
          <h3 style={{ color: '#FFFFFF' }}>No Redemptions Found</h3>
          <p style={{ fontSize: '13px', marginTop: '4px', color: '#B8B8B8' }}>Redeem your points for shop discount vouchers to see them here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {redemptions.map((item) => (
            <div
              key={item.id}
              style={{
                background: '#111111',
                borderRadius: '16px',
                padding: '16px',
                border: '1px solid rgba(212, 175, 55, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 8px 30px rgba(0,0,0,0.35)'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  {getStatusBadge(item.status)}
                  <span style={{ fontSize: '11px', color: '#F2D675', fontWeight: 600 }}>
                    {item.redemption_code}
                  </span>
                </div>

                <h4 style={{ fontSize: '15px', color: '#FFFFFF', fontWeight: 700 }}>
                  {item.discount_percent}% OFF — {item.shop_name}
                </h4>

                <span style={{ fontSize: '12px', color: '#B8B8B8', display: 'block', marginTop: '2px' }}>
                  {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} • Deducted: {item.points_deducted} Pts
                </span>
              </div>

              {item.status === 'ACTIVE' ? (
                <button
                  onClick={() => setSelectedQR(item)}
                  className="btn-primary"
                  style={{ padding: '8px 14px', fontSize: '12px', borderRadius: '10px' }}
                >
                  <QrCode size={16} color="#050505" /> Show QR
                </button>
              ) : (
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#777777' }}>
                  {item.status}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* View QR Modal */}
      {selectedQR && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{ background: '#111111', border: '1px solid rgba(212, 175, 55, 0.3)', borderRadius: '24px', maxWidth: '380px', width: '100%', padding: '24px', textAlign: 'center' }}>
            <h3 style={{ fontSize: '18px', color: '#FFFFFF', marginBottom: '4px' }}>{selectedQR.shop_name}</h3>
            <span style={{ fontSize: '20px', fontWeight: 800, color: '#F2D675', display: 'block', marginBottom: '12px' }}>
              {selectedQR.discount_percent}% OFF DISCOUNT
            </span>

            <div style={{ background: '#FFFFFF', padding: '18px', borderRadius: '20px', display: 'inline-block', marginBottom: '16px' }}>
              <QRCodeSVG
                value={JSON.stringify({ code: selectedQR.redemption_code, shop: selectedQR.shop_name })}
                size={180}
              />
            </div>

            <div style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '0.05em', color: '#FFFFFF', marginBottom: '16px' }}>
              Code: {selectedQR.redemption_code}
            </div>

            <button onClick={() => setSelectedQR(null)} className="btn-secondary" style={{ width: '100%', padding: '12px' }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
