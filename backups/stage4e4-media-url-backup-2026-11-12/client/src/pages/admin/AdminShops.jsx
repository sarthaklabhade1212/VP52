import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { CATEGORIES } from '../../config/categories';
import MerchantMap from '../../components/MerchantMap';
import { getCurrentLocation } from '../../utils/location';
import { Store, Plus, Edit2, Trash2, MapPin, Phone, CheckCircle2, X, Key, ShieldAlert, Copy, RefreshCw, UserCheck, LocateFixed, Map as MapIcon, AlertTriangle, ShieldCheck, XCircle, QrCode, Printer } from 'lucide-react';

function validCoord(lat, lng) {
  if (lat === null || lat === undefined || lat === '' || lng === null || lng === undefined || lng === '') return false;
  const la = Number(lat);
  const ln = Number(lng);
  return Number.isFinite(la) && la >= -90 && la <= 90 && Number.isFinite(ln) && ln >= -180 && ln <= 180;
}

export default function AdminShops() {
  const { token } = useAuth();
  const { t, translateCategory, translateSubcategory } = useI18n();
  const [shops, setShops] = useState([]);

  const getStatusLabel = (status) => {
    const normalized = String(status || '').toLowerCase();
    const key = `adminStatusLabel_${normalized}`;
    const label = t(key);
    return label === key ? String(status || '').replace(/_/g, ' ').toUpperCase() : label;
  };
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShop, setEditingShop] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [createdCredentials, setCreatedCredentials] = useState(null);

  const [locConfirmed, setLocConfirmed] = useState(false);
  const [candidateLat, setCandidateLat] = useState(null);
  const [candidateLng, setCandidateLng] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [locBusy, setLocBusy] = useState(false);
  const [locErr, setLocErr] = useState(null);
  const [mapCenter, setMapCenter] = useState({ lat: 18.5204, lng: 73.8567 });
  const [mapEpoch, setMapEpoch] = useState(0);

  const [formData, setFormData] = useState({
    name: '',
    owner_name: '',
    category: CATEGORIES[0].name,
    subcategory: CATEGORIES[0].subcategories[0],
    description: '',
    address: '',
    area_locality: '',
    city: 'Pune',
    pincode: '',
    phone: '',
    whatsapp_number: '',
    email: '',
    image_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80',
    logo_url: '',
    cover_photo_url: '',
    opening_time: '09:00',
    closing_time: '21:00',
    status: 'active',
    latitude: null,
    longitude: null
  });

  const fetchShops = () => {
    fetch('/api/admin/shops', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => { if (data.success) setShops(data.shops || []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchShops(); }, [token]);

  const resetLocationPicker = (seedLat = null, seedLng = null) => {
    const hasSeed = validCoord(seedLat, seedLng);
    setLocErr(null);
    setLocBusy(false);
    setShowMap(false);
    if (hasSeed) {
      const la = Number(seedLat);
      const ln = Number(seedLng);
      setCandidateLat(la);
      setCandidateLng(ln);
      setLocConfirmed(true);
      setMapCenter({ lat: la, lng: ln });
    } else {
      setCandidateLat(null);
      setCandidateLng(null);
      setLocConfirmed(false);
      setMapCenter({ lat: 18.5204, lng: 73.8567 });
    }
    setMapEpoch(e => e + 1);
  };

  const handleOpenAdd = () => {
    setEditingShop(null);
    setFormData({
      name: '',
      owner_name: '',
      category: CATEGORIES[0].name,
      subcategory: CATEGORIES[0].subcategories[0],
      description: '',
      address: '',
      area_locality: '',
      city: 'Pune',
      pincode: '',
      phone: '',
      whatsapp_number: '',
      email: '',
      image_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80',
      logo_url: '',
      cover_photo_url: '',
      opening_time: '09:00',
      closing_time: '21:00',
      status: 'active',
      latitude: null,
      longitude: null
    });
    resetLocationPicker();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (shop) => {
    setEditingShop(shop);
    const seedLat = shop.latitude;
    const seedLng = shop.longitude;
    const hasSeed = validCoord(seedLat, seedLng);
    const catName = shop.category || CATEGORIES[0].name;
    const catObj = CATEGORIES.find(c => c.name === catName) || CATEGORIES[0];
    setFormData({
      name: shop.name || '',
      owner_name: shop.owner_name || '',
      category: catName,
      subcategory: shop.subcategory || catObj.subcategories[0] || '',
      description: shop.description || '',
      address: shop.address || '',
      area_locality: shop.area_locality || '',
      city: shop.city || 'Pune',
      pincode: shop.pincode || '',
      phone: shop.phone || '',
      whatsapp_number: shop.whatsapp_number || '',
      email: shop.email || '',
      image_url: shop.image_url || '',
      logo_url: shop.logo_url || '',
      cover_photo_url: shop.cover_photo_url || '',
      opening_time: shop.opening_time || '09:00',
      closing_time: shop.closing_time || '21:00',
      status: shop.status || 'active',
      latitude: hasSeed ? Number(seedLat) : null,
      longitude: hasSeed ? Number(seedLng) : null
    });
    resetLocationPicker(seedLat, seedLng);
    setIsModalOpen(true);
  };

  const handleApprove = async (shopId) => {
    try {
      const res = await fetch(`/api/admin/shops/${shopId}/approve`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) fetchShops();
      else alert(data.error || t('failedApproveErr'));
    } catch (e) {
      alert(e.message);
    }
  };

  const handleReject = async (shopId) => {
    const reason = prompt(t('promptRejectMerchantReason'));
    if (!reason) return;
    try {
      const res = await fetch(`/api/admin/shops/${shopId}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (data.success) fetchShops();
      else alert(data.error || t('failedRejectErr'));
    } catch (e) {
      alert(e.message);
    }
  };

  const handleSuspend = async (shopId) => {
    if (!window.confirm(t('confirmSuspendShop'))) return;
    try {
      const res = await fetch(`/api/admin/shops/${shopId}/suspend`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) fetchShops();
      else alert(data.error || t('failedSuspendErr'));
    } catch (e) {
      alert(e.message);
    }
  };

  const handleUseCurrentLocation = async () => {
    setLocErr(null);
    setLocBusy(true);
    try {
      const { lat, lng } = await getCurrentLocation();
      if (!validCoord(lat, lng)) throw new Error('invalid');
      setCandidateLat(lat);
      setCandidateLng(lng);
      setLocConfirmed(false);
      setMapCenter({ lat, lng });
      setMapEpoch(e => e + 1);
      setShowMap(true);
    } catch (err) {
      setLocErr(t('locationErrorAdmin'));
    } finally {
      setLocBusy(false);
    }
  };

  const handlePickOnMap = () => {
    setLocErr(null);
    setShowMap(true);
  };

  const handlePinDropped = (lat, lng) => {
    setCandidateLat(lat);
    setCandidateLng(lng);
    setLocConfirmed(false);
  };

  const handleConfirmLocation = () => {
    if (!validCoord(candidateLat, candidateLng)) return;
    setFormData(fd => ({ ...fd, latitude: Number(candidateLat), longitude: Number(candidateLng) }));
    setLocConfirmed(true);
  };

  const handleChangeLocation = () => {
    setLocConfirmed(false);
    setShowMap(true);
  };

  const handleStatusChange = async (shopId, newStatus) => {
    try {
      const res = await fetch(`/api/admin/shops/${shopId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        fetchShops();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetCredentials = async (shopId) => {
    if (!window.confirm(t('confirmResetCreds'))) return;
    try {
      const res = await fetch(`/api/admin/shops/${shopId}/reset-credentials`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.credentials) {
        setCreatedCredentials({
          shopCode: data.credentials.shopCode,
          shopName: data.credentials.shopName,
          ownerName: data.credentials.ownerName || t('merchantLabel'),
          mobileNumber: data.credentials.mobileNumber,
          email: data.credentials.email,
          accountStatus: t('activePwResetStatus'),
          temporaryPassword: data.credentials.newTemporaryPassword
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('confirmDeleteShop'))) return;
    try {
      await fetch(`/api/admin/shops/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchShops();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleQrStatus = async (shopId, newStatus) => {
    const localizedStatus = getStatusLabel(newStatus);
    const reason = prompt(t('promptQrStatusReason', { status: localizedStatus }), t('defaultQrStatusReason', { status: localizedStatus }));
    if (!reason) return;

    try {
      const res = await fetch(`/api/admin/merchants/${shopId}/qr/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus, reason })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchShops();
      } else {
        alert(data.error || t('failedUpdateQrStatus'));
      }
    } catch (e) {
      alert(e.message);
    }
  };

  const handleRegenerateQr = async (shopId) => {
    const reason = prompt(t('promptRegenQrReason'), t('defaultRegenQrReason'));
    if (!reason) return;

    try {
      const res = await fetch(`/api/admin/merchants/${shopId}/qr/regenerate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(t('newPermanentQrAlert', { code: data.permanent_qr_code }));
        fetchShops();
      } else {
        alert(data.error || t('failedRegenQr'));
      }
    } catch (e) {
      alert(e.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!locConfirmed || !validCoord(formData.latitude, formData.longitude)) {
      setLocErr(t('shopLocationRequiredHint'));
      setShowMap(true);
      return;
    }

    const url = editingShop ? `/api/admin/shops/${editingShop.id}` : '/api/admin/shops';
    const method = editingShop ? 'PUT' : 'POST';

    setSubmitting(true);
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          latitude: Number(formData.latitude),
          longitude: Number(formData.longitude)
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setIsModalOpen(false);
        fetchShops();

        if (!editingShop && data.credentials) {
          setCreatedCredentials(data.credentials);
        }
      } else {
        setLocErr(data.error || t('couldNotSaveShopErr'));
      }
    } catch (err) {
      console.error(err);
      setLocErr(t('netErrorTryAgain'));
    } finally {
      setSubmitting(false);
    }
  };

  const canSave = locConfirmed && validCoord(formData.latitude, formData.longitude) && !submitting;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', background: '#050505' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '24px', color: '#FFFFFF', fontWeight: 800 }}>{t('adminShopsTitle')}</h2>
          <p style={{ fontSize: '14px', color: '#B8B8B8' }}>{t('adminShopsSub')}</p>
        </div>

        <button type="button" onClick={handleOpenAdd} className="btn-primary" style={{ padding: '12px 20px', borderRadius: '12px' }}>
          <Plus size={18} color="#050505" /> {t('addShopCredsBtn')}
        </button>
      </div>

      {/* Shops Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '20px' }}>
        {shops.map((shop) => {
          const shopHasLocation = validCoord(shop.latitude, shop.longitude);
          return (
          <div key={shop.id} style={{ background: '#111111', borderRadius: '20px', border: '1px solid rgba(212, 175, 55, 0.15)', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.35)' }}>
            <div style={{ height: '120px', position: 'relative' }}>
              <img src={shop.image_url} alt={shop.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '6px' }}>
                <span className={`badge ${shop.status === 'active' ? 'badge-active' : shop.status === 'suspended' ? 'badge-expired' : 'badge-used'}`}>
                  {getStatusLabel(shop.status)}
                </span>
              </div>
            </div>

            <div style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#D4AF37', textTransform: 'uppercase' }}>{translateCategory(shop.category)}</span>
                  {shop.subcategory && (
                    <span style={{ fontSize: '10px', color: '#B8B8B8', background: '#1A1A1A', padding: '2px 6px', borderRadius: '4px' }}>
                      {translateSubcategory(shop.subcategory)}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#F2D675' }}>{shop.shop_code || `SHOP-00${shop.id}`}</span>
              </div>

              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#FFFFFF', margin: '2px 0 2px 0' }}>{shop.name}</h3>
              <span style={{ fontSize: '12px', color: '#B8B8B8', fontWeight: 600, display: 'block', marginBottom: '12px' }}>
                {t('ownerPrefixLabel')} {shop.owner_name || t('storeMerchantFallback')}
              </span>

              <div style={{ fontSize: '12px', color: '#B8B8B8', display: 'flex', flexDirection: 'column', gap: '4px', background: '#151515', padding: '10px', borderRadius: '10px', marginBottom: '10px', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
                <div>📱 <strong>{t('loginMobileBold')}</strong> {shop.phone || t('naLabel')}</div>
                {shop.whatsapp_number && <div>💬 <strong>{t('whatsappBold')}</strong> {shop.whatsapp_number}</div>}
                <div>📧 <strong>{t('emailBoldLabel')}</strong> {shop.email || t('naLabel')}</div>
                <div>📍 <strong>{t('addressBoldLabel')}</strong> {shop.area_locality ? `${shop.area_locality}, ` : ''}{shop.address}</div>
                {shop.opening_time && shop.closing_time && (
                  <div>🕒 <strong>{t('hoursBold')}</strong> {shop.opening_time} - {shop.closing_time}</div>
                )}
              </div>

              {shopHasLocation ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#151515', border: '1px solid rgba(212, 175, 55, 0.3)', color: '#F2D675', padding: '8px 10px', borderRadius: '10px', marginBottom: '16px', fontSize: '11.5px', fontWeight: 700 }}>
                  <CheckCircle2 size={14} color="#F2D675" />
                  <span>{t('locVerifiedCard')} · {Number(shop.latitude).toFixed(5)}, {Number(shop.longitude).toFixed(5)}</span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#151515', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '8px 10px', borderRadius: '10px', marginBottom: '16px', fontSize: '11.5px', fontWeight: 700 }}>
                  <AlertTriangle size={14} color="#fca5a5" />
                  <span>{t('locMissingCard')}</span>
                </div>
              )}

              {/* Permanent Merchant QR Code & Status */}
              <div style={{
                background: '#151515',
                border: '1px solid rgba(212, 175, 55, 0.25)',
                borderRadius: '12px',
                padding: '10px 12px',
                marginBottom: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#B8B8B8', textTransform: 'uppercase' }}>
                    {t('permanentQrCodeUpper')}
                  </span>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    textTransform: 'uppercase',
                    background: (shop.qr_status === 'active' || !shop.qr_status) ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: (shop.qr_status === 'active' || !shop.qr_status) ? '#10B981' : '#EF4444'
                  }}>
                    {t('qrStatusBadge', { status: getStatusLabel(shop.qr_status || 'active') })}
                  </span>
                </div>
                <code style={{ fontSize: '11px', color: '#F2D675', fontFamily: 'monospace', display: 'block', wordBreak: 'break-all' }}>
                  {shop.permanent_qr_code || 'VP52-MCH-PENDING'}
                </code>

                <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                  {(shop.qr_status === 'active' || !shop.qr_status) ? (
                    <button
                      type="button"
                      onClick={() => handleToggleQrStatus(shop.id, 'suspended')}
                      style={{
                        flex: 1, padding: '5px', fontSize: '11px', fontWeight: 700, borderRadius: '6px',
                        background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.25)', cursor: 'pointer'
                      }}
                    >
                      {t('suspendQrBtn')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleToggleQrStatus(shop.id, 'active')}
                      style={{
                        flex: 1, padding: '5px', fontSize: '11px', fontWeight: 700, borderRadius: '6px',
                        background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.3)', cursor: 'pointer'
                      }}
                    >
                      {t('activateQrBtn')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRegenerateQr(shop.id)}
                    style={{
                      flex: 1, padding: '5px', fontSize: '11px', fontWeight: 700, borderRadius: '6px',
                      background: '#1A1A1A', color: '#D4AF37', border: '1px solid rgba(212, 175, 55, 0.3)', cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '3px'
                    }}
                  >
                    <RefreshCw size={11} /> {t('regenerateBtn')}
                  </button>
                </div>
              </div>

              {/* Status Action Buttons */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                {(shop.status === 'pending_approval' || shop.status === 'pending') && (
                  <>
                    <button type="button" onClick={() => handleApprove(shop.id)} style={{ flex: 1, padding: '7px', background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', fontSize: '11px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <CheckCircle2 size={13} /> {t('adminApproveBtn')}
                    </button>
                    <button type="button" onClick={() => handleReject(shop.id)} style={{ flex: 1, padding: '7px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', fontSize: '11px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <XCircle size={13} /> {t('adminRejectBtn')}
                    </button>
                  </>
                )}
                {shop.status === 'active' && (
                  <button type="button" onClick={() => handleSuspend(shop.id)} style={{ flex: 1, padding: '6px', background: '#151515', color: '#B8B8B8', border: '1px solid rgba(212, 175, 55, 0.15)', borderRadius: '8px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>
                    {t('suspendStoreBtn')}
                  </button>
                )}
                {shop.status === 'suspended' && (
                  <button type="button" onClick={() => handleApprove(shop.id)} style={{ flex: 1, padding: '6px', background: '#151515', color: '#F2D675', border: '1px solid rgba(212, 175, 55, 0.3)', borderRadius: '8px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>
                    {t('reActivateBtn')}
                  </button>
                )}
              </div>

              {/* Edit / Reset Password / Delete */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => handleOpenEdit(shop)} className="btn-secondary" style={{ flex: 1, padding: '8px', fontSize: '12px' }}>
                  <Edit2 size={14} color="#D4AF37" /> {t('adminEditBtn')}
                </button>
                <button type="button" onClick={() => handleResetCredentials(shop.id)} className="btn-secondary" style={{ padding: '8px', fontSize: '12px' }}>
                  <Key size={14} color="#D4AF37" /> {t('resetPassBtn')}
                </button>
                <button type="button" aria-label={t('adminDeleteBtn')} onClick={() => handleDelete(shop.id)} style={{ border: '1px solid rgba(239, 68, 68, 0.3)', background: '#151515', color: '#ef4444', padding: '8px 12px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}>
                  <Trash2 size={14} color="#ef4444" />
                </button>
              </div>
            </div>
          </div>
          );
        })}
      </div>

      {/* CONFIRMATION MODAL: SHOWS CREATED MERCHANT CREDENTIALS ONCE */}
      {createdCredentials && (
        <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#111111', borderRadius: '24px', maxWidth: '480px', width: '100%', padding: '28px', border: '1px solid rgba(212, 175, 55, 0.3)' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#151515', border: '1px solid rgba(212, 175, 55, 0.3)', color: '#F2D675', padding: '6px 14px', borderRadius: '99px', fontWeight: 800, fontSize: '12px', marginBottom: '16px' }}>
              <CheckCircle2 size={16} color="#F2D675" /> {t('merchantCredsCreatedBadge')}
            </div>

            <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#FFFFFF', marginBottom: '4px' }}>
              {createdCredentials.shopName}
            </h3>
            <p style={{ fontSize: '13px', color: '#B8B8B8', marginBottom: '20px' }}>
              {t('ownerPrefixLabel')} <strong style={{ color: '#FFFFFF' }}>{createdCredentials.ownerName}</strong> • {t('shopIdColon')} <strong style={{ color: '#F2D675' }}>{createdCredentials.shopCode}</strong>
            </p>

            <div style={{ background: '#151515', padding: '16px', borderRadius: '16px', border: '1px solid rgba(212, 175, 55, 0.15)', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block' }}>{t('primaryLoginMobileUpper')}</span>
                <strong style={{ color: '#FFFFFF', fontSize: '16px' }}>📱 {createdCredentials.mobileNumber}</strong>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block' }}>{t('emailAddressUpper')}</span>
                <strong style={{ color: '#FFFFFF' }}>✉️ {createdCredentials.email}</strong>
              </div>

              {validCoord(createdCredentials.latitude, createdCredentials.longitude) && (
                <div>
                  <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block' }}>{t('confirmedShopLocUpper')}</span>
                  <strong style={{ color: '#FFFFFF' }}>📍 {Number(createdCredentials.latitude).toFixed(6)}, {Number(createdCredentials.longitude).toFixed(6)}</strong>
                </div>
              )}

              <div>
                <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block' }}>{t('tempPasswordOnceUpper')}</span>
                <div style={{ background: '#111111', border: '1px solid rgba(212, 175, 55, 0.3)', padding: '10px 14px', borderRadius: '10px', color: '#F2D675', fontWeight: 800, fontSize: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <span>{createdCredentials.temporaryPassword}</span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(createdCredentials.temporaryPassword)}
                    style={{ border: 'none', background: 'none', color: '#D4AF37', cursor: 'pointer', fontSize: '12px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Copy size={14} color="#D4AF37" /> {t('copyBtn')}
                  </button>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block' }}>{t('accountStatusUpper')}</span>
                <span className="badge badge-active" style={{ display: 'inline-block', marginTop: '4px' }}>{createdCredentials.accountStatus}</span>
              </div>
            </div>

            <button type="button" onClick={() => setCreatedCredentials(null)} className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '15px', justifyContent: 'center' }}>
              {t('doneCloseConfirmBtn')}
            </button>
          </div>
        </div>
      )}

      {/* Add / Edit Shop Modal */}
      {isModalOpen && (
        <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#111111', border: '1px solid rgba(212, 175, 55, 0.3)', borderRadius: '24px', maxWidth: '520px', width: '100%', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '20px', color: '#FFFFFF', fontWeight: 800 }}>{editingShop ? t('editMerchantAccountTitle') : t('addShopCredsBtn')}</h3>
              <button type="button" aria-label={t('closeModalAria')} onClick={() => setIsModalOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={20} color="#B8B8B8" /></button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8' }}>{t('ownerFullNameRequired')}</label>
                <input type="text" required className="form-input" value={formData.owner_name} onChange={e => setFormData({ ...formData, owner_name: e.target.value })} placeholder={t('ownerFullNamePlaceholder')} />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8' }}>{t('mrShopNameLabel')}</label>
                <input type="text" required className="form-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder={t('shopBusinessNamePlaceholder')} />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8' }}>{t('loginMobilePrimaryLabel')}</label>
                <input type="tel" required className="form-input" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="9876543210" />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8' }}>{t('shopEmailRequired')}</label>
                <input type="email" required className="form-input" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="merchant@example.com" />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8' }}>{t('mrCategoryLabel')}</label>
                <select
                  className="form-input"
                  value={formData.category}
                  onChange={e => {
                    const newCat = e.target.value;
                    const cObj = CATEGORIES.find(c => c.name === newCat) || CATEGORIES[0];
                    setFormData({ ...formData, category: newCat, subcategory: cObj.subcategories[0] || '' });
                  }}
                  style={{ background: '#111111', color: '#FFFFFF' }}
                >
                  {CATEGORIES.map(c => (
                    <option key={c.id} value={c.name}>{translateCategory(c.name)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8' }}>{t('mrSubcategoryLabel')}</label>
                <select
                  className="form-input"
                  value={formData.subcategory}
                  onChange={e => setFormData({ ...formData, subcategory: e.target.value })}
                  style={{ background: '#111111', color: '#FFFFFF' }}
                >
                  {(CATEGORIES.find(c => c.name === formData.category)?.subcategories || []).map(s => (
                    <option key={s} value={s}>{translateSubcategory(s)}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8' }}>{t('whatsappNumberLabel')}</label>
                  <input type="tel" className="form-input" value={formData.whatsapp_number} onChange={e => setFormData({ ...formData, whatsapp_number: e.target.value })} placeholder="9876543210" />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8' }}>{t('areaLocalityLabel')}</label>
                  <input type="text" className="form-input" value={formData.area_locality} onChange={e => setFormData({ ...formData, area_locality: e.target.value })} placeholder={t('areaLocalityPlaceholder')} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8' }}>{t('cityLabel')}</label>
                  <input type="text" className="form-input" value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} placeholder={t('cityDefaultPune')} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8' }}>{t('pincodeLabel')}</label>
                  <input type="text" className="form-input" value={formData.pincode} onChange={e => setFormData({ ...formData, pincode: e.target.value })} placeholder="411004" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8' }}>{t('openingTimeLabel')}</label>
                  <input type="time" className="form-input" value={formData.opening_time} onChange={e => setFormData({ ...formData, opening_time: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8' }}>{t('closingTimeLabel')}</label>
                  <input type="time" className="form-input" value={formData.closing_time} onChange={e => setFormData({ ...formData, closing_time: e.target.value })} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8' }}>{t('physicalAddressRequired')}</label>
                <input type="text" required className="form-input" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder={t('physicalAddressPlaceholder')} />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8' }}>{t('initialAccountStatusLabel')}</label>
                <select className="form-input" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} style={{ background: '#111111', color: '#FFFFFF' }}>
                  <option value="active">{t('statusOpt_active_grant')}</option>
                  <option value="pending">{t('statusOpt_pending_review')}</option>
                  <option value="suspended">{t('statusOpt_suspended')}</option>
                  <option value="inactive">{t('statusOpt_inactive_deact')}</option>
                </select>
              </div>

              {/* Shop Location picker */}
              <div style={{ border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '16px', padding: '14px', background: '#151515' }}>
                <label style={{ fontSize: '13px', fontWeight: 800, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={16} color="#D4AF37" /> {t('shopLocationLabel')} *
                </label>

                {locConfirmed && validCoord(formData.latitude, formData.longitude) ? (
                  <div style={{ marginTop: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#111111', border: '1px solid rgba(212, 175, 55, 0.3)', color: '#F2D675', padding: '12px', borderRadius: '12px', fontWeight: 800, fontSize: '13px' }}>
                      <CheckCircle2 size={18} color="#F2D675" /> ✓ {t('locationConfirmedLabel')}
                    </div>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '8px', fontSize: '13px', color: '#B8B8B8' }}>
                      <div style={{ flex: 1, background: '#111111', border: '1px solid rgba(212, 175, 55, 0.15)', borderRadius: '10px', padding: '8px 10px' }}>
                        <span style={{ fontSize: '10px', color: '#B8B8B8', display: 'block', fontWeight: 700 }}>{t('latitudeLabel')}</span>
                        <strong style={{ color: '#FFFFFF' }}>{Number(formData.latitude).toFixed(6)}</strong>
                      </div>
                      <div style={{ flex: 1, background: '#111111', border: '1px solid rgba(212, 175, 55, 0.15)', borderRadius: '10px', padding: '8px 10px' }}>
                        <span style={{ fontSize: '10px', color: '#B8B8B8', display: 'block', fontWeight: 700 }}>{t('longitudeLabel')}</span>
                        <strong style={{ color: '#FFFFFF' }}>{Number(formData.longitude).toFixed(6)}</strong>
                      </div>
                    </div>
                    <button type="button" onClick={handleChangeLocation} className="btn-secondary" style={{ width: '100%', marginTop: '10px', padding: '10px', fontSize: '13px', justifyContent: 'center' }}>
                      <RefreshCw size={14} color="#D4AF37" /> {t('changeLocationBtn')}
                    </button>
                  </div>
                ) : (
                  <div style={{ marginTop: '10px' }}>
                    <p style={{ fontSize: '12px', color: '#B8B8B8', margin: '0 0 10px 0' }}>{t('shopLocationRequiredHint')}</p>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button type="button" onClick={handleUseCurrentLocation} disabled={locBusy} className="btn-secondary" style={{ flex: 1, minWidth: '150px', padding: '10px', fontSize: '13px', justifyContent: 'center' }}>
                        <LocateFixed size={15} color="#D4AF37" /> {locBusy ? t('gettingLocationAdmin') : t('useCurrentLocationBtn')}
                      </button>
                      <button type="button" onClick={handlePickOnMap} className="btn-secondary" style={{ flex: 1, minWidth: '150px', padding: '10px', fontSize: '13px', justifyContent: 'center' }}>
                        <MapIcon size={15} color="#D4AF37" /> {t('pickOnMapBtn')}
                      </button>
                    </div>

                    {locErr && (
                      <div style={{ marginTop: '10px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '10px', borderRadius: '10px', fontSize: '12px', fontWeight: 700 }}>
                        {locErr}
                      </div>
                    )}

                    {showMap && (
                      <div style={{ marginTop: '12px' }}>
                        <p style={{ fontSize: '11.5px', color: '#B8B8B8', margin: '0 0 8px 0' }}>{t('tapMapToDrop')}</p>
                        <div style={{ height: '300px', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(212, 175, 55, 0.25)' }}>
                          <MerchantMap
                            key={`admin-picker-${mapEpoch}`}
                            userLat={mapCenter.lat}
                            userLng={mapCenter.lng}
                            isPinDropMode={true}
                            onPinDropped={handlePinDropped}
                          />
                        </div>

                        <div style={{ marginTop: '10px', fontSize: '12.5px', color: '#B8B8B8' }}>
                          {validCoord(candidateLat, candidateLng) ? (
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <div style={{ flex: 1, background: '#111111', border: '1px solid rgba(212, 175, 55, 0.15)', borderRadius: '10px', padding: '8px 10px' }}>
                                <span style={{ fontSize: '10px', color: '#D4AF37', display: 'block', fontWeight: 700 }}>{t('latitudeLabel')}</span>
                                <strong style={{ color: '#FFFFFF' }}>{Number(candidateLat).toFixed(6)}</strong>
                              </div>
                              <div style={{ flex: 1, background: '#111111', border: '1px solid rgba(212, 175, 55, 0.15)', borderRadius: '10px', padding: '8px 10px' }}>
                                <span style={{ fontSize: '10px', color: '#D4AF37', display: 'block', fontWeight: 700 }}>{t('longitudeLabel')}</span>
                                <strong style={{ color: '#FFFFFF' }}>{Number(candidateLng).toFixed(6)}</strong>
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: '#777777' }}>{t('noLocationYet')}</span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={handleConfirmLocation}
                          disabled={!validCoord(candidateLat, candidateLng)}
                          className="btn-primary"
                          style={{ width: '100%', marginTop: '10px', padding: '12px', fontSize: '14px', justifyContent: 'center', opacity: validCoord(candidateLat, candidateLng) ? 1 : 0.5, cursor: validCoord(candidateLat, candidateLng) ? 'pointer' : 'not-allowed' }}
                        >
                          <CheckCircle2 size={16} color="#050505" /> {t('confirmLocationBtn')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={!canSave}
                className="btn-primary"
                style={{ padding: '14px', fontSize: '15px', marginTop: '10px', opacity: canSave ? 1 : 0.5, cursor: canSave ? 'pointer' : 'not-allowed' }}
              >
                {editingShop ? t('saveChangesBtn') : t('createMerchantCredsBtn')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
