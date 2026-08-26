import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Store, Plus, Edit2, Trash2, MapPin, Phone, CheckCircle2, X, Key, ShieldAlert, Copy, RefreshCw, UserCheck } from 'lucide-react';

export default function AdminShops() {
  const { token } = useAuth();
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShop, setEditingShop] = useState(null);

  // Credential Confirmation Modal State
  const [createdCredentials, setCreatedCredentials] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    owner_name: '',
    category: 'Restaurant',
    description: '',
    address: '',
    phone: '',
    email: '',
    image_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80',
    status: 'active',
    temp_password: ''
  });

  const fetchShops = () => {
    fetch('/api/admin/shops', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => { if (data.success) setShops(data.shops || []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchShops(); }, [token]);

  const handleOpenAdd = () => {
    setEditingShop(null);
    setFormData({
      name: '',
      owner_name: '',
      category: 'Restaurant',
      description: '',
      address: '',
      phone: '',
      email: '',
      image_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80',
      status: 'active',
      temp_password: `Shop@${Math.floor(100 + Math.random() * 900)}`
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (shop) => {
    setEditingShop(shop);
    setFormData({
      name: shop.name || '',
      owner_name: shop.owner_name || '',
      category: shop.category || 'Restaurant',
      description: shop.description || '',
      address: shop.address || '',
      phone: shop.phone || '',
      email: shop.email || '',
      image_url: shop.image_url || '',
      status: shop.status || 'active',
      temp_password: ''
    });
    setIsModalOpen(true);
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
    if (!window.confirm('Reset merchant login credentials? A new temporary password will be generated.')) return;
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
          ownerName: data.credentials.ownerName || 'Merchant',
          mobileNumber: data.credentials.mobileNumber,
          email: data.credentials.email,
          accountStatus: 'Active (Password Reset)',
          temporaryPassword: data.credentials.newTemporaryPassword
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this shop listing and merchant account?')) return;
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editingShop ? `/api/admin/shops/${editingShop.id}` : '/api/admin/shops';
    const method = editingShop ? 'PUT' : 'POST';

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
        fetchShops();

        if (!editingShop && data.credentials) {
          setCreatedCredentials(data.credentials);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '24px', color: '#0f172a' }}>Merchants & Physical Store Catalog</h2>
          <p style={{ fontSize: '14px', color: '#64748b' }}>Create shop accounts, assign merchant login credentials, and manage account statuses.</p>
        </div>

        <button onClick={handleOpenAdd} className="btn-primary" style={{ padding: '12px 20px', borderRadius: '12px' }}>
          <Plus size={18} /> Add Shop + Merchant Credentials
        </button>
      </div>

      {/* Shops Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '20px' }}>
        {shops.map((shop) => (
          <div key={shop.id} style={{ background: '#ffffff', borderRadius: '20px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
            <div style={{ height: '120px', position: 'relative' }}>
              <img src={shop.image_url} alt={shop.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '6px' }}>
                <span className={`badge ${shop.status === 'active' ? 'badge-active' : shop.status === 'suspended' ? 'badge-expired' : 'badge-used'}`}>
                  {shop.status.toUpperCase()}
                </span>
              </div>
            </div>

            <div style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#4f46e5', textTransform: 'uppercase' }}>{shop.category}</span>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#64748b' }}>{shop.shop_code || `SHOP-00${shop.id}`}</span>
              </div>

              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '2px 0 2px 0' }}>{shop.name}</h3>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '12px' }}>
                Owner: {shop.owner_name || 'Store Merchant'}
              </span>

              <div style={{ fontSize: '12px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '4px', background: '#f8fafc', padding: '10px', borderRadius: '10px', marginBottom: '16px' }}>
                <div>📱 <strong>Login Mobile:</strong> {shop.phone || 'N/A'}</div>
                <div>📧 <strong>Email:</strong> {shop.email || 'N/A'}</div>
                <div>📍 <strong>Address:</strong> {shop.address}</div>
              </div>

              {/* Status Action Buttons */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                {shop.status !== 'active' && (
                  <button onClick={() => handleStatusChange(shop.id, 'active')} style={{ flex: 1, padding: '6px', background: '#dcfce7', color: '#15803d', border: '1px solid #a7f3d0', borderRadius: '8px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>
                    Activate
                  </button>
                )}
                {shop.status !== 'suspended' && (
                  <button onClick={() => handleStatusChange(shop.id, 'suspended')} style={{ flex: 1, padding: '6px', background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', borderRadius: '8px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>
                    Suspend
                  </button>
                )}
                {shop.status !== 'inactive' && (
                  <button onClick={() => handleStatusChange(shop.id, 'inactive')} style={{ flex: 1, padding: '6px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>
                    Deactivate
                  </button>
                )}
              </div>

              {/* Edit / Reset Password / Delete */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => handleOpenEdit(shop)} className="btn-secondary" style={{ flex: 1, padding: '8px', fontSize: '12px' }}>
                  <Edit2 size={14} /> Edit
                </button>
                <button onClick={() => handleResetCredentials(shop.id)} style={{ background: '#f3e8ff', color: '#6b21a8', border: '1px solid #e9d5ff', padding: '8px', borderRadius: '10px', fontWeight: 700, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Key size={14} /> Reset Pass
                </button>
                <button onClick={() => handleDelete(shop.id)} style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', padding: '8px 12px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CONFIRMATION MODAL: SHOWS CREATED MERCHANT CREDENTIALS ONCE */}
      {createdCredentials && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(8px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#ffffff', borderRadius: '24px', maxWidth: '480px', width: '100%', padding: '28px', border: '2px solid #a7f3d0' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#dcfce7', color: '#15803d', padding: '6px 14px', borderRadius: '99px', fontWeight: 800, fontSize: '12px', marginBottom: '16px' }}>
              <CheckCircle2 size={16} /> ✅ MERCHANT CREDENTIALS CREATED
            </div>

            <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
              {createdCredentials.shopName}
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>
              Owner: <strong>{createdCredentials.ownerName}</strong> • Shop ID: <strong>{createdCredentials.shopCode}</strong>
            </p>

            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1.5px solid #cbd5e1', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>PRIMARY LOGIN MOBILE NUMBER</span>
                <strong style={{ color: '#0f172a', fontSize: '16px' }}>📱 {createdCredentials.mobileNumber}</strong>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>EMAIL ADDRESS</span>
                <strong style={{ color: '#0f172a' }}>✉️ {createdCredentials.email}</strong>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>TEMPORARY PASSWORD (SHOWN ONCE)</span>
                <div style={{ background: '#e0e7ff', border: '1px solid #c7d2fe', padding: '10px 14px', borderRadius: '10px', color: '#3730a3', fontWeight: 800, fontSize: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <span>{createdCredentials.temporaryPassword}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(createdCredentials.temporaryPassword)}
                    style={{ border: 'none', background: 'none', color: '#4f46e5', cursor: 'pointer', fontSize: '12px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Copy size={14} /> Copy
                  </button>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>ACCOUNT STATUS</span>
                <span className="badge badge-active" style={{ display: 'inline-block', marginTop: '4px' }}>{createdCredentials.accountStatus}</span>
              </div>
            </div>

            <button onClick={() => setCreatedCredentials(null)} className="btn-success" style={{ width: '100%', padding: '14px', fontSize: '15px', justifyContent: 'center' }}>
              Done / Close Confirmation
            </button>
          </div>
        </div>
      )}

      {/* Add / Edit Shop Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#ffffff', borderRadius: '24px', maxWidth: '520px', width: '100%', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '20px', color: '#0f172a' }}>{editingShop ? 'Edit Merchant Account' : 'Add Shop + Merchant Credentials'}</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={20} color="#64748b" /></button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Owner Full Name *</label>
                <input type="text" required className="form-input" value={formData.owner_name} onChange={e => setFormData({ ...formData, owner_name: e.target.value })} placeholder="e.g. Ramesh Kumar" />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Shop / Business Name *</label>
                <input type="text" required className="form-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Royal Sweets & Bakers" />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Login Mobile Number * (Primary Login ID)</label>
                <input type="tel" required className="form-input" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="e.g. 9876543210" />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Shop Email Address *</label>
                <input type="email" required className="form-input" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="merchant@example.com" />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Category</label>
                <select className="form-input" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                  <option value="Restaurant">Restaurant & Food</option>
                  <option value="Clothing">Clothing & Apparel</option>
                  <option value="Paithani">Paithani & Sarees</option>
                  <option value="Salon">Salon & Beauty Spa</option>
                  <option value="Grocery">Grocery & Supermarket</option>
                  <option value="Jewellery">Jewellery Store</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Physical Address *</label>
                <input type="text" required className="form-input" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="Shop 10, FC Road, Pune" />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Initial Account Status</label>
                <select className="form-input" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                  <option value="active">Active (Immediate Login Granted)</option>
                  <option value="pending">Pending Admin Review</option>
                  <option value="suspended">Suspended</option>
                  <option value="inactive">Deactivated</option>
                </select>
              </div>

              {!editingShop && (
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Temporary Password (Optional / Auto-Generated)</label>
                  <input type="text" className="form-input" value={formData.temp_password} onChange={e => setFormData({ ...formData, temp_password: e.target.value })} placeholder="Shop@123" />
                </div>
              )}

              <button type="submit" className="btn-primary" style={{ padding: '14px', fontSize: '15px', marginTop: '10px' }}>
                {editingShop ? 'Save Changes' : 'Create Merchant Account & Generate Credentials'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
