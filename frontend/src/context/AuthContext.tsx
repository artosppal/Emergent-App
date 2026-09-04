import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { api, setToken, getToken, ApiError } from "@/src/lib/api";

WebBrowser.maybeCompleteAuthSession();

export interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string | null;
  plan: "free" | "premium";
  phone?: string | null;
  wa_live?: boolean;
  notify_channels: { push: boolean; whatsapp: boolean };
  monthly_limit?: number | null;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (u: User) => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

const processedSessionIds = new Set<string>();

function extractSessionId(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/[?#&]session_id=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const registerPush = useCallback(async (userId: string) => {
    if (Platform.OS === "web") return;
    try {
      const perm = await Notifications.getPermissionsAsync();
      let granted = perm.granted;
      if (!granted && perm.canAskAgain) {
        const req = await Notifications.requestPermissionsAsync();
        granted = req.granted;
      }
      if (!granted) return;
      const tokenResp = await Notifications.getDevicePushTokenAsync();
      await api.registerPush({
        user_id: userId,
        platform: Platform.OS,
        device_token: String(tokenResp.data),
      });
    } catch {
      // Expo Go / no FCM — non-blocking.
    }
  }, []);

  const applyUser = useCallback(
    (u: User) => {
      setUserState(u);
      registerPush(u.user_id);
    },
    [registerPush],
  );

  const exchangeSession = useCallback(
    async (sessionId: string) => {
      if (processedSessionIds.has(sessionId)) return;
      processedSessionIds.add(sessionId);
      const res: any = await api.googleSession(sessionId);
      await setToken(res.session_token);
      applyUser(res.user);
    },
    [applyUser],
  );

  const refresh = useCallback(async () => {
    try {
      const res: any = await api.me();
      applyUser(res.user);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await setToken(null);
        setUserState(null);
      }
    }
  }, [applyUser]);

  // Bootstrap: handle cold-start deep link session_id, else existing token.
  useEffect(() => {
    (async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        const sid = extractSessionId(initialUrl);
        if (sid) {
          await exchangeSession(sid);
          setLoading(false);
          return;
        }
        const token = await getToken();
        if (token) {
          await refresh();
        }
      } catch {}
      setLoading(false);
    })();

    const sub = Linking.addEventListener("url", ({ url }) => {
      const sid = extractSessionId(url);
      if (sid) exchangeSession(sid).catch(() => {});
    });
    return () => sub.remove();
  }, [exchangeSession, refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res: any = await api.login({ email, password });
      await setToken(res.session_token);
      applyUser(res.user);
    },
    [applyUser],
  );

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      const res: any = await api.register({ email, password, name });
      await setToken(res.session_token);
      applyUser(res.user);
    },
    [applyUser],
  );

  const loginWithGoogle = useCallback(async () => {
    const redirectUrl =
      Platform.OS === "web"
        ? window.location.origin + "/"
        : Linking.createURL("");
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(
      redirectUrl,
    )}`;

    if (Platform.OS === "web") {
      window.location.href = authUrl;
      return;
    }
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    let url: string | null = null;
    if (result.type === "success" && result.url) url = result.url;
    if (!url) url = await Linking.getInitialURL();
    const sid = extractSessionId(url);
    if (sid) await exchangeSession(sid);
  }, [exchangeSession]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {}
    await setToken(null);
    setUserState(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        loginWithGoogle,
        logout,
        refresh,
        setUser: applyUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
