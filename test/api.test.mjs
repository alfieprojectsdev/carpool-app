import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import appModule from '../app.js';
import { createTestPool } from './helpers/test-db.mjs';

const { createApp } = appModule;

let pool;
let app;
let ipCounter = 0;
const freshIp = () => `198.51.100.${++ipCounter}`;

beforeAll(async () => {
  pool = await createTestPool();
  app = createApp(pool);
});

afterAll(async () => {
  await pool.end();
});

beforeEach(async () => {
  delete process.env.COMMUNITY_PASSCODE;
  await pool.query('DELETE FROM ride_interests');
  await pool.query('DELETE FROM ride_posts');
  await pool.query('DELETE FROM users');
  await pool.query('DELETE FROM rate_limits');
  await pool.query('DELETE FROM feedback');
});

async function locationId(name) {
  const r = await pool.query('SELECT location_id FROM locations WHERE location_name = $1', [name]);
  return r.rows[0].location_id;
}

async function rideBody(overrides = {}) {
  return {
    name: 'Test Driver',
    contact_method: 'viber',
    contact_info: '0900-000-0000',
    post_type: 'offer',
    origin_id: await locationId('Phirst Park Homes'),
    destination_id: await locationId('Dau Terminal'),
    days_of_week: ['friday', 'monday'],
    departure_time: '06:30',
    notes: 'Leaving from the main gate',
    vehicle_model: 'Toyota Vios',
    available_seats: 3,
    ...overrides,
  };
}

async function postRide(overrides = {}, agent = request(app)) {
  return agent.post('/api/rides').set('x-real-ip', freshIp()).send(await rideBody(overrides));
}

describe('community passcode gate', () => {
  it('is off when COMMUNITY_PASSCODE is unset', async () => {
    const session = await request(app).get('/api/session');
    expect(session.body).toEqual({ member: true, gate: false });
    expect((await request(app).get('/api/rides')).status).toBe(200);
  });

  it('keeps rides, locations and contact details behind the passcode', async () => {
    process.env.COMMUNITY_PASSCODE = 'magalang-2026';
    for (const path of ['/api/rides', '/api/locations']) {
      const res = await request(app).get(path);
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('PASSCODE_REQUIRED');
    }
    expect((await request(app).post('/api/rides').send(await rideBody())).status).toBe(401);
  });

  it('rejects a wrong passcode and admits the right one with a signed cookie', async () => {
    process.env.COMMUNITY_PASSCODE = 'magalang-2026';
    const agent = request.agent(app);

    const wrong = await agent.post('/api/join').set('x-real-ip', freshIp()).send({ passcode: 'guess' });
    expect(wrong.status).toBe(401);

    const right = await agent.post('/api/join').set('x-real-ip', freshIp()).send({ passcode: ' magalang-2026 ' });
    expect(right.status).toBe(200);
    const cookie = right.headers['set-cookie'][0];
    expect(cookie).toMatch(/^carpool_member=\d+\.[A-Za-z0-9_-]+;/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);

    expect((await agent.get('/api/rides')).status).toBe(200);
    expect((await agent.get('/api/session')).body).toEqual({ member: true, gate: true });
  });

  it('signs everyone out when the passcode changes', async () => {
    process.env.COMMUNITY_PASSCODE = 'old-code';
    const agent = request.agent(app);
    await agent.post('/api/join').set('x-real-ip', freshIp()).send({ passcode: 'old-code' });
    expect((await agent.get('/api/rides')).status).toBe(200);

    process.env.COMMUNITY_PASSCODE = 'new-code';
    expect((await agent.get('/api/rides')).status).toBe(401);
  });

  it('rejects a forged cookie', async () => {
    process.env.COMMUNITY_PASSCODE = 'magalang-2026';
    const now = Math.floor(Date.now() / 1000);
    const res = await request(app).get('/api/rides').set('Cookie', `carpool_member=${now}.forged-signature`);
    expect(res.status).toBe(401);
  });

  it('limits passcode guesses to 10 per 15 minutes per IP', async () => {
    process.env.COMMUNITY_PASSCODE = 'magalang-2026';
    const ip = freshIp();
    for (let i = 0; i < 10; i++) {
      expect((await request(app).post('/api/join').set('x-real-ip', ip).send({ passcode: `guess${i}` })).status).toBe(401);
    }
    const blocked = await request(app).post('/api/join').set('x-real-ip', ip).send({ passcode: 'magalang-2026' });
    expect(blocked.status).toBe(429);
  });
});

