import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { parseApiResponse, resolveApiErrorMessage, resolveNetworkErrorMessage } from '../../utils/api';
import { formatInr, formatCoins } from '../../utils/formatters';
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
  const { t, locale, translateCategory } = useI18n();
  const [activeTab, setActiveTab] = useState('orders'); // orders, bookings
  const [loading, setLoading] = useState(true);

  const getStatusLabel = (status) => {
    const key = `adminStatusLabel_${String(status || '').toLowerCase()}`;
    const res = t(key);
    return res === key ? status : res;
  };

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
      .then(parseApiResponse)
      .then(parsed => {
        const d = parsed.data;
        if (parsed.ok && d && d.success) setOrders(d.orders || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const fetchBookings = () => {
    setLoading(true);
    let url = '/api/admin/bookings?limit=100';
    if (bookingStatus !== 'all') url += `&status=${bookingStatus}`;
    if (bookingSearch.trim()) url += `&search=${encodeURIComponent(bookingSearch.trim())}`;

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(parseApiResponse)
      .then(parsed => {
        const d = parsed.data;
        if (parsed.ok && d && d.success) setBookings(d.bookings || []);
      })
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
      const parsed = await parseApiResponse(res);
      const data = parsed.data;
      if (parsed.ok && data && data.success) {
        setUpdatingEntity(null);
        setStatusNotes('');
        if (isOrder) fetchOrders();
        else fetchBookings();
      } else {
        alert(resolveApiErrorMessage(parsed, t, 'failedUpdateStatusErr'));
      }
    } catch (err) {
      alert(resolveNetworkErrorMessage(err, t, 'failedUpdateStatusErr'));
    } finally {
      setIsUpdating(false);
    }
  };

  const orderStatuses = [
    { value: 'all', label: t('allOrdersOption') },
    { value: 'pending', label: t('orderFilterOpt_pending') },
    { value: 'accepted', label: t('orderFilterOpt_accepted') },
    { value: 'preparing', label: t('orderFilterOpt_preparing') },
    { value: 'ready', label: t('orderFilterOpt_ready') },
    { value: 'dispatched', label: t('orderFilterOpt_dispatched') },
    { value: 'delivered', label: t('orderFilterOpt_delivered') },
    { value: 'cancelled', label: t('orderFilterOpt_cancelled') }
  ];

  const bookingStatuses = [
    { value: 'all', label: t('allBookingsOption') },
    { value: 'pending', label: t('orderFilterOpt_pending') },
    { value: 'confirmed', label: t('bookingFilterOpt_confirmed') },
    { value: 'completed', label: t('bookingFilterOpt_completed') },
    { value: 'cancelled', label: t('orderFilterOpt_cancelled') },
    { value: 'rejected', label: t('bookingFilterOpt_rejected') }
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
            {t('adminOrdersTitle')}
          </h1>
          <p style={{ fontSize: '12px', color: '#A0A0A0', margin: '4px 0 0 0' }}>
            {t('adminOrdersSub')}
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: '8px', background: '#141414', padding: '4px', borderRadius: '10px', border: '1px solid rgba(212, 175, 55, 0.2)' }}>
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            style={{
              background: activeTab === 'orders' ? 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)' : 'transparent',
              color: activeTab === 'orders' ? '#050505' : '#A0A0A0',
              border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <ShoppingBag size={15} /> {t('tabProductOrdersCount', { count: orders.length })}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bookings')}
            style={{
              background: activeTab === 'bookings' ? 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)' : 'transparent',
              color: activeTab === 'bookings' ? '#050505' : '#A0A0A0',
              border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <Clock size={15} /> {t('tabServiceBookingsCount', { count: bookings.length })}
          </button>
        </div>
      </div>

      {/* ORDERS TAB */}
      {activeTab === 'orders' && (
        <div style={{ background: '#0D0D0D', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '16px', overflow: 'hidden' }}>
          {/* Filter Bar */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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
                  placeholder={t('searchOrdersPlaceholder')}
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
                type="button"
                onClick={fetchOrders}
                style={{ background: '#1A1A1A', border: '1px solid rgba(212, 175, 55, 0.3)', color: '#F2D675', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}
              >
                {t('adminFilterBtn')}
              </button>
            </div>

            <span style={{ fontSize: '12px', color: '#888' }}>
              {orders.length === 1 ? t('ordersFoundSingle', { count: orders.length }) : t('ordersFoundPlural', { count: orders.length })}
            </span>
          </div>

          {/* Orders Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#121212', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', color: '#A0A0A0', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>{t('colOrderNum')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colCustomer')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colMerchant')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colItems')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colTotalAmount')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colCoinsUsed')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colStatus')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colPlacedDate')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>{t('colActions')}</th>
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
                        <div style={{ fontWeight: 700, color: '#FFF' }}>{o.customer_name || t('userFallbackLabel', { id: o.user_id })}</div>
                        <div style={{ fontSize: '10px', color: '#888' }}>{o.customer_phone || o.customer_email}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#FFF' }}>{o.merchant_name}</div>
                        <div style={{ fontSize: '10px', color: '#888' }}>{o.merchant_phone}</div>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#C0C0C0' }}>
                        {t('itemsCountLabel', { count: o.items_count || (o.items ? JSON.parse(o.items || '[]').length : 1) })}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: '#22c55e', fontSize: '14px' }}>
                        {formatInr(o.total_amount, locale)}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#F2D675', fontWeight: 700 }}>
                        {o.coins_redeemed ? `🪙 ${formatCoins(o.coins_redeemed, locale, t('coinsUnit'))}` : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase',
                          background: o.status === 'delivered' ? 'rgba(34, 197, 94, 0.15)' :
                                      o.status === 'cancelled' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(212, 175, 55, 0.15)',
                          color: o.status === 'delivered' ? '#22c55e' :
                                 o.status === 'cancelled' ? '#ef4444' : '#F2D675'
                        }}>
                          {getStatusLabel(o.status)}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '11px', color: '#888' }}>
                        {new Date(o.created_at).toLocaleString(locale)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(o)}
                            style={{
                              padding: '5px 8px', borderRadius: '6px', background: '#1A1A1A',
                              border: '1px solid rgba(255, 255, 255, 0.15)', color: '#FFF', fontSize: '11px', cursor: 'pointer'
                            }}
                          >
                            {t('adminDetailsBtn')}
                          </button>
                          <button
                            type="button"
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
                            {t('adminUpdateBtn')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} style={{ padding: '36px', textAlign: 'center', color: '#888' }}>
                      {loading ? t('loadingOrdersText') : t('noOrdersFilterMatch')}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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
                  placeholder={t('searchBookingsPlaceholder')}
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
                type="button"
                onClick={fetchBookings}
                style={{ background: '#1A1A1A', border: '1px solid rgba(212, 175, 55, 0.3)', color: '#F2D675', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}
              >
                {t('adminFilterBtn')}
              </button>
            </div>

            <span style={{ fontSize: '12px', color: '#888' }}>
              {bookings.length === 1 ? t('bookingsFoundSingle', { count: bookings.length }) : t('bookingsFoundPlural', { count: bookings.length })}
            </span>
          </div>

          {/* Bookings Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#121212', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', color: '#A0A0A0', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>{t('colBookingNum')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colCustomer')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colServiceName')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colMerchant')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colSlotDateTime')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colStatus')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>{t('colActions')}</th>
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
                        <div style={{ fontWeight: 700, color: '#FFF' }}>{b.customer_name || t('userFallbackLabel', { id: b.user_id })}</div>
                        <div style={{ fontSize: '10px', color: '#888' }}>{b.customer_phone}</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#FFFFFF' }}>
                        {b.service_name}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#FFF' }}>{b.merchant_name}</div>
                        <div style={{ fontSize: '10px', color: '#888' }}>{b.merchant_category ? translateCategory(b.merchant_category) : '—'}</div>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#F2D675', fontWeight: 600 }}>
                        {t('bookingDateAtTime', { date: b.booking_date, time: b.booking_time })}
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
                          {getStatusLabel(b.status)}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          type="button"
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
                          {t('updateStatusBtn')}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: '#888' }}>
                      {loading ? t('loadingBookingsText') : t('noBookingsFilterMatch')}
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
        <div role="dialog" aria-modal="true" style={{
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
                  {t('orderNumberHeading', { id: selectedOrder.order_number })}
                </h3>
                <span style={{ fontSize: '11px', color: '#D4AF37' }}>
                  {t('placedOnLabel', { date: new Date(selectedOrder.created_at).toLocaleString(locale) })}
                </span>
              </div>
              <button type="button" aria-label={t('closeModalAria')} onClick={() => setSelectedOrder(null)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '12px', background: '#141414', borderRadius: '10px', marginBottom: '14px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#888' }}>{t('customerColon')}</span>
                <span style={{ color: '#FFF', fontWeight: 700 }}>{selectedOrder.customer_name} ({selectedOrder.customer_phone})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#888' }}>{t('merchantShopColon')}</span>
                <span style={{ color: '#F2D675', fontWeight: 700 }}>{selectedOrder.merchant_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#888' }}>{t('deliveryAddressColon')}</span>
                <span style={{ color: '#FFF' }}>{selectedOrder.delivery_address || t('takeawayPickupFallback')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #222', paddingTop: '6px' }}>
                <span style={{ color: '#888' }}>{t('totalPayableColon')}</span>
                <span style={{ color: '#22c55e', fontWeight: 900, fontSize: '14px' }}>{formatInr(selectedOrder.total_amount, locale)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                style={{ padding: '8px 16px', borderRadius: '8px', background: '#1A1A1A', border: '1px solid #333', color: '#FFF', fontSize: '12px', cursor: 'pointer' }}
              >
                {t('closeBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Updater Modal */}
      {updatingEntity && (
        <div role="dialog" aria-modal="true" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#0E0E0E', border: '1px solid #D4AF37', borderRadius: '16px',
            width: '440px', maxWidth: '100%', padding: '24px', boxShadow: '0 16px 40px rgba(0,0,0,0.9)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                {updatingEntity.type === 'order' ? t('updateOrderStatusTitle') : t('updateBookingStatusTitle')}
              </h3>
              <button type="button" aria-label={t('closeModalAria')} onClick={() => setUpdatingEntity(null)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleStatusSubmit}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                  {t('newStatusRequiredLabel')}
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
                  {t('adminNotesOptionalLabel')}
                </label>
                <textarea
                  rows={2}
                  placeholder={t('statusNotesPlaceholder')}
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
                  {t('cancelBtn')}
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
                  {isUpdating ? t('adminSavingProgress') : t('confirmStatusBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
