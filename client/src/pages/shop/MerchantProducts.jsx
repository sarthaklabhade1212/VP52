import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Tag, Plus, Trash2, Edit3, CheckCircle2, XCircle, ShoppingBag } from 'lucide-react';

export default function MerchantProducts() {
  const { token } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('General');
  const [rewardEligible, setRewardEligible] = useState(true);
  const [rewardPercent, setRewardPercent] = useState(10);
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState(null);

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

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const payload = {
      name,
      photo_url: photoUrl,
      price,
      category,
      reward_eligible: rewardEligible,
      reward_percent: rewardPercent,
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
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this product item?')) return;
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
    setCategory('General');
    setRewardEligible(true);
    setRewardPercent(10);
    setDescription('');
    setEditingId(null);
  };

  return (
    <div style={{ maxWidth: '900px', background: '#050505' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '24px', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
            <ShoppingBag size={26} color="#D4AF37" /> Store Products & Services Catalog
          </h2>
          <p style={{ fontSize: '14px', color: '#B8B8B8' }}>
            Configure store items and set individual reward point eligibility per product/service.
          </p>
        </div>

        <button
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="btn-primary"
          style={{ padding: '12px 20px', borderRadius: '12px' }}
        >
          <Plus size={18} color="#050505" /> Add New Item
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
        {products.map(p => (
          <div key={p.id} style={{ background: '#111111', borderRadius: '18px', padding: '16px', border: '1px solid rgba(212, 175, 55, 0.15)', boxShadow: '0 8px 30px rgba(0,0,0,0.35)' }}>
            <div style={{ height: '100px', borderRadius: '12px', overflow: 'hidden', marginBottom: '12px', background: '#151515' }}>
              <img src={p.photo_url || 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=400&q=80'} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>

            <span style={{ fontSize: '11px', color: '#D4AF37', fontWeight: 800 }}>{p.category}</span>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF', marginBottom: '4px' }}>{p.name}</h3>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#F2D675', marginBottom: '8px' }}>₹{p.price}</div>

            <div style={{ marginBottom: '12px' }}>
              {p.reward_eligible ? (
                <span className="badge badge-active" style={{ fontSize: '11px' }}>
                  ✅ Reward Eligible ({p.reward_percent}%)
                </span>
              ) : (
                <span className="badge badge-expired" style={{ fontSize: '11px' }}>
                  🚫 Non-Eligible Item
                </span>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '10px', borderTop: '1px solid rgba(212, 175, 55, 0.15)' }}>
              <button onClick={() => handleDelete(p.id)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}>
                <Trash2 size={16} color="#ef4444" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Item Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#111111', border: '1px solid rgba(212, 175, 55, 0.3)', borderRadius: '24px', maxWidth: '480px', width: '100%', padding: '28px' }}>
            <h3 style={{ fontSize: '20px', color: '#FFFFFF', marginBottom: '20px', fontWeight: 800 }}>{editingId ? 'Edit Product Item' : 'Add Store Product / Service'}</h3>

            <form onSubmit={handleSaveProduct} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8', marginBottom: '4px', display: 'block' }}>Product / Service Name</label>
                <input type="text" required className="form-input" placeholder="e.g. Artisanal Cappuccino" value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8', marginBottom: '4px', display: 'block' }}>Price (₹ INR)</label>
                <input type="number" required className="form-input" placeholder="180" value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8', marginBottom: '4px', display: 'block' }}>Category</label>
                <input type="text" className="form-input" placeholder="e.g. Beverage / Food" value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>

              {/* Reward Eligibility Toggle */}
              <div style={{ background: '#151515', padding: '14px', borderRadius: '14px', border: '1px solid rgba(212, 175, 55, 0.2)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '14px', color: '#FFFFFF' }}>
                  <input type="checkbox" checked={rewardEligible} onChange={(e) => setRewardEligible(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#D4AF37' }} />
                  Reward Eligible Item?
                </label>
                <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block', marginTop: '4px' }}>
                  When checked, customer earns reward points on purchasing this item.
                </span>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