describe('posting rides', () => {
  it('creates the poster and ride in one request and returns a manage token once', async () => {
    const res = await postRide();
    expect(res.status).toBe(201);
    expect(res.body.manage_token).toMatch(/^[A-Za-z0-9_-]{32}$/);

    const stored = await pool.query('SELECT manage_token_hash FROM ride_posts WHERE post_id = $1', [res.body.post_id]);
    expect(stored.rows[0].manage_token_hash).toHaveLength(64);
    expect(stored.rows[0].manage_token_hash).not.toContain(res.body.manage_token);
  });

  it('ignores a client-supplied user_id (no impersonation)', async () => {
    const res = await postRide({ user_id: 999 });
    expect(res.status).toBe(201);
    const row = await pool.query('SELECT user_id FROM ride_posts WHERE post_id = $1', [res.body.post_id]);
    expect(row.rows[0].user_id).not.toBe(999);
  });

  it('lists rides with contact details but without tokens or internal ids', async () => {
    await postRide();
    const res = await request(app).get('/api/rides');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    const ride = res.body[0];
    expect(ride).toMatchObject({
      name: 'Test Driver',
      contact_info: '0900-000-0000',
      origin: 'Phirst Park Homes',
      destination: 'Dau Terminal',
      days_of_week: ['monday', 'friday'],
      departure_time: '06:30',
      interest_count: 0,
    });
    expect(ride).not.toHaveProperty('manage_token_hash');
    expect(ride).not.toHaveProperty('user_id');
  });

  it.each([
    [{ name: '' }, /Name is required/],
    [{ days_of_week: [] }, /at least one day/],
    [{ days_of_week: ['monday', '<img src=x onerror=alert(1)>'] }, /days_of_week/],
    [{ departure_time: '7pm' }, /departure_time/],
    [{ available_seats: 11 }, /between 1 and 10/],
    [{ contact_method: 'email' }, /Contact method/],
    [{ notes: 'x'.repeat(501) }, /at most 500/],
  ])('rejects %j', async (override, message) => {
    const res = await postRide(override);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(message);
  });

  it('rejects the same origin and destination, and unknown locations', async () => {
    const same = await postRide({ destination_id: await locationId('Phirst Park Homes') });
    expect(same.status).toBe(400);
    const unknown = await postRide({ destination_id: 99999 });
    expect(unknown.status).toBe(400);
    expect(unknown.body.error).toMatch(/Unknown/);
  });

  it('drops vehicle details from requests', async () => {
    const res = await postRide({ post_type: 'request' });
    const row = await pool.query('SELECT vehicle_model, available_seats FROM ride_posts WHERE post_id = $1', [res.body.post_id]);
    expect(row.rows[0]).toEqual({ vehicle_model: null, available_seats: null });
  });

  it('stores markup as plain text (the page renders it with textContent)', async () => {
    const res = await postRide({ vehicle_model: '<b>Vios</b>' });
    expect(res.status).toBe(201);
    const list = await request(app).get('/api/rides');
    expect(list.body[0].vehicle_model).toBe('<b>Vios</b>');
  });

  it('hides expired rides', async () => {
    const res = await postRide();
    await pool.query(`UPDATE ride_posts SET expires_at = NOW() - INTERVAL '1 minute' WHERE post_id = $1`, [res.body.post_id]);
    expect((await request(app).get('/api/rides')).body).toHaveLength(0);
  });

  it('limits posting to 10 rides per hour per IP', async () => {
    const ip = freshIp();
    const body = await rideBody();
    for (let i = 0; i < 10; i++) {
      expect((await request(app).post('/api/rides').set('x-real-ip', ip).send(body)).status).toBe(201);
    }
    expect((await request(app).post('/api/rides').set('x-real-ip', ip).send(body)).status).toBe(429);
  });
});

describe('managing a ride with its token', () => {
  let rideId;
  let token;

  beforeEach(async () => {
    const res = await postRide();
    rideId = res.body.post_id;
    token = res.body.manage_token;
  });

  it('refuses edits, removal and the interest list without the right token', async () => {
    for (const t of [undefined, 'wrong-token-wrong-token-wrong-tok']) {
      const headers = t ? { 'X-Manage-Token': t } : {};
      expect((await request(app).put(`/api/rides/${rideId}`).set(headers).send({ notes: 'hijack' })).status).toBe(403);
      expect((await request(app).delete(`/api/rides/${rideId}`).set(headers)).status).toBe(403);
      expect((await request(app).get(`/api/rides/${rideId}/interests`).set(headers)).status).toBe(403);
    }
    const row = await pool.query('SELECT notes, is_active FROM ride_posts WHERE post_id = $1', [rideId]);
    expect(row.rows[0]).toEqual({ notes: 'Leaving from the main gate', is_active: true });
  });

  it('edits and renews with the token', async () => {
    await pool.query(`UPDATE ride_posts SET expires_at = NOW() + INTERVAL '1 day' WHERE post_id = $1`, [rideId]);
    const res = await request(app)
      .put(`/api/rides/${rideId}`)
      .set('X-Manage-Token', token)
      .send({ days_of_week: ['saturday'], notes: 'Now weekends', renew: true });
    expect(res.status).toBe(200);
    expect(new Date(res.body.expires_at).getTime()).toBeGreaterThan(Date.now() + 59 * 24 * 3600 * 1000);

    const list = await request(app).get('/api/rides');
    expect(list.body[0]).toMatchObject({ days_of_week: ['saturday'], notes: 'Now weekends' });
  });

  it('can renew a ride that has already expired', async () => {
    await pool.query(`UPDATE ride_posts SET expires_at = NOW() - INTERVAL '1 day' WHERE post_id = $1`, [rideId]);
    const res = await request(app).put(`/api/rides/${rideId}`).set('X-Manage-Token', token).send({ renew: true });
    expect(res.status).toBe(200);
    expect((await request(app).get('/api/rides')).body).toHaveLength(1);
  });

  it('removes the ride from the board', async () => {
    expect((await request(app).delete(`/api/rides/${rideId}`).set('X-Manage-Token', token)).status).toBe(200);
    expect((await request(app).get('/api/rides')).body).toHaveLength(0);
    expect((await request(app).put(`/api/rides/${rideId}`).set('X-Manage-Token', token).send({ renew: true })).status).toBe(404);
  });

  it('shows interested riders only to the poster', async () => {
    const interest = { interested_name: 'Rider One', contact_method: 'phone', contact_info: '0911-111-1111' };
    expect((await request(app).post(`/api/rides/${rideId}/interests`).set('x-real-ip', freshIp()).send(interest)).status).toBe(201);

    const dupe = await request(app)
      .post(`/api/rides/${rideId}/interests`)
      .set('x-real-ip', freshIp())
      .send({ ...interest, interested_name: 'RIDER ONE' });
    expect(dupe.status).toBe(409);

    const list = await request(app).get(`/api/rides/${rideId}/interests`).set('X-Manage-Token', token);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ interested_name: 'Rider One', contact_info: '0911-111-1111' });

    expect((await request(app).get('/api/rides')).body[0].interest_count).toBe(1);
  });

  it('does not accept interest in a missing ride', async () => {
    const res = await request(app)
      .post('/api/rides/99999/interests')
      .set('x-real-ip', freshIp())
      .send({ interested_name: 'A', contact_method: 'phone', contact_info: '1' });
    expect(res.status).toBe(404);
  });
});

