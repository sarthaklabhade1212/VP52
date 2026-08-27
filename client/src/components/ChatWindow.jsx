import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Send, AlertCircle, WifiOff, RefreshCw } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { apiFetch } from '../utils/api';

const POLL_MS = 4000;          // active conversation refresh
const MAX_LEN = 2000;          // mirrors server-side validateMessageText

function formatTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '';
  }
}

/**
 * Shared chat screen for both the customer and the merchant sides.
 *
 * Props:
 *  - basePath: '/api/customer' | '/api/merchant'
 *  - conversationId: string | number (from the route)
 *  - myRole: 'customer' | 'shop' (which bubbles are "mine")
 *  - accent: brand colour for own bubbles / send button
 *  - deriveHeader: (conversation) => ({ title, subtitle })
 *  - onBack: () => void
 */
export default function ChatWindow({ basePath, conversationId, myRole, accent = '#4f46e5', deriveHeader, onBack }) {
  const { t } = useI18n();

  const [messages, setMessages] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error | notfound
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' ? navigator.onLine === false : false);

  const bottomRef = useRef(null);
  const scrollRef = useRef(null);
  const pollRef = useRef(null);
  const readSentRef = useRef(false);

  const messagesUrl = `${basePath}/conversations/${conversationId}/messages`;

  // Mark counterpart messages as read (best-effort; clears the unread badge).
  const markRead = useCallback(async () => {
    try {
      await apiFetch(`${basePath}/conversations/${conversationId}/read`, { method: 'PATCH' });
    } catch (e) {
      // best-effort only
    }
  }, [basePath, conversationId]);

  const load = useCallback(async ({ initial = false } = {}) => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setOffline(true);
      if (initial) setStatus('ready'); // show offline banner rather than a hard error
      return;
    }
    try {
      const res = await apiFetch(messagesUrl);
      if (res.status === 404) {
        setStatus('notfound');
        return;
      }
      if (!res.ok) {
        if (initial) setStatus('error');
        return;
      }
      const data = await res.json();
      if (!data || !data.success) {
        if (initial) setStatus('error');
        return;
      }
      setConversation(data.conversation || null);
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setStatus('ready');
      setOffline(false);

      // If any counterpart messages are unread, mark them read (once per fresh batch).
      const hasUnreadFromOther = (data.messages || []).some(
        (m) => m.sender_role !== myRole && !m.read_at
      );
      if (hasUnreadFromOther) {
        readSentRef.current = false;
      }
      if (hasUnreadFromOther && !readSentRef.current) {
        readSentRef.current = true;
        markRead();
      }
    } catch (e) {
      if (initial) setStatus('error');
    }
  }, [messagesUrl, myRole, markRead]);

  // Initial load + polling.
  useEffect(() => {
    setStatus('loading');
    readSentRef.current = false;
    load({ initial: true });
    pollRef.current = setInterval(() => load({ initial: false }), POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [load]);

  // Online/offline reactions.
  useEffect(() => {
    const goOnline = () => { setOffline(false); load({ initial: false }); };
    const goOffline = () => setOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [load]);

  // Auto-scroll to newest.
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages.length, status]);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;
    if (text.length > MAX_LEN) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setOffline(true);
      setSendError(true);
      return;
    }
    setSending(true);
    setSendError(false);
    try {
      const res = await apiFetch(messagesUrl, {
        method: 'POST',
        body: JSON.stringify({ message_text: text }),
      });
      if (!res.ok) {
        setSendError(true);
        setSending(false);
        return;
      }
      const data = await res.json();
      if (data && data.success && data.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
        setDraft('');
      } else {
        setSendError(true);
      }
    } catch (e) {
      setSendError(true);
    } finally {
      setSending(false);
    }
  }, [draft, sending, messagesUrl]);

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const header = conversation && deriveHeader ? deriveHeader(conversation) : { title: '', subtitle: '' };
  const initial = (header.title || '?').charAt(0).toUpperCase();

  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 132px)',
    background: '#f8fafc',
  };

  return (
    <div style={containerStyle}>
      {/* Conversation header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '12px 16px', background: '#ffffff', borderBottom: '1px solid #e2e8f0',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button
          onClick={onBack}
          aria-label={t('backLabel')}
          style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', color: '#0f172a', display: 'flex' }}
        >
          <ArrowLeft size={22} />
        </button>
        <div style={{
          width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
          background: accent, color: '#ffffff', fontWeight: 800, fontSize: '16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {initial}
        </div>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {header.title || '…'}
          </h3>
          {header.subtitle ? (
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{header.subtitle}</span>
          ) : null}
        </div>
      </div>

      {/* Offline banner */}
      {offline && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center',
          background: '#fef3c7', color: '#92400e', fontSize: '12px', fontWeight: 700, padding: '8px 12px',
        }}>
          <WifiOff size={14} /> {t('chatOffline')}
        </div>
      )}

      {/* Message list / states */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {status === 'loading' && (
          <div style={{ textAlign: 'center', color: '#64748b', fontSize: '13px', marginTop: '32px' }}>
            {t('loadingChat')}
          </div>
        )}

        {status === 'notfound' && (
          <div style={{ textAlign: 'center', color: '#64748b', marginTop: '40px' }}>
            <AlertCircle size={32} color="#94a3b8" />
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginTop: '10px' }}>{t('conversationNotFound')}</p>
          </div>
        )}

        {status === 'error' && (
          <div style={{ textAlign: 'center', color: '#64748b', marginTop: '40px' }}>
            <AlertCircle size={32} color="#ef4444" />
            <p style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', margin: '10px 0 14px' }}>{t('chatLoadError')}</p>
            <button
              onClick={() => { setStatus('loading'); load({ initial: true }); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: accent, color: '#fff', border: 'none', borderRadius: '10px', padding: '8px 16px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
            >
              <RefreshCw size={14} /> {t('retry')}
            </button>
          </div>
        )}

        {status === 'ready' && messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#64748b', marginTop: '48px' }}>
            <p style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>{t('noMessages')}</p>
            <p style={{ fontSize: '13px', marginTop: '6px' }}>{t('noMessagesHint')}</p>
          </div>
        )}

        {status === 'ready' && messages.map((m) => {
          const mine = m.sender_role === myRole;
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: '10px' }}>
              <div style={{ maxWidth: '78%' }}>
                <div style={{
                  background: mine ? accent : '#ffffff',
                  color: mine ? '#ffffff' : '#0f172a',
                  border: mine ? 'none' : '1px solid #e2e8f0',
                  padding: '10px 14px',
                  borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  fontSize: '14px', lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                }}>
                  {m.message_text}
                </div>
                <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '3px', textAlign: mine ? 'right' : 'left', fontWeight: 600 }}>
                  {mine ? t('you') : ''} {formatTime(m.created_at)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div style={{ background: '#ffffff', borderTop: '1px solid #e2e8f0', padding: '10px 12px' }}>
        {sendError && (
          <div style={{ fontSize: '12px', color: '#ef4444', fontWeight: 600, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <AlertCircle size={13} /> {t('chatSendError')}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('typeMessage')}
            maxLength={MAX_LEN}
            rows={1}
            disabled={status === 'notfound'}
            style={{
              flex: 1, resize: 'none', maxHeight: '120px', minHeight: '42px',
              border: '1px solid #e2e8f0', borderRadius: '12px', padding: '11px 14px',
              fontSize: '14px', fontFamily: 'inherit', outline: 'none', background: '#f8fafc',
            }}
          />
          <button
            onClick={handleSend}
            disabled={sending || !draft.trim() || status === 'notfound'}
            aria-label={t('send')}
            style={{
              flexShrink: 0, width: '46px', height: '46px', borderRadius: '12px', border: 'none',
              background: (sending || !draft.trim() || status === 'notfound') ? '#cbd5e1' : accent,
              color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: (sending || !draft.trim() || status === 'notfound') ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s ease',
            }}
          >
            {sending ? <RefreshCw size={18} className="chat-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes chatSpin { to { transform: rotate(360deg); } }
        .chat-spin { animation: chatSpin 0.8s linear infinite; }
      `}</style>
    </div>
  );
}
