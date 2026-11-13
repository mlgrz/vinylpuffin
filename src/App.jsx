import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { handleRedirect, isLoggedIn, login, logout } from "./spotify/auth.js";
import { usePlayer } from "./spotify/usePlayer.js";
import { exportBackup, useCollection } from "./collection.js";
import { clearSpotifyCache, useMe, useSavedAlbums } from "./useSpotifyData.js";
import Landing from "./components/Landing.jsx";
import Sidebar from "./components/Sidebar.jsx";
import AlbumCard from "./components/AlbumCard.jsx";
import AlbumDetail from "./components/AlbumDetail.jsx";
import CrateDialog from "./components/CrateDialog.jsx";
import AboutDialog from "./components/AboutDialog.jsx";
import ReportDialog from "./components/ReportDialog.jsx";
import PlayerBar from "./components/PlayerBar.jsx";
import { BackdropVinyl, IdleScreen } from "./components/Ambient.jsx";
import SearchView from "./components/SearchView.jsx";
import { PencilIcon, SearchIcon } from "./components/Icons.jsx";

export default function App() {
  const [auth, setAuth] = useState({ state: "checking", error: null });

  useEffect(() => {
    handleRedirect().then(({ error }) =>
      setAuth({ state: isLoggedIn() ? "in" : "out", error: error || null }),
    );
  }, []);

  const signOut = useCallback((reason) => {
    logout();
    clearSpotifyCache();
    setAuth({
      state: "out",
      error: reason === "expired" ? "Your Spotify session expired. Connect again." : null,
    });
  }, []);

  if (auth.state === "checking") return <div className="splash" />;
  if (auth.state === "out") return <Landing onConnect={login} error={auth.error} />;
  return <Shell onSignOut={signOut} />;
}

