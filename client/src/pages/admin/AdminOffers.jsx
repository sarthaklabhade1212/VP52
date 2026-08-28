import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Tag, Plus, Edit2, Trash2, Calendar, Store, X } from 'lucide-react';

export default function AdminOffers() {
  const { token } = useAuth();
  const [offers, setOffers] = useState([]);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState(null);

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
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this discount offer?')) return;
    try {
      await fetch(`/api/admin/offers/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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
      if (res.ok) {
        setIsModalOpen(false);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ background: '#050505', color: '#FFFFFF' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '24px', color: '#FFFFFF', fontWeight: 800 }}>Store Promotional Offers</h2>
          <p style={{ fontSize: '14px', color: '#B8B8B8', margin: 0 }}>Configure store promotional percentage offers and discount caps (INR ₹).</p>
        </div>

        <button onClick={handleOpenAdd} className="btn-primary" style={{ padding: '12px 20px', borderRadius: '12px' }}>
          <Plus size={18} color="#050505" /> Create New Offer
        </button>
      </div>

      <div style={{ background: '#111111', borderRadius: '20px', border: '1px solid rgba(212, 175, 55, 0.15)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: '#151515', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', color: '#B8B8B8', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase' }}>
              <th style={{ padding: '14px 20px' }}>Shop</th>
              <th style={{ padding: '14px 20px' }}>Offer Title</th>
              <th style={{ padding: '14px 20px' }}>Discount %</th>
              <th style={{ padding: '14px 20px' }}>Max Discount</th>
              <th style={{ padding: '14px 20px' }}>Valid Until</th>
              <th style={{ padding: '14px 20px' }}>Status</th>
              <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {offers.map((offer) => (
              <tr key={offer.id} style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.1)' }}>
                <td style={{ padding: '14px 20px', fontWeight: 700, color: '#FFFFFF' }}>{offer.shop_name}</td>
                <td style={{ padding: '14px 20px', color: '#B8B8B8' }}>{offer.title}</td>
                <td style={{ padding: '14px 20px', fontWeight: 800, color: '#F2D675' }}>{offer.discount_percent}% OFF</td>
                <td style={{ padding: '14px 20px', fontWeight: 700, color: '#D4AF37' }}>₹{offer.max_discount_inr}</td>
                <td style={{ padding: '14px 20px', fontSize: '13px', color: '#B8B8B8' }}>{new Date(offer.valid_until).toLocaleDateString('en-IN')}</td>
                <td style={{ padding: '14px 20px' }}>
                  <span className={`badge ${offer.status === 'active' ? 'badge-active' : 'badge-used'}`}>{offer.status}</span>
                </td>
                <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                  <button onClick={() => handleDelete(offer.id)} style={{ border: '1px solid rgba(239, 68, 68, 0.3)', background: '#151515', color: '#ef4444', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Offer Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#111111', border: '1px solid rgba(212, 175, 55, 0.3)', borderRadius: '24px', maxWidth: '500px', width: '100%', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '20px', color: '#FFFFFF', fontWeight: 800 }}>Create New Store Offer</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={20} color="#B8B8B8" /></button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8', display: 'block', marginBottom: '4px' }}>Select Partner Shop</label>
                <select className="form-input" style={{ background: '#111111', border: '1px solid #303030', color: '#FFFFFF' }} value={formData.shop_id} onChange={e => setFormData({ ...formData, shop_id: e.target.value })}>
                  {shops.map(s => <option key={s.id} value={s.id}>{s.name} ({s.category})</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8', display: 'block', marginBottom: '4px' }}>Offer Title</label>
                <input type="text" required className="form-input" style={{ background: '#111111', border: '1px solid #303030', color: '#FFFFFF' }} value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="10% OFF Total Bill" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8', display: 'block', marginBottom: '4px' }}>Discount (%)</label>
                  <input type="number" required className="form-input" style={{ background: '#111111', border: '1px solid #303030', color: '#F2D675', fontWeight: 800 }} value={formData.discount_percent} onChange={e => setFormData({ ...formData, discount_percent: parseInt(e.target.value) })} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8', display: 'block', marginBottom: '4px' }}>Max Discount (₹ INR)</label>
                  <input type="number" required className="form-input" style={{ background: '#111111', border: '1px solid #303030', color: '#FFFFFF' }} value={formData.max_discount_inr} onChange={e => setFormData({ ...formData, max_discount_inr: parseInt(e.target.value) })} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8', display: 'block', marginBottom: '4px' }}>Valid Until Date</label>
                <input type="date" required className="form-input" style={{ background: '#111111', border: '1px solid #303030', color: '#FFFFFF' }} value={formData.valid_until} onChange={e => setFormData({ ...formData, valid_until: e.target.value })} />
              </div>

              <button type="submit" className="btn-primary" style={{ padding: '14px', fontSize: '15px', marginTop: '10px', justifyContent: 'center' }}>
                Publish Store Offer
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
