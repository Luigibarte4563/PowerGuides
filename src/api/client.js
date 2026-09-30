/**
 * Single HTTP client for the PowerGuide Dagupan PHP API.
 *
 * Every network call in the app goes through `apiRequest` (or `uploadWithProgress`
 * for image uploads) so that the base URL, credentials, error handling and
 * response normalisation live in exactly one place.
 *
 * ---------------------------------------------------------------------------
 * TODO(API-CONFIRM): the reference document lists endpoints only, so the
 * request/response shapes below are best-effort guesses. Everything that is not
 * guaranteed has been marked with a `TODO` comment. Once the PHP files are
 * available, confirm / adjust:
 *   1. The JSON envelope used by the API (see `unwrapPayload` / `pickList`).
 *   2. Request field names for every `create` / `update` payload.
 *   3. Whether `auth/login.php` returns a session cookie, a token, or both
 *      (the client supports both: `credentials: 'include'` + optional bearer).
 * ---------------------------------------------------------------------------
 */

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost/CrowdsourcedAPI'
).replace(/\/+$/, '');

/**
 * The API reads the JWT from the `jwt_token` cookie (`auth/jwt_auth.php` uses
 * `$_COOKIE['jwt_token']` and ignores the Authorization header), so the cookie is
 * the source of truth. localStorage keeps a copy for reference only.
 */
const TOKEN_KEY = 'powerguide.token';
export const JWT_COOKIE = 'jwt_token';

function writeJwtCookie(token) {
  if (typeof document === 'undefined') return;
  // 7 days, lax so it is sent with the same-site XHRs the app makes.
  const maxAge = 60 * 60 * 24 * 7;
  document.cookie = `${JWT_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function getStoredToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function setStoredToken(token) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable (private mode) - the API session cookie still works */
  }
  // Reflect the token in the cookie the API actually reads.
  if (token) writeJwtCookie(token);
  else if (typeof document !== 'undefined') {
    document.cookie = `${JWT_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  }
}

export class ApiError extends Error {
  constructor(message, { status = 0, errors = null, payload = null, isNetworkError = false } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
    this.payload = payload;
    this.isNetworkError = isNetworkError;
  }
}

const NETWORK_ERROR_MESSAGE =
  'We could not reach the PowerGuide server. Check your connection and try again.';

const STATUS_ERROR_MESSAGES = {
  400: 'Some of the information you entered is not valid. Please review the form and try again.',
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have permission to perform that action.',
  404: 'The requested record could not be found.',
  409: 'That record already exists.',
  413: 'The file you selected is too large.',
  422: 'Some of the information you entered is not valid. Please review the form and try again.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'The server ran into a problem. Please try again shortly.',
  502: 'The server is temporarily unavailable. Please try again shortly.',
  503: 'The server is temporarily unavailable. Please try again shortly.',
};

