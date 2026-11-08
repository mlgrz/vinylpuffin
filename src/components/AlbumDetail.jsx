import { useEffect, useRef, useState } from "react";
import { getAlbumTracks } from "../spotify/api.js";
import { inkOn } from "../collection.js";
import Rating from "./Rating.jsx";
import {
  CloseIcon,
  ExternalIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  StarIcon,
} from "./Icons.jsx";

const fmtTime = (ms) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const SHELVES = [
  { value: null, label: "Unshelved" },
  { value: "want", label: "Want to listen" },
  { value: "listened", label: "Listened" },
];

export default function AlbumDetail({
  album,
  entry,
  crates,
  actions,
  player,
  focusRating,
  onClose,
  onNewCrate,
}) {
  const [tracks, setTracks] = useState(null);
  const ratingRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setTracks(null);
    getAlbumTracks(album.id)
      .then((t) => !cancelled && setTracks(t))
      .catch(() => !cancelled && setTracks([]));
    return () => {
      cancelled = true;
    };
  }, [album.id]);

  useEffect(() => {
    if (focusRating) ratingRef.current?.scrollIntoView({ block: "center" });
    else panelRef.current?.scrollTo({ top: 0 });
  }, [album.id, focusRating]);

  const status = entry?.status || null;
  const isCurrent = player.contextUri === album.uri || player.album?.id === album.id;
  const isPlaying = isCurrent && !player.paused;
  const totalMs = tracks?.reduce((sum, t) => sum + t.duration, 0) || 0;
  const multiDisc = tracks?.some((t) => t.disc > 1);

  const onPlayClick = () => {
    if (isCurrent && player.track) player.toggle();
    else player.play(album);
  };

  return (
    <div className="drawer-root">
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer" ref={panelRef} aria-label={album.name}>
        <button className="drawer-close" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>

        <div className={`detail-art${isPlaying ? " is-spinning" : ""}`}>
          <span className="detail-disc" aria-hidden="true">
            <span
              className="detail-disc-label"
              style={{ backgroundImage: album.image ? `url(${album.image})` : undefined }}
            />
          </span>
          {album.image ? (
            <img className="detail-cover" src={album.image} alt="" />
          ) : (
            <div className="detail-cover detail-cover-blank" />
          )}
        </div>

        <header className="detail-head">
          <h2>{album.name}</h2>
          <p className="detail-artist">{album.artists}</p>
          <p className="detail-facts">
            {[
              album.year,
              tracks && `${tracks.length} tracks`,
              totalMs && `${Math.round(totalMs / 60000)} min`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <div className="detail-actions">
            <button className="btn btn-primary" onClick={onPlayClick} disabled={player.busy}>
              {isPlaying ? <PauseIcon width={18} height={18} /> : <PlayIcon width={18} height={18} />}
              {isPlaying ? "Pause" : isCurrent && player.track ? "Resume" : "Drop the needle"}
            </button>
            <a className="btn btn-ghost" href={album.url} target="_blank" rel="noreferrer">
              <ExternalIcon width={16} height={16} /> Spotify
            </a>
          </div>
        </header>

        <section className="detail-section">
          <h3 className="label">Shelf</h3>
          <div className="segmented" role="radiogroup" aria-label="Shelf">
            {SHELVES.map((s) => (
              <button
                key={s.label}
                role="radio"
                aria-checked={status === s.value}
                className={status === s.value ? "is-on" : ""}
                onClick={() => actions.setStatus(album, s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </section>

        <section
          className={`detail-section${focusRating && !entry?.rating ? " is-prompt" : ""}`}
          ref={ratingRef}
        >
          <h3 className="label">
            Rating {status !== "listened" && <span className="hint">· rating moves it to Listened</span>}
          </h3>
          <Rating value={entry?.rating ?? null} onChange={(r) => actions.setRating(album, r)} />
        </section>

        <section className="detail-section">
          <h3 className="label">Crates</h3>
          <div className="chips">
            {crates.map((c) => {
              const on = entry?.crates?.includes(c.id);
              return (
                <button
                  key={c.id}
                  className={`chip${on ? " is-on" : ""}`}
                  style={on ? { background: c.color, borderColor: c.color, color: inkOn(c.color) } : undefined}
                  onClick={() => actions.toggleCrate(album, c.id)}
                  aria-pressed={on}
                >
                  <span className="chip-dot" style={{ background: c.color }} />
                  {c.name}
                </button>
              );
            })}
            <button className="chip chip-new" onClick={() => onNewCrate(album)}>
              <PlusIcon width={14} height={14} /> New crate
            </button>
          </div>
        </section>

        <section className="detail-section">
          <h3 className="label" id="notes-label">Notes</h3>
          <textarea
            className="notes"
            aria-labelledby="notes-label"
            placeholder="Snare on track 3 is huge. Listen on headphones…"
            value={entry?.notes || ""}
            rows={3}
            onChange={(e) => actions.setNotes(album, e.target.value)}
          />
        </section>

        <section className="detail-section">
          <h3 className="label">
            Tracklist <span className="hint">· star the standout tracks</span>
          </h3>
          {!tracks && <p className="muted">Loading tracks…</p>}
          {tracks && tracks.length === 0 && <p className="muted">Couldn't load the tracklist.</p>}
          {tracks && tracks.length > 0 && (
            <ol className="tracks">
              {tracks.map((t, i) => {
                const current =
                  isCurrent && player.track && (player.track.uri === t.uri || player.track.name === t.name);
                const starred = entry?.highlights?.includes(t.id);
                const newDisc = multiDisc && (i === 0 || tracks[i - 1].disc !== t.disc);
                return (
                  <li key={t.id} className={current ? "is-current" : ""}>
                    {newDisc && <div className="disc-label">Disc {t.disc}</div>}
                    <div className="track">
                      <span className="track-no">
                        {current && !player.paused ? <span className="eq" aria-label="Playing" /> : t.number}
                      </span>
                      <span className="track-name">{t.name}</span>
                      <button
                        className={`track-star${starred ? " is-on" : ""}`}
                        onClick={() => actions.toggleHighlight(album, t.id)}
                        aria-pressed={starred}
                        aria-label={`Standout track: ${t.name}`}
                      >
                        <StarIcon fill={starred ? 1 : 0} width={16} height={16} />
                      </button>
                      <span className="track-time">{fmtTime(t.duration)}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </aside>
    </div>
  );
}
