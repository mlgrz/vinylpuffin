import { useEffect, useRef, useState } from "react";
import { backendEnabled, backendFetch } from "../backend.js";

const KINDS = [
  { id: "bug", label: "Something's broken" },
  { id: "idea", label: "An idea" },
  { id: "other", label: "Other" },
];

// In-app bug / feedback form. The worker files it on GitHub; listeners never
// see where it goes.
export default function ReportDialog({ onClose }) {
  const [kind, setKind] = useState("bug");
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [withContext, setWithContext] = useState(true);
  const [state, setState] = useState({ phase: "edit", error: null }); // edit | sending | sent
  const inputRef = useRef(null);

  // Focus the first field once, when the dialog opens. (Not tied to onClose:
  // the parent re-renders often, and each re-render would steal focus back.)
  useEffect(() => inputRef.current?.focus(), []);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    if (summary.trim().length < 3 || state.phase === "sending") return;
    setState({ phase: "sending", error: null });
    try {
      await backendFetch("/report", {
        method: "POST",
        body: {
          kind,
          summary: summary.trim(),
          details: details.trim(),
          context: withContext
            ? `Page: ${window.location.hash || "#/"}\nBrowser: ${navigator.userAgent}`
            : "",
        },
      });
      setState({ phase: "sent", error: null });
    } catch (err) {
      setState({ phase: "edit", error: err.message || "Couldn't send that. Try again." });
    }
  };

  return (
    <div className="modal-root" role="dialog" aria-modal="true" aria-labelledby="report-title">
      <div className="modal-scrim" onClick={onClose} />
      {state.phase === "sent" ? (
        <div className="modal">
          <div className="modal-divider" style={{ background: "var(--orange)" }}>
            <span id="report-title">Thanks!</span>
          </div>
          <p className="about-copy">Your report was sent. It really helps.</p>
          <div className="modal-actions">
            <span className="spacer" />
            <button className="btn btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      ) : (
        <form className="modal" onSubmit={submit}>
          <div className="modal-divider" style={{ background: "var(--orange)" }}>
            <span id="report-title">Report a bug</span>
          </div>

          {!backendEnabled ? (
            <p className="about-copy">Bug reports aren't available on this copy of VinylPuffin.</p>
          ) : (
            <>
              <span className="label">What is it?</span>
              <div className="suggestions report-kinds" role="radiogroup" aria-label="Kind">
                {KINDS.map((k) => (
                  <button
                    type="button"
                    key={k.id}
                    role="radio"
                    aria-checked={kind === k.id}
                    className={kind === k.id ? "is-on" : ""}
                    onClick={() => setKind(k.id)}
                  >
                    {k.label}
                  </button>
                ))}
              </div>

              <label className="label" htmlFor="report-summary">In a few words</label>
              <input
                id="report-summary"
                ref={inputRef}
                className="input"
                value={summary}
                maxLength={120}
                placeholder="Rating stars don't save on mobile"
                onChange={(e) => setSummary(e.target.value)}
              />

              <label className="label" htmlFor="report-details">Details (optional)</label>
              <textarea
                id="report-details"
                className="notes"
                value={details}
                maxLength={4000}
                rows={5}
                placeholder="What did you do, what happened, and what did you expect?"
                onChange={(e) => setDetails(e.target.value)}
              />

              <label className="report-check">
                <input
                  type="checkbox"
                  checked={withContext}
                  onChange={(e) => setWithContext(e.target.checked)}
                />
                Include the current page and browser version
              </label>

              {state.error && <p className="report-error" role="alert">{state.error}</p>}
            </>
          )}

          <div className="modal-actions">
            <span className="spacer" />
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            {backendEnabled && (
              <button
                type="submit"
                className="btn btn-primary"
                disabled={summary.trim().length < 3 || state.phase === "sending"}
              >
                {state.phase === "sending" ? "Sending…" : "Send"}
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