/** Build `path?query` and drop empty query values. */
export function buildUrl(path, params) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_BASE_URL}${cleanPath}`;
  if (!params) return url;

  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.append(key, String(value));
  });

  const query = search.toString();
  return query ? `${url}?${query}` : url;
}

/**
 * Normalise the many envelopes a PHP API can return.
 * TODO(API-CONFIRM): collapse to the single envelope the API really uses.
 */
export function unwrapPayload(payload) {
  if (payload === null || payload === undefined) return null;
  if (Array.isArray(payload)) return payload;
  if (typeof payload !== 'object') return payload;

  if ('data' in payload) return payload.data;
  if ('result' in payload) return payload.result;
  if ('records' in payload) return payload.records;
  if ('items' in payload) return payload.items;
  return payload;
}

/** Best-effort extraction of a list from a response payload. */
export function pickList(payload) {
  const data = unwrapPayload(payload);
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const arrayValue = Object.values(data).find((value) => Array.isArray(value));
    if (arrayValue) return arrayValue;
  }
  return [];
}

/** Best-effort extraction of a single record from a response payload. */
export function pickItem(payload) {
  const data = unwrapPayload(payload);
  if (Array.isArray(data)) return data[0] ?? null;
  if (data && typeof data === 'object') {
    const nested = Object.values(data).find(
      (value) => value && typeof value === 'object' && !Array.isArray(value)
    );
    return nested || data;
  }
  return null;
}

/** Pull a human readable message + field errors out of an error payload. */
function readErrorDetails(payload) {
  if (!payload || typeof payload !== 'object') {
    return { message: '', errors: null };
  }

  let errors = null;
  const candidate = payload.errors || payload.error || payload.errors_msg;
  if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
    errors = candidate;
  }

  let message = '';
  const messageCandidates = [
    payload.message,
    typeof payload.error === 'string' ? payload.error : null,
    payload.error_msg,
  ].filter((value) => typeof value === 'string' && value.trim());

  if (messageCandidates.length) {
    message = messageCandidates[0].trim();
  } else if (errors) {
    message = Object.values(errors).filter((v) => typeof v === 'string')[0] || '';
  }

  return { message, errors };
}

async function parseBody(response) {
  const contentType = response.headers.get('content-type') || '';
  if (response.status === 204) return null;
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
  try {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return { message: text };
    }
  } catch {
    return null;
  }
}

const DEFAULT_TIMEOUT = 30000;

/**
 * Core request helper.
 *
 * @param {string} path                 Path relative to the API base URL, e.g. `/api/auth/me.php`.
 * @param {object} [options]
 * @param {'GET'|'POST'|'PUT'|'DELETE'} [options.method='GET']
 * @param {object}  [options.params]     Query string parameters (empty values are skipped).
 * @param {object|FormData} [options.body] JSON body, or FormData for file uploads.
 * @param {AbortSignal} [options.signal] Cancellation (React Query / unmount).
 * @param {number}  [options.timeout]    Milliseconds before the request is aborted.
 * @returns {Promise<any>} The raw response payload (envelope included).
 */
export async function apiRequest(path, options = {}) {
  const {
    method = 'GET',
    params,
    body,
    signal,
    timeout = DEFAULT_TIMEOUT,
    headers: extraHeaders = {},
  } = options;

  const controller = new AbortController();
  const timer = timeout > 0 ? setTimeout(() => controller.abort(), timeout) : null;
  const onExternalAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const headers = { Accept: 'application/json', ...extraHeaders };
  if (body !== undefined && !isFormData) headers['Content-Type'] = 'application/json';

  const token = getStoredToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let requestBody;
  if (body !== undefined && body !== null) {
    requestBody = isFormData ? body : JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(buildUrl(path, params), {
      method,
      headers,
      body: requestBody,
      // TODO(API-CONFIRM): login.php sets a session cookie, so credentials must
      // be included for cross-origin XAMPP requests. If the API is served on the
      // same origin (e.g. through the Vite proxy in vite.config.js) this is a no-op.
      credentials: 'include',
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new ApiError('The request was cancelled.', { status: 0, isNetworkError: true });
    }
    throw new ApiError(NETWORK_ERROR_MESSAGE, { status: 0, isNetworkError: true });
  } finally {
    if (timer) clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onExternalAbort);
  }

  const payload = await parseBody(response);

  if (!response.ok) {
    const { message, errors } = readErrorDetails(payload);
    throw new ApiError(
      message || STATUS_ERROR_MESSAGES[response.status] || 'Something went wrong. Please try again.',
      { status: response.status, errors, payload }
    );
  }

  // Some PHP endpoints answer 200 with an error flag instead of a 4xx status.
  // TODO(API-CONFIRM): keep or drop this once the success flag is known.
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const flag = payload.success ?? payload.status;
    if (flag === false || (typeof flag === 'string' && /^(error|fail)/i.test(flag))) {
      const { message, errors } = readErrorDetails(payload);
      throw new ApiError(message || 'Something went wrong. Please try again.', {
        status: response.status,
        errors,
        payload,
      });
    }
  }

  return payload;
}

/**
 * Multipart upload with real progress events (fetch cannot report upload progress).
 * Resolves with the raw payload, rejects with an `ApiError`.
 */
export function uploadWithProgress(path, formData, { onProgress, signal, field = 'file' } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', buildUrl(path), true);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Accept', 'application/json');
    const token = getStoredToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
        }
      };
    }

    xhr.onload = () => {
      let payload = null;
      try {
        payload = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        payload = { message: xhr.responseText };
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve(payload);
        return;
      }
      const { message, errors } = readErrorDetails(payload);
      reject(
        new ApiError(message || STATUS_ERROR_MESSAGES[xhr.status] || 'Upload failed. Please try again.', {
          status: xhr.status,
          errors,
          payload,
        })
      );
    };

    xhr.onerror = () => reject(new ApiError(NETWORK_ERROR_MESSAGE, { isNetworkError: true }));
    xhr.onabort = () => reject(new ApiError('Upload cancelled.', { isNetworkError: true }));

    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        return;
      }
      signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }

    xhr.send(formData);
    void field;
  });
}

/** Absolute URL for endpoints the browser must navigate to directly (OAuth). */
export function absoluteUrl(path, params) {
  return buildUrl(path, params);
}
