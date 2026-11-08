// Your organization data: shelves (want / listened), ratings, notes and crates.
// Spotify only knows which albums you've saved; everything else lives here,
// in this browser's localStorage. Use Export / Import to back it up or move it.

import { useEffect, useMemo, useReducer } from "react";

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

const blank = () => ({ version: 1, albums: {}, crates: [] });

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
  return { version: 1, albums: data.albums, crates: data.crates };
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
  if (isEmpty(next)) delete albums[meta.id];
  else albums[meta.id] = next;
  return { ...state, albums };
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
          c.id === action.id ? { ...c, ...action.patch } : c,
        ),
      };
    case "deleteCrate": {
      let next = { ...state, crates: state.crates.filter((c) => c.id !== action.id) };
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
        const crate = { id: newId(), name, color, createdAt: now() };
        dispatch({ type: "addCrate", crate });
        return crate;
      },
      updateCrate: (id, patch) => dispatch({ type: "updateCrate", id, patch }),
      deleteCrate: (id) => dispatch({ type: "deleteCrate", id }),
      replaceAll: (data) => dispatch({ type: "replace", data: parseBackup(data) }),
    }),
    [],
  );

  return { collection: state, actions };
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
