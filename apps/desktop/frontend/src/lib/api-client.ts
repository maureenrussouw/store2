import axios, { type AxiosRequestConfig, type InternalAxiosRequestConfig } from "axios";
import { getToken, setToken, deleteToken } from "./wails-bridge";

// Where the API is, decided once in vite.config.ts.
//
// The frontend is served from file:// in a Wails build, so a relative "/api"
// cannot work and this needs the full address. The config resolves it from
// VITE_API_URL or APP_PORT and defines it here at build time, which is why
// there is no fallback port in this file: one used to be here, it said 8080,
// and on a project that had moved APP_PORT it reached whatever else happened
// to be listening. The "/api" at the end is a last resort for a bundle built
// without the config, and is relative on purpose.
//
// Unlike the web/admin clients, this baseURL already carries "/api", so the
// version is appended here rather than rewritten per-request. Bump
// API_VERSION to move the whole desktop client to a new API version.
export const API_VERSION = "v1";

const API_ROOT = import.meta.env.VITE_API_URL || "/api";

const API_URL = API_ROOT.replace(/\/+$/, "") + "/" + API_VERSION;

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
    // This app runs in a webview, so it looks like a browser to the API, and
    // it keeps the refresh token in the OS keychain rather than in a cookie.
    // The API omits that token from the body for browsers (review 2.10), so
    // this is how a client with a better place to put it asks for it.
    "X-Grit-Client": "native",
  },
});

// Attach JWT from OS keychain (or localStorage in dev) and auto-generate an
// Idempotency-Key for unsafe methods so the server can dedupe retries (e.g.
// the 401 refresh path below re-issues the same request — without a stable
// key, a network blip mid-write could double-charge or double-create).
apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getToken("access_token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.headers) {
    const method = (config.method || "get").toUpperCase();
    const unsafe = method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
    if (unsafe && !config.headers["Idempotency-Key"]) {
      config.headers["Idempotency-Key"] = crypto.randomUUID();
    }
  }
  return config;
});

// Refresh on 401
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };

    // Don't try to refresh on the auth endpoints themselves — a wrong
    // password is a real 401 that should bubble up cleanly. Refreshing
    // here would 401 again, wipe tokens, and leave the user stuck in
    // a login loop.
    const url = original.url || "";
    const isAuthEndpoint =
      url.includes("/auth/login") ||
      url.includes("/auth/register") ||
      url.includes("/auth/refresh");

    if (error.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      original._retry = true;

      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshQueue.push((token: string) => {
            if (original.headers) original.headers.Authorization = `Bearer ${token}`;
            resolve(apiClient(original));
          });
        });
      }

      isRefreshing = true;

      try {
        const refreshToken = await getToken("refresh_token");
        if (!refreshToken) throw new Error("No refresh token");

        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refresh_token: refreshToken });

        // Same wrapper as login: { data: { tokens: { access_token, ... } } }
        const tokens = data.data.tokens;

        await setToken("access_token", tokens.access_token);
        await setToken("refresh_token", tokens.refresh_token);

        for (const cb of refreshQueue) cb(tokens.access_token);
        refreshQueue = [];

        if (original.headers) original.headers.Authorization = `Bearer ${tokens.access_token}`;
        return apiClient(original);
      } catch (refreshErr) {
        await deleteToken("access_token");
        await deleteToken("refresh_token");
        // Let the UI handle redirect to login via auth state
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// FileRef mirrors the server's files.FileRef — what the upload endpoint returns
// and what a file/files form field stores.
export interface FileRef {
  url: string;
  key?: string;
  name: string;
  mime?: string;
  size?: number;
  thumbnail_url?: string;
}

// uploadFile posts a single file to /uploads (multipart) and returns its
// FileRef. Uploads require the API — offline callers should guard on
// reachability first. onProgress reports 0–100.
export async function uploadFile(file: File, onProgress?: (pct: number) => void): Promise<FileRef> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post("/uploads", form, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });
  return data.data as FileRef;
}
