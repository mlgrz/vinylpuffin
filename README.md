# VinylPuffin

A record shelf for your Spotify albums. Queue up albums you **want to listen** to,
rate the ones you've **listened** to, and file albums into your own **crates**
(“good drum sounds”, “guitar tones”, …). Albums play whole, start to finish,
right in the browser.

## How it's built (is there a backend?)

**No backend.** VinylPuffin is a static single-page app (React + Vite). It builds
to plain HTML/JS/CSS files you can host anywhere. Right now that's GitHub Pages.

```
Browser ──(login: OAuth PKCE)──────────▶ accounts.spotify.com
   │
   ├──(saved albums, search, tracks)───▶ api.spotify.com
   ├──(playback: Web Playback SDK)─────▶ Spotify (Premium)
   │
   └── your shelves, ratings, crates, notes ──▶ localStorage (this browser)
```

- **Spotify login** uses the Authorization Code + PKCE flow. It's built for apps
  with no server, so there's no client secret to protect.
- **Your organization data** (want / listened, ratings, crates, notes, starred
  tracks) is saved in the browser's `localStorage`. Spotify has no place to store it.
  Use **Export** in the sidebar for a JSON backup and **Import** to restore it or
  move it to another browser.
- If you later want your shelves synced across devices, *that's* when you'd add a
  backend (for example Supabase or a small API with a database). Swap out
  `src/collection.js`; nothing else needs to change.

### You need Vite to run it (not Live Server)

`index.html` loads `src/main.jsx`, which has to be compiled. Opening the HTML
file directly, or with VS Code's Live Server, won't work. Use `npm run dev`.

## Setup

1. Create an app at <https://developer.spotify.com/dashboard>.
   - Tick **Web API** and **Web Playback SDK**.
   - Add Redirect URIs, which must match exactly:
     - `http://127.0.0.1:5173/` for local dev
     - `https://<you>.github.io/<repo>/` for GitHub Pages
   - Development Mode apps only work for accounts added under **User Management**.
     The app owner needs Spotify Premium.
2. `cp .env.example .env` and paste your Client ID.
3. `npm install`
4. `npm run dev`, then open <http://127.0.0.1:5173/>. Use `127.0.0.1`, not
   `localhost`: Spotify no longer accepts `localhost` redirect URIs.

## Deploying

Pushing to `master`/`main` runs `.github/workflows/deploy.yml`, which builds the
site and publishes `dist/` to GitHub Pages. Set `VITE_SPOTIFY_CLIENT_ID` (and
optionally `VITE_SPOTIFY_REDIRECT_URI`) under *Settings → Secrets and variables →
Actions*.

The old `vinylpuffin.html` URL still works. It forwards to the app.

## Code map

| File | What it does |
| --- | --- |
| `src/spotify/auth.js` | PKCE login, token storage and refresh |
| `src/spotify/api.js` | Spotify Web API calls (saved albums, search, tracks, play) |
| `src/spotify/usePlayer.js` | Web Playback SDK hook: this tab becomes a Spotify device |
| `src/collection.js` | Your shelves, ratings, crates and notes in localStorage, plus export/import |
| `src/App.jsx` | Views (`#/want`, `#/listened`, `#/library`, `#/search`, `#/crate/<id>`) |
| `src/components/` | Sidebar, album cards, album drawer, crate dialog, player bar |
| `src/styles.css` | The whole look |

### Spotify API notes

Spotify cut back the Web API for Development Mode apps in Feb 2026. This app only
uses endpoints that still work: `GET /me/albums`, `GET /search` (max 10 results per
page), `GET /albums/{id}/tracks`, and `PUT /me/player/play`. Batch endpoints such
as `GET /albums?ids=` are gone, so don't add code that relies on them.
