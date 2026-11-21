/**
 * Customer Google OAuth ID-Token Verification & Safe Diagnostics Helper
 *
 * Responsibilities:
 *  1. Normalize OAuth Client IDs from environment variables (trim whitespace/CR,
 *     strip matching surrounding quotes, support comma-separated audiences, and
 *     treat empty/blank values as unconfigured rather than letting verifyIdToken
 *     throw a misleading 401 audience error).
 *  2. Reuse an OAuth2Client instance per primary client ID so Google's public PEM
 *     certificates respect Cache-Control max-age instead of re-fetching on every
 *     login request, while recovering once cleanly on key rotation ("No pem found").
 *  3. Emit strict non-secret diagnostics when verification fails or at server boot
 *     without EVER logging raw ID tokens, access tokens, JWT segments, passwords,
 *     secrets, or user PII.
 */

function stripMatchingQuotes(value) {
  if (typeof value !== 'string') return '';
  let s = value.trim();
  if (
    (s.startsWith('"') && s.endsWith('"') && s.length >= 2) ||
    (s.startsWith("'") && s.endsWith("'") && s.length >= 2)
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

/**
 * Parses a single or comma/newline-separated OAuth client ID env variable into
 * a deduplicated array of clean client IDs.
 *
 * @param {string | undefined | null} rawValue
 * @returns {string[]}
 */
function parseClientIds(rawValue) {
  if (typeof rawValue !== 'string') return [];
  const trimmed = rawValue.trim();
  if (!trimmed) return [];

  const seen = new Set();
  const result = [];
  for (const part of trimmed.split(/[,\n]+/)) {
    const clean = stripMatchingQuotes(part.replace(/\r/g, ''));
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      result.push(clean);
    }
  }
  return result;
}

/**
 * Reads normalized Google OAuth audience configuration from env.
 *
 * @param {NodeJS.ProcessEnv} [env=process.env]
 */
function getConfiguredGoogleOAuthConfig(env = process.env) {
  const rawWeb = env.GOOGLE_WEB_CLIENT_ID;
  const rawIos = env.GOOGLE_IOS_CLIENT_ID;
  const rawExtra = env.GOOGLE_ALLOWED_AUDIENCES;

  const webClientIds = parseClientIds(rawWeb);
  const iosClientIds = parseClientIds(rawIos);
  const extraClientIds = parseClientIds(rawExtra);

  const audiences = [];
  const seen = new Set();
  for (const id of [...webClientIds, ...iosClientIds, ...extraClientIds]) {
    if (!seen.has(id)) {
      seen.add(id);
      audiences.push(id);
    }
  }

  const hadWebFormattingArtifacts =
    typeof rawWeb === 'string' &&
    rawWeb.length > 0 &&
    webClientIds.length === 1 &&
    rawWeb !== webClientIds[0];

  return {
    webClientIds,
    iosClientIds,
    extraClientIds,
    audiences,
    primaryClientId: webClientIds[0] || '',
    hadWebFormattingArtifacts
  };
}

/**
 * Masks an OAuth client ID so logs can compare prefix/suffix/length without
 * dumping full identifiers unnecessarily. Never returns raw secret material.
 *
 * @param {string | undefined | null} clientId
 * @returns {string | null}
 */
function maskClientId(clientId) {
  if (typeof clientId !== 'string' || !clientId) return null;
  const len = clientId.length;
  const suffix = '.apps.googleusercontent.com';
  if (clientId.endsWith(suffix) && len > suffix.length + 18) {
    const core = clientId.slice(0, -suffix.length);
    return `${core.slice(0, 16)}...${core.slice(-8)}${suffix} (len=${len})`;
  }
  if (len <= 18) {
    return `${clientId.slice(0, 4)}*** (len=${len})`;
  }
  return `${clientId.slice(0, 14)}...${clientId.slice(-10)} (len=${len})`;
}

function decodeBase64UrlJson(segment) {
  if (typeof segment !== 'string' || !segment) return null;
  try {
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + '='.repeat(padLength);
    const decoded = Buffer.from(padded, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    return null;
  }
}

function clampString(val, maxLen = 128) {
  if (typeof val !== 'string') return null;
  return val.slice(0, maxLen);
}

/**
 * Extracts strictly non-sensitive structural/timing/audience metadata from an
 * unverified JWT for server-side failure diagnostics.
 * NEVER extracts or returns raw token strings, signatures, email, sub, name, or secrets.
 *
 * @param {string} idToken
 * @param {string[]} [configuredAudiences=[]]
 */
function inspectUnverifiedTokenMetadata(idToken, configuredAudiences = []) {
  const serverNowMs = Date.now();
  const serverNowSec = Math.floor(serverNowMs / 1000);
  const serverNowIso = new Date(serverNowMs).toISOString();

  if (typeof idToken !== 'string') {
    return {
      segmentCount: 0,
      alg: null,
      kid: null,
      iss: null,
      tokenAudHint: null,
      tokenAzpHint: null,
      audMatchesConfigured: false,
      azpMatchesConfigured: false,
      serverNowIso,
      tokenIatIso: null,
      tokenExpIso: null,
      clockSkewFromIatSec: null,
      secondsUntilExp: null
    };
  }

  const segments = idToken.split('.');
  const header = segments.length >= 1 ? decodeBase64UrlJson(segments[0]) : null;
  const payload = segments.length >= 2 ? decodeBase64UrlJson(segments[1]) : null;

  const aud = payload && typeof payload.aud === 'string' ? payload.aud : null;
  const azp = payload && typeof payload.azp === 'string' ? payload.azp : null;
  const iss = payload && typeof payload.iss === 'string' ? clampString(payload.iss, 128) : null;

  const iatNum = payload && payload.iat !== undefined ? Number(payload.iat) : NaN;
  const expNum = payload && payload.exp !== undefined ? Number(payload.exp) : NaN;
  const hasValidIat = Number.isFinite(iatNum) && iatNum > 0;
  const hasValidExp = Number.isFinite(expNum) && expNum > 0;

  return {
    segmentCount: segments.length,
    alg: header && typeof header.alg === 'string' ? clampString(header.alg, 32) : null,
    kid: header && typeof header.kid === 'string' ? clampString(header.kid, 64) : null,
    iss,
    tokenAudHint: maskClientId(aud),
    tokenAzpHint: maskClientId(azp),
    audMatchesConfigured: Boolean(aud && configuredAudiences.includes(aud)),
    azpMatchesConfigured: Boolean(azp && configuredAudiences.includes(azp)),
    serverNowIso,
    tokenIatIso: hasValidIat ? new Date(iatNum * 1000).toISOString() : null,
    tokenExpIso: hasValidExp ? new Date(expNum * 1000).toISOString() : null,
    clockSkewFromIatSec: hasValidIat ? serverNowSec - Math.floor(iatNum) : null,
    secondsUntilExp: hasValidExp ? Math.floor(expNum) - serverNowSec : null
  };
}

/**
 * Strips any raw JWT, serialized payload JSON, or query credential from an
 * error message before classifying and logging it.
 *
 * @param {string} rawMessage
 * @returns {string}
 */
function sanitizeErrorMessage(rawMessage) {
  if (typeof rawMessage !== 'string' || !rawMessage) return 'Unknown verification error';

  let msg = rawMessage;

  // google-auth-library embeds raw JWT or JSON.stringify(payload) after these prefixes
  const cutoffPrefixes = [
    'Wrong number of segments in token:',
    "Can't parse token envelope:",
    "Can't parse token payload",
    'Invalid token signature:',
    'Expiration time too far in future:',
    'No issue time in token:',
    'No expiration time in token:'
  ];
  for (const prefix of cutoffPrefixes) {
    const idx = msg.indexOf(prefix);
    if (idx !== -1) {
      msg = msg.slice(0, idx + prefix.length).replace(/:$/, '');
      break;
    }
  }

  // "Token used too early, X < Y: {payload}" or "Token used too late, X > Y: {payload}"
  if (/^Token used too (early|late)/i.test(msg)) {
    const jsonIdx = msg.indexOf(': {');
    if (jsonIdx !== -1) {
      msg = msg.slice(0, jsonIdx);
    }
  }

  // Scrub any remaining JWTs, JSON objects, or query credentials
  msg = msg
    .replace(/eyJ[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]*){0,2}/g, '[REDACTED_JWT]')
    .replace(/\{[^}]*\}/g, '[REDACTED_OBJECT]')
    .replace(/([?&](?:access_token|id_token|token|key|secret|password)=)[^&\s]+/gi, '$1[REDACTED]');

  return msg.slice(0, 160);
}

