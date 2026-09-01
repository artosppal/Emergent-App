import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
export const TOKEN_KEY = "notifin_session_token";

let inMemoryToken: string | null = null;

export async function setToken(token: string | null) {
  inMemoryToken = token;
  if (token) {
    await storage.secureSet(TOKEN_KEY, token);
  } else {
    await storage.secureRemove(TOKEN_KEY);
  }
}

export async function getToken(): Promise<string | null> {
  if (inMemoryToken) return inMemoryToken;
  const t = await storage.secureGet<string | null>(TOKEN_KEY, null);
  inMemoryToken = t;
  return t;
}

export class ApiError extends Error {
  status: number;
  detail: any;
  constructor(status: number, detail: any) {
    super(typeof detail === "string" ? detail : detail?.message || "Terjadi kesalahan");
    this.status = status;
    this.detail = detail;
  }
}

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}/api${path}`, { ...options, headers });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new ApiError(res.status, data?.detail ?? data ?? "Error");
  }
  return data as T;
}

export const api = {
  register: (body: { email: string; password: string; name: string }) =>
    apiFetch("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    apiFetch("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  googleSession: (session_id: string) =>
    apiFetch("/auth/session", { method: "POST", body: JSON.stringify({ session_id }) }),
  me: () => apiFetch("/auth/me"),
  logout: () => apiFetch("/auth/logout", { method: "POST" }),
  upgrade: () => apiFetch("/auth/upgrade", { method: "POST" }),
  downgrade: () => apiFetch("/auth/downgrade", { method: "POST" }),
  updateChannels: (body: { push: boolean; whatsapp: boolean }) =>
    apiFetch("/auth/channels", { method: "PUT", body: JSON.stringify(body) }),

  dashboard: () => apiFetch("/dashboard"),
  listSubs: (category?: string, status?: string) => {
    const p = new URLSearchParams();
    if (category) p.append("category", category);
    if (status) p.append("status", status);
    const q = p.toString();
    return apiFetch(`/subscriptions${q ? `?${q}` : ""}`);
  },
  getSub: (id: string) => apiFetch(`/subscriptions/${id}`),
  createSub: (body: any) =>
    apiFetch("/subscriptions", { method: "POST", body: JSON.stringify(body) }),
  updateSub: (id: string, body: any) =>
    apiFetch(`/subscriptions/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteSub: (id: string) => apiFetch(`/subscriptions/${id}`, { method: "DELETE" }),

  listGroups: () => apiFetch("/groups"),
  createGroup: (name: string) =>
    apiFetch("/groups", { method: "POST", body: JSON.stringify({ name }) }),
  joinGroup: (code: string) =>
    apiFetch("/groups/join", { method: "POST", body: JSON.stringify({ code }) }),
  getGroup: (id: string) => apiFetch(`/groups/${id}`),
  leaveGroup: (id: string) => apiFetch(`/groups/${id}/leave`, { method: "POST" }),
  deleteGroup: (id: string) => apiFetch(`/groups/${id}`, { method: "DELETE" }),
  createGroupSub: (gid: string, body: any) =>
    apiFetch(`/groups/${gid}/subscriptions`, { method: "POST", body: JSON.stringify(body) }),
  updateGroupSub: (gid: string, sid: string, body: any) =>
    apiFetch(`/groups/${gid}/subscriptions/${sid}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteGroupSub: (gid: string, sid: string) =>
    apiFetch(`/groups/${gid}/subscriptions/${sid}`, { method: "DELETE" }),
  payGroupSub: (gid: string, sid: string, body: { user_id?: string; paid: boolean }) =>
    apiFetch(`/groups/${gid}/subscriptions/${sid}/pay`, { method: "PUT", body: JSON.stringify(body) }),

  registerPush: (body: { user_id: string; platform: string; device_token: string }) =>
    apiFetch("/register-push", { method: "POST", body: JSON.stringify(body) }),
};
