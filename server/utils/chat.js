// Shared chat helpers used by BOTH the customer and merchant chat routes so that
// validation rules and timestamp formats can never diverge between the two sides.
//
// Portability note (SQLite now, PostgreSQL later): timestamps are generated in the
// application layer as ISO-8601 UTC strings rather than via SQLite's datetime('now').
// The same string format sorts correctly and round-trips identically on both engines,
// so no database-specific date logic leaks into the routes.

const MAX_MESSAGE_LENGTH = 2000;

// ISO-8601 UTC timestamp, e.g. "2026-08-27T09:15:42.123Z".
function nowIso() {
  return new Date().toISOString();
}

// Validate an inbound chat message body.
// Returns { ok: true, text } with the trimmed text on success,
// or { ok: false, error } with a human-readable reason on failure.
function validateMessageText(raw) {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'Message text is required' };
  }
  const text = raw.trim();
  if (text.length === 0) {
    return { ok: false, error: 'Message cannot be empty' };
  }
  if (text.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: `Message is too long (maximum ${MAX_MESSAGE_LENGTH} characters)` };
  }
  return { ok: true, text };
}

module.exports = { MAX_MESSAGE_LENGTH, nowIso, validateMessageText };
