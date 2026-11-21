/**
 * Safe API Response & Error Parsing Helpers
 *
 * Prevents unhandled SyntaxError crashes and raw HTML error page leakage when
 * an endpoint returns HTTP 404/502/503 HTML, empty bodies, or malformed JSON.
 * Never fabricates successful responses.
 */

const HTML_BODY_REGEX = /^(?:<!doctype\s+html|<html[\s>])/i;
const HTML_FRAGMENT_REGEX = /<(?:html|head|body|title|h1|p|pre|div|span|script)\b[^>]*>/i;
const PARSE_LEAK_REGEX = /unexpected token|is not valid json|unexpected end of json/i;

/**
 * Safely parses a Fetch API Response object by checking HTTP status,
 * Content-Type, and raw text before attempting JSON.parse.
 *
 * @param {Response} res
 * @returns {Promise<{
 *   ok: boolean,
 *   httpOk: boolean,
 *   status: number,
 *   isJson: boolean,
 *   isHtml: boolean,
 *   data: any,
 *   errorCode: string | null,
 *   serverMessage: string
 * }>}
 */
export async function parseApiResponse(res) {
  if (!res) {
    return {
      ok: false,
      httpOk: false,
      status: 0,
      isJson: false,
      isHtml: false,
      data: null,
      errorCode: 'INVALID_RESPONSE',
      serverMessage: ''
    };
  }

  const status = typeof res.status === 'number' ? res.status : 0;
  const httpOk = Boolean(res.ok);
  const contentType = (
    res.headers && typeof res.headers.get === 'function'
      ? res.headers.get('content-type') || ''
      : ''
  ).toLowerCase();

  let rawText = '';
  try {
    if (typeof res.text === 'function') {
      rawText = await res.text();
    } else if (typeof res.json === 'function') {
      const jsonObj = await res.json();
      rawText = JSON.stringify(jsonObj);
    }
  } catch (_) {
    rawText = '';
  }

  const trimmed = typeof rawText === 'string' ? rawText.trim() : '';
  const isHtmlByType =
    contentType.includes('text/html') || contentType.includes('application/xhtml');
  const isHtmlByBody =
    trimmed.length > 0 &&
    (HTML_BODY_REGEX.test(trimmed) ||
      (!contentType.includes('application/json') && HTML_FRAGMENT_REGEX.test(trimmed.slice(0, 300))));
  const isHtml = isHtmlByType || isHtmlByBody;

  let data = null;
  let isJson = false;
  let parseFailed = false;

  if (!isHtml && trimmed.length > 0) {
    const looksLikeJson =
      contentType.includes('json') ||
      trimmed.startsWith('{') ||
      trimmed.startsWith('[');

    if (looksLikeJson) {
      try {
        data = JSON.parse(trimmed);
        if (data !== null && typeof data === 'object') {
          isJson = true;
        } else {
          data = null;
          parseFailed = true;
        }
      } catch (_) {
        data = null;
        parseFailed = true;
      }
    }
  }

  let serverMessage = '';
  if (isJson && data) {
    const rawMsg =
      typeof data.error === 'string'
        ? data.error
        : typeof data.message === 'string'
        ? data.message
        : '';
    const cleaned = rawMsg.trim();
    if (
      cleaned &&
      !HTML_BODY_REGEX.test(cleaned) &&
      !HTML_FRAGMENT_REGEX.test(cleaned) &&
      !PARSE_LEAK_REGEX.test(cleaned)
    ) {
      serverMessage = cleaned;
    }
  }

  const ok = httpOk && isJson && data !== null;
  let errorCode = null;

  if (!ok) {
    if (status === 401) {
      errorCode = 'UNAUTHORIZED';
    } else if (status === 403) {
      errorCode = data && data.code === 'PROFILE_INCOMPLETE' ? 'PROFILE_INCOMPLETE' : 'FORBIDDEN';
    } else if (status === 404) {
      errorCode = isHtml ? 'ENDPOINT_NOT_FOUND_HTML' : 'NOT_FOUND';
    } else if (status >= 500) {
      errorCode = 'SERVER_ERROR';
    } else if (isHtml) {
      errorCode = 'HTML_ERROR_RESPONSE';
    } else if (parseFailed || (!isJson && trimmed.length > 0)) {
      errorCode = 'INVALID_JSON_RESPONSE';
    } else if (trimmed.length === 0) {
      errorCode = 'EMPTY_RESPONSE';
    } else {
      errorCode = 'REQUEST_FAILED';
    }
  } else if (data && data.success === false) {
    errorCode = 'API_ERROR';
  }

  return {
    ok,
    httpOk,
    status,
    isJson,
    isHtml,
    data,
    errorCode,
    serverMessage
  };
}

/**
 * Resolves a localized, human-readable error message from a parsed API response.
 * Never returns raw HTML or JSON parser error strings.
 *
 * @param {Awaited<ReturnType<typeof parseApiResponse>>} parsed
 * @param {(key: string, params?: Record<string, any>) => string} t
 * @param {string} [fallbackKey='serverErrorFallback']
 * @returns {string}
 */
export function resolveApiErrorMessage(parsed, t, fallbackKey = 'serverErrorFallback') {
  const translate = typeof t === 'function' ? t : (k) => k;

  if (parsed && parsed.serverMessage && !parsed.isHtml) {
    return parsed.serverMessage;
  }

  switch (parsed?.errorCode) {
    case 'UNAUTHORIZED':
      return translate('apiErrorUnauthorized');
    case 'FORBIDDEN':
    case 'PROFILE_INCOMPLETE':
      return translate('apiErrorForbidden');
    case 'ENDPOINT_NOT_FOUND_HTML':
      return translate('apiErrorServiceUnavailable');
    case 'NOT_FOUND':
      return translate('apiErrorNotFound');
    case 'SERVER_ERROR':
      return translate('apiErrorServer');
    case 'HTML_ERROR_RESPONSE':
    case 'INVALID_JSON_RESPONSE':
    case 'EMPTY_RESPONSE':
    case 'INVALID_RESPONSE':
      return translate('apiErrorUnexpectedResponse');
    default:
      return translate(fallbackKey);
  }
}

/**
 * Resolves a safe localized error message when fetch or response handling throws,
 * ensuring JS JSON SyntaxErrors or raw HTML fragments never leak into the UI.
 *
 * @param {any} err
 * @param {(key: string, params?: Record<string, any>) => string} t
 * @param {string} [fallbackKey='networkErrorGeneric']
 * @returns {string}
 */
export function resolveNetworkErrorMessage(err, t, fallbackKey = 'networkErrorGeneric') {
  const translate = typeof t === 'function' ? t : (k) => k;
  const msg = err && typeof err.message === 'string' ? err.message.trim() : '';

  if (
    !msg ||
    err?.name === 'SyntaxError' ||
    PARSE_LEAK_REGEX.test(msg) ||
    HTML_BODY_REGEX.test(msg) ||
    HTML_FRAGMENT_REGEX.test(msg)
  ) {
    return translate(
      err?.name === 'SyntaxError' || PARSE_LEAK_REGEX.test(msg)
        ? 'apiErrorUnexpectedResponse'
        : fallbackKey
    );
  }

  if (err?.name === 'TypeError' || /failed to fetch|networkerror|load failed/i.test(msg)) {
    return translate(fallbackKey);
  }

  return msg;
}
