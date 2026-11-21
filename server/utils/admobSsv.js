/**
 * Official Google AdMob Server-Side Verification (SSV) Verifier
 *
 * Implements Google's ECDSA SHA-256 public-key verification protocol:
 * 1. Fetch Google's public verifier keys JSON from:
 *    https://www.gstatic.com/admob/reward/verifier-keys.json
 *    respecting Cache-Control `max-age` headers and refreshing on unknown `key_id`.
 * 2. Extract raw query parameters up to (but not including) `&signature=` from the URL,
 *    preserving parameter order and URL-decoding values to UTF-8.
 * 3. Verify ASN.1 DER ECDSA SHA-256 signature against the public key matching `key_id`.
 */

const crypto = require('crypto');
const https = require('https');

const GOOGLE_ADMOB_SSV_KEYS_URL = 'https://www.gstatic.com/admob/reward/verifier-keys.json';
const DEFAULT_CACHE_TTL_MS = 3600 * 1000; // 1 hour fallback
const MIN_CACHE_TTL_MS = 60 * 1000;
const MAX_CACHE_TTL_MS = 24 * 3600 * 1000;
const FORCE_REFRESH_COOLDOWN_MS = 30 * 1000;

function parseCacheMaxAgeMs(cacheControlHeader) {
  if (!cacheControlHeader || typeof cacheControlHeader !== 'string') {
    return DEFAULT_CACHE_TTL_MS;
  }
  const match = cacheControlHeader.match(/max-age=(\d+)/i);
  if (!match) return DEFAULT_CACHE_TTL_MS;
  const seconds = parseInt(match[1], 10);
  if (Number.isNaN(seconds) || seconds <= 0) return MIN_CACHE_TTL_MS;
  return Math.min(MAX_CACHE_TTL_MS, Math.max(MIN_CACHE_TTL_MS, seconds * 1000));
}

const MAX_VERIFIER_RESPONSE_BYTES = 1024 * 1024; // 1 MB safety limit

function defaultGoogleKeysFetcher(url = GOOGLE_ADMOB_SSV_KEYS_URL, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    if (!url || !String(url).startsWith('https://')) {
      return reject(new Error('AdMob verifier key URL must use HTTPS'));
    }

    const req = https.get(url, { timeout: timeoutMs }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`AdMob verifier key endpoint returned HTTP ${res.statusCode}`));
      }

      const chunks = [];
      let totalBytes = 0;
      res.on('data', (chunk) => {
        totalBytes += chunk.length;
        if (totalBytes > MAX_VERIFIER_RESPONSE_BYTES) {
          req.destroy(new Error('AdMob verifier key response exceeded 1MB safety limit'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => {
        try {
          const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          const maxAgeMs = parseCacheMaxAgeMs(res.headers['cache-control']);
          resolve({ keys: payload.keys, maxAgeMs });
        } catch (err) {
          reject(new Error(`Invalid AdMob verifier keys JSON: ${err.message}`));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('Timed out fetching Google AdMob verifier keys'));
    });
    req.on('error', (err) => reject(err));
  });
}

function toKeyObject(entry) {
  if (!entry || entry.keyId === undefined || entry.keyId === null) {
    return null;
  }
  const keyId = String(entry.keyId).trim();
  if (!keyId) return null;

  if (entry.pem && typeof entry.pem === 'string') {
    return {
      keyId,
      publicKey: crypto.createPublicKey(entry.pem)
    };
  }

  if (entry.base64 && typeof entry.base64 === 'string') {
    const der = Buffer.from(entry.base64.trim(), 'base64');
    return {
      keyId,
      publicKey: crypto.createPublicKey({ key: der, format: 'der', type: 'spki' })
    };
  }

  return null;
}

function decodeFormComponent(raw) {
  return decodeURIComponent(String(raw).replace(/\+/g, ' '));
}

function decodeSignatureBuffer(rawEncodedSig) {
  if (!rawEncodedSig || typeof rawEncodedSig !== 'string') return null;

  let decoded;
  try {
    decoded = decodeURIComponent(rawEncodedSig.trim());
  } catch (_) {
    return null;
  }

  // Handle base64url (- / _) as well as standard base64 (+ / /) or form-decoded space -> +
  let normalized = decoded.replace(/ /g, '+').replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!normalized || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    return null;
  }

  const mod4 = normalized.length % 4;
  if (mod4 === 1) return null;
  if (mod4 > 1) {
    normalized += '='.repeat(4 - mod4);
  }

  const buf = Buffer.from(normalized, 'base64');
  return buf.length > 0 ? buf : null;
}

/**
 * Extracts and validates Google AdMob SSV query string fields and reconstructs the
 * exact UTF-8 message content signed by Google (all query parameters strictly before
 * `&signature=`, URL-decoded in original parameter order).
 */
function parseSsvCallbackUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { ok: false, code: 'MALFORMED_QUERY', error: 'Missing request URL' };
  }

  const qIdx = rawUrl.indexOf('?');
  if (qIdx === -1) {
    return { ok: false, code: 'MALFORMED_QUERY', error: 'Missing SSV query parameters' };
  }

  let rawQuery = rawUrl.slice(qIdx + 1);
  const hashIdx = rawQuery.indexOf('#');
  if (hashIdx !== -1) {
    rawQuery = rawQuery.slice(0, hashIdx);
  }

  if (!rawQuery) {
    return { ok: false, code: 'MALFORMED_QUERY', error: 'Empty SSV query string' };
  }

  // Parse query pairs cleanly in wire order while rejecting duplicate keys (HTTP parameter pollution guard)
  const segments = rawQuery.split('&');
  const params = Object.create(null);
  const decodedPairs = [];
  let signatureRaw = null;
  let signatureIndex = -1;
  let keyIdIndex = -1;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (!seg) {
      return { ok: false, code: 'MALFORMED_QUERY', error: 'Empty segment in SSV query string' };
    }
    const eqIdx = seg.indexOf('=');
    if (eqIdx <= 0) {
      return { ok: false, code: 'MALFORMED_QUERY', error: 'Malformed key=value parameter in SSV query' };
    }

    const rawKey = seg.slice(0, eqIdx);
    const rawVal = seg.slice(eqIdx + 1);

    let key;
    let decodedVal;
    try {
      key = decodeFormComponent(rawKey);
      decodedVal = decodeFormComponent(rawVal);
    } catch (_) {
      return { ok: false, code: 'MALFORMED_QUERY', error: 'Invalid percent-encoding in SSV query' };
    }

    if (Object.prototype.hasOwnProperty.call(params, key)) {
      return {
        ok: false,
        code: 'DUPLICATE_QUERY_PARAM',
        error: `Duplicate SSV query parameter rejected: ${key}`
      };
    }

    params[key] = decodedVal;

    if (key === 'signature') {
      signatureRaw = rawVal;
      signatureIndex = i;
    } else if (key === 'key_id') {
      keyIdIndex = i;
    } else {
      decodedPairs.push({ index: i, key, decodedVal });
    }
  }

  if (signatureIndex < 0 || !signatureRaw) {
    return { ok: false, code: 'MISSING_SIGNATURE', error: 'Missing SSV signature parameter' };
  }

  if (keyIdIndex < 0 || !params.key_id || !/^\d+$/.test(String(params.key_id).trim())) {
    return { ok: false, code: 'MISSING_KEY_ID', error: 'Missing or invalid SSV key_id parameter' };
  }

  // Per Google AdMob SSV specification, signed content consists strictly of all parameters BEFORE signature=
  if (signatureIndex === 0) {
    return { ok: false, code: 'MALFORMED_SIGNATURE_ORDER', error: 'No signed parameters precede signature' };
  }

  // Ensure signature and key_id follow all signed reward parameters
  const signedPairs = [];
  for (const pair of decodedPairs) {
    if (pair.index > signatureIndex) {
      return {
        ok: false,
        code: 'MALFORMED_PARAM_ORDER',
        error: 'Signed parameters must appear before signature parameter'
      };
    }
    signedPairs.push(`${pair.key}=${pair.decodedVal}`);
  }

  if (keyIdIndex < signatureIndex) {
    return {
      ok: false,
      code: 'MALFORMED_PARAM_ORDER',
      error: 'key_id must not appear inside signed prefix before signature'
    };
  }

  const signatureBuffer = decodeSignatureBuffer(signatureRaw);
  if (!signatureBuffer) {
    return { ok: false, code: 'INVALID_SIGNATURE_ENCODING', error: 'Invalid base64 encoding in signature' };
  }

  const requiredParams = [
    'ad_unit',
    'custom_data',
    'reward_amount',
    'reward_item',
    'timestamp',
    'transaction_id',
    'user_id'
  ];
  for (const reqKey of requiredParams) {
    if (!params[reqKey] || String(params[reqKey]).trim() === '') {
      return {
        ok: false,
        code: 'MISSING_SSV_PARAM',
        error: `Missing required SSV parameter: ${reqKey}`
      };
    }
  }

  const tsNum = Number(params.timestamp);
  if (!Number.isFinite(tsNum) || !Number.isInteger(tsNum) || tsNum <= 0) {
    return { ok: false, code: 'INVALID_TIMESTAMP', error: 'Invalid SSV timestamp' };
  }

  return {
    ok: true,
    signedContent: signedPairs.join('&'),
    signatureBuffer,
    keyId: String(params.key_id).trim(),
    params: {
      ad_network: params.ad_network ? String(params.ad_network).trim() : null,
      ad_unit: String(params.ad_unit).trim(),
      custom_data: String(params.custom_data).trim(),
      reward_amount: String(params.reward_amount).trim(),
      reward_item: String(params.reward_item).trim(),
      timestamp: tsNum,
      transaction_id: String(params.transaction_id).trim(),
      user_id: params.user_id !== undefined ? String(params.user_id).trim() : null
    },
    rawQuery
  };
}