describe('locations', () => {
  it('adds a new place and returns the existing one regardless of case', async () => {
    const ip = freshIp();
    const added = await request(app).post('/api/locations').set('x-real-ip', ip).send({ location_name: '  SM   Clark ', location_type: 'commercial' });
    expect(added.status).toBe(201);
    expect(added.body).toMatchObject({ location_name: 'SM Clark', is_existing: false });

    const again = await request(app).post('/api/locations').set('x-real-ip', ip).send({ location_name: 'sm clark' });
    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({ location_id: added.body.location_id, is_existing: true });
  });

  it('rejects empty and overlong names', async () => {
    expect((await request(app).post('/api/locations').set('x-real-ip', freshIp()).send({ location_name: ' ' })).status).toBe(400);
    expect((await request(app).post('/api/locations').set('x-real-ip', freshIp()).send({ location_name: 'x'.repeat(61) })).status).toBe(400);
  });
});

describe('feedback', () => {
  it('stores feedback without the URL fragment (which can hold a manage token)', async () => {
    process.env.COMMUNITY_PASSCODE = 'magalang-2026'; // feedback works without the passcode
    const res = await request(app)
      .post('/api/feedback')
      .set('x-real-ip', freshIp())
      .send({ kind: 'idea', message: ' Add a Sunday filter ', page: '/#manage=5.secret-token-value' });
    expect(res.status).toBe(201);
    const rows = await pool.query('SELECT kind, message, page FROM feedback');
    expect(rows.rows).toEqual([{ kind: 'idea', message: 'Add a Sunday filter', page: '/' }]);
  });

  it('drops honeypot submissions and rejects empty messages', async () => {
    expect((await request(app).post('/api/feedback').send({ message: 'spam', website: 'x' })).status).toBe(201);
    expect((await request(app).post('/api/feedback').send({ message: '' })).status).toBe(400);
    expect((await pool.query('SELECT 1 FROM feedback')).rows).toHaveLength(0);
  });
});

describe('platform', () => {
  it('serves health without touching the database, and checks it on request', async () => {
    expect((await request(app).get('/api/health')).body).toEqual({ ok: true });
    expect((await request(app).get('/api/health?db=1')).body).toEqual({ ok: true, db: 'ok' });
  });

  it('sends a Content-Security-Policy that blocks inline scripts', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-security-policy']).toContain("script-src 'self' https://gc.zgo.at");
    expect(res.headers['content-security-policy']).not.toContain('unsafe-inline');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('answers bad JSON with 400, not a stack trace', async () => {
    const res = await request(app).post('/api/rides').set('Content-Type', 'application/json').send('{"broken"');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid JSON' });
  });

  it('keeps the migration re-runnable', async () => {
    const dir = path.join(process.cwd(), 'db', 'migrations');
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql'))) {
      await expect(pool.pglite.exec(readFileSync(path.join(dir, file), 'utf8'))).resolves.toBeDefined();
    }
  });
});

describe('vercel.json', () => {
  it('sends the same security headers from the CDN as from Express', async () => {
    const config = JSON.parse(readFileSync(path.join(process.cwd(), 'vercel.json'), 'utf8'));
    const cdn = Object.fromEntries(config.headers[0].headers.map((h) => [h.key, h.value]));
    expect(cdn).toEqual(appModule.SECURITY_HEADERS);
  });
});
