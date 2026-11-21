import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Package, Phone, CheckCircle2, XCircle, Clock, ArrowLeft, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function MerchantOrders() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchOrders = () => {
    fetch('/api/merchant/orders', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(d => {
        if (d.success) setOrders(d.orders || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrders();
  }, [token]);

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      const res = await fetch(`/api/merchant/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        fetchOrders();
      } else {
        alert(data.error || 'Failed to update order status');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const filteredOrders = orders.filter(o => {
    if (statusFilter === 'all') return true;
    return o.status === statusFilter;
  });

  return (
    <div style={{ maxWidth: '750px', margin: '0 auto', background: '#050505', color: '#FFFFFF' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <button
          onClick={() => navigate('/shop/dashboard')}
          style={{ background: 'none', border: 'none', color: '#D4AF37', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package size={24} color="#10b981" /> Customer Inquiries & Orders
          </h2>
          <span style={{ fontSize: '12px', color: '#888888' }}>Incoming product orders, service bookings, and inquiries</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '16px' }}>
        {[
          { id: 'all', label: `All (${orders.length})` },
          { id: 'pending', label: 'Pending' },
          { id: 'accepted', label: 'Accepted' },
          { id: 'ready', label: 'Ready' },
          { id: 'delivered', label: 'Delivered' },
          { id: 'cancelled', label: 'Cancelled' }
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setStatusFilter(f.id)}
            style={{
              padding: '6px 14px',
              borderRadius: '99px',
              fontSize: '12px',
              fontWeight: 700,
              border: statusFilter === f.id ? '1px solid #D4AF37' : '1px solid rgba(255,255,255,0.1)',
              background: statusFilter === f.id ? '#1A1A1A' : '#111111',
              color: statusFilter === f.id ? '#F2D675' : '#888888',
              cursor: 'pointer'
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '30px', color: '#888888' }}>Loading orders...</div>
      ) : filteredOrders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', background: '#111111', borderRadius: '18px', border: '1px dashed rgba(212,175,55,0.2)', color: '#888888', fontSize: '13px' }}>
          <Package size={36} color="#10b981" style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
          No orders or inquiries found in this status.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredOrders.map(order => {
            const isPending = order.status === 'pending';
            return (
              <div
                key={order.id}
                style={{
                  background: '#111111',
                  borderRadius: '16px',
                  padding: '16px',
                  border: isPending ? '1px solid rgba(212,175,55,0.4)' : '1px solid rgba(255,255,255,0.08)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#F2D675' }}>
                      Order #{order.id}
                    </span>
                    <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', margin: '2px 0' }}>
                      {order.customer_name || 'Customer'}
                    </h4>
                    <span style={{ fontSize: '11px', color: '#888888' }}>
                      {new Date(order.created_at).toLocaleString()}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      padding: '4px 10px',
                      borderRadius: '8px',
                      textTransform: 'uppercase',
                      background: isPending ? 'rgba(212,175,55,0.15)' : order.status === 'delivered' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.08)',
                      color: isPending ? '#F2D675' : order.status === 'delivered' ? '#10b981' : '#FFFFFF',
                      border: `1px solid ${isPending ? 'rgba(212,175,55,0.3)' : 'transparent'}`
                    }}
                  >
                    {order.status}
                  </span>
                </div>

                {/* Items */}
                <div style={{ background: '#161616', borderRadius: '10px', padding: '10px 12px', margin: '8px 0', fontSize: '12px' }}>
                  {(order.items || []).map((it, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                      <span style={{ color: '#DDDDDD' }}>
                        {it.product_name} <strong style={{ color: '#F2D675' }}>x{it.quantity}</strong>
                      </span>
                      <span style={{ color: '#FFFFFF', fontWeight: 700 }}>₹{it.price * it.quantity}</span>
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '6px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                    <span style={{ color: '#B8B8B8' }}>Total Amount:</span>
                    <span style={{ color: '#F2D675', fontSize: '14px' }}>₹{order.total_amount}</span>
                  </div>
                </div>

                {order.notes && (
                  <p style={{ fontSize: '12px', color: '#B8B8B8', margin: '6px 0', fontStyle: 'italic' }}>
                    Note: "{order.notes}"
                  </p>
                )}

                {/* Contact and Status Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  {order.customer_phone ? (
                    <a
                      href={`tel:${order.customer_phone}`}
                      style={{ fontSize: '12px', color: '#F2D675', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontWeight: 700 }}
                    >
                      <Phone size={14} /> Call Customer: {order.customer_phone}
                    </a>
                  ) : <span />}

                  <div style={{ display: 'flex', gap: '6px' }}>
                    {order.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'accepted')}
                          className="btn-primary"
                          style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '8px' }}
                        >
                          Accept Order
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'cancelled')}
                          style={{ background: '#1A1A1A', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                        >
                          Decline
                        </button>
                      </>
                    )}
                    {order.status === 'accepted' && (
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'ready')}
                        className="btn-primary"
                        style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '8px' }}
                      >
                        Mark Ready for Delivery/Pickup
                      </button>
                    )}
                    {order.status === 'ready' && (
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'delivered')}
                        style={{ background: '#10b981', color: '#050505', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
                      >
                        Mark Delivered / Completed
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