/**
 * Maps a google-auth-library error into a stable reason code and sanitized summary.
 *
 * @param {unknown} err
 */
function classifyGoogleVerificationError(err) {
  const rawMessage = err && typeof err.message === 'string' ? err.message : String(err || '');
  const lower = rawMessage.toLowerCase();

  let reason = 'verification_error';
  if (lower.includes('wrong recipient') || lower.includes('audience')) {
    reason = 'audience_mismatch';
  } else if (lower.includes('token used too early')) {
    reason = 'token_used_too_early';
  } else if (lower.includes('token used too late')) {
    reason = 'token_used_too_late';
  } else if (lower.includes('expiration time too far in future')) {
    reason = 'exp_too_far_in_future';
  } else if (lower.includes('invalid issuer')) {
    reason = 'invalid_issuer';
  } else if (
    lower.includes('failed to retrieve verification certificates') ||
    lower.includes('enotfound') ||
    lower.includes('etimedout') ||
    lower.includes('econnreset') ||
    lower.includes('econnrefused') ||
    lower.includes('eai_again') ||
    lower.includes('network')
  ) {
    reason = 'cert_fetch_failed';
  } else if (lower.includes('no pem found for envelope')) {
    reason = 'pem_not_found';
  } else if (lower.includes('invalid token signature')) {
    reason = 'invalid_signature';
  } else if (
    lower.includes('no issue time') ||
    lower.includes('no expiration time') ||
    lower.includes('iat field') ||
    lower.includes('exp field')
  ) {
    reason = 'missing_time_claims';
  } else if (
    lower.includes('wrong number of segments') ||
    lower.includes("can't parse token")
  ) {
    reason = 'malformed_jwt';
  }

  return {
    reason,
    errorCode: err && err.code ? String(err.code) : null,
    summary: sanitizeErrorMessage(rawMessage)
  };
}

