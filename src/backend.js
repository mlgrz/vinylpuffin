// The VinylPuffin worker (see /worker): cloud sync and bug reports.
// Set VITE_SYNC_URL to its URL; without it, those features are off.

import { getToken } from "./spotify/auth.js";

export const API_URL = (import.meta.env.VITE_SYNC_URL || "").replace(/\/+$/, "");
export const backendEnabled = Boolean(API_URL);

export class BackendError extends Error {
  constructor(status, message) {
    super(message || `Request failed (${status})`);
    this.status = status; // 0 = offline / unreachable
  }
}

// Calls the worker with the Spotify token, refreshing it once on 401.
// Resolves to { status, data } for 2xx and the statuses listed in `allow`.
export async function backendFetch(path, { method = "GET", body, allow = [] } = {}, retry = true) {
  const token = await getToken();
  if (!token) throw new BackendError(401, "Your Spotify session expired.");
  let res;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new BackendError(0, "Couldn't reach the server. Check your connection.");
  }
  if (res.status === 401 && retry) {
    await getToken({ force: true });
    return backendFetch(path, { method, body, allow }, false);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok && !allow.includes(res.status)) {
    throw new BackendError(res.status, data?.error);
  }
  return { status: res.status, data };
}
