import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, AlertCircle, RefreshCw, ChevronRight } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { apiFetch, parseApiResponse } from '../utils/api';

const LIST_POLL_MS = 10000;

function preview(text) {
  if (!text) return '';
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}

export default function CustomerMessages() {
  const { t, translateCategory } = useI18n();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState([]);
  const [status, setStatus] = useState('loading');
  const timerRef = useRef(null);

  const load = useCallback(async ({ initial = false } = {}) => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      if (initial) setStatus('error');
      return;
    }
    try {
      const res = await apiFetch('/api/customer/conversations');
      const parsed = await parseApiResponse(res);
      const data = parsed.data;
      if (parsed.ok && data && data.success) {
        setConversations(Array.isArray(data.conversations) ? data.conversations : []);
        setStatus('ready');
      } else if (initial) {
        setStatus('error');
      }
    } catch (e) {
      if (initial) setStatus('error');
    }
  }, []);

  useEffect(() => {
    load({ initial: true });
    timerRef.current = setInterval(() => load({ initial: false }), LIST_POLL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  return (
    <div style={{ padding: '16px', maxWidth: '640px', margin: '0 auto', background: '#050505' }}>
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>{t('messagesTitle')}</h2>
        <span style={{ fontSize: '13px', color: '#B8B8B8', fontWeight: 600 }}>{t('messagesSubtitle')}</span>
      </div>

      {status === 'loading' && (
        <div style={{ textAlign: 'center', color: '#B8B8B8', fontSize: '13px', marginTop: '40px' }}>{t('loadingConversations')}</div>
      )}

      {status === 'error' && (
        <div style={{ textAlign: 'center', color: '#B8B8B8', marginTop: '48px' }}>
          <AlertCircle size={34} color="#ef4444" />
          <p style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF', margin: '12px 0 16px' }}>{t('conversationsLoadError')}</p>
          <button
            onClick={() => { setStatus('loading'); load({ initial: true }); }}
            className="btn-primary"
            style={{ padding: '9px 18px', fontSize: '13px' }}
          >
            <RefreshCw size={14} color="#050505" /> {t('retry')}
          </button>
        </div>
      )}

      {status === 'ready' && conversations.length === 0 && (
        <div style={{ textAlign: 'center', color: '#B8B8B8', marginTop: '56px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#111111', border: '1px solid rgba(212, 175, 55, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <MessageCircle size={30} color="#D4AF37" />
          </div>
          <p style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>{t('noConversations')}</p>
          <p style={{ fontSize: '13px', marginTop: '6px', color: '#B8B8B8' }}>{t('noConversationsHintCustomer')}</p>
        </div>
      )}

      {status === 'ready' && conversations.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate(`/customer/messages/${c.id}`)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left',
                background: '#111111', border: '1px solid rgba(212, 175, 55, 0.15)', borderRadius: '16px',
                padding: '12px 14px', cursor: 'pointer', width: '100%', boxShadow: '0 8px 30px rgba(0,0,0,0.35)'
              }}
            >
              {c.shop_image_url ? (
                <img src={c.shop_image_url} alt={c.shop_name} style={{ width: '48px', height: '48px', borderRadius: '12px', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)', color: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>
                  {(c.shop_name || '?').charAt(0).toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.shop_name}</h3>
                  {c.unread_count > 0 && (
                    <span style={{ flexShrink: 0, background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)', color: '#050505', fontSize: '11px', fontWeight: 800, borderRadius: '999px', minWidth: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>
                      {c.unread_count}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '12px', color: c.unread_count > 0 ? '#F2D675' : '#B8B8B8', fontWeight: c.unread_count > 0 ? 700 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                  {preview(c.last_message_text) || translateCategory(c.shop_category)}
                </span>
              </div>
              <ChevronRight size={18} color="#D4AF37" style={{ flexShrink: 0 }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
