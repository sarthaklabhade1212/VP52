import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { Camera, Plus, Trash2, CheckCircle2, Star, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function MerchantPhotos() {
  const { token } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState('');

  const fetchPhotos = () => {
    fetch('/api/merchant/photos', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(d => {
        if (d.success) setPhotos(d.photos || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPhotos();
  }, [token]);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        // 1. Upload to storage
        const upRes = await fetch('/api/upload/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ image: evt.target.result, folder: 'merchant' })
        });
        const upData = await upRes.json();
        if (!upData.success || !upData.url) throw new Error(upData.error || t('uploadFailedPrefix'));

        // 2. Save photo record
        const addRes = await fetch('/api/merchant/photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            photo_url: upData.url,
            caption: caption,
            is_cover: photos.length === 0 ? 1 : 0
          })
        });
        const addData = await addRes.json();
        if (addData.success) {
          setCaption('');
          fetchPhotos();
        } else {
          alert(addData.error || t('failedSavePhotoError'));
        }
      } catch (err) {
        alert(err.message);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = async (photoId) => {
    if (!window.confirm(t('deletePhotoConfirm'))) return;
    try {
      const res = await fetch(`/api/merchant/photos/${photoId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        fetchPhotos();
      }
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', background: '#050505', color: '#FFFFFF' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <button
          type="button"
          aria-label={t('goBackAria')}
          onClick={() => navigate('/shop/dashboard')}
          style={{ background: 'none', border: 'none', color: '#D4AF37', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Camera size={24} color="#D4AF37" /> {t('storePhotoGalleryTitle')}
          </h2>
          <span style={{ fontSize: '12px', color: '#888888' }}>{t('storePhotoGallerySub')}</span>
        </div>
      </div>

      {/* Upload Box */}
      <div style={{ background: '#111111', borderRadius: '18px', padding: '20px', border: '1px solid rgba(212,175,55,0.25)', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#F2D675', margin: '0 0 12px 0' }}>{t('addNewStorePhotoTitle')}</h3>
        <div style={{ marginBottom: '12px' }}>
          <input
            type="text"
            className="form-input"
            placeholder={t('photoCaptionPlaceholder')}
            value={caption}
            onChange={e => setCaption(e.target.value)}
            style={{ width: '100%', borderRadius: '10px', padding: '10px 14px', fontSize: '13px' }}
          />
        </div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderRadius: '12px', background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)', color: '#050505', fontWeight: 800, fontSize: '13px', cursor: uploading ? 'wait' : 'pointer' }}>
          <Plus size={18} color="#050505" aria-hidden="true" />
          {uploading ? t('uploadingPhotoProgress') : t('selectUploadPhotoBtn')}
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {/* Photos Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '30px', color: '#888888' }}>{t('loadingGallery')}</div>
      ) : photos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', background: '#111111', borderRadius: '18px', border: '1px dashed rgba(212,175,55,0.2)', color: '#888888', fontSize: '13px' }}>
          <Camera size={36} color="#D4AF37" style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
          {t('emptyGalleryMerchant')}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px' }}>
          {photos.map(p => (
            <div key={p.id} style={{ background: '#111111', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(212,175,55,0.2)', position: 'relative' }}>
              <div style={{ height: '140px', width: '100%' }}>
                <img src={p.photo_url} alt={p.caption || t('storePhotoAlt')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ padding: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '8px' }}>
                  {p.caption || t('storePhotoAlt')}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {p.is_cover ? (
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#10b981', background: 'rgba(16,185,129,0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                      {t('primaryCoverBadge')}
                    </span>
                  ) : <span />}
                  <button
                    type="button"
                    onClick={() => handleDelete(p.id)}
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                    title={t('deletePhotoTitle')}
                    aria-label={t('deletePhotoTitle')}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
