// React hook around Spotify's Web Playback SDK. Turns this browser tab into a
// Spotify Connect device called "VinylPuffin". Requires Spotify Premium.

import { useCallback, useEffect, useRef, useState } from "react";
import { getToken } from "./auth.js";
import { playAlbum as apiPlayAlbum } from "./api.js";

let sdkPromise = null;

function loadSdk() {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    if (window.Spotify?.Player) return resolve();
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    script.onerror = () => {
      sdkPromise = null;
      reject(new Error("Couldn't load the Spotify player."));
    };
    document.body.appendChild(script);
  });
  return sdkPromise;
}

function describe(e) {
  if (e.reason === "PREMIUM_REQUIRED") return "Playback needs Spotify Premium.";
  if (e.status === 404) return "Player isn't connected yet. Try again in a moment.";
  if (e.status === 403)
    return "Spotify blocked playback. Check that your account is added under User Management in the Spotify developer dashboard.";
  return e.message || "Playback failed.";
}

const initial = {
  ready: false,
  paused: true,
  track: null,
  contextUri: null,
  position: 0,
  duration: 0,
  at: 0,
  album: null,
  error: null,
  busy: false,
};

export function usePlayer({ onFinished } = {}) {
  const [state, setState] = useState(initial);
  const playerRef = useRef(null);
  const deviceRef = useRef(null);
  const waitersRef = useRef([]);
  const prevRef = useRef(null);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  useEffect(() => {
    let cancelled = false;
    let player = null;

    loadSdk()
      .then(() => {
        if (cancelled) return;
        player = new window.Spotify.Player({
          name: "VinylPuffin",
          volume: 0.8,
          getOAuthToken: (cb) => getToken().then((t) => cb(t || "")),
        });

        player.addListener("ready", ({ device_id }) => {
          deviceRef.current = device_id;
          waitersRef.current.splice(0).forEach((resolve) => resolve(device_id));
          setState((s) => ({ ...s, ready: true }));
        });
        player.addListener("not_ready", () => {
          deviceRef.current = null;
          setState((s) => ({ ...s, ready: false }));
        });

        player.addListener("player_state_changed", (st) => {
          if (!st) return;
          const prev = prevRef.current;
          prevRef.current = st;
          const t = st.track_window?.current_track;

          setState((s) => ({
            ...s,
            paused: st.paused,
            position: st.position,
            duration: st.duration,
            at: performance.now(),
            contextUri: st.context?.uri || s.contextUri,
            track: t
              ? {
                  id: t.id,
                  uri: t.uri,
                  name: t.name,
                  artists: (t.artists || []).map((a) => a.name).join(", "),
                  album: t.album?.name || "",
                  image: t.album?.images?.[0]?.url || "",
                }
              : null,
          }));

          // When the last track ends, Spotify pauses and rewinds to 0.
          const wasOnLastTrack =
            prev && !prev.paused && prev.track_window?.next_tracks?.length === 0;
          if (wasOnLastTrack && st.paused && st.position === 0) {
            onFinishedRef.current?.(prev.context?.uri);
          }
        });

        const errors = {
          initialization_error: "This browser can't run the Spotify player.",
          authentication_error: "Spotify player couldn't authenticate. Try logging out and in.",
          account_error: "Playback needs Spotify Premium.",
          playback_error: "Spotify couldn't play that.",
        };
        Object.entries(errors).forEach(([event, message]) =>
          player.addListener(event, () =>
            setState((s) => ({ ...s, error: message, busy: false })),
          ),
        );

        player.connect();
        playerRef.current = player;
      })
      .catch((e) => {
        if (!cancelled) setState((s) => ({ ...s, error: e.message }));
      });

    return () => {
      cancelled = true;
      player?.disconnect();
      playerRef.current = null;
      deviceRef.current = null;
    };
  }, []);

  const waitForDevice = useCallback(() => {
    if (deviceRef.current) return Promise.resolve(deviceRef.current);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("The Spotify player didn't start. Reload and try again.")),
        10_000,
      );
      waitersRef.current.push((id) => {
        clearTimeout(timer);
        resolve(id);
      });
    });
  }, []);

  const play = useCallback(
    async (album, position = 0) => {
      // Must run synchronously inside the click for browser autoplay rules.
      playerRef.current?.activateElement?.();
      setState((s) => ({ ...s, album, error: null, busy: true }));
      try {
        const deviceId = await waitForDevice();
        await apiPlayAlbum(deviceId, album.uri, position);
      } catch (e) {
        setState((s) => ({ ...s, error: describe(e) }));
      } finally {
        setState((s) => ({ ...s, busy: false }));
      }
    },
    [waitForDevice],
  );

  const toggle = useCallback(() => {
    playerRef.current?.togglePlay();
  }, []);

  const dismissError = useCallback(
    () => setState((s) => ({ ...s, error: null })),
    [],
  );

  return { ...state, play, toggle, dismissError };
}
