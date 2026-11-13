import { useEffect } from "react";
import logo from "../assets/puffin.png";

export default function AboutDialog({ onClose, onReport }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-root" role="dialog" aria-modal="true" aria-labelledby="about-title">
      <div className="modal-scrim" onClick={onClose} />
      <div className="modal about">
        <div className="modal-divider" style={{ background: "var(--orange)" }}>
          <span id="about-title">About</span>
        </div>
        <div className="about-brand">
          <img src={logo} alt="" width={48} height={48} />
          <div>
            <strong>VinylPuffin</strong>
            <p>A record shelf for your Spotify albums.</p>
          </div>
        </div>
        <p className="about-credit">dev by kave</p>
        <p className="about-copy">
          Found something broken, or have an idea? Send a report. A note on what you clicked and
          what you expected helps a lot.
        </p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          <span className="spacer" />
          <button className="btn btn-primary" onClick={onReport}>
            Report a bug / issue
          </button>
        </div>
      </div>
    </div>
  );
}
