# Carpool board: production readiness (September 2026)

The app was deployed to Render in October 2025 (`render.yaml`, free web
service + free Postgres). It is not reachable today. Render deletes free
Postgres databases 30 days after creation (plus a 14-day grace period), so
the database and its posts are gone; there is nothing to migrate.

The audit on 2026-09-28 found that anyone on the internet could edit or
delete any ride, read every interested rider's phone number, and inject
script into the page every resident loads. This branch fixes those, moves
hosting to Vercel + Neon (both free, neither expires), and adds a feedback
button.

## Findings

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| 1 | Critical | Stored XSS. The page built ride cards with `innerHTML` and escaped only name, notes and contact; `origin`, `destination`, `vehicle_model` and `days_of_week` went in raw. Location names and rides could be created by anyone, so one post could run script for every visitor. | The page is rebuilt with `textContent` only (`public/js/app.js`), no inline handlers, and a Content-Security-Policy without `unsafe-inline`. Server validates every field (days from a fixed list, lengths, time format). Verified in a browser with `<img onerror>` payloads in the name and vehicle fields. |
| 2 | Critical | No authorization. `PUT` and `DELETE /api/rides/:id` accepted any id from anyone. `POST /api/rides` took `user_id` from the request body, so a ride could be posted as someone else. | Each ride has a random manage token (returned once, stored as SHA-256). Edit, renew, remove and the interest list require it. The poster is created in the same request as the ride; client `user_id` is ignored. |
| 3 | High | `GET /api/rides/:id/interests` returned the names and phone/Messenger of everyone interested in any ride, to anyone. | Poster only (manage token). The form now says "Only the person who posted this ride will see your details." |
| 4 | High | The whole board, including residents' phone numbers and daily departure times from their home, was public on the internet. | Shared community passcode gate (signed HttpOnly cookie, 10 guesses per 15 minutes per IP). Feedback and health stay public. |
| 5 | Medium | No rate limits anywhere. | Postgres-backed per-IP limits on join, post, interest, new locations and feedback (serverless instances share no memory). |
| 6 | Medium | `pool.on('error')` called `process.exit(-1)`. Neon closes idle connections, which would have killed the server. | Logs the error; the pool replaces the client. |
| 7 | Medium | Hosting on Render's free tier: the database expired after 30 days, and the free web service sleeps after 15 minutes idle and takes about a minute to wake. | Vercel Hobby + Neon Free. `render.yaml` removed. |
| 8 | Low | `.gitignore` excluded `db/` and `scripts/`, so new migrations and scripts would silently never be committed (the existing ones had been force-added). | Rewritten. `docs/*` and `CLAUDE.md` stay local-only as before, except this file. |
| 9 | Low | `db/testdata.sql` had what look like real residents' names from the group chat. | Deleted. |
| 10 | Low | Stale posts never left the board. | Posts expire after 60 days; the poster can renew. |

Also removed: EJS (the page is static now; the only template variable was
the GoatCounter tag), the unused multi-community schema draft, Jest and the
Playwright config that pointed at a missing `tests/` folder. `npm audit
--omit=dev`: 0 vulnerabilities (Express 4.22).

## Why not accounts?

The November 2025 hand-off doc planned username/password/community-code
accounts with Passport, and the viability analysis listed ten P0 fixes that
design needed. For a board where people already share phone numbers in a
group chat, accounts add a password-reset problem and signup friction
without protecting much more than the passcode does. The manage link borrows
the idea from washboard's booking links: a random, unguessable URL is the
credential for one specific thing. If a resident loses the link, the post
expires on its own in 60 days.

## Deploy runbook

1. Create a Neon project (free plan: 0.5 GB and 100 compute-hours per
   month per project; suspends after 5 minutes idle). Copy the pooled
   connection string.
2. Apply the migration:
   ```bash
   DATABASE_URL="<pooled string>" npm run db:migrate
   ```
3. Import the GitHub repo into Vercel (framework preset "Express" or
   "Other"; no build command). Environment variables for Production and
   Preview: `DATABASE_URL`, `COMMUNITY_PASSCODE`, optionally
   `FEEDBACK_WEBHOOK_URL`. Add a domain, e.g. `carpool.ithinkandicode.space`.
4. Smoke-test on a phone: `/api/health` → `{"ok":true}`,
   `/api/health?db=1` → `"db":"ok"`; the page asks for the passcode; post a
   ride, copy the manage link, open it in another browser, edit and remove.
5. Share the passcode in the group chat's pinned post.
6. Add an UptimeRobot free monitor (50 monitors, 5-minute checks, email
   alerts) on `/api/health`. Don't monitor `?db=1`: pinging the database every 5
   minutes would keep Neon awake and use up the free compute hours.

## Tradeoffs

- Anyone in the group chat can pass the shared passcode on. That
  matches who could already see these rides in the chat. If it leaks, change
  `COMMUNITY_PASSCODE` in Vercel: every existing cookie stops working at once.
- Losing a manage link means the poster can't edit or remove that ride.
  It drops off after 60 days anyway, and the owner can remove it in the
  Neon SQL editor (`UPDATE ride_posts SET is_active = false WHERE post_id = …`).
- Contact details are visible to every member, which is the point of the
  board and the same as the group chat. Interested riders' details are the
  exception: poster only.
- Per-IP limits can be shared by a household on one connection; the
  numbers (10 posts an hour) leave room for that.
- The GoatCounter code is hard-coded in `public/index.html`, as it was in
  `server.js`. It's a public site identifier, not a secret.

## Not done

- Notifications when someone is interested (the poster checks "My rides").
  A Discord webhook or email would be the next step.
- Browser end-to-end tests in CI; the flow was verified by hand in a
  browser on 2026-09-29 (gate, post, manage link on a second device,
  interest, edit, remove, feedback, 375 px layout).
