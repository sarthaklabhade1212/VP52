import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { parseApiResponse, resolveApiErrorMessage, resolveNetworkErrorMessage } from '../../utils/api';
import {
  Headphones,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  User,
  Store,
  RefreshCw,
  X,
  MessageSquare,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

export default function AdminComplaints() {
  const { token, user } = useAuth();
  const { t, locale } = useI18n();
  const [complaints, setComplaints] = useState([]);

  const getStatusLabel = (status) => {
    const normalized = String(status || '').toLowerCase();
    const key = `adminStatusLabel_${normalized}`;
    const label = t(key);
    return label === key ? String(status || '').replace(/_/g, ' ').toUpperCase() : label;
  };

  const getPriorityLabel = (priority) => {
    const normalized = String(priority || 'medium').toLowerCase();
    const key = `priority_${normalized}`;
    const label = t(key);
    return label === key ? String(priority || 'medium').toUpperCase() : label;
  };
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Selected Complaint Resolution Modal
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [assignedAdminId, setAssignedAdminId] = useState('');
  const [resolutionText, setResolutionText] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [newStatus, setNewStatus] = useState('resolved');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchComplaints = () => {
    setLoading(true);
    let url = '/api/admin/complaints?limit=100';
    if (statusFilter !== 'all') url += `&status=${statusFilter}`;

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(parseApiResponse)
      .then(parsed => {
        const d = parsed.data;
        if (parsed.ok && d && d.success) setComplaints(d.complaints || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const fetchAdmins = () => {
    fetch('/api/admin/admins', { headers: { Authorization: `Bearer ${token}` } })
      .then(parseApiResponse)
      .then(parsed => {
        const d = parsed.data;
        if (parsed.ok && d && d.success) setAdmins(d.admins || []);
      })
      .catch(console.error);
  };

  useEffect(() => {
    if (!token) return;
    fetchComplaints();
    fetchAdmins();
  }, [token, statusFilter]);

  const handleOpenResolve = (comp) => {
    setSelectedComplaint(comp);
    setAssignedAdminId(comp.assigned_admin_id ? String(comp.assigned_admin_id) : '');
    setResolutionText(comp.resolution || '');
    setInternalNotes(comp.internal_notes || '');
    setNewStatus(comp.status === 'open' ? 'under_review' : comp.status);
  };

  const handleSaveResolution = async (e) => {
    e.preventDefault();
    if (!selectedComplaint) return;
    setIsSubmitting(true);

    try {
      // 1. Update status and resolution
      const res = await fetch(`/api/admin/complaints/${selectedComplaint.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: newStatus,
          resolution: resolutionText.trim(),
          internal_notes: internalNotes.trim()
        })
      });

      // 2. If assigned admin changed
      if (assignedAdminId) {
        await fetch(`/api/admin/complaints/${selectedComplaint.id}/assign`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            assigned_admin_id: parseInt(assignedAdminId)
          })
        });
      }

      const parsed = await parseApiResponse(res);
      const data = parsed.data;
      if (parsed.ok && data && data.success) {
        setSelectedComplaint(null);
        fetchComplaints();
      } else {
        alert(resolveApiErrorMessage(parsed, t, 'failedUpdateComplaintErr'));
      }
    } catch (err) {
      alert(resolveNetworkErrorMessage(err, t, 'failedUpdateComplaintErr'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = complaints.filter(c => {
    const matchesSearch = (c.description || '').toLowerCase().includes(search.toLowerCase()) ||
                          (c.user_name || '').toLowerCase().includes(search.toLowerCase()) ||
                          (c.ticket_id || '').toLowerCase().includes(search.toLowerCase());
    const matchesPriority = priorityFilter === 'all' || c.priority === priorityFilter;
    return matchesSearch && matchesPriority;
  });

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
            {t('adminComplaintsTitle')}
          </h1>
          <p style={{ fontSize: '12px', color: '#A0A0A0', margin: '4px 0 0 0' }}>
            {t('adminComplaintsSub')}
          </p>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{
              background: '#141414', border: '1px solid rgba(212, 175, 55, 0.25)',
              color: '#FFFFFF', borderRadius: '10px', padding: '8px 12px', fontSize: '12px', outline: 'none'
            }}
          >
            <option value="all">{t('adminStatusAll')}</option>
            <option value="open">{t('ticketFilter_open')}</option>
            <option value="under_review">{t('ticketFilter_under_review')}</option>
            <option value="resolved">{t('ticketFilter_resolved')}</option>
            <option value="closed">{t('ticketFilter_closed')}</option>
          </select>

          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            style={{
              background: '#141414', border: '1px solid rgba(212, 175, 55, 0.25)',
              color: '#FFFFFF', borderRadius: '10px', padding: '8px 12px', fontSize: '12px', outline: 'none'
            }}
          >
            <option value="all">{t('allPrioritiesOption')}</option>
            <option value="urgent">{t('priority_urgent')}</option>
            <option value="high">{t('priority_high')}</option>
            <option value="medium">{t('priority_medium')}</option>
            <option value="low">{t('priority_low')}</option>
          </select>

          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={15} color="#D4AF37" style={{ position: 'absolute', left: '10px', top: '10px' }} />
            <input
              type="text"
              placeholder={t('searchTicketUserPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.25)',
                color: '#FFFFFF', borderRadius: '10px', padding: '8px 10px 8px 32px', fontSize: '12px', outline: 'none'
              }}
            />
          </div>

          <button
            type="button"
            onClick={fetchComplaints}
            style={{
              background: '#181818', border: '1px solid rgba(212, 175, 55, 0.3)',
              color: '#D4AF37', padding: '8px 12px', borderRadius: '10px',
              fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> {t('adminRefreshBtn')}
          </button>
        </div>
      </div>

      {/* Complaints Table */}
      <div style={{
        background: '#0D0D0D',
        borderRadius: '16px',
        border: '1px solid rgba(212, 175, 55, 0.2)',
        overflow: 'hidden'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#121212', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', color: '#A0A0A0', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px' }}>{t('colTicketId')}</th>
                <th style={{ padding: '12px 16px' }}>{t('colComplainant')}</th>
                <th style={{ padding: '12px 16px' }}>{t('colCategory')}</th>
                <th style={{ padding: '12px 16px' }}>{t('colDescription')}</th>
                <th style={{ padding: '12px 16px' }}>{t('colPriority')}</th>
                <th style={{ padding: '12px 16px' }}>{t('colAssignedAdmin')}</th>
                <th style={{ padding: '12px 16px' }}>{t('colStatus')}</th>
                <th style={{ padding: '12px 16px' }}>{t('colCreatedDate')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>{t('colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.08)' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 800, color: '#D4AF37' }}>
                      {c.ticket_id || `TCK-${c.id}`}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#FFF' }}>{c.user_name || t('userFallbackLabel', { id: c.user_id })}</div>
                      <div style={{ fontSize: '10px', color: '#888' }}>{c.user_email}</div>
                    </td>
                    <td style={{ padding: '12px 16px', textTransform: 'capitalize', color: '#F2D675', fontSize: '11px', fontWeight: 600 }}>
                      {c.category?.replace(/_/g, ' ')}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#E0E0E0', maxWidth: '280px' }}>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.description}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase',
                        background: c.priority === 'urgent' ? 'rgba(239, 68, 68, 0.2)' :
                                    c.priority === 'high' ? 'rgba(249, 115, 22, 0.2)' : 'rgba(100, 100, 100, 0.15)',
                        color: c.priority === 'urgent' ? '#ef4444' :
                               c.priority === 'high' ? '#f97316' : '#A0A0A0'
                      }}>
                        {getPriorityLabel(c.priority || 'medium')}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '11px', color: c.assigned_admin_name ? '#D4AF37' : '#666' }}>
                      {c.assigned_admin_name || t('unassignedLabel')}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase',
                        background: c.status === 'resolved' ? 'rgba(34, 197, 94, 0.15)' :
                                    c.status === 'under_review' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: c.status === 'resolved' ? '#22c55e' :
                               c.status === 'under_review' ? '#eab308' : '#ef4444'
                      }}>
                        {getStatusLabel(c.status)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '11px', color: '#888' }}>
                      {new Date(c.created_at).toLocaleDateString(locale)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenResolve(c)}
                        style={{
                          padding: '5px 10px', borderRadius: '6px',
                          background: 'rgba(212, 175, 55, 0.15)', border: '1px solid #D4AF37',
                          color: '#F2D675', fontSize: '11px', fontWeight: 700, cursor: 'pointer'
                        }}
                      >
                        {t('manageTicketBtn')}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} style={{ padding: '36px', textAlign: 'center', color: '#888' }}>
                    {loading ? t('loadingTickets') : t('noComplaintsFound')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ticket Investigation & Resolution Modal */}
      {selectedComplaint && (
        <div role="dialog" aria-modal="true" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#0E0E0E', border: '1px solid #D4AF37', borderRadius: '16px',
            width: '560px', maxWidth: '100%', padding: '24px', boxShadow: '0 16px 40px rgba(0,0,0,0.9)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                  {t('manageTicketTitle', { id: selectedComplaint.ticket_id || `TCK-${selectedComplaint.id}` })}
                </h3>
                <span style={{ fontSize: '11px', color: '#D4AF37' }}>
                  {t('categoryPriorityLine', { category: selectedComplaint.category, priority: getPriorityLabel(selectedComplaint.priority) })}
                </span>
              </div>
              <button type="button" aria-label={t('closeModalAria')} onClick={() => setSelectedComplaint(null)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {/* Description box */}
            <div style={{ padding: '12px', background: '#141414', borderRadius: '10px', marginBottom: '16px', fontSize: '12px' }}>
              <div style={{ color: '#888', marginBottom: '4px' }}>{t('complainantColon')} <strong>{selectedComplaint.user_name} ({selectedComplaint.user_email})</strong></div>
              <div style={{ color: '#FFF', lineHeight: 1.4, marginTop: '6px' }}>
                {selectedComplaint.description}
              </div>
            </div>

            <form onSubmit={handleSaveResolution}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                    {t('colStatus')}
                  </label>
                  <select
                    value={newStatus}
                    onChange={e => setNewStatus(e.target.value)}
                    style={{
                      width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.3)',
                      borderRadius: '8px', padding: '8px 10px', color: '#FFFFFF', fontSize: '12px', outline: 'none'
                    }}
                  >
                    <option value="open">{getStatusLabel('open')}</option>
                    <option value="under_review">{t('ticketFilter_under_review')}</option>
                    <option value="resolved">{t('ticketFilter_resolved')}</option>
                    <option value="closed">{t('ticketFilter_closed')}</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                    {t('assignAdminLabel')}
                  </label>
                  <select
                    value={assignedAdminId}
                    onChange={e => setAssignedAdminId(e.target.value)}
                    style={{
                      width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.3)',
                      borderRadius: '8px', padding: '8px 10px', color: '#FFFFFF', fontSize: '12px', outline: 'none'
                    }}
                  >
                    <option value="">{t('unassignedOption')}</option>
                    {admins.map(a => (
                      <option key={a.id} value={a.id}>{a.full_name} ({a.email})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                  {t('resolutionSummaryLabel')}
                </label>
                <textarea
                  rows={2}
                  placeholder={t('resolutionSummaryPlaceholder')}
                  value={resolutionText}
                  onChange={e => setResolutionText(e.target.value)}
                  style={{
                    width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.3)',
                    borderRadius: '8px', padding: '8px 10px', color: '#FFFFFF', fontSize: '12px', outline: 'none', resize: 'none'
                  }}
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                  {t('internalNotesLabel')}
                </label>
                <textarea
                  rows={2}
                  placeholder={t('internalNotesPlaceholder')}
                  value={internalNotes}
                  onChange={e => setInternalNotes(e.target.value)}
                  style={{
                    width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.3)',
                    borderRadius: '8px', padding: '8px 10px', color: '#FFFFFF', fontSize: '12px', outline: 'none', resize: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setSelectedComplaint(null)}
                  style={{ padding: '8px 14px', borderRadius: '8px', background: '#1A1A1A', border: '1px solid #333', color: '#888', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  {t('cancelBtn')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '8px 18px', borderRadius: '8px',
                    background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)',
                    border: 'none', color: '#050505', fontSize: '12px', fontWeight: 900, cursor: 'pointer'
                  }}
                >
                  {isSubmitting ? t('adminSavingProgress') : t('saveResolutionBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
