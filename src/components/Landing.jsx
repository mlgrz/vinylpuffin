import logo from "../assets/puffin.png";
import { hasClientId, REDIRECT_URI } from "../spotify/auth.js";
import ThemeToggle from "./ThemeToggle.jsx";

const DIVIDERS = [
  { label: "Want to listen", color: "#F0622B" },
  { label: "Listened ★★★★½", color: "#1A1714" },
  { label: "Good drum sounds", color: "#2F5BEA" },
  { label: "Guitar tones", color: "#1C9A62" },
  { label: "Late night", color: "#E3A912" },
];

export default function Landing({ onConnect, error }) {
  return (
    <main className="landing">
      <header className="landing-top">
        <img src={logo} alt="" width={36} height={36} />
        <span className="wordmark">VinylPuffin</span>
        <ThemeToggle className="push-right" />
      </header>

      <section className="landing-hero">
        <div className="landing-copy">
          <p className="kicker">A record shelf for your Spotify albums</p>
          <h1>
            Dig through
            <br />
            your crates.
          </h1>
          <p className="landing-lede">
            Queue up what you <strong>want to listen</strong> to. Rate what you've{" "}
            <strong>heard</strong>. File albums into your own crates, like{" "}
            <em>good drum sounds</em> or <em>guitar tones</em>, and play them whole,
            start to finish.
          </p>

          {hasClientId ? (
            <button className="btn btn-connect" onClick={onConnect}>
              Connect Spotify
            </button>
          ) : (
            <div className="setup-note">
              <strong>Setup needed:</strong> add <code>VITE_SPOTIFY_CLIENT_ID</code> to a{" "}
              <code>.env</code> file and restart <code>npm run dev</code>. Register{" "}
              <code>{REDIRECT_URI}</code> as a Redirect URI in your Spotify app. See README.md.
            </div>
          )}
          {error && <p className="landing-error">{error}</p>}
          <p className="fine">
            Uses your saved Spotify albums. Your shelves and crates are saved in this browser.
            Playback needs Spotify Premium.
          </p>
        </div>

        <div className="crate" aria-hidden="true">
          {DIVIDERS.map((d, i) => (
            <div
              key={d.label}
              className="crate-divider"
              style={{ "--i": i, background: d.color, color: i === 4 ? "#1A1714" : "#fff" }}
            >
              {d.label}
            </div>
          ))}
          <div className="crate-box" />
        </div>
      </section>
    </main>
  );
}
