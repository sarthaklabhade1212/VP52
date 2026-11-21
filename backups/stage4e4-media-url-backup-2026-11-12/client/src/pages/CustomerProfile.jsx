import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { parseApiResponse, resolveApiErrorMessage, resolveNetworkErrorMessage } from '../utils/api';
import {
  compressImageToDataUrl,
  validateImageFile,
  IMAGE_UPLOAD_PRESETS,
  ImageCompressionError
} from '../utils/imageCompression';
import { QRCodeSVG } from 'qrcode.react';
import { Award, Phone, Mail, CheckCircle2, RefreshCw, Lock, LogOut, Trash2, Shield, AlertTriangle, Camera, Upload, Check } from 'lucide-react';

export default function CustomerProfile() {
  const navigate = useNavigate();
  const { user, token, logout, updateUserPhoto } = useAuth();
  const { t, locale } = useI18n();
  const [qrToken, setQrToken] = useState(null);
  const [loadingQr, setLoadingQr] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Profile photo states
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [photoSuccess, setPhotoSuccess] = useState('');
  const [avatarError, setAvatarError] = useState(false);
  const fileInputRef = useRef(null);

  const handlePhotoSelect = async (e) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file, {
      maxInputBytes: IMAGE_UPLOAD_PRESETS.PROFILE_AVATAR.maxInputBytes
    });
    if (!validation.valid) {
      if (validation.reason === 'INVALID_TYPE') {
        setPhotoError(t('photoTypeError'));
      } else if (validation.reason === 'FILE_TOO_LARGE') {
        setPhotoError(t('apiErrorPayloadTooLarge'));
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploadingPhoto(true);
    setPhotoError('');
    setPhotoSuccess('');

    try {
      const { dataUrl } = await compressImageToDataUrl(file, IMAGE_UPLOAD_PRESETS.PROFILE_AVATAR);

      // 1. Upload compressed image to storage
      const upRes = await fetch('/api/upload/image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ image: dataUrl, type: 'customer_profile' })
      });
      const upParsed = await parseApiResponse(upRes);
      const upData = upParsed.data;
      if (!upParsed.ok || !upData || !upData.success || !upData.url) {
        throw new Error(resolveApiErrorMessage(upParsed, t, 'photoUploadFailed'));
      }

      // 2. Associate photo with customer account
      const photoRes = await fetch('/api/customer/photo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ photo_url: upData.url })
      });
      const photoParsed = await parseApiResponse(photoRes);
      const photoData = photoParsed.data;
      if (!photoParsed.ok || !photoData || !photoData.success) {
        throw new Error(resolveApiErrorMessage(photoParsed, t, 'photoUpdateFailed'));
      }

      updateUserPhoto(upData.url);
      setAvatarError(false);
      setPhotoSuccess(t('photoUpdateSuccess'));
    } catch (err) {
      console.error('Profile photo upload error:', err);
      if (err instanceof ImageCompressionError) {
        setPhotoError(
          err.code === 'COMPRESSED_TOO_LARGE'
            ? t('apiErrorPayloadTooLarge')
            : t('photoCompressionFailed')
        );
      } else {
        setPhotoError(resolveNetworkErrorMessage(err, t, 'photoUpdateFailed'));
      }
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = async () => {
    setUploadingPhoto(true);
    setPhotoError('');
    setPhotoSuccess('');
    try {
      const res = await fetch('/api/customer/photo', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = await parseApiResponse(res);
      const data = parsed.data;
      if (parsed.ok && data && data.success) {
        updateUserPhoto(null);
        setAvatarError(false);
        setPhotoSuccess(t('photoRemovedSuccess'));
      } else {
        setPhotoError(resolveApiErrorMessage(parsed, t, 'photoRemoveFailed'));
      }
    } catch (err) {
      setPhotoError(resolveNetworkErrorMessage(err, t, 'photoRemoveNetError'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const fetchQrToken = (rotate = false) => {
    setLoadingQr(true);
    fetch('/api/customer/qr-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ rotate })
    })
      .then(res => parseApiResponse(res))
      .then(parsed => {
        const data = parsed.data;
        if (parsed.ok && data && data.success) {
          setQrToken(data.qrToken);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingQr(false));
  };

  useEffect(() => {
    if (token) fetchQrToken(false);
  }, [token]);

  const handleLogout = () => {
    logout();
    navigate('/customer/login');
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch('/api/customer/account', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const parsed = await parseApiResponse(res);
      const data = parsed.data;
      if (parsed.ok && data && data.success) {
        alert(data.message || t('accountDeletedAlert'));
        logout();
        navigate('/customer/login');
      } else {
        setDeleteError(resolveApiErrorMessage(parsed, t, 'accountDeleteFailed'));
        setDeleting(false);
      }
    } catch (err) {
      console.error(err);
      setDeleteError(resolveNetworkErrorMessage(err, t, 'accountDeleteNetError'));
      setDeleting(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto', background: '#050505' }}>
      <h2 style={{ fontSize: '22px', color: '#FFFFFF', marginBottom: '16px', fontWeight: 800 }}>
        {t('profileTitle')}
      </h2>

      {/* User Info Card */}
      <div style={{
        background: '#111111',
        borderRadius: '20px',
        padding: '24px 20px',
        border: '1px solid rgba(212, 175, 55, 0.25)',
        textAlign: 'center',
        marginBottom: '20px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.35)'
      }}>
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={handlePhotoSelect}
        />

        {/* Circular Avatar with Camera Overlay */}
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: '14px' }}>
          {user?.profile_photo && !avatarError ? (
            <img
              src={user.profile_photo}
              alt={user.full_name || t('customerLabel')}
              onError={() => setAvatarError(true)}
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid #D4AF37',
                boxShadow: '0 8px 24px rgba(212, 175, 55, 0.35)',
                display: 'block'
              }}
            />
          ) : (
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#050505',
              fontWeight: 800,
              fontSize: '32px',
              border: '2px solid #D4AF37',
              boxShadow: '0 8px 24px rgba(212, 175, 55, 0.35)'
            }}>
              {user && user.full_name ? user.full_name.charAt(0).toUpperCase() : 'C'}
            </div>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingPhoto}
            title={t('changeProfilePhotoAria')}
            aria-label={t('changeProfilePhotoAria')}
            style={{
              position: 'absolute',
              bottom: '0',
              right: '0',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: '#D4AF37',
              border: '2px solid #111111',
              color: '#050505',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: uploadingPhoto ? 'wait' : 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.5)'
            }}
          >
            <Camera size={14} color="#050505" />
          </button>
        </div>

        {/* Change / Remove Photo Buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '14px' }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingPhoto}
            style={{
              background: 'rgba(212, 175, 55, 0.12)',
              border: '1px solid rgba(212, 175, 55, 0.3)',
              color: '#F2D675',
              padding: '6px 12px',
              borderRadius: '99px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: uploadingPhoto ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Upload size={12} color="#F2D675" />
            {uploadingPhoto ? t('uploadingPhoto') : (user?.profile_photo ? t('changePhotoBtn') : t('uploadPhotoBtn'))}
          </button>

          {user?.profile_photo && (
            <button
              type="button"
              onClick={handleRemovePhoto}
              disabled={uploadingPhoto}
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                padding: '6px 10px',
                borderRadius: '99px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {t('removeBtn')}
            </button>
          )}
        </div>

        {photoSuccess && (
          <div style={{ fontSize: '11px', color: '#10b981', marginBottom: '10px', fontWeight: 600 }}>
            ✓ {photoSuccess}
          </div>
        )}
        {photoError && (
          <div style={{ fontSize: '11px', color: '#ef4444', marginBottom: '10px', fontWeight: 600 }}>
            ⚠️ {photoError}
          </div>
        )}

        <h3 style={{ fontSize: '18px', color: '#FFFFFF', marginBottom: '2px', fontWeight: 800 }}>
          {user ? user.full_name : t('customerLabel')}
        </h3>
        <p style={{ fontSize: '13px', color: '#B8B8B8', marginBottom: '12px' }}>
          {user ? user.email : 'customer@example.com'}
        </p>

        <span className="badge badge-active" style={{ fontSize: '12px', padding: '6px 12px' }}>
          <CheckCircle2 size={14} color="#F2D675" /> {t('activeRewardsMember')}
        </span>
      </div>

      {/* CRYPTOGRAPHICALLY SECURE CUSTOMER QR CARD */}
      <div style={{
        background: '#111111',
        borderRadius: '24px',
        padding: '24px',
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: '20px',
        border: '1px solid rgba(212, 175, 55, 0.3)',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#151515', border: '1px solid rgba(212, 175, 55, 0.3)', padding: '4px 12px', borderRadius: '99px', fontSize: '11px', fontWeight: 800, color: '#F2D675', marginBottom: '16px' }}>
          <Lock size={12} color="#F2D675" /> {t('cryptoSecureQr')}
        </div>

        <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '20px', display: 'inline-block', marginBottom: '16px', boxShadow: '0 8px 20px rgba(0,0,0,0.4)' }}>
          {loadingQr ? (
            <div style={{ width: '160px', height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#777777', fontSize: '12px' }}>
              {t('generatingSecureQr')}
            </div>
          ) : qrToken ? (
            <QRCodeSVG value={qrToken} size={160} />
          ) : (
            <div style={{ color: '#ef4444', fontSize: '12px' }}>{t('failedLoadQrToken')}</div>
          )}
        </div>

        <p style={{ fontSize: '12px', color: '#B8B8B8', marginBottom: '14px' }}>
          {t('showQrToMerchant')}
        </p>

        <button
          type="button"
          onClick={() => fetchQrToken(true)}
          className="btn-secondary"
          style={{
            padding: '8px 16px', borderRadius: '12px', fontSize: '12px', fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', gap: '6px'
          }}
        >
          <RefreshCw size={14} color="#D4AF37" /> {t('rotateSecureToken')}
        </button>
      </div>

      {/* Profile Details List */}
      <div style={{ background: '#111111', borderRadius: '16px', border: '1px solid rgba(212, 175, 55, 0.15)', overflow: 'hidden', marginBottom: '24px' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Mail size={18} color="#D4AF37" />
          <div>
            <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block' }}>{t('emailAddress')}</span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>{user ? user.email : '-'}</span>
          </div>
        </div>

        <div style={{ padding: '16px', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Phone size={18} color="#D4AF37" />
          <div>
            <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block' }}>{t('mobileNumber')}</span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>{user ? user.phone || '-' : '-'}</span>
          </div>
        </div>

        <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Award size={18} color="#D4AF37" />
          <div>
            <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block' }}>{t('availableCoinsBalance')}</span>
            <span style={{ fontSize: '14px', fontWeight: 800, color: '#F2D675' }}>
              🪙 {(user ? user.available_coins || user.balance || 0 : 0).toLocaleString(locale)} {t('coinsUnit')}
            </span>
          </div>
        </div>
      </div>

      {/* Privacy Policy and Compliance Links */}
      <div style={{
        background: '#111111',
        borderRadius: '16px',
        border: '1px solid rgba(212, 175, 55, 0.15)',
        padding: '12px 16px',
        marginBottom: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        <Link
          to="/privacy"
          style={{
            color: '#D4AF37',
            fontSize: '13px',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 600
          }}
        >
          <Shield size={16} color="#D4AF37" /> {t('privacyPolicyLink')}
        </Link>
        <Link
          to="/delete-account"
          style={{
            color: '#888888',
            fontSize: '12px',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Trash2 size={14} color="#888888" /> {t('accountDeletionTitle')}
        </Link>
      </div>

      {/* Action Buttons: Sign Out and Delete Account */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            padding: '14px',
            color: '#FFFFFF',
            border: '1px solid rgba(212, 175, 55, 0.3)',
            background: '#151515',
            fontWeight: 700,
            borderRadius: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <LogOut size={18} color="#D4AF37" /> {t('signOutAccount')}
        </button>

        <button
          onClick={() => setShowDeleteModal(true)}
          style={{
            width: '100%',
            padding: '14px',
            color: '#ef4444',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            background: 'rgba(239, 68, 68, 0.06)',
            fontWeight: 700,
            borderRadius: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <Trash2 size={18} color="#ef4444" /> {t('deleteAccountBtn')}
        </button>
      </div>

      {/* Account Deletion Confirmation Modal */}
      {showDeleteModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(6px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            style={{
              background: '#151515',
              border: '1px solid rgba(239, 68, 68, 0.5)',
              borderRadius: '20px',
              padding: '24px',
              maxWidth: '420px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
              color: '#FFFFFF'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', color: '#ef4444' }}>
              <AlertTriangle size={24} color="#ef4444" />
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
                {t('deleteAccountConfirmTitle')}
              </h3>
            </div>

            <p style={{ fontSize: '13px', color: '#CCCCCC', lineHeight: '1.5', marginBottom: '20px' }}>
              {t('deleteAccountWarning')}
            </p>

            {deleteError && (
              <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '14px', padding: '8px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px' }}>
                {deleteError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                disabled={deleting}
                onClick={() => setShowDeleteModal(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#222222',
                  border: '1px solid #444444',
                  color: '#FFFFFF',
                  borderRadius: '10px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {t('cancelBtn')}
              </button>

              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteAccount}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#dc2626',
                  border: 'none',
                  color: '#FFFFFF',
                  borderRadius: '10px',
                  fontWeight: 800,
                  cursor: deleting ? 'not-allowed' : 'pointer'
                }}
              >
                {deleting ? '...' : t('confirmDeleteBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
