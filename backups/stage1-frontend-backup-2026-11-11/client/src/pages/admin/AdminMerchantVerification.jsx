import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Store, CheckCircle2, XCircle, AlertTriangle, ShieldCheck, MapPin } from 'lucide-react';

export default function AdminMerchantVerification() {
  const { token } = useAuth();
  const [pendingShops, setPendingShops] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPendingQueue = () => {
    fetch('/api/admin/merchants/pending', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(d => { if (d.success) setPendingShops(d.shops || []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPendingQueue();
  }, [token]);

  const handleVerifyAction = async (shopId, action) => {
    try {
      let url = `/api/admin/shops/${shopId}/approve`;
      let body = {};
      if (action === 'rejected') {
        const reason = prompt('Please enter the reason for rejecting this merchant registration:');
        if (!reason) return;
        url = `/api/admin/shops/${shopId}/reject`;
        body = { reason };
      }

      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        fetchPendingQueue();
      } else {
        alert(data.error || 'Failed to update merchant status');
      }
    } catch (e) {
      console.error(e);
      alert(e.message);
    }
  };

  return (
    <div style={{ background: '#050505' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
          <ShieldCheck size={26} color="#D4AF37" /> Merchant Verification Queue
        </h2>
        <p style={{ fontSize: '14px', color: '#B8B8B8' }}>
          Review and approve newly registered physical merchants before they become publicly visible to customers.
        </p>
      </div>

      {pendingShops.length === 0 ? (
        <div style={{ background: '#111111', borderRadius: '20px', padding: '40px', textAlign: 'center', color: '#B8B8B8', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
          <CheckCircle2 size={38} color="#F2D675" style={{ margin: '0 auto 10px auto' }} />
          <h3 style={{ fontSize: '18px', color: '#FFFFFF', fontWeight: 800 }}>Verification Queue Clear!</h3>
          <p style={{ fontSize: '13px', color: '#B8B8B8' }}>There are currently no pending merchant applications awaiting administrator verification.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {pendingShops.map(s => (
            <div key={s.id} style={{ background: '#111111', borderRadius: '20px', padding: '24px', border: '1px solid rgba(212, 175, 55, 0.3)', boxShadow: '0 8px 30px rgba(0,0,0,0.35)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <span className="badge badge-expired" style={{ background: '#151515', border: '1px solid rgba(212, 175, 55, 0.3)', color: '#F2D675', fontWeight: 800 }}>
                  ⏳ PENDING VERIFICATION
                </span>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#F2D675' }}>{s.shop_code}</span>
              </div>

              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#FFFFFF', marginBottom: '2px' }}>{s.name}</h3>
              <p style={{ fontSize: '12px', color: '#B8B8B8', marginBottom: '12px' }}>
                Owner: <strong style={{ color: '#FFFFFF' }}>{s.owner_name || 'N/A'}</strong> • Category: <strong style={{ color: '#D4AF37' }}>{s.category}</strong>
              </p>

              <div style={{ fontSize: '12px', color: '#B8B8B8', background: '#151515', padding: '10px', borderRadius: '10px', marginBottom: '16px', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
                <div>📍 <strong>Address:</strong> {s.address}</div>
                <div>📧 <strong>Email:</strong> {s.email}</div>
                <div>📞 <strong>Phone:</strong> {s.phone || 'N/A'}</div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => handleVerifyAction(s.id, 'approved')}
                  className="btn-primary"
                  style={{ flex: 1, padding: '10px', fontSize: '13px', justifyContent: 'center' }}
                >
                  <CheckCircle2 size={16} color="#050505" /> Approve
                </button>
                <button
                  onClick={() => handleVerifyAction(s.id, 'rejected')}
                  style={{ flex: 1, padding: '10px', fontSize: '13px', justifyContent: 'center', background: '#151515', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <XCircle size={16} color="#ef4444" /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
