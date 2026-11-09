// Ambient visuals: a faint record behind the page that turns while music
// plays, and a minimalist idle screen after a stretch of no input.

import { useEffect, useRef, useState } from "react";

const IDLE_MS = 3 * 60 * 1000;
const ACTIVITY = ["pointerdown", "keydown", "wheel", "touchstart"];

function labelImage(player) {
  return player.track?.image || player.album?.image || "";
}

function Disc({ className, player }) {
  const image = labelImage(player);
  return (
    <div className={`${className}${player.paused ? "" : " is-spinning"}`}>
      <span
        className="ambient-label"
        style={{ backgroundImage: image ? `url(${image})` : undefined }}
      />
    </div>
  );
}

export function BackdropVinyl({ player }) {
  return (
    <div className="backdrop-vinyl" aria-hidden="true">
      <Disc className="backdrop-disc" player={player} />
    </div>
  );
}

// True after `ms` of no input. The input that wakes it is swallowed so a
// stray key or click doesn't also act on the page underneath.
function useIdle(ms) {
  const [idle, setIdle] = useState(false);
  const idleRef = useRef(false);
  const lastRef = useRef(performance.now());

  useEffect(() => {
    const onActivity = (e) => {
      lastRef.current = performance.now();
      if (!idleRef.current) return;
      idleRef.current = false;
      setIdle(false);
      if (e.type === "keydown" || e.type === "pointerdown") {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    ACTIVITY.forEach((t) =>
      window.addEventListener(t, onActivity, { capture: true, passive: false }),
    );
    const timer = setInterval(() => {
      if (!idleRef.current && performance.now() - lastRef.current >= ms) {
        idleRef.current = true;
        setIdle(true);
      }
    }, 5000);
    return () => {
      ACTIVITY.forEach((t) =>
        window.removeEventListener(t, onActivity, { capture: true }),
      );
      clearInterval(timer);
    };
  }, [ms]);

  return idle;
}

export function IdleScreen({ player }) {
  const idle = useIdle(IDLE_MS);
  // Stay mounted through the fade-out so the waking click lands here.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (idle) return setShown(true);
    const id = setTimeout(() => setShown(false), 400);
    return () => clearTimeout(id);
  }, [idle]);

  if (!shown) return null;
  const playing = !player.paused && player.track;
  return (
    <div
      className={`idle-screen${idle ? "" : " is-leaving"}`}
      aria-hidden="true"
    >
      <Disc className="idle-disc" player={player} />
      {playing && (
        <p className="idle-caption">
          <strong>{player.track.name}</strong>
          <span>{player.track.artists}</span>
        </p>
      )}
    </div>
  );
}
