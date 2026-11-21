import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { parseApiResponse, resolveApiErrorMessage, resolveNetworkErrorMessage } from '../../utils/api';
import { formatInr, formatCoins } from '../../utils/formatters';
import { Receipt, Trash2, CheckCircle2 } from 'lucide-react';

export default function MerchantBilling() {
  const { token } = useAuth();
  const { t, locale } = useI18n();
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
      .then(parseApiResponse)
      .then(parsed => {
        const d = parsed.data;
        if (parsed.ok && d && d.success) setProducts(d.products || []);
      })
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

  const totalBillAmount = billItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const eligibleAmount = billItems.reduce((acc, item) => acc + (item.reward_eligible ? item.price * item.quantity : 0), 0);
  const estimatedPoints = Math.floor(eligibleAmount * 0.10);

  const handleGenerateBill = async () => {
    if (!customerIdentifier) return setError(t('enterCustomerIdentifierError'));
    if (billItems.length === 0) return setError(t('addBillItemError'));

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

      const parsed = await parseApiResponse(res);
      const data = parsed.data;
      if (!parsed.ok || !data || !data.success) {
        throw new Error(resolveApiErrorMessage(parsed, t, 'failedGenerateBillError'));
      }

      setBillResult(data.bill);
    } catch (err) {
      setError(resolveNetworkErrorMessage(err, t, 'failedGenerateBillError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '900px', background: '#050505' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
          <Receipt size={26} color="#D4AF37" /> {t('billingHeader')}
        </h2>
        <p style={{ fontSize: '14px', color: '#B8B8B8' }}>
          {t('billingSubheader')}
        </p>
      </div>

      {billResult ? (
        <div style={{ background: '#111111', borderRadius: '24px', padding: '28px', border: '1px solid rgba(212, 175, 55, 0.3)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#151515', border: '1px solid rgba(212, 175, 55, 0.3)', color: '#F2D675', padding: '6px 14px', borderRadius: '99px', fontWeight: 800, fontSize: '13px', marginBottom: '16px' }}>
            <CheckCircle2 size={16} color="#F2D675" /> {t('billingSuccessNotice')}
          </div>

          <h3 style={{ fontSize: '24px', fontWeight: 800, color: '#FFFFFF', marginBottom: '4px' }}>
            {t('billNumberTitle', { number: billResult.bill_number })}
          </h3>
          <p style={{ fontSize: '14px', color: '#B8B8B8', marginBottom: '20px' }}>
            {t('customerLabel')}: <strong style={{ color: '#FFFFFF' }}>{billResult.customer_name}</strong>
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: '#151515', padding: '16px', borderRadius: '14px', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
              <span style={{ fontSize: '11px', color: '#B8B8B8', textTransform: 'uppercase', fontWeight: 700 }}>{t('totalItemsBill')}</span>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#FFFFFF' }}>{formatInr(billResult.total_amount, locale)}</div>
            </div>

            <div style={{ background: '#151515', padding: '16px', borderRadius: '14px', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
              <span style={{ fontSize: '11px', color: '#B8B8B8', textTransform: 'uppercase', fontWeight: 700 }}>{t('rewardEligibleAmount')}</span>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#F2D675' }}>{formatInr(billResult.eligible_amount, locale)}</div>
            </div>

            <div style={{ background: '#151515', padding: '16px', borderRadius: '14px', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
              <span style={{ fontSize: '11px', color: '#B8B8B8', textTransform: 'uppercase', fontWeight: 700 }}>{t('rewardCoinsLabel')}</span>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#D4AF37' }}>+🪙 {formatCoins(billResult.points_awarded, locale, t('coinsUnit'))}</div>
            </div>
          </div>

          <button type="button" onClick={() => setBillResult(null)} className="btn-primary" style={{ padding: '12px 24px' }}>
            {t('createAnotherBillBtn')}
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px' }}>
          {/* Left Column: Bill Items Entry Table */}
          <div style={{ background: '#111111', borderRadius: '20px', padding: '24px', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
            <h3 style={{ fontSize: '16px', color: '#FFFFFF', marginBottom: '16px', fontWeight: 800 }}>{t('currentBillItemsTitle')}</h3>

            {error && <div role="alert" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '10px', borderRadius: '10px', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', marginBottom: '20px' }}>
              <thead>
                <tr style={{ background: '#151515', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', color: '#B8B8B8' }}>
                  <th style={{ padding: '8px' }}>{t('productNameHeader')}</th>
                  <th style={{ padding: '8px' }}>{t('priceHeader')}</th>
                  <th style={{ padding: '8px' }}>{t('qtyHeader')}</th>
                  <th style={{ padding: '8px' }}>{t('eligibleColHeader')}</th>
                  <th style={{ padding: '8px' }}>{t('subtotalHeader')}</th>
                  <th style={{ padding: '8px' }}></th>
                </tr>
              </thead>
              <tbody>
                {billItems.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.1)' }}>
                    <td style={{ padding: '10px 8px', fontWeight: 700, color: '#FFFFFF' }}>{item.product_name}</td>
                    <td style={{ padding: '10px 8px', color: '#B8B8B8' }}>{formatInr(item.price, locale)}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <input type="number" min="1" value={item.quantity} onChange={(e) => handleQuantityChange(idx, e.target.value)} style={{ width: '45px', padding: '4px', borderRadius: '6px', border: '1px solid #303030', background: '#151515', color: '#FFFFFF' }} />
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      {item.reward_eligible ? <span style={{ color: '#F2D675', fontWeight: 700 }}>{t('yesCheckLabel')}</span> : <span style={{ color: '#ef4444', fontWeight: 700 }}>{t('noCrossLabel')}</span>}
                    </td>
                    <td style={{ padding: '10px 8px', fontWeight: 800, color: '#FFFFFF' }}>{formatInr((item.price || 0) * (item.quantity || 0), locale)}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <button type="button" aria-label={t('removeItemAria')} onClick={() => handleRemoveItem(idx)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}>
                        <Trash2 size={14} color="#ef4444" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Quick Catalog Item Selector */}
            <div style={{ paddingTop: '16px', borderTop: '1px solid rgba(212, 175, 55, 0.15)' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8', display: 'block', marginBottom: '8px' }}>{t('quickAddCatalogUpper')}</span>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {products.map(p => (
                  <button type="button" key={p.id} onClick={() => handleAddItemFromCatalog(p)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                    + {p.name} ({formatInr(p.price, locale)})
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Customer Info & Calculation Summary */}
          <div style={{ background: '#111111', borderRadius: '20px', padding: '24px', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
            <h3 style={{ fontSize: '16px', color: '#FFFFFF', marginBottom: '16px', fontWeight: 800 }}>{t('billSummaryTitle')}</h3>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8', marginBottom: '4px', display: 'block' }}>{t('customerMobileEmailLabel')}</label>
              <input type="text" className="form-input" placeholder="customer@example.com" value={customerIdentifier} onChange={(e) => setCustomerIdentifier(e.target.value)} />
            </div>

            <div style={{ background: '#151515', padding: '16px', borderRadius: '14px', border: '1px solid rgba(212, 175, 55, 0.15)', marginBottom: '20px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#B8B8B8' }}>
                <span>{t('totalItemsBill')}:</span> <strong style={{ color: '#FFFFFF' }}>{formatInr(totalBillAmount, locale)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#F2D675', fontWeight: 700 }}>
                <span>{t('rewardEligibleAmount')}:</span> <strong>{formatInr(eligibleAmount, locale)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#D4AF37', fontWeight: 800, paddingTop: '6px', borderTop: '1px solid rgba(212, 175, 55, 0.15)' }}>
                <span>{t('estimatedCoinsLabel')}</span> <strong>+🪙 {formatCoins(estimatedPoints, locale, t('coinsUnit'))}</strong>
              </div>
            </div>

            <button type="button" onClick={handleGenerateBill} disabled={loading} className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '15px', justifyContent: 'center' }}>
              {loading ? t('processingBtn') : t('approveAndCompleteBilling')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
