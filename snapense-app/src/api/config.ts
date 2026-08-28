import Constants from 'expo-constants';

/**
 * Backend base URL.
 *
 * Expo Go on a physical phone cannot reach `localhost` - that resolves to the
 * phone itself - so this must be the dev machine's LAN address. Override it
 * without editing code by setting `apiBaseUrl` under `expo.extra` in app.json,
 * or the EXPO_PUBLIC_API_BASE_URL environment variable.
 *
 * If the phone cannot connect, check that: the phone and this machine are on
 * the same Wi-Fi, Flask is bound to 0.0.0.0 (not 127.0.0.1), and Windows
 * Firewall allows inbound connections on the port.
 */
const DEFAULT_API_BASE_URL = 'http://192.168.67.240:5000/api';

const fromExtra = (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)
  ?.apiBaseUrl;

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? fromExtra ?? DEFAULT_API_BASE_URL;

/** Requests fail rather than hang forever on an unreachable LAN address. */
export const REQUEST_TIMEOUT_MS = 15000;

export const TOKEN_KEYS = {
  access: 'snapense.accessToken',
  refresh: 'snapense.refreshToken',
} as const;
