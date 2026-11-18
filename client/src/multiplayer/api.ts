// Small REST client for the game API.
import { useStore } from '../store/useStore';

const TOKEN_KEY = 'hue.token';
export const loadToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
export const saveToken = (t: string | null) => {
  try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ }
};

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = useStore.getState().token;
  const res = await fetch('/api' + path, {
    method: opts.method ?? 'GET',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  let data: unknown = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) throw new ApiError((data as { error?: string })?.error ?? `Request failed (${res.status})`, res.status);
  return data as T;
}

export async function refreshProfile() {
  try {
    const { profile } = await api<{ profile: import('@shared/types').Profile }>('/me');
    useStore.getState().set({ profile });
    return profile;
  } catch {
    return null;
  }
}
