import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { parseApiResponse, resolveApiErrorMessage, resolveNetworkErrorMessage } from '../../utils/api';
import {
  Crown,
  ShieldCheck,
  Plus,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Users,
  Store,
  X,
  Power,
  RefreshCw,
  Lock
} from 'lucide-react';

export default function AdminMemberships() {
  const { token } = useAuth();
  const { t, locale } = useI18n();
  const [plans, setPlans] = useState([]);
  const [members, setMembers] = useState([]);
  const [activeTab, setActiveTab] = useState('plans'); // plans, members
  const [loading, setLoading] = useState(true);

  const getStatusLabel = (status) => {
    const key = `adminStatusLabel_${String(status || '').toLowerCase()}`;
    const res = t(key);
    return res === key ? status : res;
  };
  const getRoleLabel = (role) => {
    const r = String(role || 'customer').toLowerCase();
    if (r === 'merchant' || r === 'shop') return t('merchantLabel');
    if (r === 'customer') return t('customerLabel');
    return r.toUpperCase();
  };

  // Add/Edit Plan Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    price: 0,
    duration_days: 365,
    target_role: 'customer',
    benefits: ''
  });
  const [modalError, setModalError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchPlans = () => {
    setLoading(true);
    fetch('/api/admin/memberships/plans', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(parseApiResponse)
      .then(parsed => {
        const d = parsed.data;
        if (parsed.ok && d && d.success) setPlans(d.plans || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const fetchMembers = () => {
    setLoading(true);
    fetch('/api/admin/memberships/members?limit=100', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(parseApiResponse)
      .then(parsed => {
        const d = parsed.data;
        if (parsed.ok && d && d.success) setMembers(d.members || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!token) return;
    if (activeTab === 'plans') fetchPlans();
    else fetchMembers();
  }, [token, activeTab]);

  const handleTogglePlan = async (id, currentPrice, isCurrentlyActive) => {
    if (currentPrice > 0 && !isCurrentlyActive) {
      alert(t('paidPlanPolicyErr'));
      return;
    }

    try {
      const res = await fetch(`/api/admin/memberships/plans/${id}/toggle`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = await parseApiResponse(res);
      const data = parsed.data;
      if (parsed.ok && data && data.success) {
        fetchPlans();
      } else {
        alert(resolveApiErrorMessage(parsed, t, 'failedTogglePlanErr'));
      }
    } catch (err) {
      alert(resolveNetworkErrorMessage(err, t, 'failedTogglePlanErr'));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalError('');

    const parsedPrice = parseFloat(formData.price) || 0;
    if (parsedPrice > 0) {
      if (!window.confirm(t('confirmPaidPlanSaveInactive'))) {
        return;
      }
    }

    setSubmitting(true);
    const url = editingPlan ? `/api/admin/memberships/plans/${editingPlan.id}` : '/api/admin/memberships/plans';
    const method = editingPlan ? 'PUT' : 'POST';

    const benefitsArray = formData.benefits
      ? formData.benefits.split(',').map(b => b.trim()).filter(Boolean)
      : [];

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          price: parsedPrice,
          benefits_json: benefitsArray
        })
      });
      const parsed = await parseApiResponse(res);
      const data = parsed.data;
      if (parsed.ok && data && data.success) {
        setIsModalOpen(false);
        fetchPlans();
      } else {
        setModalError(resolveApiErrorMessage(parsed, t, 'failedSavePlanErr'));
      }
    } catch (err) {
      setModalError(resolveNetworkErrorMessage(err, t, 'failedSavePlanErr'));
    } finally {
      setSubmitting(false);
    }
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
        marginBottom: '20px',
        background: '#0D0D0D',
        border: '1px solid rgba(212, 175, 55, 0.2)',
        borderRadius: '16px',
        padding: '16px 20px'
      }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
            {t('adminMembershipsTitle')}
          </h1>
          <p style={{ fontSize: '12px', color: '#A0A0A0', margin: '4px 0 0 0' }}>
            {t('adminMembershipsSub')}
          </p>
        </div>

        {/* Tab switch */}
        <div style={{ display: 'flex', gap: '8px', background: '#141414', padding: '4px', borderRadius: '10px', border: '1px solid rgba(212, 175, 55, 0.2)' }}>
          <button
            type="button"
            onClick={() => setActiveTab('plans')}
            style={{
              background: activeTab === 'plans' ? 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)' : 'transparent',
              color: activeTab === 'plans' ? '#050505' : '#A0A0A0',
              border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <Crown size={15} /> {t('tabMembershipPlansCount', { count: plans.length })}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            style={{
              background: activeTab === 'members' ? 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)' : 'transparent',
              color: activeTab === 'members' ? '#050505' : '#A0A0A0',
              border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <Users size={15} /> {t('tabEnrolledMembersCount', { count: members.length })}
          </button>
        </div>
      </div>

      {/* Free Tier Commercial Notice */}
      <div style={{
        background: 'linear-gradient(135deg, #0F1A12 0%, #16291C 100%)',
        border: '1px solid #22c55e',
        borderRadius: '14px',
        padding: '14px 18px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px'
      }}>
        <div style={{
          width: '38px', height: '38px', borderRadius: '10px', background: '#22c55e',
          color: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
        }}>
          <ShieldCheck size={22} color="#050505" />
        </div>
        <div>
          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#FFFFFF' }}>
            {t('freePlatformBannerTitle')}
          </h4>
          <span style={{ fontSize: '11px', color: '#86efac', lineHeight: 1.4, display: 'block', marginTop: '2px' }}>
            {t('freePlatformBannerDesc')}
          </span>
        </div>
      </div>

      {/* PLANS TAB */}
      {activeTab === 'plans' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>
            {plans.map(p => {
              const benefits = typeof p.benefits_json === 'string'
                ? JSON.parse(p.benefits_json || '[]')
                : (p.benefits_json || []);

              return (
                <div
                  key={p.id}
                  style={{
                    background: '#0E0E0E',
                    border: p.is_active ? '1px solid #D4AF37' : '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '16px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: p.is_active ? '0 8px 30px rgba(212, 175, 55, 0.15)' : 'none'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                          {p.name}
                        </h3>
                        <span style={{ fontSize: '11px', color: '#A0A0A0' }}>
                          {t('targetRoleSlugLine', { role: getRoleLabel(p.target_role), slug: p.slug })}
                        </span>
                      </div>

                      <span style={{
                        padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 800,
                        background: p.is_active ? 'rgba(34, 197, 94, 0.15)' : 'rgba(100, 100, 100, 0.15)',
                        color: p.is_active ? '#22c55e' : '#888',
                        border: `1px solid ${p.is_active ? '#22c55e' : '#555'}`
                      }}>
                        {p.is_active ? t('adminStatusLabel_active') : t('adminStatusLabel_disabled')}
                      </span>
                    </div>

                    <div style={{ margin: '12px 0' }}>
                      <span style={{ fontSize: '28px', fontWeight: 900, color: p.price === 0 ? '#22c55e' : '#D4AF37' }}>
                        {p.price === 0 ? t('adminFreeBadge') : (p.price || 0).toLocaleString(locale)}
                      </span>
                      {p.price > 0 && <span style={{ fontSize: '12px', color: '#888' }}> {t('perDaysLabel', { days: p.duration_days })}</span>}
                    </div>

                    <p style={{ fontSize: '12px', color: '#C0C0C0', margin: '0 0 14px 0', lineHeight: 1.4 }}>
                      {p.description || t('standardPlatformTierFallback')}
                    </p>

                    {benefits.length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#D4AF37', marginBottom: '6px' }}>{t('benefitsUpperLabel')}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {benefits.map((b, idx) => (
                            <div key={idx} style={{ fontSize: '11px', color: '#E0E0E0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <CheckCircle2 size={12} color="#22c55e" />
                              <span>{b}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ paddingTop: '14px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {p.price > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#fca5a5' }}>
                        <Lock size={12} />
                        <span>{t('paidActivationBlocked')}</span>
                      </div>
                    ) : (
                      <div style={{ fontSize: '11px', color: '#22c55e', fontWeight: 700 }}>
                        {t('guaranteedFreePlan')}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleTogglePlan(p.id, p.price, p.is_active)}
                      style={{
                        padding: '6px 12px', borderRadius: '8px',
                        background: p.is_active ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                        border: `1px solid ${p.is_active ? '#ef4444' : '#22c55e'}`,
                        color: p.is_active ? '#ef4444' : '#22c55e',
                        fontSize: '11px', fontWeight: 800, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '4px'
                      }}
                    >
                      <Power size={12} />
                      {p.is_active ? t('adminDeactivateBtn') : t('adminActivateBtn')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MEMBERS TAB */}
      {activeTab === 'members' && (
        <div style={{ background: '#0D0D0D', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
              {t('enrolledMembersHeading')}
            </h3>
            <button type="button" onClick={fetchMembers} style={{ background: '#1A1A1A', border: '1px solid rgba(212, 175, 55, 0.3)', color: '#D4AF37', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
              {t('adminRefreshBtn')}
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#121212', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', color: '#A0A0A0', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>{t('colMember')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colPlanName')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colPlanType')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colRole')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colStartedAt')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {members.length > 0 ? (
                  members.map(m => (
                    <tr key={m.id} style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.08)' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#FFF' }}>{m.full_name || m.shop_name}</div>
                        <div style={{ fontSize: '10px', color: '#888' }}>{m.email}</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#D4AF37' }}>
                        {m.plan_name}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#22c55e', fontWeight: 700 }}>
                        {m.price === 0 ? t('adminFreeBadge') : (m.price || 0).toLocaleString(locale)}
                      </td>
                      <td style={{ padding: '12px 16px', textTransform: 'uppercase', fontSize: '11px', color: '#A0A0A0' }}>
                        {getRoleLabel(m.role)}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '11px', color: '#888' }}>
                        {new Date(m.started_at).toLocaleDateString(locale)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 800,
                          background: m.status === 'active' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(100, 100, 100, 0.15)',
                          color: m.status === 'active' ? '#22c55e' : '#888'
                        }}>
                          {getStatusLabel(m.status)}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: '#888' }}>
                      {loading ? t('loadingMembers') : t('noEnrolledMembersFound')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
