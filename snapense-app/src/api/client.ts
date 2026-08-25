/**
 * Axios instance for the Snapense API.
 *
 * Request interceptor  - attaches the stored JWT as `Authorization: Bearer`.
 * Response interceptor - on 401, tries the refresh token exactly once, and if
 *                        that fails clears the session and sends the user back
 *                        to Login.
 *
 * The redirect is done through a registered callback rather than importing the
 * navigator here, so this module stays free of navigation imports (and the
 * circular import that would come with them). AuthContext registers the
 * handler on mount.
 */

import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';

import { API_BASE_URL, REQUEST_TIMEOUT_MS } from './config';
import { tokenStore } from './tokenStore';

type UnauthorizedHandler = () => void;

let onUnauthorized: UnauthorizedHandler | null = null;

/** Called by AuthContext so a hard 401 can drop the user on Login. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler;
}

/** Endpoints that must not trigger the refresh-and-retry dance. */
const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh'];

function isAuthPath(url?: string): boolean {
  if (!url) return false;
  return AUTH_PATHS.some((path) => url.includes(path));
}

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await tokenStore.getAccessToken();
  if (token) {
    const headers = AxiosHeaders.from(config.headers);
    headers.set('Authorization', `Bearer ${token}`);
    config.headers = headers;
  }
  return config;
});

/**
 * Only one refresh runs at a time; concurrent 401s wait on the same promise
 * instead of each firing their own refresh request.
 */
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await tokenStore.getRefreshToken();
  if (!refreshToken) return null;

  try {
    // A bare axios call, so this request skips the interceptors above and
    // cannot recurse back into the 401 handler.
    const response = await axios.post<{ access_token: string }>(
      `${API_BASE_URL}/auth/refresh`,
      null,
      {
        timeout: REQUEST_TIMEOUT_MS,
        headers: { Authorization: `Bearer ${refreshToken}` },
      },
    );

    const accessToken = response.data?.access_token;
    if (!accessToken) return null;

    await tokenStore.save({ accessToken, refreshToken });
    return accessToken;
  } catch {
    return null;
  }
}

async function forceLogout(): Promise<void> {
  await tokenStore.clear();
  onUnauthorized?.();
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retried?: boolean })
      | undefined;

    const status = error.response?.status;

    // 422 is what flask-jwt-extended returns for a malformed/!fresh token.
    const isAuthFailure = status === 401 || status === 422;

    if (!isAuthFailure || !original || original._retried || isAuthPath(original.url)) {
      return Promise.reject(error);
    }

    original._retried = true;

    refreshInFlight = refreshInFlight ?? refreshAccessToken();
    const accessToken = await refreshInFlight;
    refreshInFlight = null;

    if (!accessToken) {
      await forceLogout();
      return Promise.reject(error);
    }

    const headers = AxiosHeaders.from(original.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);
    original.headers = headers;

    return api(original);
  },
);

/** Pull a readable message out of an API error for display. */
export function errorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (axios.isAxiosError(error)) {
    const apiError = (error.response?.data as { error?: string } | undefined)?.error;
    if (apiError) return apiError;
    if (error.code === 'ECONNABORTED') return 'The request timed out.';
    if (!error.response) {
      return 'Cannot reach the server. Check that your phone and computer are on the same Wi-Fi.';
    }
  }
  return fallback;
}

export default api;
