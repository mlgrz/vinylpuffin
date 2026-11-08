import { useEffect, useState } from "react";
import { CloseIcon, PauseIcon, PlayIcon } from "./Icons.jsx";

function useProgress(player) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (player.paused) return;
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [player.paused]);
  if (!player.duration) return 0;
  const pos = player.paused ? player.position : player.position + (performance.now() - player.at);
  return Math.min(1, pos / player.duration);
}

export default function PlayerBar({ player, onOpenAlbum }) {
  const progress = useProgress(player);
  const album = player.album;
  const image = player.track?.image || album?.image;
  const playing = !player.paused;

  if (!album && !player.track && !player.error) return null;

  return (
    <div className="playerbar">
      <div className="playerbar-progress" style={{ transform: `scaleX(${progress})` }} />
      <button
        className={`mini-disc${playing ? " is-spinning" : ""}`}
        onClick={() => album && onOpenAlbum(album)}
        aria-label="Open the album that's playing"
      >
        <span style={{ backgroundImage: image ? `url(${image})` : undefined }} />
      </button>
      <div className="playerbar-text">
        {player.error ? (
          <span className="playerbar-error">{player.error}</span>
        ) : (
          <>
            <span className="playerbar-track">
              {player.track?.name || (player.busy ? "Cueing up…" : album?.name)}
            </span>
            <span className="playerbar-album">
              {player.track ? `${player.track.album} — ${player.track.artists}` : album?.artists}
            </span>
          </>
        )}
      </div>
      {player.error ? (
        <button className="icon-btn" onClick={player.dismissError} aria-label="Dismiss">
          <CloseIcon />
        </button>
      ) : (
        <button
          className="play-btn"
          onClick={player.toggle}
          disabled={!player.track}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
      )}
    </div>
  );
}
