import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import {
  Tag,
  Percent,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Store,
  X,
  Search,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Power
} from 'lucide-react';

export default function AdminOffers() {
  const { token } = useAuth();
  const { t, locale, translateCategory } = useI18n();
  const [offers, setOffers] = useState([]);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const getStatusLabel = (status) => {
    const key = `adminStatusLabel_${String(status || '').toLowerCase()}`;
    const res = t(key);
    return res === key ? status : res;
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState(null);
  const [modalError, setModalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    shop_id: '',
    title: '',
    discount_percent: 10,
    max_discount_inr: 100,
    valid_until: '2026-12-31',
    usage_limit: 100,
    status: 'active'
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [offRes, shopRes] = await Promise.all([
        fetch('/api/admin/offers', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/shops', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const offData = await offRes.json();
      const shopData = await shopRes.json();
      if (offData.success) setOffers(offData.offers || []);
      if (shopData.success) {
        setShops(shopData.shops || []);
        if (shopData.shops.length > 0 && !formData.shop_id) {
          setFormData(prev => ({ ...prev, shop_id: shopData.shops[0].id }));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [token]);

  const handleOpenAdd = () => {
    setEditingOffer(null);
    setFormData({
      shop_id: shops.length > 0 ? shops[0].id : '',
      title: '',
      discount_percent: 10,
      max_discount_inr: 100,
      valid_until: '2026-12-31',
      usage_limit: 100,
      status: 'active'
    });
    setModalError('');
    setIsModalOpen(true);
  };

  const handleToggle = async (id) => {
    try {
      const res = await fetch(`/api/admin/offers/${id}/toggle`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('confirmDeleteOffer'))) return;
    try {
      const res = await fetch(`/api/admin/offers/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setModalError('');

    const url = editingOffer ? `/api/admin/offers/${editingOffer.id}` : '/api/admin/offers';
    const method = editingOffer ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsModalOpen(false);
        fetchData();
      } else {
        setModalError(data.error || t('failedSaveOfferErr'));
      }
    } catch (err) {
      setModalError(err.message || t('networkErrorGeneric'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = offers.filter(o => {
    const matchesSearch = (o.title || '').toLowerCase().includes(search.toLowerCase()) ||
                          (o.shop_name || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
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
            {t('adminOffersTitle')}
          </h1>
          <p style={{ fontSize: '12px', color: '#A0A0A0', margin: '4px 0 0 0' }}>
            {t('adminOffersSub')}
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
            <option value="all">{t('allOffersOption')}</option>
            <option value="active">{t('activeOffersOption')}</option>
            <option value="inactive">{t('inactiveOffersOption')}</option>
          </select>

          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={15} color="#D4AF37" style={{ position: 'absolute', left: '10px', top: '10px' }} />
            <input
              type="text"
              placeholder={t('searchTitleShopPlaceholder')}
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
            onClick={handleOpenAdd}
            style={{
              background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)',
              border: 'none', color: '#050505', padding: '8px 16px', borderRadius: '10px',
              fontSize: '12px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <Plus size={16} /> {t('createOfferBtn')}
          </button>
        </div>
      </div>

      {/* Offers Table */}
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
                <th style={{ padding: '14px 18px' }}>{t('colPartnerShop')}</th>
                <th style={{ padding: '14px 18px' }}>{t('colOfferTitle')}</th>
                <th style={{ padding: '14px 18px' }}>{t('colDiscountPercent')}</th>
                <th style={{ padding: '14px 18px' }}>{t('colMaxCap')}</th>
                <th style={{ padding: '14px 18px' }}>{t('colValidUntil')}</th>
                <th style={{ padding: '14px 18px' }}>{t('colStatus')}</th>
                <th style={{ padding: '14px 18px', textAlign: 'right' }}>{t('colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map(o => (
                  <tr key={o.id} style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.08)' }}>
                    <td style={{ padding: '14px 18px', fontWeight: 700, color: '#FFFFFF' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Store size={15} color="#D4AF37" />
                        <span>{o.shop_name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 18px', color: '#E0E0E0' }}>{o.title}</td>
                    <td style={{ padding: '14px 18px', fontWeight: 900, color: '#F2D675', fontSize: '14px' }}>
                      {t('pctOffLabel', { pct: o.discount_percent })}
                    </td>
                    <td style={{ padding: '14px 18px', fontWeight: 700, color: '#D4AF37' }}>
                      {(o.max_discount_inr || 0).toLocaleString(locale)}
                    </td>
                    <td style={{ padding: '14px 18px', color: '#A0A0A0', fontSize: '12px' }}>
                      {new Date(o.valid_until).toLocaleDateString(locale)}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span style={{
                        padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 800,
                        background: o.status === 'active' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(100, 100, 100, 0.15)',
                        color: o.status === 'active' ? '#22c55e' : '#888',
                        border: `1px solid ${o.status === 'active' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(100, 100, 100, 0.3)'}`
                      }}>
                        {getStatusLabel(o.status)}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => handleToggle(o.id)}
                          title={t('titleToggleActiveStatus')}
                          style={{
                            padding: '6px 10px', borderRadius: '8px', background: '#161616',
                            border: '1px solid rgba(212, 175, 55, 0.3)', color: o.status === 'active' ? '#eab308' : '#22c55e',
                            fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                          }}
                        >
                          <Power size={12} /> {o.status === 'active' ? t('adminDeactivateBtn') : t('adminActivateBtn')}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(o.id)}
                          title={t('titleDeleteOffer')}
                          style={{
                            padding: '6px 10px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid #ef4444', color: '#ef4444', fontSize: '11px',
                            fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                          }}
                        >
                          <Trash2 size={12} /> {t('adminDeleteBtn')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: '#888' }}>
                    {loading ? t('loadingOffers') : t('noOffersFound')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Offer Modal */}
      {isModalOpen && (
        <div role="dialog" aria-modal="true" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#0E0E0E', border: '1px solid #D4AF37', borderRadius: '16px',
            width: '480px', maxWidth: '100%', padding: '24px', boxShadow: '0 16px 40px rgba(0,0,0,0.9)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                {t('createPartnerOfferTitle')}
              </h3>
              <button type="button" aria-label={t('closeModalAria')} onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {modalError && (
              <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', color: '#ef4444', fontSize: '12px', marginBottom: '14px' }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                  {t('selectPartnerShopLabel')}
                </label>
                <select
                  required
                  value={formData.shop_id}
                  onChange={e => setFormData({ ...formData, shop_id: e.target.value })}
                  style={{
                    width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.3)',
                    borderRadius: '8px', padding: '8px 12px', color: '#FFFFFF', fontSize: '13px', outline: 'none'
                  }}
                >
                  <option value="">{t('chooseShopOption')}</option>
                  {shops.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({translateCategory(s.category) || s.category})</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                  {t('offerTitleLabel')}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t('offerTitlePlaceholder')}
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  style={{
                    width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.3)',
                    borderRadius: '8px', padding: '8px 12px', color: '#FFFFFF', fontSize: '13px', outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                    {t('discountPctLabel')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={formData.discount_percent}
                    onChange={e => setFormData({ ...formData, discount_percent: parseInt(e.target.value) || 0 })}
                    style={{
                      width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.3)',
                      borderRadius: '8px', padding: '8px 12px', color: '#F2D675', fontWeight: 800, fontSize: '14px', outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                    {t('maxDiscountRequiredLabel')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.max_discount_inr}
                    onChange={e => setFormData({ ...formData, max_discount_inr: parseInt(e.target.value) || 0 })}
                    style={{
                      width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.3)',
                      borderRadius: '8px', padding: '8px 12px', color: '#FFFFFF', fontSize: '14px', outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                  {t('validUntilRequiredLabel')}
                </label>
                <input
                  type="date"
                  required
                  value={formData.valid_until}
                  onChange={e => setFormData({ ...formData, valid_until: e.target.value })}
                  style={{
                    width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.3)',
                    borderRadius: '8px', padding: '8px 12px', color: '#FFFFFF', fontSize: '13px', outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
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
                  {isSubmitting ? t('publishingProgress') : t('publishOfferBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