// ─── Routing: #/want, #/listened, #/library, #/search, #/crate/<id> ───
function useHashView() {
  const read = () => window.location.hash.replace(/^#\/?/, "") || "want";
  const [view, setView] = useState(read);
  useEffect(() => {
    const onHash = () => setView(read());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const go = useCallback((v) => {
    window.location.hash = `/${v}`;
  }, []);
  return [view, go];
}

const SORTS = {
  recent: { label: "Recently added" },
  rating: { label: "Rating" },
  artist: { label: "Artist A–Z" },
  title: { label: "Title A–Z" },
  year: { label: "Release year" },
};

const byText = (key) => (a, b) => a[key].localeCompare(b[key], undefined, { sensitivity: "base" });

function sortAlbums(list, sort, view, entries) {
  const out = list.slice();
  const recentKey = (a) => {
    const e = entries[a.id];
    if (view === "library") return a.savedAt || "";
    if (view === "listened") return e?.listenedAt || "";
    if (view === "want") return e?.shelvedAt || e?.addedAt || "";
    return e?.addedAt || "";
  };
  if (sort === "recent") out.sort((a, b) => recentKey(b).localeCompare(recentKey(a)));
  if (sort === "rating")
    out.sort((a, b) => (entries[b.id]?.rating || 0) - (entries[a.id]?.rating || 0) || byText("artists")(a, b));
  if (sort === "artist") out.sort((a, b) => byText("artists")(a, b) || byText("name")(a, b));
  if (sort === "title") out.sort(byText("name"));
  if (sort === "year") out.sort((a, b) => (b.year || "").localeCompare(a.year || ""));
  return out;
}

function Shell({ onSignOut }) {
  const { collection, actions, sync } = useCollection();
  const entries = collection.albums;
  const crates = collection.crates;

  const authLost = useCallback(() => onSignOut("expired"), [onSignOut]);
  const saved = useSavedAlbums(authLost);
  const me = useMe();
  const [view, go] = useHashView();

  const [open, setOpen] = useState(null); // { album, focusRating }
  const [crateDialog, setCrateDialog] = useState(null); // { crate?, assignTo? }
  const [toast, setToast] = useState(null);
  const [dialog, setDialog] = useState(null); // "about" | "report"
  const [filter, setFilter] = useState("");
  const [sorts, setSorts] = useState({ listened: "rating" });
  const [unsortedOnly, setUnsortedOnly] = useState(false);

  // Album metadata: prefer fresh data from the Spotify library, else what we stored.
  const savedById = useMemo(() => new Map(saved.albums.map((a) => [a.id, a])), [saved.albums]);
  const metaFor = useCallback((id) => savedById.get(id) || entries[id]?.meta, [savedById, entries]);

  const showToast = useCallback((t) => setToast({ ...t, key: Date.now() }), []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), toast.action ? 9000 : 4000);
    return () => clearTimeout(id);
  }, [toast]);

  // When an album finishes, offer to rate it.
  const lookupRef = useRef(null);
  lookupRef.current = (uri) =>
    saved.albums.find((a) => a.uri === uri) ||
    Object.values(entries).find((e) => e.meta?.uri === uri)?.meta;
  const player = usePlayer({
    onFinished: (uri) => {
      const album = lookupRef.current(uri);
      if (!album) return;
      showToast({
        text: `That's the end of ${album.name}.`,
        action: { label: "Rate it", run: () => setOpen({ album, focusRating: true }) },
      });
    },
  });

  const counts = useMemo(() => {
    const c = { want: 0, listened: 0, library: saved.albums.length, crates: {} };
    for (const e of Object.values(entries)) {
      if (e.status === "want") c.want++;
      if (e.status === "listened") c.listened++;
      for (const id of e.crates) c.crates[id] = (c.crates[id] || 0) + 1;
    }
    return c;
  }, [entries, saved.albums.length]);

  const crate = view.startsWith("crate/") ? crates.find((c) => c.id === view.slice(6)) : null;
  const knownView = ["want", "listened", "library", "search"].includes(view) || crate;
  useEffect(() => {
    if (!knownView) go("want");
  }, [knownView, go]);

  const sort = sorts[view] || "recent";

  const list = useMemo(() => {
    let albums;
    if (view === "library") {
      albums = unsortedOnly ? saved.albums.filter((a) => !entries[a.id]) : saved.albums;
    } else if (view === "want" || view === "listened") {
      albums = Object.keys(entries)
        .filter((id) => entries[id].status === view)
        .map(metaFor)
        .filter(Boolean);
    } else if (crate) {
      albums = Object.keys(entries)
        .filter((id) => entries[id].crates.includes(crate.id))
        .map(metaFor)
        .filter(Boolean);
    } else {
      return [];
    }
    const q = filter.trim().toLowerCase();
    if (q) albums = albums.filter((a) => `${a.name} ${a.artists}`.toLowerCase().includes(q));
    return sortAlbums(albums, sort, view, entries);
  }, [view, crate, entries, saved.albums, unsortedOnly, filter, sort, metaFor]);

  // Keyboard: Esc closes the drawer, space plays/pauses.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.("input, textarea, select, [contenteditable]")) return;
      if (e.key === "Escape" && !crateDialog && !dialog) setOpen(null);
      if (e.key === " " && player.track && !e.target.closest?.("button, a")) {
        e.preventDefault();
        player.toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [crateDialog, dialog, player]);

  const importFile = async (file) => {
    try {
      const data = JSON.parse(await file.text());
      if (!window.confirm("Replace your current shelves and crates with this backup?")) return;
      actions.replaceAll(data);
      showToast({ text: "Backup imported." });
    } catch (e) {
      showToast({ text: e.message.includes("VinylPuffin") ? e.message : "Couldn't read that file." });
    }
  };

  const renderGrid = (albums) => (
    <div className="grid">
      {albums.map((a) => {
        const entry = entries[a.id];
        return (
          <AlbumCard
            key={a.id}
            album={a}
            entry={entry}
            crates={crates}
            nowPlaying={player.contextUri === a.uri && !player.paused}
            onOpen={() => setOpen({ album: a })}
            onToggleWant={() => actions.setStatus(a, entry?.status === "want" ? null : "want")}
            onMarkListened={() => {
              if (entry?.status !== "listened") actions.setStatus(a, "listened");
              setOpen({ album: a, focusRating: true });
            }}
            onPlay={() => player.play(a)}
          />
        );
      })}
    </div>
  );

  const header = {
    want: { title: "Want to listen", sub: "Records queued up for a proper sit-down." },
    listened: { title: "Listened", sub: "Everything you've heard, rated." },
    library: { title: "Spotify library", sub: "Every album saved in your Spotify. Shelve them or drop them into crates." },
    search: { title: "Find albums", sub: "Anything on Spotify, saved or not." },
  }[view] || (crate && { title: crate.name, sub: "Crate" });

  const sortOptions = view === "library" || view === "want" ? ["recent", "artist", "title", "year"] : Object.keys(SORTS);

  return (
    <div className={`app${player.album || player.error ? " has-player" : ""}`}>
      <BackdropVinyl player={player} />
      <Sidebar
        view={view}
        go={(v) => {
          setFilter("");
          go(v);
        }}
        counts={counts}
        crates={crates}
        me={me}
        onNewCrate={() => setCrateDialog({})}
        onEditCrate={(c) => setCrateDialog({ crate: c })}
        onExport={() => exportBackup(collection)}
        onImport={importFile}
        onLogout={() => onSignOut()}
        onAbout={() => setDialog("about")}
        onReport={() => setDialog("report")}
        sync={sync}
      />

      <main className="main">
        {header && (
          <header className="page-head" style={crate ? { "--crate": crate.color } : undefined}>
            {crate && <span className="page-tab" />}
            <h1>
              {header.title}
              {view !== "search" && <sup>{list.length}</sup>}
            </h1>
            <p>{header.sub}</p>
            {crate && (
              <button className="btn btn-ghost btn-sm" onClick={() => setCrateDialog({ crate })}>
                <PencilIcon width={14} height={14} /> Edit crate
              </button>
            )}
          </header>
        )}

        {view === "search" ? (
          <SearchView renderGrid={renderGrid} />
        ) : (
          <>
            <div className="toolbar">
              <label className="search-box">
                <SearchIcon width={16} height={16} />
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filter…"
                  aria-label="Filter albums"
                />
              </label>
              <select
                className="select"
                value={sort}
                onChange={(e) => setSorts({ ...sorts, [view]: e.target.value })}
                aria-label="Sort"
              >
                {sortOptions.map((k) => (
                  <option key={k} value={k}>
                    {SORTS[k].label}
                  </option>
                ))}
              </select>
              {view === "library" && (
                <button
                  className={`toggle${unsortedOnly ? " is-on" : ""}`}
                  onClick={() => setUnsortedOnly(!unsortedOnly)}
                  aria-pressed={unsortedOnly}
                >
                  Unsorted only
                </button>
              )}
              {view === "library" && saved.status === "loading" && saved.albums.length > 0 && (
                <span className="syncing">Syncing with Spotify…</span>
              )}
            </div>

            {view === "library" && saved.status === "error" && (
              <div className="notice">
                {saved.error?.status === 403
                  ? "Spotify refused the request. If this is a Development Mode app, add your account under User Management in the Spotify developer dashboard."
                  : `Couldn't load your Spotify library. ${saved.error?.message || ""}`}{" "}
                <button className="link" onClick={saved.reload}>Try again</button>
              </div>
            )}

            {view === "library" && saved.status === "loading" && saved.albums.length === 0 ? (
              <div className="grid">
                {Array.from({ length: 12 }, (_, i) => (
                  <div className="skeleton" key={i} />
                ))}
              </div>
            ) : list.length > 0 ? (
              renderGrid(list)
            ) : (
              <EmptyState view={view} filtered={Boolean(filter.trim())} go={go} />
            )}
          </>
        )}
      </main>

      {open && (
        <AlbumDetail
          album={metaFor(open.album.id) || open.album}
          entry={entries[open.album.id]}
          crates={crates}
          actions={actions}
          player={player}
          focusRating={open.focusRating}
          onClose={() => setOpen(null)}
          onNewCrate={(album) => setCrateDialog({ assignTo: album })}
        />
      )}

      {crateDialog && (
        <CrateDialog
          crate={crateDialog.crate}
          count={crateDialog.crate ? counts.crates[crateDialog.crate.id] || 0 : 0}
          onClose={() => setCrateDialog(null)}
          onSave={({ name, color }) => {
            if (crateDialog.crate) {
              actions.updateCrate(crateDialog.crate.id, { name, color });
            } else {
              const created = actions.addCrate(name, color);
              if (crateDialog.assignTo) actions.toggleCrate(crateDialog.assignTo, created.id);
              else go(`crate/${created.id}`);
            }
            setCrateDialog(null);
          }}
          onDelete={() => {
            if (view === `crate/${crateDialog.crate.id}`) go("want");
            actions.deleteCrate(crateDialog.crate.id);
            setCrateDialog(null);
          }}
        />
      )}

      {dialog === "about" && (
        <AboutDialog onClose={() => setDialog(null)} onReport={() => setDialog("report")} />
      )}
      {dialog === "report" && <ReportDialog onClose={() => setDialog(null)} />}

      <PlayerBar player={player} onOpenAlbum={(album) => setOpen({ album })} />
      <IdleScreen player={player} />

      {toast && (
        <div className="toast" key={toast.key} role="status">
          <span>{toast.text}</span>
          {toast.action && (
            <button
              onClick={() => {
                toast.action.run();
                setToast(null);
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({ view, filtered, go }) {
  if (filtered) return <p className="empty">Nothing matches that filter.</p>;
  const messages = {
    want: (
      <>
        Nothing queued yet. Bookmark albums from your{" "}
        <button className="link" onClick={() => go("library")}>Spotify library</button> or{" "}
        <button className="link" onClick={() => go("search")}>find new ones</button>.
      </>
    ),
    listened: "Mark an album as listened, or rate it, and it lands here.",
    library: "No saved albums in your Spotify library yet. Save some in Spotify, or use Find albums.",
  };
  return (
    <p className="empty">
      {messages[view] || "This crate is empty. Open any album and tick this crate to add it."}
    </p>
  );
}