let cachedClient = null;
let cachedClientCtor = null;
let cachedPrimaryClientId = null;

function getOrCreateOAuth2Client(OAuth2ClientCtor, primaryClientId) {
  if (
    cachedClient &&
    cachedClientCtor === OAuth2ClientCtor &&
    cachedPrimaryClientId === primaryClientId
  ) {
    return cachedClient;
  }

  cachedClient = new OAuth2ClientCtor(primaryClientId);
  cachedClientCtor = OAuth2ClientCtor;
  cachedPrimaryClientId = primaryClientId;
  return cachedClient;
}

function resetCachedOAuth2Client() {
  cachedClient = null;
  cachedClientCtor = null;
  cachedPrimaryClientId = null;
}

/**
 * Verifies a customer Google ID token with normalized configured audiences,
 * certificate-cache reuse, key-rotation retry, and non-secret failure logging.
 *
 * @param {string} rawIdToken
 * @param {NodeJS.ProcessEnv} [env=process.env]
 */
async function verifyCustomerGoogleIdToken(rawIdToken, env = process.env) {
  const idToken = typeof rawIdToken === 'string' ? rawIdToken.trim() : '';
  if (!idToken) {
    return {
      ok: false,
      status: 400,
      code: 'missing_token',
      error: 'Google ID token is required'
    };
  }

  // Lazy-load the verifier so the server still boots before `npm install`
  // adds google-auth-library. Returns a clear, actionable error until then.
  let OAuth2Client;
  try {
    ({ OAuth2Client } = require('google-auth-library'));
  } catch (e) {
    return {
      ok: false,
      status: 503,
      code: 'library_unavailable',
      error: 'Google sign-in is not available on the server yet (run "npm install" in /server).'
    };
  }

  const config = getConfiguredGoogleOAuthConfig(env);
  if (config.webClientIds.length === 0) {
    console.warn('[CustomerGoogleAuth] Rejected login: GOOGLE_WEB_CLIENT_ID is missing or empty.');
    return {
      ok: false,
      status: 503,
      code: 'not_configured',
      error: 'Google sign-in is not configured on the server (GOOGLE_WEB_CLIENT_ID missing).'
    };
  }

  const verifyOptions = {
    idToken,
    audience: config.audiences.length === 1 ? config.audiences[0] : config.audiences
  };

  try {
    const client = getOrCreateOAuth2Client(OAuth2Client, config.primaryClientId);
    let ticket;
    try {
      ticket = await client.verifyIdToken(verifyOptions);
    } catch (firstErr) {
      const classified = classifyGoogleVerificationError(firstErr);
      // If Google rotated signing certificates before cached PEM expiry, clear cache once and retry.
      if (classified.reason === 'pem_not_found' && client.certificateCache) {
        client.certificateCache = {};
        client.certificateExpiry = null;
        ticket = await client.verifyIdToken(verifyOptions);
      } else {
        throw firstErr;
      }
    }

    const payload = ticket && typeof ticket.getPayload === 'function' ? ticket.getPayload() : null;
    if (!payload || !payload.sub) {
      const metadata = inspectUnverifiedTokenMetadata(idToken, config.audiences);
      console.error(
        '[CustomerGoogleAuth] ID token verified without subject claim:',
        JSON.stringify({
          reason: 'missing_sub',
          iss: metadata.iss,
          tokenAudHint: metadata.tokenAudHint,
          serverNowIso: metadata.serverNowIso
        })
      );
      return {
        ok: false,
        status: 401,
        code: 'missing_sub',
        error: 'Invalid Google credential'
      };
    }

    return {
      ok: true,
      payload,
      config
    };
  } catch (err) {
    const classified = classifyGoogleVerificationError(err);
    const metadata = inspectUnverifiedTokenMetadata(idToken, config.audiences);
    const diagnostic = {
      reason: classified.reason,
      errorCode: classified.errorCode,
      summary: classified.summary,
      configuredWebAudiences: config.webClientIds.map(maskClientId),
      configuredIosAudiences: config.iosClientIds.map(maskClientId),
      hadWebFormattingArtifacts: config.hadWebFormattingArtifacts,
      token: metadata
    };

    console.error('[CustomerGoogleAuth] ID token verification failed:', JSON.stringify(diagnostic));

    return {
      ok: false,
      status: 401,
      code: classified.reason,
      error: 'Invalid or unverifiable Google credential',
      diagnostic
    };
  }
}

