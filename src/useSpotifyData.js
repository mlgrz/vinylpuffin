import { useCallback, useEffect, useState } from "react";
import { getMe, getSavedAlbums } from "./spotify/api.js";

const CACHE_KEY = "vinylpuffin.savedAlbumsCache";

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY)) || [];
  } catch {
    return [];
  }
}

// Your saved albums from Spotify. Shows the cached copy instantly, then
// refreshes it from Spotify in the background.
export function useSavedAlbums(onAuthLost) {
  const [albums, setAlbums] = useState(readCache);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const hadCache = readCache().length > 0;
    setStatus("loading");
    setError(null);
    getSavedAlbums((partial) => {
      if (!cancelled && !hadCache) setAlbums(partial);
    })
      .then((all) => {
        if (cancelled) return;
        setAlbums(all);
        setStatus("ready");
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(all));
        } catch {
          /* cache is optional */
        }
      })
      .catch((e) => {
        if (cancelled) return;
        if (e.status === 401) onAuthLost?.();
        setError(e);
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { albums, status, error, reload };
}

export function useMe() {
  const [me, setMe] = useState(null);
  useEffect(() => {
    getMe().then(setMe).catch(() => {});
  }, []);
  return me;
}

export function clearSpotifyCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}