/**
 * Factory producing an SSV verifier instance with cached Google public keys.
 * @param {Object} [options]
 * @param {Function} [options.keyFetcher] - Custom async fetcher returning `{ keys, maxAgeMs }` (used in isolated tests)
 */
function createSsvVerifier(options = {}) {
  const keyFetcher = typeof options.keyFetcher === 'function' ? options.keyFetcher : defaultGoogleKeysFetcher;

  let cachedKeys = new Map();
  let cacheExpiresAt = 0;
  let lastFetchAt = 0;
  let inflightFetch = null;

  async function refreshKeys(force = false) {
    const now = Date.now();
    if (!force && cachedKeys.size > 0 && now < cacheExpiresAt) {
      return cachedKeys;
    }

    if (force && cachedKeys.size > 0 && (now - lastFetchAt) < FORCE_REFRESH_COOLDOWN_MS && options.keyFetcher === undefined) {
      return cachedKeys;
    }

    if (inflightFetch) {
      return inflightFetch;
    }

    inflightFetch = (async () => {
      try {
        const result = await keyFetcher();
        if (!result || !Array.isArray(result.keys)) {
          throw new Error('Malformed verifier keys response');
        }

        const nextMap = new Map();
        for (const entry of result.keys) {
          try {
            const parsed = toKeyObject(entry);
            if (parsed) {
              nextMap.set(parsed.keyId, parsed.publicKey);
            }
          } catch (_) {
            // Skip malformed single key entry safely
          }
        }

        if (nextMap.size === 0) {
          throw new Error('No valid AdMob verifier public keys loaded');
        }

        const ttlMs = Number.isFinite(result.maxAgeMs) && result.maxAgeMs > 0
          ? result.maxAgeMs
          : DEFAULT_CACHE_TTL_MS;

        cachedKeys = nextMap;
        lastFetchAt = Date.now();
        cacheExpiresAt = lastFetchAt + ttlMs;
        return cachedKeys;
      } finally {
        inflightFetch = null;
      }
    })();

    return inflightFetch;
  }

  async function resolvePublicKey(keyId) {
    const map = await refreshKeys(false);
    if (map.has(keyId)) {
      return map.get(keyId);
    }
    const refreshed = await refreshKeys(true);
    return refreshed.get(keyId) || null;
  }

  async function verifyCallbackUrl(rawUrl) {
    const parsed = parseSsvCallbackUrl(rawUrl);
    if (!parsed.ok) {
      return parsed;
    }

    let publicKey;
    try {
      publicKey = await resolvePublicKey(parsed.keyId);
    } catch (err) {
      return {
        ok: false,
        code: 'VERIFIER_KEY_FETCH_FAILED',
        error: `Failed to retrieve Google AdMob verifier key: ${err.message}`,
        params: parsed.params,
        keyId: parsed.keyId
      };
    }

    if (!publicKey) {
      return {
        ok: false,
        code: 'UNKNOWN_KEY_ID',
        error: `Unknown Google AdMob key_id: ${parsed.keyId}`,
        params: parsed.params,
        keyId: parsed.keyId
      };
    }

    let isValid = false;
    try {
      isValid = crypto.verify(
        'sha256',
        Buffer.from(parsed.signedContent, 'utf8'),
        { key: publicKey, dsaEncoding: 'der' },
        parsed.signatureBuffer
      );
    } catch (_) {
      isValid = false;
    }

    if (!isValid) {
      return {
        ok: false,
        code: 'INVALID_SSV_SIGNATURE',
        error: 'AdMob SSV ECDSA signature verification failed',
        params: parsed.params,
        keyId: parsed.keyId
      };
    }

    return {
      ok: true,
      params: parsed.params,
      keyId: parsed.keyId,
      signedContent: parsed.signedContent,
      signatureBuffer: parsed.signatureBuffer,
      rawQuery: parsed.rawQuery
    };
  }

  function clearCache() {
    cachedKeys = new Map();
    cacheExpiresAt = 0;
    lastFetchAt = 0;
  }

  return {
    verifyCallbackUrl,
    refreshKeys,
    clearCache
  };
}

const defaultVerifier = createSsvVerifier();

module.exports = {
  GOOGLE_ADMOB_SSV_KEYS_URL,
  decodeSignatureBuffer,
  parseSsvCallbackUrl,
  createSsvVerifier,
  verifyAdMobSsvCallback: defaultVerifier.verifyCallbackUrl
};
