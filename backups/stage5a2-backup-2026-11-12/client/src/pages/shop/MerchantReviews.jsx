import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { resolveMediaUrl } from '../../utils/api';
import { Star, MessageCircle, Send, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function MerchantReviews() {
  const { token } = useAuth();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyingId, setReplyingId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  const fetchReviews = () => {
    fetch('/api/merchant/reviews', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(d => {
        if (d.success) setReviews(d.reviews || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchReviews();
  }, [token]);

  const handleSendReply = async (reviewId) => {
    if (!replyText.trim()) return;
    setSubmittingReply(true);
    try {
      const res = await fetch(`/api/merchant/reviews/${reviewId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reply: replyText.trim() })
      });
      const d = await res.json();
      if (d.success) {
        setReplyingId(null);
        setReplyText('');
        fetchReviews();
      } else {
        alert(d.error || t('failedSubmitReply'));
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmittingReply(false);
    }
  };

  const avgRating = reviews.length > 0
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : '0.0';

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
            <Star size={24} color="#F2D675" /> {t('customerReviewsRatingsTitle')}
          </h2>
          <span style={{ fontSize: '12px', color: '#888888' }}>{t('reviewsAverageSummary', { avg: avgRating, count: reviews.length })}</span>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '30px', color: '#888888' }}>{t('loadingReviews')}</div>
      ) : reviews.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', background: '#111111', borderRadius: '18px', border: '1px dashed rgba(212,175,55,0.2)', color: '#888888', fontSize: '13px' }}>
          <Star size={36} color="#F2D675" style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
          {t('emptyReviewsMerchant')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {reviews.map(rev => (
            <div
              key={rev.id}
              style={{
                background: '#111111',
                borderRadius: '16px',
                padding: '16px',
                border: '1px solid rgba(212,175,55,0.2)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                    {rev.customer_name || t('customerLabel')}
                  </h4>
                  <span style={{ fontSize: '11px', color: '#888888' }}>
                    {new Date(rev.created_at).toLocaleDateString(locale)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '2px' }}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star
                      key={s}
                      size={14}
                      fill={s <= rev.rating ? '#F2D675' : 'transparent'}
                      color="#F2D675"
                    />
                  ))}
                </div>
              </div>

              <p style={{ fontSize: '13px', color: '#DDDDDD', margin: '8px 0', lineHeight: 1.4 }}>
                {rev.comment}
              </p>

              {rev.photo_url && (
                <img
                  src={resolveMediaUrl(rev.photo_url)}
                  alt={t('reviewPhotoAlt')}
                  style={{ width: '80px', height: '80px', borderRadius: '10px', objectFit: 'cover', marginBottom: '8px' }}
                />
              )}

              {/* Existing Merchant Reply */}
              {rev.merchant_reply ? (
                <div style={{
                  background: '#161616',
                  borderLeft: '3px solid #D4AF37',
                  borderRadius: '0 10px 10px 0',
                  padding: '10px 14px',
                  fontSize: '12px',
                  marginTop: '10px'
                }}>
                  <div style={{ fontWeight: 800, color: '#D4AF37', marginBottom: '2px' }}>
                    {t('yourReplyLabel')}
                  </div>
                  <p style={{ color: '#B8B8B8', margin: 0 }}>{rev.merchant_reply}</p>
                </div>
              ) : (
                <div style={{ marginTop: '10px' }}>
                  {replyingId === rev.id ? (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder={t('replyPlaceholder')}
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        style={{ flex: 1, padding: '8px 12px', fontSize: '12px', borderRadius: '8px' }}
                      />
                      <button
                        type="button"
                        onClick={() => handleSendReply(rev.id)}
                        disabled={submittingReply}
                        className="btn-primary"
                        style={{ padding: '8px 14px', fontSize: '12px', borderRadius: '8px' }}
                      >
                        {submittingReply ? t('sending') : t('replyBtn')}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setReplyingId(null); setReplyText(''); }}
                        className="btn-secondary"
                        style={{ padding: '8px 12px', fontSize: '12px', borderRadius: '8px' }}
                      >
                        {t('cancelBtn')}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setReplyingId(rev.id); setReplyText(''); }}
                      style={{ background: 'none', border: '1px solid rgba(212,175,55,0.3)', borderRadius: '8px', color: '#F2D675', padding: '6px 12px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <MessageCircle size={14} color="#F2D675" aria-hidden="true" /> {t('replyToReviewBtn')}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
