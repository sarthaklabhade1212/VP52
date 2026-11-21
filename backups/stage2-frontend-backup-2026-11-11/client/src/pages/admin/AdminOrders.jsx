import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  ShoppingBag,
  Clock,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Eye,
  Edit2,
  RefreshCw,
  X,
  Store,
  User,
  Calendar,
  DollarSign
} from 'lucide-react';

export default function AdminOrders() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('orders'); // orders, bookings
  const [loading, setLoading] = useState(true);

  // Orders State
  const [orders, setOrders] = useState([]);
  const [orderStatus, setOrderStatus] = useState('all');
  const [orderSearch, setOrderSearch] = useState('');

  // Bookings State
  const [bookings, setBookings] = useState([]);
  const [bookingStatus, setBookingStatus] = useState('all');
  const [bookingSearch, setBookingSearch] = useState('');

  // Details Modal State
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);

  // Status Updater Modal State
  const [updatingEntity, setUpdatingEntity] = useState(null); // { type: 'order'|'booking', id: ..., currentStatus: ... }
  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchOrders = () => {
    setLoading(true);
    let url = '/api/admin/orders?limit=100';
    if (orderStatus !== 'all') url += `&status=${orderStatus}`;
    if (orderSearch.trim()) url += `&search=${encodeURIComponent(orderSearch.trim())}`;

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(d => { if (d.success) setOrders(d.orders || []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const fetchBookings = () => {
    setLoading(true);
    let url = '/api/admin/bookings?limit=100';
    if (bookingStatus !== 'all') url += `&status=${bookingStatus}`;
    if (bookingSearch.trim()) url += `&search=${encodeURIComponent(bookingSearch.trim())}`;

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(d => { if (d.success) setBookings(d.bookings || []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!token) return;
    if (activeTab === 'orders') fetchOrders();
    else fetchBookings();
  }, [token, activeTab, orderStatus, bookingStatus]);

  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    if (!updatingEntity || !newStatus) return;
    setIsUpdating(true);

    const isOrder = updatingEntity.type === 'order';
    const url = isOrder
      ? `/api/admin/orders/${updatingEntity.id}/status`
      : `/api/admin/bookings/${updatingEntity.id}/status`;

    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: newStatus,
          notes: statusNotes.trim()
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUpdatingEntity(null);
        setStatusNotes('');
        if (isOrder) fetchOrders();
        else fetchBookings();
      } else {
        alert(data.error || 'Failed to update status');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const orderStatuses = [
    { value: 'all', label: 'All Orders' },
    { value: 'pending', label: 'Pending' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'preparing', label: 'Preparing' },
    { value: 'ready', label: 'Ready' },
    { value: 'dispatched', label: 'Dispatched' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  const bookingStatuses = [
    { value: 'all', label: 'All Bookings' },
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'rejected', label: 'Rejected' }
  ];

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '24px',
        background: '#0D0D0D',
        border: '1px solid rgba(212, 175, 55, 0.2)',
        borderRadius: '16px',
        padding: '16px 20px'
      }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
            Order & Booking Management
          </h1>
          <p style={{ fontSize: '12px', color: '#A0A0A0', margin: '4px 0 0 0' }}>
            Monitor product delivery orders and service appointment bookings across all partner merchants
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: '8px', background: '#141414', padding: '4px', borderRadius: '10px', border: '1px solid rgba(212, 175, 55, 0.2)' }}>
          <button
            onClick={() => setActiveTab('orders')}
            style={{
              background: activeTab === 'orders' ? 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)' : 'transparent',
              color: activeTab === 'orders' ? '#050505' : '#A0A0A0',
              border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <ShoppingBag size={15} /> Product Orders ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('bookings')}
            style={{
              background: activeTab === 'bookings' ? 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)' : 'transparent',
              color: activeTab === 'bookings' ? '#050505' : '#A0A0A0',
              border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <Clock size={15} /> Service Bookings ({bookings.length})
          </button>
        </div>
      </div>

      {/* ORDERS TAB */}
      {activeTab === 'orders' && (
        <div style={{ background: '#0D0D0D', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '16px', overflow: 'hidden' }}>
          {/* Filter Bar */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <select
                value={orderStatus}
                onChange={e => setOrderStatus(e.target.value)}
                style={{
                  background: '#141414', border: '1px solid rgba(212, 175, 55, 0.25)',
                  color: '#FFFFFF', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', outline: 'none'
                }}
              >
                {orderStatuses.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>

              <div style={{ position: 'relative', width: '260px' }}>
                <Search size={14} color="#D4AF37" style={{ position: 'absolute', left: '10px', top: '9px' }} />
                <input
                  type="text"
                  placeholder="Search order #, customer, shop..."
                  value={orderSearch}
                  onChange={e => setOrderSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') fetchOrders(); }}
                  style={{
                    width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.25)',
                    color: '#FFFFFF', borderRadius: '8px', padding: '6px 10px 6px 32px', fontSize: '12px', outline: 'none'
                  }}
                />
              </div>

              <button
                onClick={fetchOrders}
                style={{ background: '#1A1A1A', border: '1px solid rgba(212, 175, 55, 0.3)', color: '#F2D675', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}
              >
                Filter
              </button>
            </div>

            <span style={{ fontSize: '12px', color: '#888' }}>
              {orders.length} order{orders.length === 1 ? '' : 's'} found
            </span>
          </div>

          {/* Orders Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#121212', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', color: '#A0A0A0', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>Order #</th>
                  <th style={{ padding: '12px 16px' }}>Customer</th>
                  <th style={{ padding: '12px 16px' }}>Merchant</th>
                  <th style={{ padding: '12px 16px' }}>Items</th>
                  <th style={{ padding: '12px 16px' }}>Total Amount</th>
                  <th style={{ padding: '12px 16px' }}>Coins Used</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px' }}>Placed Date</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.length > 0 ? (
                  orders.map(o => (
                    <tr key={o.id} style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.08)' }}>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 800, color: '#D4AF37' }}>
                        {o.order_number}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#FFF' }}>{o.customer_name || `User #${o.user_id}`}</div>
                        <div style={{ fontSize: '10px', color: '#888' }}>{o.customer_phone || o.customer_email}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#FFF' }}>{o.merchant_name}</div>
                        <div style={{ fontSize: '10px', color: '#888' }}>{o.merchant_phone}</div>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#C0C0C0' }}>
                        {o.items_count || (o.items ? JSON.parse(o.items || '[]').length : 1)} item(s)
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: '#22c55e', fontSize: '14px' }}>
                        ₹{o.total_amount}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#F2D675', fontWeight: 700 }}>
                        {o.coins_redeemed ? `🪙 ${o.coins_redeemed}` : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase',
                          background: o.status === 'delivered' ? 'rgba(34, 197, 94, 0.15)' :
                                      o.status === 'cancelled' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(212, 175, 55, 0.15)',
                          color: o.status === 'delivered' ? '#22c55e' :
                                 o.status === 'cancelled' ? '#ef4444' : '#F2D675'
                        }}>
                          {o.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '11px', color: '#888' }}>
                        {new Date(o.created_at).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => setSelectedOrder(o)}
                            style={{
                              padding: '5px 8px', borderRadius: '6px', background: '#1A1A1A',
                              border: '1px solid rgba(255, 255, 255, 0.15)', color: '#FFF', fontSize: '11px', cursor: 'pointer'
                            }}
                          >
                            Details
                          </button>
                          <button
                            onClick={() => {
                              setUpdatingEntity({ type: 'order', id: o.id, currentStatus: o.status });
                              setNewStatus(o.status);
                              setStatusNotes('');
                            }}
                            style={{
                              padding: '5px 8px', borderRadius: '6px', background: 'rgba(212, 175, 55, 0.15)',
                              border: '1px solid #D4AF37', color: '#F2D675', fontSize: '11px', fontWeight: 700, cursor: 'pointer'
                            }}
                          >
                            Update
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} style={{ padding: '36px', textAlign: 'center', color: '#888' }}>
                      {loading ? 'Loading orders...' : 'No orders found matching the filter'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* BOOKINGS TAB */}
      {activeTab === 'bookings' && (
        <div style={{ background: '#0D0D0D', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '16px', overflow: 'hidden' }}>
          {/* Filter Bar */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <select
                value={bookingStatus}
                onChange={e => setBookingStatus(e.target.value)}
                style={{
                  background: '#141414', border: '1px solid rgba(212, 175, 55, 0.25)',
                  color: '#FFFFFF', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', outline: 'none'
                }}
              >
                {bookingStatuses.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>

              <div style={{ position: 'relative', width: '260px' }}>
                <Search size={14} color="#D4AF37" style={{ position: 'absolute', left: '10px', top: '9px' }} />
                <input
                  type="text"
                  placeholder="Search booking #, customer, service..."
                  value={bookingSearch}
                  onChange={e => setBookingSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') fetchBookings(); }}
                  style={{
                    width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.25)',
                    color: '#FFFFFF', borderRadius: '8px', padding: '6px 10px 6px 32px', fontSize: '12px', outline: 'none'
                  }}
                />
              </div>

              <button
                onClick={fetchBookings}
                style={{ background: '#1A1A1A', border: '1px solid rgba(212, 175, 55, 0.3)', color: '#F2D675', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}
              >
                Filter
              </button>
            </div>

            <span style={{ fontSize: '12px', color: '#888' }}>
              {bookings.length} booking{bookings.length === 1 ? '' : 's'} found
            </span>
          </div>

          {/* Bookings Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#121212', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', color: '#A0A0A0', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>Booking #</th>
                  <th style={{ padding: '12px 16px' }}>Customer</th>
                  <th style={{ padding: '12px 16px' }}>Service Name</th>
                  <th style={{ padding: '12px 16px' }}>Merchant</th>
                  <th style={{ padding: '12px 16px' }}>Slot Date & Time</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.length > 0 ? (
                  bookings.map(b => (
                    <tr key={b.id} style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.08)' }}>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 800, color: '#D4AF37' }}>
                        {b.booking_number}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#FFF' }}>{b.customer_name || `User #${b.user_id}`}</div>
                        <div style={{ fontSize: '10px', color: '#888' }}>{b.customer_phone}</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#FFFFFF' }}>
                        {b.service_name}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#FFF' }}>{b.merchant_name}</div>
                        <div style={{ fontSize: '10px', color: '#888' }}>{b.merchant_category}</div>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#F2D675', fontWeight: 600 }}>
                        {b.booking_date} at {b.booking_time}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase',
                          background: b.status === 'completed' ? 'rgba(34, 197, 94, 0.15)' :
                                      b.status === 'confirmed' ? 'rgba(59, 130, 246, 0.15)' :
                                      b.status === 'cancelled' || b.status === 'rejected' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                          color: b.status === 'completed' ? '#22c55e' :
                                 b.status === 'confirmed' ? '#3b82f6' :
                                 b.status === 'cancelled' || b.status === 'rejected' ? '#ef4444' : '#eab308'
                        }}>
                          {b.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => {
                            setUpdatingEntity({ type: 'booking', id: b.id, currentStatus: b.status });
                            setNewStatus(b.status);
                            setStatusNotes('');
                          }}
                          style={{
                            padding: '5px 8px', borderRadius: '6px', background: 'rgba(212, 175, 55, 0.15)',
                            border: '1px solid #D4AF37', color: '#F2D675', fontSize: '11px', fontWeight: 700, cursor: 'pointer'
                          }}
                        >
                          Update Status
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: '#888' }}>
                      {loading ? 'Loading bookings...' : 'No service bookings found matching the filter'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#0E0E0E', border: '1px solid #D4AF37', borderRadius: '16px',
            width: '500px', maxWidth: '100%', padding: '24px', boxShadow: '0 16px 40px rgba(0,0,0,0.9)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                  Order #{selectedOrder.order_number}
                </h3>
                <span style={{ fontSize: '11px', color: '#D4AF37' }}>
                  Placed on {new Date(selectedOrder.created_at).toLocaleString()}
                </span>
              </div>
              <button onClick={() => setSelectedOrder(null)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '12px', background: '#141414', borderRadius: '10px', marginBottom: '14px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#888' }}>Customer:</span>
                <span style={{ color: '#FFF', fontWeight: 700 }}>{selectedOrder.customer_name} ({selectedOrder.customer_phone})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#888' }}>Merchant Shop:</span>
                <span style={{ color: '#F2D675', fontWeight: 700 }}>{selectedOrder.merchant_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#888' }}>Delivery Address:</span>
                <span style={{ color: '#FFF' }}>{selectedOrder.delivery_address || 'Takeaway / Store Pickup'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #222', paddingTop: '6px' }}>
                <span style={{ color: '#888' }}>Total Payable:</span>
                <span style={{ color: '#22c55e', fontWeight: 900, fontSize: '14px' }}>₹{selectedOrder.total_amount}</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedOrder(null)}
                style={{ padding: '8px 16px', borderRadius: '8px', background: '#1A1A1A', border: '1px solid #333', color: '#FFF', fontSize: '12px', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Updater Modal */}
      {updatingEntity && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#0E0E0E', border: '1px solid #D4AF37', borderRadius: '16px',
            width: '440px', maxWidth: '100%', padding: '24px', boxShadow: '0 16px 40px rgba(0,0,0,0.9)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                Update {updatingEntity.type === 'order' ? 'Order' : 'Booking'} Status
              </h3>
              <button onClick={() => setUpdatingEntity(null)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleStatusSubmit}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                  New Status *
                </label>
                <select
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value)}
                  style={{
                    width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.3)',
                    borderRadius: '8px', padding: '10px', color: '#FFFFFF', fontSize: '13px', outline: 'none'
                  }}
                >
                  {(updatingEntity.type === 'order' ? orderStatuses : bookingStatuses)
                    .filter(s => s.value !== 'all')
                    .map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                </select>
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                  Admin Notes / Customer Explanation
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional internal remarks or status reason..."
                  value={statusNotes}
                  onChange={e => setStatusNotes(e.target.value)}
                  style={{
                    width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.3)',
                    borderRadius: '8px', padding: '8px 12px', color: '#FFFFFF', fontSize: '12px', outline: 'none', resize: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setUpdatingEntity(null)}
                  style={{ padding: '8px 14px', borderRadius: '8px', background: '#1A1A1A', border: '1px solid #333', color: '#888', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  style={{
                    padding: '8px 18px', borderRadius: '8px',
                    background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)',
                    border: 'none', color: '#050505', fontSize: '12px', fontWeight: 900, cursor: 'pointer'
                  }}
                >
                  {isUpdating ? 'Saving...' : 'Confirm Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
