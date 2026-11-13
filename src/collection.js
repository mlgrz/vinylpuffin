// Your organization data: shelves (want / listened), ratings, notes and crates.
// Spotify only knows which albums you've saved; everything else lives here.
// It's always kept in this browser's localStorage, and synced to the cloud
// when VITE_SYNC_URL is set (see src/sync.js). Export / Import still work.
//
// Every album entry and crate carries `updatedAt`, and removals leave a
// timestamped tombstone in `deleted`, so two devices' copies can be merged
// record by record (mergeCollections) instead of one overwriting the other.

import { useEffect, useMemo, useReducer } from "react";
import { useCloudSync } from "./sync.js";

const KEY = "vinylpuffin.collection.v1";

export const CRATE_COLORS = [
  "#F0622B", // puffin orange
  "#2F5BEA", // blue
  "#1C9A62", // green
  "#E3A912", // mustard
  "#D63E8A", // pink
  "#7B4FD8", // violet
  "#1A1714", // ink
];

const blank = () => ({ version: 1, albums: {}, crates: [], deleted: {} });

// Tombstones older than this are forgotten. A device that stays offline for
// longer could bring a removed album back; that's an acceptable trade-off.
const TOMBSTONE_TTL_MS = 180 * 24 * 60 * 60 * 1000;

export function parseBackup(data) {
  if (
    !data ||
    typeof data !== "object" ||
    !data.albums ||
    typeof data.albums !== "object" ||
    !Array.isArray(data.crates)
  ) {
    throw new Error("That file isn't a VinylPuffin backup.");
  }
  const deleted =
    data.deleted && typeof data.deleted === "object" && !Array.isArray(data.deleted)
      ? data.deleted
      : {};
  return { version: 1, albums: data.albums, crates: data.crates, deleted };
}

const stamp = (r) => r?.updatedAt || r?.createdAt || r?.addedAt || "";
const newer = (x, y) => (!x ? y : !y ? x : stamp(y) > stamp(x) ? y : x);

// Combine two copies of the collection (e.g. this device and the cloud).
// For each album and crate the most recently changed version wins, and a
// removal wins over any version older than it.
export function mergeCollections(a, b) {
  const cutoff = new Date(Date.now() - TOMBSTONE_TTL_MS).toISOString();
  const deleted = {};
  for (const src of [a.deleted, b.deleted]) {
    for (const [k, t] of Object.entries(src || {})) {
      if (t > cutoff && !(deleted[k] >= t)) deleted[k] = t;
    }
  }
  const alive = (key, rec) => rec && !(deleted[key] && deleted[key] >= stamp(rec));

  const aCrates = new Map(a.crates.map((c) => [c.id, c]));
  const bCrates = new Map(b.crates.map((c) => [c.id, c]));
  const crates = [];
  for (const id of new Set([...aCrates.keys(), ...bCrates.keys()])) {
    const c = newer(aCrates.get(id), bCrates.get(id));
    if (alive(`crate:${id}`, c)) crates.push(c);
  }
  crates.sort((x, y) => (x.createdAt || "").localeCompare(y.createdAt || ""));
  const crateIds = new Set(crates.map((c) => c.id));

  const albums = {};
  for (const id of new Set([...Object.keys(a.albums), ...Object.keys(b.albums)])) {
    const e = newer(a.albums[id], b.albums[id]);
    if (!alive(`album:${id}`, e)) continue;
    // Drop links to crates that were deleted elsewhere.
    albums[id] = e.crates.every((c) => crateIds.has(c))
      ? e
      : { ...e, crates: e.crates.filter((c) => crateIds.has(c)) };
  }
  return { version: 1, albums, crates, deleted };
}

// JSON with sorted keys, so two equal collections give the same string.
export function stableStringify(v) {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v)
      .sort()
      .filter((k) => v[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? parseBackup(JSON.parse(raw)) : blank();
  } catch {
    return blank();
  }
}

const now = () => new Date().toISOString();

const newId = () =>
  crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);

const isEmpty = (e) =>
  !e.status && !e.rating && !e.notes && !e.crates.length && !e.highlights.length;

// Apply `change` to one album's entry, creating it if needed and dropping it
// again once nothing about the album is recorded any more.
function updateAlbum(state, meta, change) {
  const prev = state.albums[meta.id] || {
    status: null,
    rating: null,
    notes: "",
    crates: [],
    highlights: [],
    addedAt: now(),
  };
  const next = { ...prev, ...change(prev), meta: { ...prev.meta, ...meta } };
  next.updatedAt = now();
  const albums = { ...state.albums };
  const deleted = { ...state.deleted };
  if (isEmpty(next)) {
    delete albums[meta.id];
    deleted[`album:${meta.id}`] = next.updatedAt;
  } else {
    albums[meta.id] = next;
    delete deleted[`album:${meta.id}`];
  }
  return { ...state, albums, deleted };
}

