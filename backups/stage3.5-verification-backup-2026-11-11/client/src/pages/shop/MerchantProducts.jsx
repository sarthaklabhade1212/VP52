import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { Tag, Plus, Trash2, Edit3, CheckCircle2, XCircle, ShoppingBag, ArrowLeft, Camera } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function MerchantProducts() {
  const { token } = useAuth();
  const { t, locale, translateCategory } = useI18n();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Product fields
  const [name, setName] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [price, setPrice] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [category, setCategory] = useState('General');
  const [productType, setProductType] = useState('product'); // 'product', 'food', 'service', 'course'
  const [vegNonVeg, setVegNonVeg] = useState('veg');
  const [foodCategory, setFoodCategory] = useState('');
  const [specialOffer, setSpecialOffer] = useState('');
  const [fabric, setFabric] = useState('');
  const [colour, setColour] = useState('');
  const [size, setSize] = useState('');
  const [brand, setBrand] = useState('');
  const [specifications, setSpecifications] = useState('');
  const [warranty, setWarranty] = useState('');
  const [duration, setDuration] = useState('');
  const [timings, setTimings] = useState('');
  const [rewardEligible, setRewardEligible] = useState(true);
  const [rewardPercent, setRewardPercent] = useState(10);
  const [description, setDescription] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  const fetchProducts = () => {
    fetch('/api/merchant/products', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => { if (data.success) setProducts(data.products || []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProducts();
  }, [token]);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const res = await fetch('/api/upload/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ image: evt.target.result, folder: 'products' })
        });
        const data = await res.json();
        if (data.success && data.url) {
          setPhotoUrl(data.url);
        } else {
          alert(`${t('uploadFailedPrefix')} ${data.error || t('serverErrorFallback')}`);
        }
      } catch (err) {
        alert(err.message);
      } finally {
        setUploadingImage(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleOpenEdit = (p) => {
    setEditingId(p.id);
    setName(p.name || '');
    setPhotoUrl(p.photo_url || '');
    setPrice(p.price || '');
    setPriceMax(p.price_max || '');
    setCategory(p.category || 'General');
    setProductType(p.product_type || 'product');
    setVegNonVeg(p.veg_non_veg || 'veg');
    setFoodCategory(p.food_category || '');
    setSpecialOffer(p.special_offer || '');
    setFabric(p.fabric || '');
    setColour(p.colour || '');
    setSize(p.size || '');
    setBrand(p.brand || '');
    setSpecifications(p.specifications || '');
    setWarranty(p.warranty || '');
    setDuration(p.duration || '');
    setTimings(p.timings || '');
    setRewardEligible(!!p.reward_eligible);
    setRewardPercent(p.reward_percent || 10);
    setDescription(p.description || '');
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const payload = {
      name,
      photo_url: photoUrl,
      price: Number(price),
      price_max: priceMax ? Number(priceMax) : null,
      category,
      product_type: productType,
      veg_non_veg: productType === 'food' ? vegNonVeg : null,
      food_category: productType === 'food' ? foodCategory : null,
      special_offer: specialOffer,
      fabric,
      colour,
      size,
      brand,
      specifications,
      warranty,
      duration,
      timings,
      reward_eligible: rewardEligible,
      reward_percent: Number(rewardPercent),
      description
    };

    const url = editingId ? `/api/merchant/products/${editingId}` : '/api/merchant/products';
    const method = editingId ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        resetForm();
        fetchProducts();
      } else {
        alert(data.error || t('failedSaveProduct'));
      }
    } catch (e) {
      alert(e.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('deleteCatalogConfirm'))) return;
    try {
      await fetch(`/api/merchant/products/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchProducts();
    } catch (e) {
      console.error(e);
    }
  };

  const resetForm = () => {
    setName('');
    setPhotoUrl('');
    setPrice('');
    setPriceMax('');
    setCategory('General');
    setProductType('product');
    setVegNonVeg('veg');
    setFoodCategory('');
    setSpecialOffer('');
    setFabric('');
    setColour('');
    setSize('');
    setBrand('');
    setSpecifications('');
    setWarranty('');
    setDuration('');
    setTimings('');
    setRewardEligible(true);
    setRewardPercent(10);
    setDescription('');
    setEditingId(null);
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', background: '#050505', color: '#FFFFFF' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            aria-label={t('goBackAria')}
            onClick={() => navigate('/shop/dashboard')}
            style={{ background: 'none', border: 'none', color: '#D4AF37', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          <div>
            <h2 style={{ fontSize: '22px', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, margin: 0 }}>
              <ShoppingBag size={24} color="#D4AF37" /> {t('catalogMenuServicesTitle')}
            </h2>
            <p style={{ fontSize: '13px', color: '#888888', margin: '4px 0 0 0' }}>
              {t('catalogMenuServicesSub')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="btn-primary"
          style={{ padding: '10px 18px', borderRadius: '12px', fontSize: '13px' }}
        >
          <Plus size={16} color="#050505" aria-hidden="true" /> {t('addItemBtn')}
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '30px', color: '#888888' }}>{t('loadingCatalog')}</div>
      ) : products.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', background: '#111111', borderRadius: '18px', border: '1px dashed rgba(212,175,55,0.2)', color: '#888888', fontSize: '13px' }}>
          <ShoppingBag size={36} color="#D4AF37" style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
          {t('emptyCatalogHint')}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '16px' }}>
          {products.map(p => (
            <div key={p.id} style={{ background: '#111111', borderRadius: '18px', padding: '16px', border: '1px solid rgba(212, 175, 55, 0.15)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                {p.photo_url && (
                  <div style={{ height: '110px', borderRadius: '12px', overflow: 'hidden', marginBottom: '12px', background: '#151515' }}>
                    <img src={p.photo_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#D4AF37', fontWeight: 800 }}>{translateCategory(p.category)}</span>
                  {p.veg_non_veg && (
                    <span style={{ fontSize: '10px', fontWeight: 800, color: p.veg_non_veg === 'veg' ? '#10b981' : '#ef4444' }}>
                      {p.veg_non_veg === 'veg' ? t('vegLabel') : t('nonVegLabel')}
                    </span>
                  )}
                </div>

                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF', margin: '2px 0 4px 0' }}>{p.name}</h3>
                <div style={{ fontSize: '18px', fontWeight: 900, color: '#F2D675', marginBottom: '6px' }}>
                  {Number(p.price || 0).toLocaleString(locale)}
                  {p.price_max && p.price_max > p.price && (
                    <span style={{ fontSize: '13px', color: '#888888', marginLeft: '4px' }}>- {Number(p.price_max).toLocaleString(locale)}</span>
                  )}
                </div>

                {p.description && (
                  <p style={{ fontSize: '12px', color: '#888888', margin: '0 0 8px 0', lineHeight: 1.4 }}>{p.description}</p>
                )}

                {/* Attributes pill */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', fontSize: '11px', color: '#B8B8B8', marginBottom: '8px' }}>
                  {p.duration && <span style={{ background: '#1A1A1A', padding: '2px 6px', borderRadius: '4px' }}>⏳ {p.duration}</span>}
                  {p.fabric && <span style={{ background: '#1A1A1A', padding: '2px 6px', borderRadius: '4px' }}>{t('specFabric', { val: p.fabric })}</span>}
                  {p.size && <span style={{ background: '#1A1A1A', padding: '2px 6px', borderRadius: '4px' }}>{t('specSize', { val: p.size })}</span>}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <span className={p.reward_eligible ? 'badge badge-active' : 'badge badge-expired'} style={{ fontSize: '10px' }}>
                  {p.reward_eligible ? t('coinsPercentBadge', { percent: p.reward_percent }) : t('noCoinsBadge')}
                </span>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" aria-label={t('editItemAria')} onClick={() => handleOpenEdit(p)} style={{ border: 'none', background: 'none', color: '#D4AF37', cursor: 'pointer', padding: '4px' }}>
                    <Edit3 size={16} aria-hidden="true" />
                  </button>
                  <button type="button" aria-label={t('deleteItemAria')} onClick={() => handleDelete(p.id)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}>
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Item Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editingId ? t('editCatalogItemTitle') : t('addCatalogItemTitle')}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
        >
          <div style={{ background: '#111111', border: '1px solid rgba(212, 175, 55, 0.3)', borderRadius: '24px', maxWidth: '520px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>
            <h3 style={{ fontSize: '18px', color: '#FFFFFF', marginBottom: '16px', fontWeight: 800 }}>
              {editingId ? t('editCatalogItemTitle') : t('addCatalogItemTitle')}
            </h3>

            <form onSubmit={handleSaveProduct} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8', marginBottom: '4px', display: 'block' }}>{t('typeOfItemRequired')}</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {['product', 'food', 'service', 'course'].map(itemType => (
                    <button
                      key={itemType}
                      type="button"
                      onClick={() => setProductType(itemType)}
                      style={{
                        padding: '8px 4px',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontWeight: 700,
                        border: productType === itemType ? '1px solid #D4AF37' : '1px solid rgba(255,255,255,0.1)',
                        background: productType === itemType ? 'rgba(212,175,55,0.15)' : '#161616',
                        color: productType === itemType ? '#F2D675' : '#888888',
                        cursor: 'pointer'
                      }}
                    >
                      {t(`itemType_${itemType}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8', marginBottom: '4px', display: 'block' }}>{t('itemNameRequiredLabel')}</label>
                <input type="text" required className="form-input" placeholder={t('itemNamePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%', borderRadius: '10px', padding: '10px' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8', marginBottom: '4px', display: 'block' }}>{t('basePriceRequiredLabel')}</label>
                  <input type="number" required className="form-input" placeholder="e.g. 280" value={price} onChange={(e) => setPrice(e.target.value)} style={{ width: '100%', borderRadius: '10px', padding: '10px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8', marginBottom: '4px', display: 'block' }}>{t('maxPriceOptionalLabel')}</label>
                  <input type="number" className="form-input" placeholder="e.g. 350" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} style={{ width: '100%', borderRadius: '10px', padding: '10px' }} />
                </div>
              </div>

              {/* Food-specific options */}
              {productType === 'food' && (
                <div style={{ background: '#161616', padding: '12px', borderRadius: '12px', border: '1px solid rgba(212,175,55,0.2)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: '#B8B8B8', display: 'block', marginBottom: '4px' }}>{t('vegNonVegLabel')}</label>
                      <select value={vegNonVeg} onChange={e => setVegNonVeg(e.target.value)} className="form-input" style={{ width: '100%', padding: '8px', borderRadius: '8px', background: '#111', color: '#FFF' }}>
                        <option value="veg">{t('vegLabel')}</option>
                        <option value="non-veg">{t('nonVegLabel')}</option>
                        <option value="egg">{t('eggOptionLabel')}</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: '#B8B8B8', display: 'block', marginBottom: '4px' }}>{t('foodSectionLabel')}</label>
                      <input type="text" placeholder={t('foodSectionPlaceholder')} value={foodCategory} onChange={e => setFoodCategory(e.target.value)} className="form-input" style={{ width: '100%', padding: '8px', borderRadius: '8px' }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Service/Course specific options */}
              {(productType === 'service' || productType === 'course') && (
                <div style={{ background: '#161616', padding: '12px', borderRadius: '12px', border: '1px solid rgba(212,175,55,0.2)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: '#B8B8B8', display: 'block', marginBottom: '4px' }}>{t('durationFieldLabel')}</label>
                      <input type="text" placeholder={t('durationPlaceholder')} value={duration} onChange={e => setDuration(e.target.value)} className="form-input" style={{ width: '100%', padding: '8px', borderRadius: '8px' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: '#B8B8B8', display: 'block', marginBottom: '4px' }}>{t('batchTimingsLabel')}</label>
                      <input type="text" placeholder={t('batchTimingsPlaceholder')} value={timings} onChange={e => setTimings(e.target.value)} className="form-input" style={{ width: '100%', padding: '8px', borderRadius: '8px' }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Product specific options */}
              {productType === 'product' && (
                <div style={{ background: '#161616', padding: '12px', borderRadius: '12px', border: '1px solid rgba(212,175,55,0.2)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: '#B8B8B8', display: 'block', marginBottom: '4px' }}>{t('fabricMaterialLabel')}</label>
                      <input type="text" placeholder={t('fabricMaterialPlaceholder')} value={fabric} onChange={e => setFabric(e.target.value)} className="form-input" style={{ width: '100%', padding: '8px', borderRadius: '8px' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: '#B8B8B8', display: 'block', marginBottom: '4px' }}>{t('sizeFieldLabel')}</label>
                      <input type="text" placeholder={t('sizeFieldPlaceholder')} value={size} onChange={e => setSize(e.target.value)} className="form-input" style={{ width: '100%', padding: '8px', borderRadius: '8px' }} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: '#B8B8B8', display: 'block', marginBottom: '4px' }}>{t('brandFieldLabel')}</label>
                      <input type="text" placeholder={t('brandFieldPlaceholder')} value={brand} onChange={e => setBrand(e.target.value)} className="form-input" style={{ width: '100%', padding: '8px', borderRadius: '8px' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: '#B8B8B8', display: 'block', marginBottom: '4px' }}>{t('warrantyFieldLabel')}</label>
                      <input type="text" placeholder={t('warrantyFieldPlaceholder')} value={warranty} onChange={e => setWarranty(e.target.value)} className="form-input" style={{ width: '100%', padding: '8px', borderRadius: '8px' }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Photo Upload */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8', marginBottom: '4px', display: 'block' }}>{t('photoFieldLabel')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input type="file" accept="image/*" onChange={handleImageUpload} style={{ fontSize: '11px', color: '#888888' }} />
                  {photoUrl && (
                    <img src={photoUrl} alt={t('photoFieldLabel')} style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover' }} />
                  )}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8', marginBottom: '4px', display: 'block' }}>{t('descriptionOptionalLabel')}</label>
                <textarea className="form-input" rows={2} placeholder={t('descriptionOptionalPlaceholder')} value={description} onChange={(e) => setDescription(e.target.value)} style={{ width: '100%', borderRadius: '10px', padding: '10px', fontSize: '12px' }} />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary" style={{ flex: 1, padding: '12px', justifyContent: 'center' }}>{t('cancelBtn')}</button>
                <button type="submit" disabled={uploadingImage} className="btn-primary" style={{ flex: 1, padding: '12px', justifyContent: 'center' }}>{t('saveItemBtn')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
