import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { parseApiResponse, resolveApiErrorMessage, resolveNetworkErrorMessage } from '../utils/api';
import {
  compressImageToDataUrl,
  validateImageFile,
  IMAGE_UPLOAD_PRESETS,
  ImageCompressionError
} from '../utils/imageCompression';
import CategoryIcon from '../components/CategoryIcon';
import MerchantMap from '../components/MerchantMap';
import {
  ArrowLeft,
  Star,
  MapPin,
  Phone,
  MessageCircle,
  Clock,
  Navigation,
  Share2,
  CheckCircle2,
  AlertCircle,
  ShoppingBag,
  UtensilsCrossed,
  Sparkles,
  Camera,
  X,
  ChevronRight,
  Send,
  Flag,
  Heart,
  Calendar,
  Tag
} from 'lucide-react';

export default function CustomerShopDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const { t, locale, translateCategory, translateSubcategory } = useI18n();

  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog', 'about', 'gallery', 'reviews'

  // Catalog filter
  const [catalogFilter, setCatalogFilter] = useState('all');

  // Review Modal State
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [ratingInput, setRatingInput] = useState(5);
  const [reviewTextInput, setReviewTextInput] = useState('');
  const [reviewPhoto, setReviewPhoto] = useState(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState(null);
  const [reviewSuccess, setReviewSuccess] = useState(null);

  // Order / Inquiry Modal State
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [orderPhone, setOrderPhone] = useState(user?.phone || '');
  const [orderNotes, setOrderNotes] = useState('');
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderSuccessMsg, setOrderSuccessMsg] = useState(null);

  // Gallery Lightbox
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(null);

  const fetchShopDetails = () => {
    fetch(`/api/customer/shops/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => parseApiResponse(res))
      .then(parsed => {
        const d = parsed.data;
        if (parsed.ok && d && d.success && d.shop) {
          setShop(d.shop);
        } else {
          navigate('/customer/home');
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token && id) {
      fetchShopDetails();
    }
  }, [token, id]);

  const startChat = () => {
    fetch('/api/customer/conversations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop_id: Number(id) })
    })
      .then(res => parseApiResponse(res))
      .then(parsed => {
        const d = parsed.data;
        if (parsed.ok && d && d.success && d.conversation) {
          navigate(`/customer/messages/${d.conversation.id}`);
        } else {
          alert(resolveApiErrorMessage(parsed, t, 'serverErrorFallback'));
        }
      })
      .catch(err => alert(resolveNetworkErrorMessage(err, t, 'networkErrorGeneric')));
  };

  const handleDirections = () => {
    if (!shop) return;
    const dest = (shop.latitude && shop.longitude)
      ? `${shop.latitude},${shop.longitude}`
      : encodeURIComponent(shop.address || shop.name);
    window.open(`https://maps.google.com/?q=${dest}`, '_blank');
  };

  const handleCall = () => {
    const num = shop?.phone || shop?.mobile_number;
    if (num) window.location.href = `tel:${num}`;
  };

  const handleWhatsApp = () => {
    const num = shop?.whatsapp_number || shop?.phone || shop?.mobile_number;
    if (num) {
      const cleanNum = num.replace(/\D/g, '');
      const text = encodeURIComponent(t('whatsappShopGreeting', { name: shop.name }));
      window.open(`https://wa.me/${cleanNum.startsWith('91') ? cleanNum : '91' + cleanNum}?text=${text}`, '_blank');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: shop.name,
          text: t('shareShopText', { name: shop.name }),
          url: window.location.href
        });
      } catch (err) {}
    } else {
      navigator.clipboard?.writeText(window.location.href);
      alert(t('storeLinkCopied'));
    }
  };

  // Review Photo Upload
  const handleReviewPhotoUpload = async (e) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file, {
      allowAnyRasterImage: true,
      maxInputBytes: IMAGE_UPLOAD_PRESETS.GENERAL_PHOTO.maxInputBytes
    });
    if (!validation.valid) {
      setReviewError(
        validation.reason === 'FILE_TOO_LARGE'
          ? t('apiErrorPayloadTooLarge')
          : t('photoTypeError')
      );
      input.value = '';
      return;
    }

    setReviewError(null);
    try {
      const { dataUrl } = await compressImageToDataUrl(file, IMAGE_UPLOAD_PRESETS.GENERAL_PHOTO);
      const res = await fetch('/api/upload/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ image: dataUrl, folder: 'reviews' })
      });
      const parsed = await parseApiResponse(res);
      const d = parsed.data;
      if (parsed.ok && d && d.success && d.url) {
        setReviewPhoto(d.url);
      } else {
        setReviewError(resolveApiErrorMessage(parsed, t, 'photoUploadFailed'));
      }
    } catch (err) {
      console.error('Failed to upload review photo', err);
      if (err instanceof ImageCompressionError) {
        setReviewError(
          err.code === 'COMPRESSED_TOO_LARGE'
            ? t('apiErrorPayloadTooLarge')
            : t('photoCompressionFailed')
        );
      } else {
        setReviewError(resolveNetworkErrorMessage(err, t, 'photoUploadFailed'));
      }
    } finally {
      input.value = '';
    }
  };

  // Submit Review
  const handleSubmitReview = async (e) => {
    e.preventDefault();
    setReviewSubmitting(true);
    setReviewError(null);
    setReviewSuccess(null);

    try {
      const res = await fetch(`/api/customer/shops/${id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          rating: ratingInput,
          comment: reviewTextInput,
          photo_url: reviewPhoto
        })
      });
      const parsed = await parseApiResponse(res);
      const data = parsed.data;
      if (parsed.ok && data && data.success) {
        setReviewSuccess(data.message || t('reviewSubmittedMsg'));
        setReviewTextInput('');
        setReviewPhoto(null);
        setTimeout(() => {
          setIsReviewModalOpen(false);
          setReviewSuccess(null);
          fetchShopDetails();
        }, 1200);
      } else {
        setReviewError(resolveApiErrorMessage(parsed, t, 'failedSubmitReview'));
      }
    } catch (err) {
      setReviewError(resolveNetworkErrorMessage(err, t, 'failedSubmitReview'));
    } finally {
      setReviewSubmitting(false);
    }
  };

  // Report Review
  const handleReportReview = async (reviewId) => {
    const reason = prompt(t('reportReviewPrompt'));
    if (!reason) return;
    try {
      const res = await fetch(`/api/customer/reviews/${reviewId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason })
      });
      const parsed = await parseApiResponse(res);
      const d = parsed.data;
      if (parsed.ok && d && d.success) {
        alert(d.message || t('reportSubmittedMsg'));
      } else {
        alert(resolveApiErrorMessage(parsed, t, 'reportFailedMsg'));
      }
    } catch (err) {
      alert(resolveNetworkErrorMessage(err, t, 'reportFailedMsg'));
    }
  };

  // Open Order Modal
  const handleOpenOrder = (product) => {
    setSelectedProduct(product);
    setOrderQuantity(1);
    setOrderSuccessMsg(null);
    setIsOrderModalOpen(true);
  };

  // Submit Order / Inquiry
  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    setOrderSubmitting(true);
    try {
      const items = [{
        product_id: selectedProduct?.id || null,
        product_name: selectedProduct?.name || t('orderInquiryFallback'),
        price: selectedProduct?.price || 0,
        quantity: orderQuantity
      }];
      const totalAmount = (selectedProduct?.price || 0) * orderQuantity;

      const res = await fetch('/api/customer/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          shop_id: Number(id),
          customer_phone: orderPhone,
          total_amount: totalAmount,
          notes: orderNotes,
          items
        })
      });
      const parsed = await parseApiResponse(res);
      const data = parsed.data;
      if (parsed.ok && data && data.success) {
        setOrderSuccessMsg(data.message || t('orderPlacedSuccess'));
        setTimeout(() => {
          setIsOrderModalOpen(false);
          setOrderSuccessMsg(null);
          setOrderNotes('');
        }, 1500);
      } else {
        alert(resolveApiErrorMessage(parsed, t, 'orderPlaceFailed'));
      }
    } catch (err) {
      alert(resolveNetworkErrorMessage(err, t, 'orderPlaceFailed'));
    } finally {
      setOrderSubmitting(false);
    }
  };

  if (loading || !shop) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D4AF37', fontWeight: 800, background: '#050505' }}>
        {t('loadingBusinessDetails', { name: shop?.name || t('businessDetailsFallback') })}
      </div>
    );
  }

  const isTempClosed = !!shop.is_temporarily_closed;
  const ratingAvg = shop.rating_avg && Number(shop.rating_avg) > 0 ? Number(shop.rating_avg).toFixed(1) : null;
  const coverImage = shop.cover_photo_url || shop.image_url || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1000&q=80';
  const logoImage = shop.logo_url || shop.image_url || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=300&q=80';

  // Filter products by type
  const products = shop.products || [];
  const filteredProducts = products.filter(p => {
    if (catalogFilter === 'all') return true;
    if (catalogFilter === 'food') return p.product_type === 'food' || p.veg_non_veg;
    if (catalogFilter === 'service') return p.product_type === 'service' || p.product_type === 'course' || p.duration;
    if (catalogFilter === 'product') return p.product_type === 'product' || (!p.product_type && !p.veg_non_veg);
    return true;
  });

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto', paddingBottom: '60px', background: '#050505', color: '#FFFFFF' }}>
      {/* Top Hero Section */}
      <div style={{ position: 'relative', width: '100%', height: '230px', background: '#111111' }}>
        <img
          src={coverImage}
          alt={shop.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(5,5,5,0.3) 0%, rgba(5,5,5,0.85) 100%)' }} />

        {/* Navigation Floating Header */}
        <div style={{ position: 'absolute', top: '16px', left: '16px', right: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
          <button
            type="button"
            aria-label={t('goBackAria')}
            onClick={() => navigate(-1)}
            style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(5,5,5,0.75)', border: '1px solid rgba(212,175,55,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#F2D675' }}
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={t('shareStoreAria')}
            onClick={handleShare}
            style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(5,5,5,0.75)', border: '1px solid rgba(212,175,55,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#F2D675' }}
          >
            <Share2 size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Logo floating avatar */}
        <div style={{ position: 'absolute', bottom: '-28px', left: '20px', zIndex: 12 }}>
          <img
            src={logoImage}
            alt={shop.name}
            style={{ width: '76px', height: '76px', borderRadius: '20px', objectFit: 'cover', border: '3px solid #050505', boxShadow: '0 8px 24px rgba(0,0,0,0.8)' }}
          />
        </div>
      </div>

      {/* Main Info Card */}
      <div style={{ padding: '36px 20px 20px 20px', background: '#0B0B0B', borderBottom: '1px solid rgba(212,175,55,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#D4AF37', background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.3)', padding: '3px 10px', borderRadius: '8px', textTransform: 'uppercase' }}>
                {translateCategory(shop.category)}
              </span>
              {shop.subcategory && (
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#FFFFFF', background: '#1A1A1A', padding: '3px 10px', borderRadius: '8px' }}>
                  {translateSubcategory(shop.subcategory)}
                </span>
              )}
              <span style={{ fontSize: '11px', fontWeight: 700, color: isTempClosed ? '#ef4444' : '#10b981', background: isTempClosed ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)', padding: '3px 10px', borderRadius: '8px' }}>
                {isTempClosed ? t('shopStatusTempClosedBadge') : t('shopStatusOpenBadge')}
              </span>
            </div>

            <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#FFFFFF', margin: '4px 0 6px 0', lineHeight: 1.2 }}>
              {shop.name}
            </h1>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: '#B8B8B8', marginBottom: '8px' }}>
              <span style={{ color: '#F2D675', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Star size={16} fill="#F2D675" color="#F2D675" aria-hidden="true" />
                {ratingAvg ? `${ratingAvg} / 5` : t('ratingNew')}
                <span style={{ color: '#888888', fontWeight: 500 }}>{t('reviewsCountLabel', { count: shop.rating_count || 0 })}</span>
              </span>
              {shop.opening_time && shop.closing_time && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={14} color="#D4AF37" aria-hidden="true" /> {shop.opening_time} - {shop.closing_time}
                </span>
              )}
            </div>

            <div style={{ fontSize: '12px', color: '#888888', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapPin size={14} color="#D4AF37" aria-hidden="true" />
              <span>{shop.area_locality ? `${shop.area_locality}, ` : ''}{shop.address}{shop.city ? `, ${shop.city}` : ''}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginTop: '20px' }}>
          <button
            type="button"
            onClick={handleCall}
            style={{ padding: '12px', borderRadius: '14px', background: '#151515', border: '1px solid rgba(212,175,55,0.25)', color: '#FFFFFF', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}
          >
            <Phone size={18} color="#D4AF37" aria-hidden="true" /> {t('callBtn')}
          </button>
          <button
            type="button"
            onClick={handleWhatsApp}
            style={{ padding: '12px', borderRadius: '14px', background: '#151515', border: '1px solid rgba(16,185,129,0.3)', color: '#FFFFFF', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}
          >
            <MessageCircle size={18} color="#10b981" aria-hidden="true" /> {t('whatsappBtn')}
          </button>
          <button
            type="button"
            onClick={startChat}
            style={{ padding: '12px', borderRadius: '14px', background: '#151515', border: '1px solid rgba(212,175,55,0.25)', color: '#FFFFFF', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}
          >
            <Send size={18} color="#D4AF37" aria-hidden="true" /> {t('inAppChatBtn')}
          </button>
          <button
            type="button"
            onClick={handleDirections}
            style={{ padding: '12px', borderRadius: '14px', background: '#151515', border: '1px solid rgba(212,175,55,0.25)', color: '#FFFFFF', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}
          >
            <Navigation size={18} color="#F2D675" aria-hidden="true" /> {t('directionsBtn')}
          </button>
        </div>

        {/* VP52 Coin Rewards Highlight Banner */}
        <div style={{
          marginTop: '20px',
          background: 'linear-gradient(135deg, #17130A 0%, #0B0B0B 100%)',
          borderRadius: '16px',
          padding: '16px 20px',
          border: '1px solid rgba(212,175,55,0.35)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 8px 25px rgba(212,175,55,0.08)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              <span style={{ fontSize: '16px' }}>🪙</span>
              <span style={{ fontSize: '14px', fontWeight: 800, color: '#F2D675' }}>{t('useVp52CoinsDiscountHere')}</span>
            </div>
            <p style={{ fontSize: '11.5px', color: '#B8B8B8', margin: 0 }}>
              {t('yourCoinBalanceSummary', { balance: (user?.balance || 0).toLocaleString(locale) })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/customer/wallet')}
            className="btn-primary"
            style={{ padding: '8px 14px', fontSize: '12px', borderRadius: '10px', whiteSpace: 'nowrap' }}
          >
            {t('redeemCoinsBtn')}
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(212,175,55,0.15)', background: '#080808', position: 'sticky', top: 0, zIndex: 20 }}>
        {[
          { key: 'catalog', label: t('tabCatalogMenu') },
          { key: 'about', label: t('tabHoursInfo') },
          { key: 'gallery', label: t('tabGalleryCount', { count: (shop.photos || []).length }) },
          { key: 'reviews', label: t('tabReviewsCount', { count: shop.rating_count || 0 }) }
        ].map(tab => (
          <button
            type="button"
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              padding: '14px 8px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid #D4AF37' : '2px solid transparent',
              color: activeTab === tab.key ? '#F2D675' : '#888888',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ padding: '20px' }}>
        {/* TAB 1: CATALOG & MENU */}
        {activeTab === 'catalog' && (
          <div>
            {/* Catalog Type Filters */}
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '16px' }}>
              {[
                { id: 'all', label: t('filterAllItems') },
                { id: 'food', label: t('filterFoodMenu') },
                { id: 'product', label: t('filterProducts') },
                { id: 'service', label: t('filterServices') }
              ].map(f => (
                <button
                  type="button"
                  key={f.id}
                  onClick={() => setCatalogFilter(f.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '99px',
                    fontSize: '12px',
                    fontWeight: 700,
                    border: catalogFilter === f.id ? '1px solid #D4AF37' : '1px solid rgba(255,255,255,0.1)',
                    background: catalogFilter === f.id ? '#1A1A1A' : '#111111',
                    color: catalogFilter === f.id ? '#F2D675' : '#888888',
                    cursor: 'pointer'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {filteredProducts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', background: '#111111', borderRadius: '18px', border: '1px dashed rgba(212,175,55,0.2)', color: '#888888', fontSize: '13px' }}>
                <ShoppingBag size={32} color="#D4AF37" style={{ margin: '0 auto 8px auto', opacity: 0.5 }} aria-hidden="true" />
                {t('noCatalogItemsSection')}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                {filteredProducts.map(item => (
                  <div
                    key={item.id}
                    style={{
                      background: '#111111',
                      borderRadius: '18px',
                      padding: '16px',
                      border: '1px solid rgba(212,175,55,0.15)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '12px'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                        <div>
                          {item.veg_non_veg && (
                            <span
                              style={{
                                display: 'inline-block',
                                fontSize: '10px',
                                fontWeight: 800,
                                color: item.veg_non_veg === 'veg' ? '#10b981' : '#ef4444',
                                background: item.veg_non_veg === 'veg' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                marginBottom: '4px',
                                textTransform: 'uppercase'
                              }}
                            >
                              {item.veg_non_veg === 'veg' ? t('vegLabel') : t('nonVegLabel')}
                            </span>
                          )}
                          <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                            {item.name}
                          </h4>
                          {item.food_category && (
                            <span style={{ fontSize: '11px', color: '#D4AF37' }}>{item.food_category}</span>
                          )}
                        </div>

                        {item.photo_url && (
                          <img
                            src={item.photo_url}
                            alt={item.name}
                            style={{ width: '64px', height: '64px', borderRadius: '12px', objectFit: 'cover' }}
                          />
                        )}
                      </div>

                      {item.description && (
                        <p style={{ fontSize: '12px', color: '#999999', margin: '4px 0 8px 0', lineHeight: 1.4 }}>
                          {item.description}
                        </p>
                      )}

                      {/* Product Specifications & Badges */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '11px', color: '#B8B8B8', marginBottom: '8px' }}>
                        {item.size && <span style={{ background: '#1A1A1A', padding: '2px 6px', borderRadius: '4px' }}>{t('specSize', { val: item.size })}</span>}
                        {item.fabric && <span style={{ background: '#1A1A1A', padding: '2px 6px', borderRadius: '4px' }}>{t('specFabric', { val: item.fabric })}</span>}
                        {item.colour && <span style={{ background: '#1A1A1A', padding: '2px 6px', borderRadius: '4px' }}>{t('specColour', { val: item.colour })}</span>}
                        {item.brand && <span style={{ background: '#1A1A1A', padding: '2px 6px', borderRadius: '4px' }}>{t('specBrand', { val: item.brand })}</span>}
                        {item.duration && <span style={{ background: '#1A1A1A', padding: '2px 6px', borderRadius: '4px' }}>⏳ {item.duration}</span>}
                        {item.warranty && <span style={{ background: '#1A1A1A', padding: '2px 6px', borderRadius: '4px' }}>🛡️ {item.warranty}</span>}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <div>
                        <span style={{ fontSize: '18px', fontWeight: 900, color: '#F2D675' }}>
                          {Number(item.price || 0).toLocaleString(locale)}
                        </span>
                        {item.price_max && item.price_max > item.price && (
                          <span style={{ fontSize: '13px', color: '#888888', marginLeft: '4px' }}>
                            - {Number(item.price_max).toLocaleString(locale)}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenOrder(item)}
                        className="btn-primary"
                        style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '10px' }}
                      >
                        {t('inquireOrderBtn')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: HOURS & ABOUT */}
        {activeTab === 'about' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Description Card */}
            {shop.description && (
              <div style={{ background: '#111111', borderRadius: '18px', padding: '18px', border: '1px solid rgba(212,175,55,0.15)' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', marginBottom: '8px' }}>{t('aboutShopTitle', { name: shop.name })}</h3>
                <p style={{ fontSize: '13px', color: '#B8B8B8', lineHeight: 1.6, margin: 0 }}>{shop.description}</p>
              </div>
            )}

            {/* Business Hours Schedule */}
            <div style={{ background: '#111111', borderRadius: '18px', padding: '18px', border: '1px solid rgba(212,175,55,0.15)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} color="#D4AF37" aria-hidden="true" /> {t('operatingHoursTitle')}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                  <div key={day} style={{ display: 'flex', justifyContent: 'space-between', color: '#B8B8B8', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontWeight: 600 }}>{t(`day_${day}`)}</span>
                    <span style={{ color: shop.opening_time && shop.closing_time ? '#F2D675' : '#888888', fontWeight: 700 }}>
                      {shop.opening_time && shop.closing_time ? `${shop.opening_time} - ${shop.closing_time}` : t('regularBusinessHours')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Location & Contact Information */}
            <div style={{ background: '#111111', borderRadius: '18px', padding: '18px', border: '1px solid rgba(212,175,55,0.15)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={18} color="#D4AF37" aria-hidden="true" /> {t('addressLocationTitle')}
              </h3>
              <div style={{ fontSize: '13px', color: '#B8B8B8', lineHeight: 1.5, marginBottom: '14px' }}>
                <div><strong>{t('localityLabel')}</strong> {shop.area_locality || t('cityCenterFallback')}</div>
                <div><strong>{t('addressFieldLabel')}</strong> {shop.address}</div>
                <div><strong>{t('cityPinLabel')}</strong> {shop.city || t('cityDefaultPune')}, {shop.pincode || '411001'}</div>
                <div><strong>{t('ownerManagerLabel')}</strong> {shop.owner_name}</div>
              </div>

              {shop.latitude && shop.longitude && (
                <div style={{ height: '200px', borderRadius: '14px', overflow: 'hidden', border: '1px solid rgba(212,175,55,0.2)' }}>
                  <MerchantMap
                    shops={[shop]}
                    merchants={[shop]}
                    userLat={Number(shop.latitude)}
                    userLng={Number(shop.longitude)}
                    userLocation={{ lat: Number(shop.latitude), lng: Number(shop.longitude) }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: GALLERY PHOTOS */}
        {activeTab === 'gallery' && (
          <div>
            {(shop.photos || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', background: '#111111', borderRadius: '18px', border: '1px dashed rgba(212,175,55,0.2)', color: '#888888', fontSize: '13px' }}>
                <Camera size={32} color="#D4AF37" style={{ margin: '0 auto 8px auto', opacity: 0.5 }} aria-hidden="true" />
                {t('noGalleryPhotosYet')}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
                {(shop.photos || []).map((photo, idx) => (
                  <div
                    key={photo.id || idx}
                    onClick={() => setSelectedPhotoIndex(idx)}
                    style={{ position: 'relative', height: '140px', borderRadius: '14px', overflow: 'hidden', border: '1px solid rgba(212,175,55,0.2)', cursor: 'pointer' }}
                  >
                    <img
                      src={photo.photo_url}
                      alt={photo.caption || t('storePhotoAlt')}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    {photo.caption && (
                      <div style={{ position: 'absolute', bottom: 0, insetInline: 0, background: 'rgba(0,0,0,0.7)', fontSize: '10px', padding: '4px 6px', color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {photo.caption}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: REVIEWS & RATINGS */}
        {activeTab === 'reviews' && (
          <div>
            {/* Reviews Summary Card */}
            <div style={{
              background: '#111111',
              borderRadius: '20px',
              padding: '20px',
              border: '1px solid rgba(212,175,55,0.2)',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontSize: '36px', fontWeight: 900, color: '#F2D675' }}>
                    {ratingAvg || '0.0'}
                  </span>
                  <span style={{ fontSize: '14px', color: '#888888' }}>/ 5.0</span>
                </div>
                <div style={{ display: 'flex', gap: '2px', margin: '4px 0' }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star
                      key={star}
                      size={16}
                      fill={star <= Math.round(Number(ratingAvg || 0)) ? '#F2D675' : 'transparent'}
                      color="#F2D675"
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <span style={{ fontSize: '12px', color: '#B8B8B8' }}>
                  {t('basedOnReviewsCount', { count: shop.rating_count || 0 })}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsReviewModalOpen(true)}
                className="btn-primary"
                style={{ padding: '10px 18px', fontSize: '13px', borderRadius: '12px' }}
              >
                {t('writeReviewBtn')}
              </button>
            </div>

            {/* Reviews List */}
            {(shop.reviews || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 20px', background: '#111111', borderRadius: '18px', border: '1px dashed rgba(212,175,55,0.2)', color: '#888888', fontSize: '13px' }}>
                {t('beFirstToReview', { name: shop.name })}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {(shop.reviews || []).map(rev => (
                  <div
                    key={rev.id}
                    style={{
                      background: '#111111',
                      borderRadius: '16px',
                      padding: '16px',
                      border: '1px solid rgba(212,175,55,0.12)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)', color: '#050505', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>
                          {(rev.customer_name || 'C').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: '#FFFFFF' }}>{rev.customer_name || t('customerLabel')}</div>
                          <div style={{ fontSize: '11px', color: '#888888' }}>{new Date(rev.created_at).toLocaleDateString(locale)}</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ display: 'flex', gap: '2px' }}>
                          {[1, 2, 3, 4, 5].map(s => (
                            <Star
                              key={s}
                              size={13}
                              fill={s <= rev.rating ? '#F2D675' : 'transparent'}
                              color="#F2D675"
                              aria-hidden="true"
                            />
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleReportReview(rev.id)}
                          title={t('reportReviewAria')}
                          aria-label={t('reportReviewAria')}
                          style={{ background: 'none', border: 'none', color: '#666666', cursor: 'pointer', padding: '2px' }}
                        >
                          <Flag size={13} aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <p style={{ fontSize: '13px', color: '#DDDDDD', margin: '6px 0', lineHeight: 1.5 }}>
                      {rev.comment}
                    </p>

                    {rev.photo_url && (
                      <img
                        src={rev.photo_url}
                        alt={t('reviewPhotoAlt')}
                        style={{ width: '80px', height: '80px', borderRadius: '10px', objectFit: 'cover', marginTop: '6px', border: '1px solid rgba(212,175,55,0.2)' }}
                      />
                    )}

                    {/* Merchant Reply Section */}
                    {rev.merchant_reply && (
                      <div style={{
                        marginTop: '12px',
                        background: '#161616',
                        borderLeft: '3px solid #D4AF37',
                        borderRadius: '0 10px 10px 0',
                        padding: '10px 14px',
                        fontSize: '12px'
                      }}>
                        <div style={{ fontWeight: 800, color: '#D4AF37', marginBottom: '2px' }}>
                          {t('responseFromMerchant')}
                        </div>
                        <p style={{ color: '#B8B8B8', margin: 0, lineHeight: 1.4 }}>
                          {rev.merchant_reply}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* WRITE A REVIEW MODAL */}
      {isReviewModalOpen && (
        <div role="dialog" aria-modal="true" aria-label={t('reviewShopModalTitle', { name: shop.name })} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#111111', borderRadius: '24px', maxWidth: '480px', width: '100%', padding: '24px', border: '1px solid rgba(212,175,55,0.3)', boxShadow: '0 20px 50px rgba(0,0,0,0.9)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>{t('reviewShopModalTitle', { name: shop.name })}</h3>
              <button type="button" aria-label={t('closeBtn')} onClick={() => setIsReviewModalOpen(false)} style={{ background: 'none', border: 'none', color: '#888888', cursor: 'pointer' }}>
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            {reviewSuccess && (
              <div style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid #10b981', color: '#10b981', padding: '10px', borderRadius: '10px', fontSize: '13px', textAlign: 'center', marginBottom: '12px' }}>
                {reviewSuccess}
              </div>
            )}

            {reviewError && (
              <div role="alert" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', color: '#ef4444', padding: '10px', borderRadius: '10px', fontSize: '13px', textAlign: 'center', marginBottom: '12px' }}>
                {reviewError}
              </div>
            )}

            <form onSubmit={handleSubmitReview}>
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <span style={{ fontSize: '12px', color: '#888888', display: 'block', marginBottom: '8px' }}>{t('selectStarRating')}</span>
                <div style={{ display: 'inline-flex', gap: '8px' }}>
                  {[1, 2, 3, 4, 5].map(num => (
                    <button
                      type="button"
                      key={num}
                      aria-label={`${num}`}
                      onClick={() => setRatingInput(num)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                    >
                      <Star
                        size={32}
                        fill={num <= ratingInput ? '#F2D675' : 'transparent'}
                        color="#F2D675"
                        aria-hidden="true"
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', color: '#B8B8B8', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  {t('experienceFeedbackLabel')}
                </label>
                <textarea
                  className="form-input"
                  rows={4}
                  required
                  placeholder={t('experienceFeedbackPlaceholder')}
                  value={reviewTextInput}
                  onChange={e => setReviewTextInput(e.target.value)}
                  style={{ width: '100%', borderRadius: '12px', padding: '12px', fontSize: '13px', resize: 'vertical' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '12px', color: '#B8B8B8', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  {t('uploadPhotoOptional')}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleReviewPhotoUpload}
                  style={{ fontSize: '12px', color: '#888888' }}
                />
                {reviewPhoto && (
                  <div style={{ marginTop: '8px' }}>
                    <img src={reviewPhoto} alt={t('reviewPhotoPreviewAlt')} style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover' }} />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(false)}
                  className="btn-secondary"
                  style={{ flex: 1, padding: '12px', justifyContent: 'center' }}
                >
                  {t('cancelBtn')}
                </button>
                <button
                  type="submit"
                  disabled={reviewSubmitting}
                  className="btn-primary"
                  style={{ flex: 1, padding: '12px', justifyContent: 'center' }}
                >
                  {reviewSubmitting ? t('submittingBtn') : t('submitReviewBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ORDER / INQUIRY MODAL */}
      {isOrderModalOpen && selectedProduct && (
        <div role="dialog" aria-modal="true" aria-label={t('placeOrderInquiryTitle')} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#111111', borderRadius: '24px', maxWidth: '440px', width: '100%', padding: '24px', border: '1px solid rgba(212,175,55,0.3)', boxShadow: '0 20px 50px rgba(0,0,0,0.9)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>{t('placeOrderInquiryTitle')}</h3>
              <button type="button" aria-label={t('closeBtn')} onClick={() => setIsOrderModalOpen(false)} style={{ background: 'none', border: 'none', color: '#888888', cursor: 'pointer' }}>
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            {orderSuccessMsg && (
              <div style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid #10b981', color: '#10b981', padding: '12px', borderRadius: '12px', fontSize: '13px', textAlign: 'center', marginBottom: '14px' }}>
                ✅ {orderSuccessMsg}
              </div>
            )}

            <form onSubmit={handleSubmitOrder}>
              <div style={{ background: '#171717', padding: '14px', borderRadius: '14px', marginBottom: '16px', border: '1px solid rgba(212,175,55,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF' }}>{selectedProduct.name}</span>
                  <span style={{ fontSize: '16px', fontWeight: 800, color: '#F2D675' }}>{Number(selectedProduct.price || 0).toLocaleString(locale)}</span>
                </div>
                {selectedProduct.description && (
                  <p style={{ fontSize: '12px', color: '#888888', margin: '4px 0 0 0' }}>{selectedProduct.description}</p>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '13px', color: '#B8B8B8', fontWeight: 600 }}>{t('quantityLabel')}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setOrderQuantity(Math.max(1, orderQuantity - 1))}
                    style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.2)', color: '#FFFFFF', fontSize: '16px', fontWeight: 800, cursor: 'pointer' }}
                  >
                    -
                  </button>
                  <span style={{ fontSize: '16px', fontWeight: 800, color: '#F2D675', minWidth: '24px', textAlign: 'center' }}>
                    {orderQuantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOrderQuantity(orderQuantity + 1)}
                    style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.2)', color: '#FFFFFF', fontSize: '16px', fontWeight: 800, cursor: 'pointer' }}
                  >
                    +
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', color: '#B8B8B8', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  {t('contactPhoneNumberLabel')}
                </label>
                <input
                  type="tel"
                  required
                  className="form-input"
                  placeholder={t('mobileNumberPlaceholder')}
                  value={orderPhone}
                  onChange={e => setOrderPhone(e.target.value)}
                  style={{ width: '100%', borderRadius: '12px', padding: '10px 14px', fontSize: '13px' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '12px', color: '#B8B8B8', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  {t('specialInstructionsLabel')}
                </label>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder={t('specialInstructionsPlaceholder')}
                  value={orderNotes}
                  onChange={e => setOrderNotes(e.target.value)}
                  style={{ width: '100%', borderRadius: '12px', padding: '10px 14px', fontSize: '13px', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '10px 14px', background: '#151515', borderRadius: '12px', border: '1px dashed rgba(212,175,55,0.3)' }}>
                <span style={{ fontSize: '13px', color: '#B8B8B8' }}>{t('estimatedTotalLabel')}</span>
                <span style={{ fontSize: '18px', fontWeight: 900, color: '#F2D675' }}>
                  {((selectedProduct.price || 0) * orderQuantity).toLocaleString(locale)}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsOrderModalOpen(false)}
                  className="btn-secondary"
                  style={{ flex: 1, padding: '12px', justifyContent: 'center' }}
                >
                  {t('cancelBtn')}
                </button>
                <button
                  type="submit"
                  disabled={orderSubmitting}
                  className="btn-primary"
                  style={{ flex: 1, padding: '12px', justifyContent: 'center' }}
                >
                  {orderSubmitting ? t('placingOrderBtn') : t('submitInquiryBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GALLERY LIGHTBOX MODAL */}
      {selectedPhotoIndex !== null && shop.photos?.[selectedPhotoIndex] && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedPhotoIndex(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
        >
          <button
            type="button"
            aria-label={t('closeBtn')}
            onClick={() => setSelectedPhotoIndex(null)}
            style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: '#FFFFFF', cursor: 'pointer' }}
          >
            <X size={28} aria-hidden="true" />
          </button>
          <img
            src={shop.photos[selectedPhotoIndex].photo_url}
            alt={t('fullSizePreviewAlt')}
            style={{ maxWidth: '90%', maxHeight: '80vh', borderRadius: '14px', objectFit: 'contain' }}
          />
        </div>
      )}
    </div>
  );
}
