// Thin wrapper around the Spotify Web API.
// Only uses endpoints that still exist for Development Mode apps after
// Spotify's February 2026 changes (no batch endpoints, search limit 10).

import { getToken } from "./auth.js";

const BASE = "https://api.spotify.com/v1";

export class SpotifyError extends Error {
  constructor(message, status, reason) {
    super(message);
    this.status = status;
    this.reason = reason;
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function api(path, { method = "GET", body, retry = true } = {}) {
  const token = await getToken();
  if (!token) throw new SpotifyError("Your Spotify session expired.", 401);

  const res = await fetch(path.startsWith("http") ? path : BASE + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && retry) {
    const fresh = await getToken({ force: true });
    if (fresh) return api(path, { method, body, retry: false });
    throw new SpotifyError("Your Spotify session expired.", 401);
  }
  if (res.status === 429 && retry) {
    const seconds = Number(res.headers.get("Retry-After")) || 2;
    await wait(Math.min(seconds, 30) * 1000);
    return api(path, { method, body, retry: false });
  }
  if (!res.ok) {
    let message = `Spotify error ${res.status}`;
    let reason;
    try {
      const j = await res.json();
      message = j?.error?.message || message;
      reason = j?.error?.reason;
    } catch {
      /* no body */
    }
    throw new SpotifyError(message, res.status, reason);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Normalized album shape used everywhere in the app (and saved in backups).
export function toAlbum(a) {
  const images = a.images || [];
  return {
    id: a.id,
    uri: a.uri,
    name: a.name,
    artists: (a.artists || []).map((x) => x.name).join(", "),
    image: images[0]?.url || "",
    thumb: (images[1] || images[0])?.url || "",
    year: (a.release_date || "").slice(0, 4),
    totalTracks: a.total_tracks || 0,
    url: a.external_urls?.spotify || `https://open.spotify.com/album/${a.id}`,
  };
}

export const getMe = () => api("/me");

export async function getSavedAlbums(onProgress) {
  const out = [];
  let next = "/me/albums?limit=50";
  while (next) {
    const page = await api(next);
    for (const item of page.items) {
      out.push({ ...toAlbum(item.album), savedAt: item.added_at });
    }
    onProgress?.(out.slice(), page.total);
    next = page.next;
  }
  return out;
}

export async function searchAlbums(query, offset = 0) {
  const params = new URLSearchParams({
    q: query,
    type: "album",
    limit: "10",
    offset: String(offset),
  });
  const data = await api(`/search?${params}`);
  return {
    albums: (data?.albums?.items || []).filter(Boolean).map(toAlbum),
    hasMore: Boolean(data?.albums?.next),
  };
}

const trackCache = new Map();

export async function getAlbumTracks(albumId) {
  if (trackCache.has(albumId)) return trackCache.get(albumId);
  const tracks = [];
  let next = `/albums/${albumId}/tracks?limit=50`;
  while (next) {
    const page = await api(next);
    for (const t of page.items) {
      tracks.push({
        id: t.id,
        uri: t.uri,
        name: t.name,
        number: t.track_number,
        disc: t.disc_number,
        duration: t.duration_ms,
      });
    }
    next = page.next;
  }
  trackCache.set(albumId, tracks);
  return tracks;
}

export function playAlbum(deviceId, albumUri, position = 0) {
  return api(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
    method: "PUT",
    body: { context_uri: albumUri, offset: { position }, position_ms: 0 },
  });
}
