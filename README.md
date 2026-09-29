# Carpool board

A ride board for Phirst Park Homes residents, built to replace scrolling the
community group chat for "anyone going to Dau at 6?". Residents post ride
offers and requests (route, days, time, seats); other residents browse,
filter, and either contact the poster directly or tap "I'm interested".

![The ride board: filters by type, route and day, with each post's schedule, vehicle and contact](docs/screenshots/ride-board.png)

On a phone: the passcode screen, posting a ride, the private manage link
shown once after posting, and the poster's list of interested riders.

<p>
  <img src="docs/screenshots/passcode-gate.png" width="200" alt="Residents-only passcode screen">
  <img src="docs/screenshots/post-ride-form.png" width="200" alt="Post a ride form">
  <img src="docs/screenshots/manage-link.png" width="200" alt="Manage link shown after posting">
  <img src="docs/screenshots/who-is-interested.png" width="200" alt="Poster's view of interested riders">
</p>

Screenshots are from a local run on 2026-09-29 with made-up residents.

## How it works

- The board sits behind one shared passcode (`COMMUNITY_PASSCODE`), posted in
  the group chat. Entering it once sets a signed cookie for 180 days, and
  changing the passcode signs everyone out.
- There are no accounts. Posting a ride returns a private manage link
  (`/#manage=<id>.<token>`), which this browser remembers under "My rides" and
  which works on any device. Only that link can edit, renew or remove the
  ride, or see who is interested. The server stores a SHA-256 of the token,
  not the token.
- "I'm interested" sends your name and contact to the poster only.
- Posts drop off after 60 days unless the poster renews them.
- A Feedback button on every page saves to the `feedback` table and can also
  post to a Discord channel.

## How the system fits together

Two diagrams: first the parts of production and how they connect, then one
resident's path through the app with the tests that enforce each step pinned
to it. (Mermaid: renders on GitHub; VS Code's preview needs the "Markdown
Preview Mermaid Support" extension.)

```mermaid
flowchart LR
  U["Resident's phone<br/>passcode cookie, manage links in localStorage"]
  D["carpool.ithinkandicode.space<br/>domain, planned"]
  GH["GitHub: main"]
  subgraph V["Vercel project carpool-app, planned"]
    CDN["CDN: public/<br/>index.html, js/app.js, style.css<br/>headers from vercel.json"]
    FN["Function: app.js<br/>Express, /api/*"]
    B["Build: npm run build<br/>scripts/migrate.js --vercel<br/>acts only when VERCEL_ENV=production"]
  end
  DB[("Neon Postgres<br/>users, locations, ride_posts, ride_interests,<br/>rate_limits, feedback, schema_migrations")]
  DC["Discord webhook<br/>only if FEEDBACK_WEBHOOK_URL is set"]
  GC["GoatCounter<br/>count.js from gc.zgo.at<br/>ithinkandicode.goatcounter.com"]
  UR["UptimeRobot monitor, planned<br/>every 5 min"]
  U -.-> D
  D -. "static files" .-> CDN
  D -. "/api/*" .-> FN
  U -- "page views, events" --> GC
  FN <-- "rides, interests, rate-limit counters" --> DB
  FN -- "feedback, 3 s timeout" --> DC
  GH -. "merge, planned" .-> B
  B -- "pending db/migrations/*.sql" --> DB
  UR -. "GET /api/health, no DB query" .-> FN
```

Two arrows carry most of the story. Everything the phone asks for beyond the
static page goes to the Express function in `app.js`, and apart from the
passcode cookie (an HMAC check in `lib/membership.js`), what it decides comes
from Neon. That includes the per-IP rate limits: their counters live in
`rate_limits` because serverless instances share no memory. The other
is the build arrow. Merging to main will run `scripts/migrate.js --vercel`,
which applies pending migrations before the new code goes live, and a failed
migration stops the deploy. Only the feedback webhook and GoatCounter (loaded
by the browser, not the server) talk to outside services.

Nothing runs on Vercel yet. The project, the domain (the one the runbook
suggests) and the UptimeRobot monitor are the planned parts, so their arrows
are dashed; `docs/PRODUCTION_READINESS.md` has the steps to set them up.

```mermaid
flowchart TD
  S1["1. Enter the passcode<br/>POST /api/join, 10 tries per 15 min per IP<br/>signed HttpOnly cookie, 180 days"] --> S2["2. Read the board<br/>GET /api/rides, members only<br/>active_rides: not removed, not expired, newest 200"]
  S2 --> S3["3. Post a ride<br/>POST /api/rides, 10 per hour per IP<br/>poster and ride saved in one transaction<br/>manage token returned once, only its SHA-256 stored"]
  S3 --> S4["4. Keep the manage link<br/>/#manage=id.token, saved under My rides<br/>the fragment never reaches the server"]
  S4 --> S5["5. A neighbour taps I'm interested<br/>POST /api/rides/:id/interests, 20 per hour per IP<br/>one per name per ride, else 409"]
  S5 --> S6["6. Poster opens Who is interested<br/>GET /api/rides/:id/interests<br/>X-Manage-Token must hash to the stored value"]
  S6 --> S7["7. Edit or renew<br/>PUT /api/rides/:id with X-Manage-Token<br/>renew: 60 days from now, even after expiry"]
  S7 --> S8["8. Remove<br/>DELETE /api/rides/:id with X-Manage-Token<br/>sets is_active = false"]
  S1 -.- T1["api.test.mjs · community passcode gate<br/>rejects a wrong passcode and admits the right one with a signed cookie<br/>signs everyone out when the passcode changes<br/>rejects a forged cookie<br/>limits passcode guesses to 10 per 15 minutes per IP"]
  S2 -.- T2["api.test.mjs · community passcode gate<br/>keeps rides, locations and contact details behind the passcode<br/>api.test.mjs · posting rides<br/>lists rides with contact details but without tokens or internal ids<br/>hides expired rides"]
  S3 -.- T3["api.test.mjs · posting rides<br/>creates the poster and ride in one request and returns a manage token once<br/>ignores a client-supplied user_id (no impersonation)<br/>limits posting to 10 rides per hour per IP"]
  S4 -.- T4["No test for the link itself: public/js/app.js was checked by hand on 2026-09-29<br/>api.test.mjs · feedback<br/>stores feedback without the URL fragment (which can hold a manage token)"]
  S5 -.- T5["api.test.mjs · managing a ride with its token<br/>shows interested riders only to the poster (includes the 409)<br/>does not accept interest in a missing ride<br/>The 20-per-hour limit has no test"]
  S6 -.- T6["api.test.mjs · managing a ride with its token<br/>refuses edits, removal and the interest list without the right token<br/>shows interested riders only to the poster"]
  S7 -.- T7["api.test.mjs · managing a ride with its token<br/>edits and renews with the token<br/>can renew a ride that has already expired"]
  S8 -.- T8["api.test.mjs · managing a ride with its token<br/>removes the ride from the board"]
  classDef data fill:#FAEEDA,stroke:#854F0B,color:#633806
  class S1,S2,S3,S6 data
```

Amber marks the four steps where access is handed out or residents' contact
details leave the server. Step 1 sets the cookie that opens everything else.
Step 2 sends every active poster's name and contact details to any member.
Step 3 returns the manage token, the only credential for that ride, and the
server keeps no copy it could show again. Step 6 sends interested riders'
contact details, and only to whoever holds that token.

Mappings the boxes can't show: every `/api/rides` route also needs the cookie
from step 1, so a manage link opened in a browser that hasn't entered the
passcode shows the gate first; the page saves the link to My rides before it
checks the session, so the ride is there after joining. Changing
`COMMUNITY_PASSCODE` cancels step 1's cookies but not step 3's tokens. The
limits in steps 1, 3 and 5 share the `rate_limits` table, keyed by bucket
(`join`, `post-ride`, `interest`) and the `x-real-ip` address, so a household
on one connection shares them, and
they let requests through if the database check fails. Expiry spans steps 2
and 7: after 60 days `active_rides` hides the post but the token still works,
so renewing brings it back, whereas step 8 is final (renewing a removed ride
returns 404).

## Stack

Node 20+, Express 4, PostgreSQL (`pg`), plain HTML/CSS/JS in `public/`.
Hosted on Vercel (zero-config Express: `app.js` exports the app, `public/` is
served from the CDN) with Neon Postgres. Production builds run `npm run build`,
which applies pending migrations before the new code goes live; preview and
local builds skip that step.

## Local development

```bash
npm install
cp .env.example .env         # DATABASE_URL at minimum
npm run db:migrate           # applies db/migrations/*.sql
npm run dev                  # http://localhost:3000
```

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | yes | Postgres connection string |
| `COMMUNITY_PASSCODE` | in production | Residents' passcode; unset = public board |
| `FEEDBACK_WEBHOOK_URL` | no | Discord webhook for feedback |

Schema changes go in a new `db/migrations/00N_name.sql`, written to be
re-runnable; production builds apply it. Tests only see an empty database, so
before merging a pull request that adds a migration, dry-run it on a Neon
branch of production (steps in `docs/PRODUCTION_READINESS.md`, "Changing the
schema after launch"). Neon access is Alfie's: ask Alfie to run it and paste
the output into the pull request.

## Tests

```bash
npm test
```

Vitest + Supertest against PGlite (Postgres compiled to WASM) with the real
migration applied; no database server needed. `test/migrate.test.mjs` covers
the migration runner itself: bookkeeping, rollback on failure, and the
production-only gate in the build step. GitHub Actions is turned off for
this repo, so run them locally before merging. `.github/workflows/ci.yml`
runs them again if Actions is turned back on.

## API

| Method | Path | Who |
|--------|------|-----|
| GET | `/api/session` | anyone: `{ member, gate }` |
| POST | `/api/join` | anyone: `{ passcode }` → member cookie (10 tries / 15 min / IP) |
| POST | `/api/leave` | clears the cookie |
| GET | `/api/rides` | members |
| POST | `/api/rides` | members (10 / hour / IP) → `{ post_id, manage_token }` |
| PUT | `/api/rides/:id` | manage token (`X-Manage-Token`); `{ days_of_week, departure_time, notes, vehicle_model, available_seats, renew }` |
| DELETE | `/api/rides/:id` | manage token |
| GET | `/api/rides/:id/interests` | manage token |
| POST | `/api/rides/:id/interests` | members (20 / hour / IP) |
| GET / POST | `/api/locations` | members (POST 10 / hour / IP) |
| POST | `/api/feedback` | anyone (5 / hour / IP) |
| GET | `/api/health` (`?db=1`) | anyone |

Deployment steps and the September 2026 audit: [docs/PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md).

## License

MIT
