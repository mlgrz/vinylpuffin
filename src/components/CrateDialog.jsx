import { useEffect, useRef, useState } from "react";
import { CRATE_COLORS } from "../collection.js";

const SUGGESTIONS = ["Good drum sounds", "Guitar tones", "Late night", "Bass lines", "Sunday morning"];

// Create or edit a crate (a custom bucket like "good drum sounds").
export default function CrateDialog({ crate, count, onSave, onDelete, onClose }) {
  const [name, setName] = useState(crate?.name || "");
  const [color, setColor] = useState(crate?.color || CRATE_COLORS[0]);
  const inputRef = useRef(null);

  // Focus once on open; re-running this on every parent re-render would steal focus.
  useEffect(() => inputRef.current?.focus(), []);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = (e) => {
    e.preventDefault();
    if (name.trim()) onSave({ name: name.trim(), color });
  };

  return (
    <div className="modal-root" role="dialog" aria-modal="true" aria-labelledby="crate-title">
      <div className="modal-scrim" onClick={onClose} />
      <form className="modal" onSubmit={submit}>
        <div className="modal-divider" style={{ background: color }}>
          <span id="crate-title">{crate ? "Edit crate" : "New crate"}</span>
        </div>
        <label className="label" htmlFor="crate-name">Name</label>
        <input
          id="crate-name"
          ref={inputRef}
          className="input"
          value={name}
          maxLength={40}
          placeholder="For good drum sounds"
          onChange={(e) => setName(e.target.value)}
        />
        {!crate && (
          <div className="suggestions">
            {SUGGESTIONS.map((s) => (
              <button type="button" key={s} onClick={() => setName(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        <span className="label">Color</span>
        <div className="swatches" role="radiogroup" aria-label="Color">
          {CRATE_COLORS.map((c) => (
            <button
              type="button"
              key={c}
              role="radio"
              aria-checked={color === c}
              aria-label={c}
              className={color === c ? "is-on" : ""}
              style={{ background: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
        <div className="modal-actions">
          {crate && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                const msg = count
                  ? `Delete "${crate.name}"? ${count} album${count === 1 ? "" : "s"} will be taken out of it (the albums themselves stay).`
                  : `Delete "${crate.name}"?`;
                if (window.confirm(msg)) onDelete();
              }}
            >
              Delete
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
            {crate ? "Save" : "Create crate"}
          </button>
        </div>
      </form>
    </div>
  );
}
