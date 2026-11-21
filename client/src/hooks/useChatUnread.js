import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch, parseApiResponse } from '../utils/api';

// Polls the unread-count endpoint for the chat nav badge.
//   role: 'customer' -> /api/customer/conversations/unread-count
//   role: 'shop'     -> /api/merchant/conversations/unread-count
// Identity is derived server-side from the JWT; nothing sensitive is sent here.
// Polls on a gentle interval and pauses while the tab is hidden or offline.
export default function useChatUnread(role, intervalMs = 20000) {
  const [unread, setUnread] = useState(0);
  const timerRef = useRef(null);

  const basePath = role === 'shop' ? '/api/merchant' : '/api/customer';

  const fetchUnread = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    try {
      const res = await apiFetch(`${basePath}/conversations/unread-count`);
      const parsed = await parseApiResponse(res);
      const data = parsed.data;
      if (parsed.ok && data && data.success && typeof data.unread_count === 'number') {
        setUnread(data.unread_count);
      }
    } catch (e) {
      // Silent: the badge is best-effort and must never disrupt navigation.
    }
  }, [basePath]);

  useEffect(() => {
    fetchUnread();
    timerRef.current = setInterval(fetchUnread, intervalMs);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchUnread();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchUnread, intervalMs]);

  return unread;
}
