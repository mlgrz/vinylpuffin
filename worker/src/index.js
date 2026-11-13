// VinylPuffin sync worker: stores each user's collection (shelves, ratings,
// crates, notes) so it follows them across browsers and devices.
//
// There is no separate account. The browser sends its Spotify access token,
// and the worker asks Spotify who that is (GET /v1/me). The Spotify user id
// is the key, so you can only ever read or write your own collection.
//
//   GET /collection  -> { userId, rev, data }   (rev 0 and data null if none yet)
//   PUT /collection  <- { baseRev, data }
//                    -> 200 { rev }                     saved
//                    -> 409 { userId, rev, data }       someone saved first: merge and retry
//   POST /report     <- { kind, summary, details?, context? }
//                    -> 200 { ok: true }    filed as an issue on GITHUB_REPO
//
// Bug reports go through here so listeners never see or need the GitHub repo.
// The GitHub token is a worker secret (GITHUB_TOKEN) and never reaches the browser.

const MAX_BYTES = 1_000_000; // a big collection is tens of KB
const ME_CACHE_SECONDS = 300;
const REPORTS_PER_DAY = 5; // per Spotify account
const KINDS = { bug: "Bug", idea: "Idea", other: "Feedback" };

const json = (body, status, headers) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });

function corsHeaders(req, env) {
  const origin = req.headers.get("Origin");
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim());
  if (!origin || !allowed.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Spotify user id for this token, or a Response to send back on failure.
// Cached briefly (by token hash) so every save doesn't hit Spotify.
async function spotifyUser(req, ctx) {
  const token = (req.headers.get("Authorization") || "").match(/^Bearer (.+)$/)?.[1];
  if (!token) return { error: 401 };

  const cache = caches.default;
  const cacheKey = new Request(`https://vinylpuffin-sync.internal/me/${await sha256(token)}`);
  const hit = await cache.match(cacheKey);
  if (hit) return { id: await hit.text() };

  const res = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) return { error: 401 };
  if (!res.ok) return { error: 502 };
  const me = await res.json();
  if (!me?.id) return { error: 502 };

  ctx.waitUntil(
    cache.put(
      cacheKey,
      new Response(me.id, { headers: { "Cache-Control": `max-age=${ME_CACHE_SECONDS}` } }),
    ),
  );
  return { id: me.id };
}

function validCollection(d) {
  return (
    d &&
    typeof d === "object" &&
    d.albums &&
    typeof d.albums === "object" &&
    !Array.isArray(d.albums) &&
    Array.isArray(d.crates)
  );
}

async function current(env, userId) {
  const row = await env.DB.prepare("SELECT rev, data FROM collections WHERE user_id = ?")
    .bind(userId)
    .first();
  // `data` is already JSON text; splice it in rather than parse + re-stringify.
  return row
    ? `{"userId":${JSON.stringify(userId)},"rev":${row.rev},"data":${row.data}}`
    : JSON.stringify({ userId, rev: 0, data: null });
}

const clip = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Keep user text from pinging people (@name) or closing our code fences.
const defang = (text) => text.replace(/@/g, "@\u200b").replace(/```/g, "ˋˋˋ");

async function fileReport(req, env, userId) {
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) {
    return { status: 503, body: { error: "Bug reports aren't set up on the server." } };
  }
  let input;
  try {
    input = await req.json();
  } catch {
    return { status: 400, body: { error: "Invalid JSON" } };
  }
  const kind = KINDS[input?.kind] ? input.kind : "other";
  const summary = clip(input?.summary, 120);
  const details = clip(input?.details, 4000);
  const context = clip(input?.context, 500);
  if (summary.length < 3) return { status: 400, body: { error: "Add a short summary." } };

  // Rate limit per account (stored in D1 alongside collections).
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { n } = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM reports WHERE user_id = ? AND created_at > ?",
  )
    .bind(userId, since)
    .first();
  if (n >= REPORTS_PER_DAY) {
    return { status: 429, body: { error: "That's a lot of reports today. Try again tomorrow." } };
  }

  // Reporter is shown as a short hash, not their Spotify id: issues may be public.
  const reporter = (await sha256(`report:${userId}`)).slice(0, 8);
  const body = [
    details ? defang(details) : "_No details given._",
    "",
    "---",
    `Reporter: \`${reporter}\` · sent from the in-app form`,
    context ? `\n\`\`\`\n${defang(context)}\n\`\`\`` : "",
  ].join("\n");

  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "vinylpuffin-sync",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title: `[${KINDS[kind]}] ${defang(summary)}`, body }),
  });
  if (!res.ok) {
    console.error("GitHub issue create failed", res.status, await res.text());
    return { status: 502, body: { error: "Couldn't send the report. Try again later." } };
  }
  await env.DB.prepare("INSERT INTO reports (user_id, created_at) VALUES (?, ?)")
    .bind(userId, new Date().toISOString())
    .run();
  return { status: 200, body: { ok: true } };
}

export default {
  async fetch(req, env, ctx) {
    const cors = corsHeaders(req, env);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const { pathname } = new URL(req.url);
    const route = `${req.method} ${pathname}`;
    if (!["GET /collection", "PUT /collection", "POST /report"].includes(route)) {
      return json({ error: "Not found" }, 404, cors);
    }

    const user = await spotifyUser(req, ctx);
    if (user.error === 401) return json({ error: "Spotify token invalid or expired" }, 401, cors);
    if (user.error) return json({ error: "Couldn't reach Spotify" }, 502, cors);

    if (route === "POST /report") {
      const { status, body } = await fileReport(req, env, user.id);
      return json(body, status, cors);
    }

    if (req.method === "GET") return json(await current(env, user.id), 200, cors);

    // PUT
    const text = await req.text();
    if (new TextEncoder().encode(text).length > MAX_BYTES) {
      return json({ error: "Collection too large" }, 413, cors);
    }
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return json({ error: "Invalid JSON" }, 400, cors);
    }
    const { baseRev, data } = body || {};
    if (!Number.isInteger(baseRev) || baseRev < 0 || !validCollection(data)) {
      return json({ error: "Expected { baseRev, data: { albums, crates } }" }, 400, cors);
    }

    const stored = JSON.stringify(data);
    const now = new Date().toISOString();
    // Only succeeds if nobody saved since `baseRev` (optimistic concurrency).
    const result =
      baseRev === 0
        ? await env.DB.prepare(
            "INSERT INTO collections (user_id, rev, data, updated_at) VALUES (?, 1, ?, ?) ON CONFLICT(user_id) DO NOTHING",
          )
            .bind(user.id, stored, now)
            .run()
        : await env.DB.prepare(
            "UPDATE collections SET rev = rev + 1, data = ?, updated_at = ? WHERE user_id = ? AND rev = ?",
          )
            .bind(stored, now, user.id, baseRev)
            .run();

    if (result.meta.changes === 1) return json({ rev: baseRev + 1 }, 200, cors);
    return json(await current(env, user.id), 409, cors);
  },
};
