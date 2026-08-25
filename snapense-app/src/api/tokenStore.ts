/**
 * JWT persistence.
 *
 * SecureStore keeps tokens in the iOS keychain / Android keystore rather than
 * plain AsyncStorage. It is unavailable on web, so that falls back to
 * localStorage - fine for dev, and the app targets Expo Go on a phone.
 */

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { TOKEN_KEYS } from './config';

const isWeb = Platform.OS === 'web';

async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (isWeb) {
    return globalThis.localStorage?.getItem(key) ?? null;
  }
  return SecureStore.getItemAsync(key);
}

async function removeItem(key: string): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export const tokenStore = {
  async save({ accessToken, refreshToken }: TokenPair): Promise<void> {
    await Promise.all([
      setItem(TOKEN_KEYS.access, accessToken),
      setItem(TOKEN_KEYS.refresh, refreshToken),
    ]);
  },

  async getAccessToken(): Promise<string | null> {
    return getItem(TOKEN_KEYS.access);
  },

  async getRefreshToken(): Promise<string | null> {
    return getItem(TOKEN_KEYS.refresh);
  },

  async clear(): Promise<void> {
    await Promise.all([
      removeItem(TOKEN_KEYS.access),
      removeItem(TOKEN_KEYS.refresh),
    ]);
  },
};
