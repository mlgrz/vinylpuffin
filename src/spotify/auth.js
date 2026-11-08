// Spotify login using the Authorization Code + PKCE flow.
// PKCE is designed for apps with no backend: there is no client secret,
// so everything here can safely run in the browser.

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || "";

export const REDIRECT_URI =
  import.meta.env.VITE_SPOTIFY_REDIRECT_URI ||
  new URL(import.meta.env.BASE_URL, window.location.origin).toString();

export const hasClientId = Boolean(CLIENT_ID);

const SCOPES = [
  "user-read-private",
  "user-library-read", // read your saved albums
  "streaming", // Web Playback SDK
  "user-read-playback-state",
  "user-modify-playback-state",
].join(" ");

const KEYS = {
  access: "vinylpuffin.auth.access",
  refresh: "vinylpuffin.auth.refresh",
  expires: "vinylpuffin.auth.expires",
  verifier: "vinylpuffin.auth.verifier",
};

const store = {
  get: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* storage unavailable */
    }
  },
  remove: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* storage unavailable */
    }
  },
};

function randomString(length) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  return Array.from(
    crypto.getRandomValues(new Uint8Array(length)),
    (v) => chars[v % chars.length],
  ).join("");
}

async function challengeFor(verifier) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function login() {
  const verifier = randomString(64);
  store.set(KEYS.verifier, verifier);
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: "S256",
    code_challenge: await challengeFor(verifier),
  });
  window.location.assign("https://accounts.spotify.com/authorize?" + params);
}

function saveTokens(data) {
  store.set(KEYS.access, data.access_token);
  store.set(
    KEYS.expires,
    String(Date.now() + (data.expires_in || 3600) * 1000),
  );
  if (data.refresh_token) store.set(KEYS.refresh, data.refresh_token);
}

async function tokenRequest(params) {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, ...params }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Token request failed");
  }
  return data;
}

let redirectResult = null;

// Call once on startup. If Spotify just sent us back with ?code=…, trade it
// for tokens and clean the URL. Memoized so React StrictMode's double effect
// doesn't try to redeem the same code twice.
export function handleRedirect() {
  if (!redirectResult) redirectResult = doHandleRedirect();
  return redirectResult;
}

async function doHandleRedirect() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const error = params.get("error");
  if (!code && !error) return {};

  window.history.replaceState(
    {},
    "",
    window.location.pathname + window.location.hash,
  );

  if (error) {
    return {
      error:
        error === "access_denied"
          ? "Spotify connection was cancelled."
          : `Spotify said: ${error}`,
    };
  }
  try {
    const data = await tokenRequest({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: store.get(KEYS.verifier) || "",
    });
    saveTokens(data);
    store.remove(KEYS.verifier);
    return {};
  } catch (e) {
    return { error: `Couldn't finish connecting to Spotify (${e.message}).` };
  }
}

export function isLoggedIn() {
  return Boolean(store.get(KEYS.refresh) || store.get(KEYS.access));
}

let refreshing = null;

async function refresh() {
  const refreshToken = store.get(KEYS.refresh);
  if (!refreshToken) return null;
  try {
    const data = await tokenRequest({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
    saveTokens(data);
    return data.access_token;
  } catch {
    return null;
  }
}

// Returns a valid access token, refreshing it when it's close to expiring.
// Returns null when the session can't be recovered (user must log in again).
export async function getToken({ force = false } = {}) {
  const access = store.get(KEYS.access);
  const expires = Number(store.get(KEYS.expires) || 0);
  if (!force && access && Date.now() < expires - 60_000) return access;

  if (!refreshing) {
    refreshing = refresh().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

export function logout() {
  Object.values(KEYS).forEach(store.remove);
}