/**
 * Logs non-secret Google OAuth server configuration & UTC clock at startup.
 *
 * @param {NodeJS.ProcessEnv} [env=process.env]
 */
function logGoogleOAuthStartupDiagnostics(env = process.env) {
  const config = getConfiguredGoogleOAuthConfig(env);
  const serverUtc = new Date().toISOString();

  if (config.webClientIds.length === 0) {
    console.warn(
      `⚠️  [GoogleOAuth] GOOGLE_WEB_CLIENT_ID is not configured (customer Google Sign-In disabled). Server UTC: ${serverUtc}`
    );
    return;
  }

  console.log(
    `🔐 [GoogleOAuth] Web Client IDs=${config.webClientIds.length} [${config.webClientIds.map(maskClientId).join(', ')}] | iOS Client IDs=${config.iosClientIds.length} | Server UTC=${serverUtc}`
  );

  if (config.hadWebFormattingArtifacts) {
    console.warn(
      '⚠️  [GoogleOAuth] GOOGLE_WEB_CLIENT_ID contained surrounding whitespace, quotes, or CR characters and was normalized at runtime.'
    );
  }
}

module.exports = {
  parseClientIds,
  getConfiguredGoogleOAuthConfig,
  maskClientId,
  inspectUnverifiedTokenMetadata,
  sanitizeErrorMessage,
  classifyGoogleVerificationError,
  resetCachedOAuth2Client,
  verifyCustomerGoogleIdToken,
  logGoogleOAuthStartupDiagnostics
};
