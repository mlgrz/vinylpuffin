import { BookmarkIcon, CheckIcon, PlayIcon } from "./Icons.jsx";
import { formatRating } from "../collection.js";

export default function AlbumCard({
  album,
  entry,
  crates,
  nowPlaying,
  onOpen,
  onToggleWant,
  onMarkListened,
  onPlay,
}) {
  const crateTabs = (entry?.crates || [])
    .map((id) => crates.find((c) => c.id === id))
    .filter(Boolean);
  const status = entry?.status;

  return (
    <article className={`card${nowPlaying ? " is-playing" : ""}`}>
      <div className="sleeve">
        <span className="sleeve-disc" aria-hidden="true">
          <span
            className="sleeve-disc-label"
            style={{ backgroundImage: album.thumb ? `url(${album.thumb})` : undefined }}
          />
        </span>
        <button className="sleeve-cover" onClick={onOpen} aria-label={`Open ${album.name}`}>
          {album.thumb ? (
            <img src={album.thumb} alt="" loading="lazy" />
          ) : (
            <span className="sleeve-blank">{album.name}</span>
          )}
        </button>

        {status === "want" && <span className="stamp">Want</span>}
        {status === "listened" && (
          <span className={`sticker${entry.rating ? "" : " is-unrated"}`}>
            {entry.rating ? formatRating(entry.rating) : "rate"}
          </span>
        )}

        <div className="quick">
          <button
            className={status === "want" ? "is-on" : ""}
            onClick={onToggleWant}
            title={status === "want" ? "Remove from Want to Listen" : "Want to listen"}
          >
            <BookmarkIcon width={16} height={16} />
          </button>
          <button
            className={status === "listened" ? "is-on" : ""}
            onClick={onMarkListened}
            title="Mark listened and rate"
          >
            <CheckIcon width={16} height={16} />
          </button>
          <button onClick={onPlay} title="Play album">
            <PlayIcon width={15} height={15} />
          </button>
        </div>
      </div>

      {crateTabs.length > 0 && (
        <div className="card-tabs">
          {crateTabs.map((c) => (
            <span key={c.id} style={{ background: c.color }} title={c.name} />
          ))}
        </div>
      )}

      <button className="card-meta" onClick={onOpen} tabIndex={-1}>
        <span className="card-title">{album.name}</span>
        <span className="card-artist">
          {album.artists}
          {album.year && <span className="card-year"> · {album.year}</span>}
        </span>
      </button>
    </article>
  );
}
