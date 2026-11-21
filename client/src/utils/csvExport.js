import {
  parseApiResponse,
  resolveApiErrorMessage,
  resolveNetworkErrorMessage
} from './apiResponse.js';

/**
 * Downloads a CSV export using an authenticated fetch request with
 * `Authorization: Bearer <token>` so JWTs are never exposed in URLs or logs.
 *
 * @param {{
 *   url: string,
 *   token: string | null | undefined,
 *   fallbackFilename?: string,
 *   t?: (key: string, params?: Record<string, any>) => string
 * }} options
 * @returns {Promise<{ filename: string, size: number }>}
 */
export async function downloadAuthenticatedCsv({
  url,
  token,
  fallbackFilename = 'export.csv',
  t
}) {
  const translate = typeof t === 'function' ? t : (k) => k;
  const authToken =
    token ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('rewards_token') : null);

  if (!authToken) {
    const err = new Error(translate('apiErrorUnauthorized'));
    err.status = 401;
    err.code = 'UNAUTHORIZED';
    throw err;
  }

  let res;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
        Accept: 'text/csv, text/plain, application/json'
      }
    });
  } catch (networkErr) {
    const err = new Error(resolveNetworkErrorMessage(networkErr, translate, 'csvExportFailed'));
    err.code = 'NETWORK_ERROR';
    throw err;
  }

  if (!res.ok) {
    const parsed = await parseApiResponse(res);
    const err = new Error(resolveApiErrorMessage(parsed, translate, 'csvExportFailed'));
    err.status = res.status;
    err.code = parsed.errorCode || `HTTP_${res.status}`;
    throw err;
  }

  const contentType = (
    res.headers && typeof res.headers.get === 'function'
      ? res.headers.get('content-type') || ''
      : ''
  ).toLowerCase();

  // Guard against reverse-proxy/server error responses mistakenly returning HTTP 200 with HTML or JSON
  if (contentType.includes('application/json') || contentType.includes('text/html')) {
    const parsed = await parseApiResponse(res);
    const err = new Error(resolveApiErrorMessage(parsed, translate, 'csvExportFailed'));
    err.status = res.status;
    err.code = parsed.errorCode || 'INVALID_CSV_CONTENT_TYPE';
    throw err;
  }

  const blob = await res.blob();
  const disposition =
    res.headers && typeof res.headers.get === 'function'
      ? res.headers.get('content-disposition') || ''
      : '';
  const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
  const filename =
    match && match[1] ? decodeURIComponent(match[1].trim()) : fallbackFilename;

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);

  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 1000);
  }

  return { filename, size: blob.size };
}
