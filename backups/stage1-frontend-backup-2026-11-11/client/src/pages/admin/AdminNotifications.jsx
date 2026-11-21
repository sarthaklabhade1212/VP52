import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Bell,
  Send,
  Users,
  Store,
  Tag,
  CheckCircle2,
  X,
  Clock,
  Eye,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

export default function AdminNotifications() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  // Composer Form State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetAudience, setTargetAudience] = useState('all_customers');
  const [targetId, setTargetId] = useState('');
  const [notifType, setNotifType] = useState('announcement');
  const [isSending, setIsSending] = useState(false);
  const [sendFeedback, setSendFeedback] = useState({ type: '', text: '' });

  // Recipients Modal State
  const [selectedNotif, setSelectedNotif] = useState(null);
  const [recipients, setRecipients] = useState([]);
  const [recipientsLoading, setRecipientsLoading] = useState(false);

  const fetchNotifications = () => {
    setLoading(true);
    fetch('/api/admin/notifications?limit=50', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(d => { if (d.success) setNotifications(d.notifications || []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) fetchNotifications();
  }, [token]);

  const handleSend = async (e) => {
    e.preventDefault();
    setSendFeedback({ type: '', text: '' });

    if (!title.trim() || !message.trim()) {
      setSendFeedback({ type: 'error', text: 'Title and message are required' });
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch('/api/admin/notifications/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          target_audience: targetAudience,
          target_id: targetId ? targetId.trim() : null,
          notification_type: notifType
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSendFeedback({ type: 'success', text: data.message });
        setTitle('');
        setMessage('');
        setTargetId('');
        fetchNotifications();
      } else {
        setSendFeedback({ type: 'error', text: data.error || 'Failed to dispatch notification' });
      }
    } catch (err) {
      setSendFeedback({ type: 'error', text: err.message });
    } finally {
      setIsSending(false);
    }
  };

  const handleViewRecipients = (notif) => {
    setSelectedNotif(notif);
    setRecipients([]);
    setRecipientsLoading(true);

    fetch(`/api/admin/notifications/${notif.id}/recipients`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(d => { if (d.success) setRecipients(d.recipients || []); })
      .catch(console.error)
      .finally(() => setRecipientsLoading(false));
  };

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
            Notification & Broadcast Management
          </h1>
          <p style={{ fontSize: '12px', color: '#A0A0A0', margin: '4px 0 0 0' }}>
            Dispatch targeted in-app alerts, market offers, festival announcements & system updates
          </p>
        </div>

        <button
          onClick={fetchNotifications}
          style={{
            background: '#181818', border: '1px solid rgba(212, 175, 55, 0.3)',
            color: '#D4AF37', padding: '8px 16px', borderRadius: '10px',
            fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
          }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh History
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 420px) 1fr', gap: '24px', alignItems: 'flex-start' }}>
        
        {/* Left: Broadcast Composer */}
        <div style={{
          background: '#0D0D0D',
          border: '1px solid rgba(212, 175, 55, 0.25)',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)',
              color: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Send size={18} color="#050505" />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>Compose Notification</h3>
              <span style={{ fontSize: '11px', color: '#A0A0A0' }}>Broadcast message to platform users</span>
            </div>
          </div>

          {sendFeedback.text && (
            <div style={{
              padding: '10px 14px', borderRadius: '8px', fontSize: '12px', marginBottom: '16px',
              background: sendFeedback.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
              color: sendFeedback.type === 'error' ? '#ef4444' : '#22c55e',
              border: `1px solid ${sendFeedback.type === 'error' ? '#ef4444' : '#22c55e'}`
            }}>
              {sendFeedback.text}
            </div>
          )}

          <form onSubmit={handleSend}>
            {/* Target Audience */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                Target Audience *
              </label>
              <select
                value={targetAudience}
                onChange={e => setTargetAudience(e.target.value)}
                style={{
                  width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.3)',
                  borderRadius: '8px', padding: '9px 12px', color: '#FFFFFF', fontSize: '13px', outline: 'none'
                }}
              >
                <option value="all_customers">All Customers (Platform-wide)</option>
                <option value="selected_customers">Selected Customer (By ID)</option>
                <option value="all_merchants">All Merchants (Store Owners)</option>
                <option value="selected_merchants">Selected Merchant (By Shop ID)</option>
                <option value="category_merchants">Category Merchants</option>
              </select>
            </div>

            {/* Target ID if specific */}
            {(targetAudience === 'selected_customers' || targetAudience === 'selected_merchants' || targetAudience === 'category_merchants') && (
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                  {targetAudience === 'category_merchants' ? 'Category Name *' : 'Target User / Shop ID *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={targetAudience === 'category_merchants' ? 'e.g. Restaurants, Cafes & Food' : 'e.g. 1'}
                  value={targetId}
                  onChange={e => setTargetId(e.target.value)}
                  style={{
                    width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.3)',
                    borderRadius: '8px', padding: '9px 12px', color: '#FFFFFF', fontSize: '13px', outline: 'none'
                  }}
                />
              </div>
            )}

            {/* Notification Type */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                Notification Type
              </label>
              <select
                value={notifType}
                onChange={e => setNotifType(e.target.value)}
                style={{
                  width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.3)',
                  borderRadius: '8px', padding: '9px 12px', color: '#FFFFFF', fontSize: '13px', outline: 'none'
                }}
              >
                <option value="announcement">Announcement / Notice</option>
                <option value="offer">Special Offer / Promotion</option>
                <option value="system_update">System Update</option>
                <option value="alert">Important Security Alert</option>
              </select>
            </div>

            {/* Title */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                Notification Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Weekend Discount Festival!"
                value={title}
                onChange={e => setTitle(e.target.value)}
                style={{
                  width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.3)',
                  borderRadius: '8px', padding: '9px 12px', color: '#FFFFFF', fontSize: '13px', outline: 'none'
                }}
              />
            </div>

            {/* Message */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                Notification Message Body *
              </label>
              <textarea
                required
                rows={4}
                placeholder="Write message content delivered to user app notifications..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                style={{
                  width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.3)',
                  borderRadius: '8px', padding: '10px 12px', color: '#FFFFFF', fontSize: '12px', outline: 'none', resize: 'none'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isSending}
              style={{
                width: '100%', padding: '12px', borderRadius: '10px',
                background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)',
                border: 'none', color: '#050505', fontSize: '13px', fontWeight: 900, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}
            >
              <Send size={16} />
              {isSending ? 'Broadcasting...' : 'Broadcast Notification Now'}
            </button>
          </form>
        </div>

        {/* Right: Broadcast History Table */}
        <div style={{
          background: '#0D0D0D',
          border: '1px solid rgba(212, 175, 55, 0.2)',
          borderRadius: '16px',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
              Broadcast History ({notifications.length})
            </h3>
            <span style={{ fontSize: '11px', color: '#A0A0A0' }}>Sent notification logs</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#121212', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', color: '#A0A0A0', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>Title & Content</th>
                  <th style={{ padding: '12px 16px' }}>Audience</th>
                  <th style={{ padding: '12px 16px' }}>Type</th>
                  <th style={{ padding: '12px 16px' }}>Recipients</th>
                  <th style={{ padding: '12px 16px' }}>Dispatched At</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {notifications.length > 0 ? (
                  notifications.map(n => (
                    <tr key={n.id} style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.08)' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#FFFFFF' }}>{n.title}</div>
                        <div style={{ fontSize: '11px', color: '#A0A0A0', marginTop: '2px', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {n.message}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textTransform: 'capitalize', color: '#F2D675', fontSize: '11px', fontWeight: 600 }}>
                        {n.target_audience?.replace(/_/g, ' ')}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '3px 7px', borderRadius: '6px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase',
                          background: n.notification_type === 'alert' ? 'rgba(239, 68, 68, 0.15)' :
                                      n.notification_type === 'offer' ? 'rgba(212, 175, 55, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                          color: n.notification_type === 'alert' ? '#ef4444' :
                                 n.notification_type === 'offer' ? '#F2D675' : '#3b82f6'
                        }}>
                          {n.notification_type}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: '#22c55e' }}>
                        {n.recipient_count || 0} users
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '11px', color: '#888' }}>
                        {new Date(n.created_at).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleViewRecipients(n)}
                          style={{
                            padding: '4px 8px', borderRadius: '6px', background: '#161616',
                            border: '1px solid rgba(212, 175, 55, 0.3)', color: '#F2D675', fontSize: '11px',
                            fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                          }}
                        >
                          <Eye size={12} /> View
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: '#888' }}>
                      {loading ? 'Loading notification history...' : 'No broadcast notifications sent yet'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recipients Modal */}
      {selectedNotif && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#0E0E0E', border: '1px solid #D4AF37', borderRadius: '16px',
            width: '500px', maxWidth: '100%', padding: '24px', boxShadow: '0 16px 40px rgba(0,0,0,0.9)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                  Recipients: {selectedNotif.title}
                </h3>
                <span style={{ fontSize: '11px', color: '#A0A0A0' }}>
                  Delivered users for Notification #{selectedNotif.id}
                </span>
              </div>
              <button onClick={() => setSelectedNotif(null)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {recipientsLoading ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>Loading recipients...</div>
              ) : recipients.length > 0 ? (
                recipients.map(r => (
                  <div key={r.id} style={{ padding: '8px 12px', background: '#141414', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#FFF' }}>{r.full_name || 'Customer'}</div>
                      <div style={{ fontSize: '10px', color: '#888' }}>{r.email}</div>
                    </div>
                    <span style={{ fontSize: '10px', color: r.is_read ? '#22c55e' : '#eab308', fontWeight: 700 }}>
                      {r.is_read ? 'READ' : 'UNREAD'}
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', color: '#888', fontSize: '12px' }}>
                  No recipients found
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
