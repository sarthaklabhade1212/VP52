import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Receipt, Plus, Trash2, CheckCircle2, User, ShoppingBag, ShieldCheck } from 'lucide-react';

export default function MerchantBilling() {
  const { token } = useAuth();
  const [products, setProducts] = useState([]);
  const [customerIdentifier, setCustomerIdentifier] = useState('');
  const [billItems, setBillItems] = useState([
    { product_id: 1, product_name: 'Artisanal Cappuccino', price: 180, quantity: 1, reward_eligible: true },
    { product_id: 3, product_name: 'Private Event Space Rent', price: 2500, quantity: 1, reward_eligible: false }
  ]);

  const [loading, setLoading] = useState(false);
  const [billResult, setBillResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/merchant/products', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(d => { if (d.success) setProducts(d.products || []); })
      .catch(console.error);
  }, [token]);

  const handleAddItemFromCatalog = (product) => {
    const existing = billItems.find(i => i.product_id === product.id);
    if (existing) {
      setBillItems(billItems.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setBillItems([
        ...billItems,
        {
          product_id: product.id,
          product_name: product.name,
          price: product.price,
          quantity: 1,
          reward_eligible: Boolean(product.reward_eligible)
        }
      ]);
    }
  };

  const handleRemoveItem = (index) => {
    setBillItems(billItems.filter((_, i) => i !== index));
  };

  const handleQuantityChange = (index, qty) => {
    const newQty = Math.max(1, parseInt(qty) || 1);
    setBillItems(billItems.map((item, i) => i === index ? { ...item, quantity: newQty } : item));
  };

  // Live Summary Calculation
  const totalBillAmount = billItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const eligibleAmount = billItems.reduce((acc, item) => acc + (item.reward_eligible ? item.price * item.quantity : 0), 0);
  const estimatedPoints = Math.floor(eligibleAmount * 0.10);

  const handleGenerateBill = async () => {
    if (!customerIdentifier) return setError('Please enter customer email or mobile');
    if (billItems.length === 0) return setError('Add at least one item to the bill');

    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/merchant/create-bill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          customer_identifier: customerIdentifier,
          items: billItems
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate bill');
      }

      setBillResult(data.bill);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Receipt size={26} color="#10b981" /> Itemized Bill & Server Reward Calculator
        </h2>
        <p style={{ fontSize: '14px', color: '#64748b' }}>
          Combine reward-eligible and non-eligible items into a single bill. Points are calculated server-side.
        </p>
      </div>

      {billResult ? (
        <div style={{ background: '#ffffff', borderRadius: '24px', padding: '28px', border: '2px solid #a7f3d0', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#dcfce7', color: '#15803d', padding: '6px 14px', borderRadius: '99px', fontWeight: 800, fontSize: '13px', marginBottom: '16px' }}>
            <CheckCircle2 size={16} /> ✅ BILL GENERATED & POINTS AWARDED
          </div>

          <h3 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
            Bill #{billResult.bill_number}
          </h3>
          <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px' }}>
            Customer: <strong>{billResult.customer_name}</strong>
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Total Bill</span>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>₹{billResult.total_amount}</div>
            </div>

            <div style={{ background: '#ecfdf5', padding: '16px', borderRadius: '14px', border: '1px solid #a7f3d0' }}>
              <span style={{ fontSize: '11px', color: '#059669', textTransform: 'uppercase', fontWeight: 700 }}>Eligible Subtotal</span>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#047857' }}>₹{billResult.eligible_amount}</div>
            </div>

            <div style={{ background: '#e0e7ff', padding: '16px', borderRadius: '14px', border: '1px solid #c7d2fe' }}>
              <span style={{ fontSize: '11px', color: '#3730a3', textTransform: 'uppercase', fontWeight: 700 }}>Points Awarded</span>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#4f46e5' }}>+🪙 {billResult.points_awarded}</div>
            </div>
          </div>

          <button onClick={() => setBillResult(null)} className="btn-success" style={{ padding: '12px 24px' }}>
            Create Another Bill
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px' }}>
          {/* Left Column: Bill Items Entry Table */}
          <div style={{ background: '#ffffff', borderRadius: '20px', padding: '24px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '16px', color: '#0f172a', marginBottom: '16px' }}>Current Bill Items</h3>

            {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px', borderRadius: '10px', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', marginBottom: '20px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                  <th style={{ padding: '8px' }}>Item</th>
                  <th style={{ padding: '8px' }}>Price</th>
                  <th style={{ padding: '8px' }}>Qty</th>
                  <th style={{ padding: '8px' }}>Eligible?</th>
                  <th style={{ padding: '8px' }}>Subtotal</th>
                  <th style={{ padding: '8px' }}></th>
                </tr>
              </thead>
              <tbody>
                {billItems.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 8px', fontWeight: 700 }}>{item.product_name}</td>
                    <td style={{ padding: '10px 8px' }}>₹{item.price}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <input type="number" min="1" value={item.quantity} onChange={(e) => handleQuantityChange(idx, e.target.value)} style={{ width: '45px', padding: '4px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      {item.reward_eligible ? <span style={{ color: '#10b981', fontWeight: 700 }}>✅ Yes</span> : <span style={{ color: '#ef4444', fontWeight: 700 }}>🚫 No</span>}
                    </td>
                    <td style={{ padding: '10px 8px', fontWeight: 800 }}>₹{item.price * item.quantity}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <button onClick={() => handleRemoveItem(idx)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Quick Catalog Item Selector */}
            <div style={{ paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '8px' }}>+ QUICK ADD FROM CATALOG</span>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {products.map(p => (
                  <button key={p.id} onClick={() => handleAddItemFromCatalog(p)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                    + {p.name} (₹{p.price})
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Customer Info & Calculation Summary */}
          <div style={{ background: '#ffffff', borderRadius: '20px', padding: '24px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '16px', color: '#0f172a', marginBottom: '16px' }}>Bill Summary</h3>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>Customer Mobile / Email</label>
              <input type="text" className="form-input" placeholder="customer@example.com" value={customerIdentifier} onChange={(e) => setCustomerIdentifier(e.target.value)} />
            </div>

            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '14px', border: '1px solid #cbd5e1', marginBottom: '20px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total Items Bill:</span> <strong>₹{totalBillAmount}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', fontWeight: 700 }}>
                <span>Reward Eligible Amount:</span> <strong>₹{eligibleAmount}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4f46e5', fontWeight: 800, paddingTop: '6px', borderTop: '1px solid #e2e8f0' }}>
                <span>Estimated Points Earned:</span> <strong>+🪙 {estimatedPoints} Pts</strong>
              </div>
            </div>

            <button onClick={handleGenerateBill} disabled={loading} className="btn-success" style={{ width: '100%', padding: '14px', fontSize: '15px', justifyContent: 'center' }}>
              {loading ? 'Processing...' : 'Generate Bill & Award Points'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
