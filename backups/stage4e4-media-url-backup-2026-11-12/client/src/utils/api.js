// Centralized API Base Configuration & Dual-Mode Interceptor
//
// The backend origin is supplied exclusively via VITE_API_URL at build time.
// There is intentionally NO hardcoded fallback: a production build that ships
// without a real HTTPS origin must fail loudly rather than silently point at
// an unreachable emulator/localhost address.
//   • Development / Android emulator (`npm run dev`, `npm run build:dev`)
//       -> VITE_API_URL comes from client/.env.development (http://10.0.2.2:5000)
//   • Production (`npm run build`)
//       -> VITE_API_URL must be your public HTTPS API (see client/.env.production.example)
export const API_BASE_URL = import.meta.env.VITE_API_URL;

// Hosts that are only reachable in local development (emulator alias / loopback).
// A *production* build must never resolve its API origin to any of these.
const DEV_ONLY_HOSTS = ['10.0.2.2', 'localhost', '127.0.0.1', '0.0.0.0'];

/**
 * Returns the normalized absolute backend origin, or throws if it is missing or
 * (in a production build) points at a development-only host. Used for native
 * apps and production browser builds — never for the dev server, which proxies.
 */
const resolveBaseUrl = () => {
  const base = (API_BASE_URL || '').trim().replace(/\/+$/, '');
  if (!base) {
    throw new Error(
      '[config] VITE_API_URL is not set. The app has no backend to talk to. ' +
      'Set VITE_API_URL at build time (see client/.env.production.example).'
    );
  }
  if (import.meta.env.MODE === 'production') {
    let host = '';
    try { host = new URL(base).hostname; } catch (e) { host = ''; }
    if (DEV_ONLY_HOSTS.includes(host)) {
      throw new Error(
        `[config] VITE_API_URL points to development-only host "${host}" in a production build. ` +
        'Use your public HTTPS origin, or build the emulator bundle with "npm run build:dev".'
      );
    }
  }
  return base;
};

/**
 * Safely detects whether the application is running inside a native Capacitor container (Android / iOS)
 */
export const isCapacitorNative = () => {
  if (typeof window === 'undefined') return false;

  // 1. Check window.Capacitor bridge object
  if (window.Capacitor) {
    if (typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) {
      return true;
    }
    if (typeof window.Capacitor.getPlatform === 'function') {
      const platform = window.Capacitor.getPlatform();
      if (platform === 'android' || platform === 'ios') {
        return true;
      }
    }
  }

  // 2. Check Android / iOS WebView schemes and origins
  if (window.location.protocol === 'capacitor:' || window.location.protocol === 'file:') {
    return true;
  }

  // 3. Android WebView localhost check (No dev port 3000)
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    if (!window.location.port || window.location.port === '80' || window.location.port === '') {
      return true;
    }
  }

  return false;
};

/**
 * Resolves an API path based on execution mode:
 * - Dev server (browser): relative `/api/...` path, handled by the Vite dev proxy -> 127.0.0.1:5000
 * - Native app (Android/iOS) OR production browser build: VITE_API_URL + `/api/...`
 *   (dev/emulator builds resolve to http://10.0.2.2:5000 via .env.development)
 */
export const getApiUrl = (path) => {
  if (!path) return path;

  // Do not alter full URLs (http:// or https://)
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const isNative = isCapacitorNative();

  // Genuine Vite dev server only: use a relative path so the dev proxy forwards it.
  if (!isNative && import.meta.env.DEV) {
    return cleanPath;
  }

  // Native app, or a production browser build: require an explicit absolute origin.
  const cleanBase = resolveBaseUrl();
  return `${cleanBase}${cleanPath}`;
};

/**
 * Robust Centralized Request Helper supporting GET, POST, PUT, PATCH, DELETE
 * Preserves Authorization headers, JWT tokens, Content-Type, and JSON bodies.
 * Safely logs diagnostic information without logging tokens or request bodies.
 */
export const apiFetch = async (resource, options = {}) => {
  const url = typeof resource === 'string' ? resource : (resource && resource.url ? resource.url : String(resource));
  const resolvedUrl = getApiUrl(url);
  const method = (options && options.method) ? options.method.toUpperCase() : 'GET';

  console.log(`[API Request] ${method} ${url} → ${resolvedUrl}`);

  const defaultHeaders = {
    'Content-Type': 'application/json'
  };

  const token = localStorage.getItem('rewards_token');
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {})
    }
  };

  const fetchFn = window.__originalFetch || window.fetch;
  try {
    const res = await fetchFn(resolvedUrl, config);
    console.log(`[API Response] ${method} ${resolvedUrl} → HTTP ${res.status} ${res.statusText}`);
    return res;
  } catch (err) {
    console.error(`[API Network Error] ${method} ${resolvedUrl} → ${err.name}: ${err.message}`);
    throw err;
  }
};

/**
 * Transparent global window.fetch interceptor.
 * Automatically converts relative `/api/...` requests in Capacitor Android to http://10.0.2.2:5000/api/...
 * Safely logs diagnostic info without leaking credentials or request payloads.
 */
export const setupGlobalFetchInterceptor = () => {
  if (typeof window === 'undefined' || window.__apiFetchInterceptorSet) return;
  window.__apiFetchInterceptorSet = true;

  const originalFetch = window.fetch;
  window.__originalFetch = originalFetch;

  window.fetch = async function (resource, config) {
    let url = '';
    let isRequestInstance = false;

    if (typeof resource === 'string') {
      url = resource;
    } else if (resource && typeof resource === 'object' && resource.url) {
      url = resource.url;
      isRequestInstance = true;
    }

    if (typeof url === 'string' && (url.startsWith('/api') || url.startsWith('api/'))) {
      const formattedPath = url.startsWith('/') ? url : `/${url}`;
      const resolvedUrl = getApiUrl(formattedPath);
      const method = (config && config.method) || (resource && resource.method) || 'GET';

      console.log(`[API Intercept] ${method} ${url} → ${resolvedUrl}`);

      try {
        let res;
        if (isRequestInstance) {
          const clonedReq = new Request(resolvedUrl, resource);
          res = await originalFetch.call(this, clonedReq, config);
        } else {
          res = await originalFetch.call(this, resolvedUrl, config);
        }
        console.log(`[API Intercept Response] ${method} ${resolvedUrl} → HTTP ${res.status} ${res.statusText}`);
        return res;
      } catch (err) {
        console.error(`[API Intercept Network Error] ${method} ${resolvedUrl} → ${err.name}: ${err.message}`);
        throw err;
      }
    }

    return originalFetch.apply(this, arguments);
  };
};

// Auto-run interceptor on module load
setupGlobalFetchInterceptor();

export {
  parseApiResponse,
  resolveApiErrorMessage,
  resolveNetworkErrorMessage
} from './apiResponse';
