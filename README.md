# VinylPuffin

A record shelf for your Spotify albums. Queue up albums you **want to listen** to,
rate the ones you've **listened** to, and file albums into your own **crates**
(“good drum sounds”, “guitar tones”, …). Albums play whole, start to finish,
right in the browser.

## How it's built

VinylPuffin is a static single-page app (React + Vite) hosted on GitHub Pages,
plus an **optional** tiny backend (a Cloudflare Worker with a D1 database) that
keeps your shelves the same on every device and files in-app bug reports.

```
Browser ──(login: OAuth PKCE)──────────▶ accounts.spotify.com
   │
   ├──(saved albums, search, tracks)───▶ api.spotify.com
   ├──(playback: Web Playback SDK)─────▶ Spotify (Premium)
   │
   ├── shelves, ratings, crates, notes ─▶ localStorage (working copy, works offline)
   └──(sync + bug reports, if VITE_SYNC_URL is set)──▶ worker/ ──▶ D1 (one row per Spotify account)
                                     ├─(who is this token?)─▶ api.spotify.com/v1/me
                                     └─(report → new issue)─▶ api.github.com
```

- **Spotify login** uses the Authorization Code + PKCE flow. It's built for apps
  with no server, so there's no client secret to protect.
- **Your organization data** (want / listened, ratings, crates, notes, starred
  tracks) is always saved in the browser's `localStorage`. **Export / Import** in
  the sidebar still give you a JSON backup.
- **Sync** (`src/sync.js` + `worker/`): there's no separate account. The app sends
  its Spotify token to the worker, which asks Spotify who you are and stores your
  collection under your Spotify user id.
  - Every save names the revision it was based on. If another device saved in
    between, the worker answers `409` with its copy, the app merges the two and
    tries again.
  - Merging is per album and per crate: the most recent change wins.
    Removals leave a timestamped tombstone, so deleting something on one device
    doesn't get undone by another.
  - Changes save about a second after you make them. Other devices' changes come
    in when the app starts, when you switch back to the tab, and every few minutes.
    Offline edits stay local and sync when you're back. The sidebar shows the status.
  - If a different Spotify account signs in on the same browser, its cloud copy
    replaces the local one. The two are never mixed.

- **Bug reports** (`src/components/ReportDialog.jsx`, `POST /report`): listeners fill
  in a form inside the app. The worker opens a GitHub issue using a token that only
  the worker holds. The app never links to the repo or shows it. Reports require a
  Spotify login and are limited to 5 per account per day. The issue shows a short
  hash instead of the reporter's Spotify id, and `@mentions` in the text are
  neutralised.

### Setting up the backend (one time, free tier is plenty)

```sh
cd worker
npm install
npx wrangler login
npx wrangler d1 create vinylpuffin        # paste the printed database_id into wrangler.toml
npm run db:init                           # creates the tables (safe to re-run)
npx wrangler secret put GITHUB_TOKEN      # for bug reports, see below
npx wrangler deploy                       # prints https://vinylpuffin-sync.<you>.workers.dev
```

Then set `VITE_SYNC_URL` to that URL in `.env` for local dev, and as an Actions
variable for GitHub Pages. If you serve the app from another origin, add it to
`ALLOWED_ORIGINS` in `worker/wrangler.toml` and deploy again. The first sync
merges whatever is already in your browser into the cloud copy.

`GITHUB_TOKEN` should be a **fine-grained** personal access token
(GitHub → Settings → Developer settings) with access to only `mlgrz/vinylpuffin`
and only **Issues: Read and write**. Reports are filed to `GITHUB_REPO` in
`wrangler.toml`. Without the token, the form says reports aren't available.

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
optionally `VITE_SPOTIFY_REDIRECT_URI` and `VITE_SYNC_URL`) under *Settings → Secrets and variables →
Actions*.

The old `vinylpuffin.html` URL still works. It forwards to the app.

## Code map

| File | What it does |
| --- | --- |
| `src/spotify/auth.js` | PKCE login, token storage and refresh |
| `src/spotify/api.js` | Spotify Web API calls (saved albums, search, tracks, play) |
| `src/spotify/usePlayer.js` | Web Playback SDK hook: this tab becomes a Spotify device |
| `src/collection.js` | Your shelves, ratings, crates and notes: state, merge logic, export/import |
| `src/backend.js` | Calls to the worker, with the Spotify token |
| `src/sync.js` | Cloud sync with the worker (optional) |
| `worker/` | Backend: sync + bug reports (Cloudflare Worker + D1) |
| `src/App.jsx` | Views (`#/want`, `#/listened`, `#/library`, `#/search`, `#/crate/<id>`) |
| `src/components/` | Sidebar, album cards, album drawer, crate & about dialogs, player bar, idle screen |
| `src/styles.css` | The whole look |

### Spotify API notes

Spotify cut back the Web API for Development Mode apps in Feb 2026. This app only
uses endpoints that still work: `GET /me/albums`, `GET /search` (max 10 results per
page), `GET /albums/{id}/tracks`, and `PUT /me/player/play`. Batch endpoints such
as `GET /albums?ids=` are gone, so don't add code that relies on them.
