import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import {
  Tags,
  Plus,
  Edit2,
  Trash2,
  Search,
  Store,
  Layers,
  CheckCircle2,
  X,
  AlertTriangle,
  RefreshCw,
  FolderTree,
  ArrowRight
} from 'lucide-react';
import CategoryIcon from '../../components/CategoryIcon';

export default function AdminCategories() {
  const { token } = useAuth();
  const { t, translateCategory, translateSubcategory } = useI18n();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  // Subcategories Manager Modal State
  const [subcatModalCategory, setSubcatModalCategory] = useState(null);
  const [newSubcatName, setNewSubcatName] = useState('');
  const [subcatLoading, setSubcatLoading] = useState(false);

  // Safe Deletion Modal State
  const [deletingCategory, setDeletingCategory] = useState(null);
  const [targetReassignCat, setTargetReassignCat] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    icon: 'Store',
    catalog_type: 'product',
    color: '#D4AF37',
    description: '',
    display_order: 1,
    subcategories: ''
  });

  const fetchCategories = () => {
    setLoading(true);
    fetch('/api/admin/categories', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(d => {
        if (d.success) setCategories(d.categories || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) fetchCategories();
  }, [token]);

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      icon: 'Store',
      catalog_type: 'product',
      color: '#D4AF37',
      description: '',
      display_order: categories.length + 1,
      subcategories: ''
    });
    setModalError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cat) => {
    setEditingCategory(cat);
    setFormData({
      name: cat.name,
      icon: cat.icon || 'Store',
      catalog_type: cat.catalog_type || 'product',
      color: cat.color || '#D4AF37',
      description: cat.description || '',
      display_order: cat.display_order || 1,
      subcategories: ''
    });
    setModalError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setModalError('');

    const subcats = formData.subcategories
      ? formData.subcategories.split(',').map(s => s.trim()).filter(Boolean)
      : undefined;

    const url = editingCategory ? `/api/admin/categories/${editingCategory.id}` : '/api/admin/categories';
    const method = editingCategory ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          subcategories: subcats
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setModalError(data.error || t('failedSaveCategoryErr'));
      } else {
        setIsModalOpen(false);
        fetchCategories();
      }
    } catch (err) {
      setModalError(err.message || t('networkErrorGeneric'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddSubcategory = async (e) => {
    e.preventDefault();
    if (!newSubcatName.trim() || !subcatModalCategory) return;
    setSubcatLoading(true);

    try {
      const res = await fetch(`/api/admin/categories/${subcatModalCategory.id}/subcategories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newSubcatName.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNewSubcatName('');
        // Update local subcategories
        const updatedSubcats = [...(subcatModalCategory.subcategories || []), { id: data.id, name: newSubcatName.trim() }];
        setSubcatModalCategory({ ...subcatModalCategory, subcategories: updatedSubcats });
        fetchCategories();
      } else {
        alert(data.error || t('failedAddSubcatErr'));
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setSubcatLoading(false);
    }
  };

  const handleDeleteSubcategory = async (subId) => {
    if (!window.confirm(t('deleteSubcatConfirm'))) return;
    try {
      const res = await fetch(`/api/admin/subcategories/${subId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSubcatModalCategory({
          ...subcatModalCategory,
          subcategories: subcatModalCategory.subcategories.filter(s => s.id !== subId)
        });
        fetchCategories();
      } else {
        alert(data.error || t('cannotDeleteSubcatErr'));
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deletingCategory) return;
    setDeleteError('');

    try {
      const res = await fetch(`/api/admin/categories/${deletingCategory.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          target_category_id: targetReassignCat || undefined
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setDeleteError(data.error || t('cannotDeleteCategoryErr'));
      } else {
        setDeletingCategory(null);
        setTargetReassignCat('');
        fetchCategories();
      }
    } catch (err) {
      setDeleteError(err.message);
    }
  };

  const searchLower = search.toLowerCase();
  const filtered = categories.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchLower) ||
                          translateCategory(c.name).toLowerCase().includes(searchLower) ||
                          (c.description || '').toLowerCase().includes(searchLower) ||
                          c.id.toLowerCase().includes(searchLower);
    const matchesType = typeFilter === 'all' || c.catalog_type === typeFilter;
    return matchesSearch && matchesType;
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
            {t('adminCategoriesTitle')}
          </h1>
          <p style={{ fontSize: '12px', color: '#A0A0A0', margin: '4px 0 0 0' }}>
            {t('adminCategoriesSub')}
          </p>
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            style={{
              background: '#141414', border: '1px solid rgba(212, 175, 55, 0.25)',
              color: '#FFFFFF', borderRadius: '10px', padding: '8px 12px', fontSize: '12px', outline: 'none'
            }}
          >
            <option value="all">{t('allCatalogTypes')}</option>
            <option value="product">{t('catalogType_product')}</option>
            <option value="restaurant">{t('catalogType_restaurant')}</option>
            <option value="service">{t('catalogType_service')}</option>
            <option value="course">{t('catalogType_course')}</option>
          </select>

          <div style={{ position: 'relative', width: '240px' }}>
            <Search size={16} color="#D4AF37" style={{ position: 'absolute', left: '12px', top: '10px' }} />
            <input
              type="text"
              placeholder={t('searchCategoriesPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.25)',
                color: '#FFFFFF', borderRadius: '10px', padding: '8px 12px 8px 36px', fontSize: '12px', outline: 'none'
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
            <Plus size={16} /> {t('addCategoryBtn')}
          </button>
        </div>
      </div>

      {/* Categories Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '16px'
      }}>
        {filtered.map(cat => {
          const subcats = Array.isArray(cat.subcategories) ? cat.subcategories : [];
          return (
            <div
              key={cat.id}
              style={{
                background: '#0E0E0E',
                border: '1px solid rgba(212, 175, 55, 0.2)',
                borderRadius: '16px',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
              }}
            >
              <div>
                {/* Category Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '42px', height: '42px', borderRadius: '12px',
                      background: 'rgba(212, 175, 55, 0.1)', border: '1px solid rgba(212, 175, 55, 0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <CategoryIcon iconName={cat.icon} size={22} color={cat.color || '#D4AF37'} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                        {translateCategory(cat.name)}
                      </h3>
                      <span style={{ fontSize: '10px', color: '#888', fontWeight: 600 }}>
                        {t('catIdOrderLine', { id: cat.id, order: cat.display_order })}
                      </span>
                    </div>
                  </div>

                  <span style={{
                    padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 800,
                    textTransform: 'uppercase', background: 'rgba(212, 175, 55, 0.15)', color: '#F2D675',
                    border: '1px solid rgba(212, 175, 55, 0.3)'
                  }}>
                    {t(`catalogType_${cat.catalog_type || 'product'}`)}
                  </span>
                </div>

                {cat.description && (
                  <p style={{ fontSize: '12px', color: '#A0A0A0', margin: '0 0 12px 0', lineHeight: 1.4 }}>
                    {cat.description}
                  </p>
                )}

                {/* Subcategories Summary */}
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#D4AF37' }}>
                      {t('subcategoriesCountAdmin', { count: subcats.length })}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSubcatModalCategory(cat)}
                      style={{ background: 'none', border: 'none', color: '#F2D675', fontSize: '11px', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                    >
                      {t('manageBtn')}
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '68px', overflowY: 'hidden' }}>
                    {subcats.slice(0, 5).map((s, idx) => (
                      <span
                        key={idx}
                        style={{
                          background: '#161616', border: '1px solid rgba(255, 255, 255, 0.1)',
                          padding: '3px 7px', borderRadius: '6px', fontSize: '10px', color: '#C0C0C0'
                        }}
                      >
                        {translateSubcategory(typeof s === 'string' ? s : s.name)}
                      </span>
                    ))}
                    {subcats.length > 5 && (
                      <span style={{ fontSize: '10px', color: '#888', padding: '3px 4px' }}>
                        {t('moreCountLabel', { count: subcats.length - 5 })}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Footer: Merchant count & Actions */}
              <div style={{
                paddingTop: '12px',
                borderTop: '1px solid rgba(212, 175, 55, 0.12)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#A0A0A0' }}>
                  <Store size={14} color="#D4AF37" />
                  <span>
                    {t((cat.shop_count || 0) === 1 ? 'assignedShopSingle' : 'assignedShopPlural', { count: cat.shop_count || 0 })}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(cat)}
                    title={t('adminEditBtn')}
                    style={{
                      background: '#161616', border: '1px solid rgba(212, 175, 55, 0.3)',
                      color: '#F2D675', padding: '6px 10px', borderRadius: '8px', fontSize: '11px',
                      fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                    }}
                  >
                    <Edit2 size={12} /> {t('adminEditBtn')}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDeletingCategory(cat);
                      setDeleteError('');
                      setTargetReassignCat('');
                    }}
                    title={t('adminDeleteBtn')}
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444',
                      color: '#ef4444', padding: '6px 10px', borderRadius: '8px', fontSize: '11px',
                      fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                    }}
                  >
                    <Trash2 size={12} /> {t('adminDeleteBtn')}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Category Modal */}
      {isModalOpen && (
        <div role="dialog" aria-modal="true" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#0E0E0E', border: '1px solid #D4AF37', borderRadius: '16px',
            width: '520px', maxWidth: '100%', padding: '24px', boxShadow: '0 16px 40px rgba(0,0,0,0.9)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                {editingCategory ? t('editCategoryTitle', { name: translateCategory(editingCategory.name) }) : t('addMasterCategoryTitle')}
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                    {t('categoryNameRequired')}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={t('categoryNamePlaceholder')}
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    style={{
                      width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.3)',
                      borderRadius: '8px', padding: '8px 10px', color: '#FFFFFF', fontSize: '13px', outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                    {t('catalogTypeRequired')}
                  </label>
                  <select
                    value={formData.catalog_type}
                    onChange={e => setFormData({ ...formData, catalog_type: e.target.value })}
                    style={{
                      width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.3)',
                      borderRadius: '8px', padding: '8px 10px', color: '#FFFFFF', fontSize: '13px', outline: 'none'
                    }}
                  >
                    <option value="product">{t('catalogType_product')}</option>
                    <option value="restaurant">{t('catalogType_restaurant')}</option>
                    <option value="service">{t('catalogType_service')}</option>
                    <option value="course">{t('catalogType_course')}</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                    {t('lucideIconNameLabel')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('lucideIconPlaceholder')}
                    value={formData.icon}
                    onChange={e => setFormData({ ...formData, icon: e.target.value })}
                    style={{
                      width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.3)',
                      borderRadius: '8px', padding: '8px 10px', color: '#FFFFFF', fontSize: '13px', outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                    {t('displayOrderLabel')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.display_order}
                    onChange={e => setFormData({ ...formData, display_order: parseInt(e.target.value) || 1 })}
                    style={{
                      width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.3)',
                      borderRadius: '8px', padding: '8px 10px', color: '#FFFFFF', fontSize: '13px', outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                  {t('descriptionLabel')}
                </label>
                <textarea
                  rows={2}
                  placeholder={t('categoryDescPlaceholder')}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  style={{
                    width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.3)',
                    borderRadius: '8px', padding: '8px 10px', color: '#FFFFFF', fontSize: '12px', outline: 'none', resize: 'none'
                  }}
                />
              </div>

              {!editingCategory && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                    {t('initialSubcatsLabel')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('initialSubcatsPlaceholder')}
                    value={formData.subcategories}
                    onChange={e => setFormData({ ...formData, subcategories: e.target.value })}
                    style={{
                      width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.3)',
                      borderRadius: '8px', padding: '8px 10px', color: '#FFFFFF', fontSize: '12px', outline: 'none'
                    }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', background: '#1A1A1A',
                    border: '1px solid #333', color: '#888', fontSize: '12px', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  {t('cancelBtn')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '8px 20px', borderRadius: '8px',
                    background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)',
                    border: 'none', color: '#050505', fontSize: '12px', fontWeight: 900, cursor: 'pointer'
                  }}
                >
                  {isSubmitting ? t('adminSavingProgress') : editingCategory ? t('updateCategoryBtn') : t('createCategoryBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subcategories Manager Modal */}
      {subcatModalCategory && (
        <div role="dialog" aria-modal="true" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#0E0E0E', border: '1px solid #D4AF37', borderRadius: '16px',
            width: '480px', maxWidth: '100%', padding: '24px', boxShadow: '0 16px 40px rgba(0,0,0,0.9)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                  {t('subcategoriesOfTitle', { name: translateCategory(subcatModalCategory.name) })}
                </h3>
                <span style={{ fontSize: '11px', color: '#A0A0A0' }}>
                  {t('manageIndividualSubcatsSub')}
                </span>
              </div>
              <button type="button" aria-label={t('closeModalAria')} onClick={() => setSubcatModalCategory(null)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {/* Add Subcategory Form */}
            <form onSubmit={handleAddSubcategory} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input
                type="text"
                required
                placeholder={t('newSubcatPlaceholder')}
                value={newSubcatName}
                onChange={e => setNewSubcatName(e.target.value)}
                style={{
                  flex: 1, background: '#141414', border: '1px solid rgba(212, 175, 55, 0.3)',
                  borderRadius: '8px', padding: '8px 12px', color: '#FFFFFF', fontSize: '13px', outline: 'none'
                }}
              />
              <button
                type="submit"
                disabled={subcatLoading}
                style={{
                  padding: '8px 16px', borderRadius: '8px',
                  background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)',
                  border: 'none', color: '#050505', fontSize: '12px', fontWeight: 800, cursor: 'pointer'
                }}
              >
                {t('addBtn')}
              </button>
            </form>

            {/* Subcategories List */}
            <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {(subcatModalCategory.subcategories || []).map((sub, idx) => {
                const sName = typeof sub === 'string' ? sub : sub.name;
                const sId = typeof sub === 'object' ? sub.id : null;
                return (
                  <div
                    key={idx}
                    style={{
                      padding: '8px 12px', background: '#141414', borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex',
                      justifyContent: 'space-between', alignItems: 'center'
                    }}
                  >
                    <span style={{ fontSize: '12px', color: '#FFFFFF' }}>{translateSubcategory(sName)}</span>
                    {sId && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSubcategory(sId)}
                        title={t('adminDeleteBtn')}
                        aria-label={t('adminDeleteBtn')}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Safe Category Deletion Dialog (Dependency Check) */}
      {deletingCategory && (
        <div role="dialog" aria-modal="true" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#0E0E0E', border: '1px solid #ef4444', borderRadius: '16px',
            width: '460px', maxWidth: '100%', padding: '24px', boxShadow: '0 16px 40px rgba(0,0,0,0.9)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <AlertTriangle size={24} color="#ef4444" />
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                {t('deleteCategoryTitle', { name: translateCategory(deletingCategory.name) })}
              </h3>
            </div>

            {deleteError && (
              <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', color: '#ef4444', fontSize: '12px', marginBottom: '14px' }}>
                {deleteError}
              </div>
            )}

            {deletingCategory.shop_count > 0 ? (
              <div>
                <p style={{ fontSize: '13px', color: '#fca5a5', lineHeight: 1.4, margin: '0 0 14px 0' }}>
                  <strong>{t('safetyGuardTitle')}</strong> {t('safetyGuardBody', { count: deletingCategory.shop_count })}
                </p>

                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '6px' }}>
                  {t('targetReplacementCatRequired')}
                </label>
                <select
                  value={targetReassignCat}
                  onChange={e => setTargetReassignCat(e.target.value)}
                  style={{
                    width: '100%', background: '#141414', border: '1px solid #D4AF37',
                    borderRadius: '8px', padding: '10px', color: '#FFFFFF', fontSize: '13px', outline: 'none', marginBottom: '18px'
                  }}
                >
                  <option value="">{t('selectReplacementCatOpt')}</option>
                  {categories.filter(c => c.id !== deletingCategory.id).map(c => (
                    <option key={c.id} value={c.id}>{translateCategory(c.name)}</option>
                  ))}
                </select>
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: '#C0C0C0', lineHeight: 1.4, margin: '0 0 18px 0' }}>
                {t('confirmDeleteZeroShops', { name: translateCategory(deletingCategory.name) })}
              </p>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setDeletingCategory(null)}
                style={{
                  padding: '8px 16px', borderRadius: '8px', background: '#1A1A1A',
                  border: '1px solid #333', color: '#888', fontSize: '12px', fontWeight: 700, cursor: 'pointer'
                }}
              >
                {t('cancelBtn')}
              </button>
              <button
                type="button"
                onClick={handleDeleteCategory}
                disabled={deletingCategory.shop_count > 0 && !targetReassignCat}
                style={{
                  padding: '8px 20px', borderRadius: '8px',
                  background: (deletingCategory.shop_count > 0 && !targetReassignCat) ? '#333' : '#ef4444',
                  border: 'none', color: '#FFFFFF', fontSize: '12px', fontWeight: 900, cursor: 'pointer'
                }}
              >
                {t('confirmDeletionBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
