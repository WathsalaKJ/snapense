import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { setUnauthorizedHandler } from '../api/client';
import { authApi } from '../api/endpoints';
import { tokenStore } from '../api/tokenStore';
import type { User } from '../api/types';

interface AuthContextValue {
  user: User | null;
  /** True while the stored token is being restored on cold start. */
  isRestoring: boolean;
  isAuthenticated: boolean;
  /**
   * True once this install has held a session. Drives where the logged-out
   * stack starts: a returning user (or one bounced by a 401) lands on Login
   * rather than being shown onboarding again.
   */
  isReturning: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isReturning, setIsReturning] = useState(false);

  /** Clear local session state. The navigator swaps to Login on user === null. */
  const clearSession = useCallback(() => {
    setUser(null);
    setIsReturning(true);
  }, []);

  // Let the axios 401 handler drop the session without importing navigation.
  useEffect(() => {
    setUnauthorizedHandler(clearSession);
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  // Cold start: if a token is on disk, verify it before showing the app.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const token = await tokenStore.getAccessToken();
        if (!token) return;

        const me = await authApi.me();
        if (!cancelled) {
          setUser(me);
          setIsReturning(true);
        }
      } catch {
        // Expired or invalid: fall through to the logged-out state, but the
        // user has signed in here before, so skip onboarding.
        await tokenStore.clear();
        if (!cancelled) setIsReturning(true);
      } finally {
        if (!cancelled) setIsRestoring(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authApi.login(email, password);
    await tokenStore.save({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    });
    setUser(data.user);
    setIsReturning(true);
  }, []);

  const register = useCallback(
    async (email: string, password: string, fullName: string) => {
      const data = await authApi.register(email, password, fullName);
      await tokenStore.save({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
      });
      setUser(data.user);
      setIsReturning(true);
    },
    [],
  );

  const logout = useCallback(async () => {
    await tokenStore.clear();
    setUser(null);
    setIsReturning(true);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isRestoring,
      isAuthenticated: user !== null,
      isReturning,
      login,
      register,
      logout,
    }),
    [user, isRestoring, isReturning, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used inside an AuthProvider.');
  }
  return context;
}
