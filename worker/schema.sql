-- One row per Spotify account: the whole collection as JSON, plus a
-- revision number that every save bumps (used to detect concurrent saves).
CREATE TABLE IF NOT EXISTS collections (
  user_id    TEXT PRIMARY KEY,
  rev        INTEGER NOT NULL,
  data       TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Bug reports sent from the app, kept only to rate-limit each account.
CREATE TABLE IF NOT EXISTS reports (
  user_id    TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS reports_by_user ON reports (user_id, created_at);
