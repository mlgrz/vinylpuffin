// Cloud sync for the collection. Optional: it's switched on by setting
// VITE_SYNC_URL to the deployed worker in /worker. Without it, the app keeps
// using localStorage only, exactly as before.
//
// The worker stores one JSON copy of the collection per Spotify account,
// with a revision number. Each save says which revision it was based on; if
// another device saved in between, the worker answers 409 with its copy, we
// merge the two record by record (mergeCollections) and try again.
// localStorage stays the working copy, so the app works offline and catches
// up the next time it can reach the worker.

import { useCallback, useEffect, useRef, useState } from "react";
import { backendEnabled as syncEnabled, backendFetch } from "./backend.js";
import { mergeCollections, parseBackup, stableStringify } from "./collection.js";

// Which Spotify account this browser's local copy belongs to. If someone
// else signs in here, their cloud copy replaces the local one instead of the
// two being merged together.
const OWNER_KEY = "vinylpuffin.sync.owner";
const SAVE_DELAY_MS = 800;
const POLL_MS = 3 * 60 * 1000;
const PULL_THROTTLE_MS = 20 * 1000;

const readOwner = () => {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
};
const writeOwner = (id) => {
  try {
    localStorage.setItem(OWNER_KEY, id);
  } catch {
    /* storage unavailable */
  }
};

const request = (method, body) =>
  backendFetch("/collection", { method, body, allow: [409] });

// status: "off" | "syncing" | "synced" | "offline" | "error"
export function useCloudSync(state, dispatch) {
  const [status, setStatus] = useState(syncEnabled ? "syncing" : "off");
  const stateRef = useRef(state);
  stateRef.current = state;

  // rev: the server revision our copy is based on (null = not fetched yet).
  // synced: stableStringify of that server copy, to skip no-op saves.
  const server = useRef({ rev: null, synced: null });
  const running = useRef(false);
  const queued = useRef(null); // { pull } for a run requested mid-run
  const lastPull = useRef(0);

  // Fold a server response ({ userId, rev, data }) into the local copy.
  const absorb = useCallback(
    (remote) => {
      const owner = readOwner();
      const remoteData = remote.data ? parseBackup(remote.data) : null;
      let next = stateRef.current;
      if (owner && owner !== remote.userId) {
        // A different account used this browser before: don't mix them.
        next = remoteData || { version: 1, albums: {}, crates: [], deleted: {} };
      } else if (remoteData) {
        next = mergeCollections(stateRef.current, remoteData);
      }
      writeOwner(remote.userId);
      server.current = {
        rev: remote.rev,
        synced: remoteData ? stableStringify(remoteData) : null,
      };
      if (stableStringify(next) !== stableStringify(stateRef.current)) {
        stateRef.current = next;
        dispatch({ type: "replace", data: next });
      }
    },
    [dispatch],
  );

  const run = useCallback(
    async ({ pull = false } = {}) => {
      if (!syncEnabled) return;
      if (running.current) {
        queued.current = { pull: pull || queued.current?.pull };
        return;
      }
      running.current = true;
      setStatus("syncing");
      try {
        if (pull || server.current.rev === null) {
          lastPull.current = Date.now();
          absorb((await request("GET")).data);
        }
        // Push until the server has our copy. Each 409 means another device
        // saved first; merge its copy and retry (bounded, just in case).
        for (let attempt = 0; attempt < 5; attempt++) {
          const local = stateRef.current;
          const str = stableStringify(local);
          if (str === server.current.synced) break;
          const res = await request("PUT", { baseRev: server.current.rev, data: local });
          if (res.status === 200) {
            server.current = { rev: res.data.rev, synced: str };
            break;
          }
          absorb(res.data);
        }
        setStatus("synced");
      } catch (e) {
        setStatus(e.status === 0 ? "offline" : "error");
      } finally {
        running.current = false;
        if (queued.current) {
          const next = queued.current;
          queued.current = null;
          run(next);
        }
      }
    },
    [absorb],
  );

  // Save shortly after each change.
  useEffect(() => {
    if (!syncEnabled) return;
    const id = setTimeout(() => run(), SAVE_DELAY_MS);
    return () => clearTimeout(id);
  }, [state, run]);

  // Pull other devices' changes on start, on refocus, when back online,
  // and every few minutes while visible.
  useEffect(() => {
    if (!syncEnabled) return;
    run({ pull: true });
    const pull = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastPull.current < PULL_THROTTLE_MS) return;
      run({ pull: true });
    };
    const timer = setInterval(pull, POLL_MS);
    document.addEventListener("visibilitychange", pull);
    window.addEventListener("focus", pull);
    window.addEventListener("online", pull);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", pull);
      window.removeEventListener("focus", pull);
      window.removeEventListener("online", pull);
    };
  }, [run]);

  return { status, retry: () => run({ pull: true }) };
}
