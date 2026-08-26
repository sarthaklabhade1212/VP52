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
      const res = await fetch(`/api/admin/merchants/${shopId}/verify`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (data.success) {
        fetchPendingQueue();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={26} color="#7c3aed" /> Merchant Verification Queue
        </h2>
        <p style={{ fontSize: '14px', color: '#64748b' }}>
          Review and approve newly registered physical merchants before they become publicly visible to customers.
        </p>
      </div>

      {pendingShops.length === 0 ? (
        <div style={{ background: '#ffffff', borderRadius: '20px', padding: '40px', textAlign: 'center', color: '#64748b', border: '1px solid #e2e8f0' }}>
          <CheckCircle2 size={38} color="#10b981" style={{ margin: '0 auto 10px auto' }} />
          <h3 style={{ fontSize: '18px', color: '#0f172a' }}>Verification Queue Clear!</h3>
          <p style={{ fontSize: '13px' }}>There are currently no pending merchant applications awaiting administrator verification.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {pendingShops.map(s => (
            <div key={s.id} style={{ background: '#ffffff', borderRadius: '20px', padding: '24px', border: '2px solid #fde047', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <span className="badge badge-expired" style={{ background: '#fef9c3', color: '#854d0e', fontWeight: 800 }}>
                  ⏳ PENDING VERIFICATION
                </span>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#4f46e5' }}>{s.shop_code}</span>
              </div>

              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginBottom: '2px' }}>{s.name}</h3>
              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                Owner: <strong>{s.owner_name || 'N/A'}</strong> • Category: <strong>{s.category}</strong>
              </p>

              <div style={{ fontSize: '12px', color: '#475569', background: '#f8fafc', padding: '10px', borderRadius: '10px', marginBottom: '16px' }}>
                <div>📍 <strong>Address:</strong> {s.address}</div>
                <div>📧 <strong>Email:</strong> {s.email}</div>
                <div>📞 <strong>Phone:</strong> {s.phone || 'N/A'}</div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => handleVerifyAction(s.id, 'approved')}
                  className="btn-success"
                  style={{ flex: 1, padding: '10px', fontSize: '13px', justifyContent: 'center' }}
                >
                  <CheckCircle2 size={16} /> Approve
                </button>
                <button
                  onClick={() => handleVerifyAction(s.id, 'rejected')}
                  className="btn-secondary"
                  style={{ flex: 1, padding: '10px', fontSize: '13px', justifyContent: 'center', background: '#fee2e2', color: '#991b1b', border: 'none' }}
                >
                  <XCircle size={16} /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