const toggle = (list, value) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

function reducer(state, action) {
  switch (action.type) {
    case "status":
      return updateAlbum(state, action.meta, (e) => ({
        status: action.status,
        shelvedAt: action.status && action.status !== e.status ? now() : e.shelvedAt,
        listenedAt:
          action.status === "listened" ? e.listenedAt || now() : e.listenedAt,
      }));
    case "rating":
      // Rating something implies you've listened to it.
      return updateAlbum(state, action.meta, (e) => ({
        rating: action.rating,
        status: action.rating ? "listened" : e.status,
        shelvedAt: action.rating && e.status !== "listened" ? now() : e.shelvedAt,
        listenedAt: action.rating ? e.listenedAt || now() : e.listenedAt,
      }));
    case "notes":
      return updateAlbum(state, action.meta, () => ({ notes: action.notes }));
    case "toggleCrate":
      return updateAlbum(state, action.meta, (e) => ({
        crates: toggle(e.crates, action.crateId),
      }));
    case "toggleHighlight":
      return updateAlbum(state, action.meta, (e) => ({
        highlights: toggle(e.highlights, action.trackId),
      }));
    case "addCrate":
      return { ...state, crates: [...state.crates, action.crate] };
    case "updateCrate":
      return {
        ...state,
        crates: state.crates.map((c) =>
          c.id === action.id ? { ...c, ...action.patch, updatedAt: now() } : c,
        ),
      };
    case "deleteCrate": {
      let next = {
        ...state,
        crates: state.crates.filter((c) => c.id !== action.id),
        deleted: { ...state.deleted, [`crate:${action.id}`]: now() },
      };
      for (const [id, entry] of Object.entries(state.albums)) {
        if (entry.crates.includes(action.id)) {
          next = updateAlbum(next, { id }, (e) => ({
            crates: e.crates.filter((c) => c !== action.id),
          }));
        }
      }
      return next;
    }
    case "replace":
      return action.data;
    case "import": {
      // Replace everything, and record what went away so the removals also
      // reach your other devices instead of being merged back in.
      const t = now();
      const deleted = { ...state.deleted, ...action.data.deleted };
      for (const id of Object.keys(state.albums)) {
        if (!action.data.albums[id]) deleted[`album:${id}`] = t;
      }
      for (const c of state.crates) {
        if (!action.data.crates.some((x) => x.id === c.id)) deleted[`crate:${c.id}`] = t;
      }
      for (const id of Object.keys(action.data.albums)) delete deleted[`album:${id}`];
      for (const c of action.data.crates) delete deleted[`crate:${c.id}`];
      return { ...action.data, deleted };
    }
    default:
      return state;
  }
}

export function useCollection() {
  const [state, dispatch] = useReducer(reducer, undefined, load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage full or unavailable */
    }
  }, [state]);

  // Keep several open tabs in sync.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== KEY || !e.newValue) return;
      try {
        dispatch({ type: "replace", data: parseBackup(JSON.parse(e.newValue)) });
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const actions = useMemo(
    () => ({
      setStatus: (meta, status) => dispatch({ type: "status", meta, status }),
      setRating: (meta, rating) => dispatch({ type: "rating", meta, rating }),
      setNotes: (meta, notes) => dispatch({ type: "notes", meta, notes }),
      toggleCrate: (meta, crateId) => dispatch({ type: "toggleCrate", meta, crateId }),
      toggleHighlight: (meta, trackId) =>
        dispatch({ type: "toggleHighlight", meta, trackId }),
      addCrate: (name, color) => {
        const t = now();
        const crate = { id: newId(), name, color, createdAt: t, updatedAt: t };
        dispatch({ type: "addCrate", crate });
        return crate;
      },
      updateCrate: (id, patch) => dispatch({ type: "updateCrate", id, patch }),
      deleteCrate: (id) => dispatch({ type: "deleteCrate", id }),
      replaceAll: (data) => dispatch({ type: "import", data: parseBackup(data) }),
    }),
    [],
  );

  const sync = useCloudSync(state, dispatch);

  return { collection: state, actions, sync };
}

export function exportBackup(collection) {
  const blob = new Blob([JSON.stringify(collection, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `vinylpuffin-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Ratings are stored as 1–10 (half stars); shown as 0.5–5.
export const formatRating = (r) => (r ? (r / 2).toFixed(1).replace(/\.0$/, "") : "");

// Pick black or white text for a crate's color.
export function inkOn(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#1A1714" : "#FFFFFF";
}
