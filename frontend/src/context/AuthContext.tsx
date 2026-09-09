import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Platform } from "react-native";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import * as Notifications from "expo-notifications";
import { api, setToken, getToken, ApiError } from "@/src/lib/api";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "";
const GOOGLE_DISCOVERY = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
};

export interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string | null;
  plan: "free" | "premium";
  phone?: string | null;
  phone_verified?: boolean;
  wa_live?: boolean;
  notify_channels: { push: boolean; whatsapp: boolean };
  monthly_limit?: number | null;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  registerStart: (email: string, password: string, name: string) => Promise<void>;
  registerVerify: (email: string, code: string) => Promise<void>;
  registerResend: (email: string) => Promise<void>;
  registerWhatsappStart: (name: string, email: string, phone: string) => Promise<string>;
  registerWhatsappVerify: (phone: string, code: string) => Promise<void>;
  registerWhatsappResend: (phone: string) => Promise<void>;
  loginWhatsappRequest: (phone: string) => Promise<string>;
  loginWhatsappVerify: (phone: string, code: string) => Promise<void>;
  verifyPhoneRequest: (phone: string) => Promise<string>;
  verifyPhoneConfirm: (code: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (u: User) => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

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

  // Bootstrap: restore an existing session token, if any.
  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (token) {
          await refresh();
        }
      } catch {}
      setLoading(false);
    })();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res: any = await api.login({ email, password });
      await setToken(res.session_token);
      applyUser(res.user);
    },
    [applyUser],
  );

  const registerStart = useCallback(async (email: string, password: string, name: string) => {
    await api.registerStart({ email, password, name });
  }, []);

  const registerVerify = useCallback(
    async (email: string, code: string) => {
      const res: any = await api.registerVerify({ email, code });
      await setToken(res.session_token);
      applyUser(res.user);
    },
    [applyUser],
  );

  const registerResend = useCallback(async (email: string) => {
    await api.registerResend(email);
  }, []);

  const registerWhatsappStart = useCallback(async (name: string, email: string, phone: string) => {
    const res: any = await api.registerWhatsappStart({ name, email, phone });
    return res.phone as string;
  }, []);

  const registerWhatsappVerify = useCallback(
    async (phone: string, code: string) => {
      const res: any = await api.registerWhatsappVerify({ phone, code });
      await setToken(res.session_token);
      applyUser(res.user);
    },
    [applyUser],
  );

  const registerWhatsappResend = useCallback(async (phone: string) => {
    await api.registerWhatsappResend(phone);
  }, []);

  const loginWhatsappRequest = useCallback(async (phone: string) => {
    const res: any = await api.loginWhatsappRequest(phone);
    return res.phone as string;
  }, []);

  const loginWhatsappVerify = useCallback(
    async (phone: string, code: string) => {
      const res: any = await api.loginWhatsappVerify({ phone, code });
      await setToken(res.session_token);
      applyUser(res.user);
    },
    [applyUser],
  );

  const verifyPhoneRequest = useCallback(async (phone: string) => {
    const res: any = await api.phoneVerifyRequest(phone);
    return res.phone as string;
  }, []);

  const verifyPhoneConfirm = useCallback(
    async (code: string) => {
      const res: any = await api.phoneVerifyConfirm(code);
      applyUser(res.user);
    },
    [applyUser],
  );

  const loginWithGoogle = useCallback(async () => {
    if (!GOOGLE_CLIENT_ID) {
      throw new Error("Login Google belum dikonfigurasi");
    }
    const redirectUri = AuthSession.makeRedirectUri();
    const request = new AuthSession.AuthRequest({
      clientId: GOOGLE_CLIENT_ID,
      scopes: ["openid", "profile", "email"],
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
    });
    const result = await request.promptAsync(GOOGLE_DISCOVERY);
    if (result.type !== "success" || !result.params.code) return;
    const res: any = await api.googleSession({
      code: result.params.code,
      redirect_uri: redirectUri,
      code_verifier: request.codeVerifier,
    });
    await setToken(res.session_token);
    applyUser(res.user);
  }, [applyUser]);

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
        registerStart,
        registerVerify,
        registerResend,
        registerWhatsappStart,
        registerWhatsappVerify,
        registerWhatsappResend,
        loginWhatsappRequest,
        loginWhatsappVerify,
        verifyPhoneRequest,
        verifyPhoneConfirm,
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
