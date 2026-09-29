// routes/rides.js
// Ride posts. There are no accounts: whoever posts a ride gets a random
// manage token (shown once as a "manage link"), and only that token can edit
// or remove the ride or see who is interested. The database stores its
// sha256, so a database leak does not hand out edit rights.

const crypto = require('crypto');
const express = require('express');
const { requireMember } = require('../lib/membership');
const { limit } = require('../lib/rate-limit');
const { newRide, rideUpdate, interest } = require('../lib/validation');

const HOUR = 60 * 60 * 1000;

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function rideId(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: 'Invalid ride id' });
    return null;
  }
  return id;
}

module.exports = function ridesRouter(pool, wrap) {
  const router = express.Router();
  router.use(requireMember);

  /** Loads the ride if the X-Manage-Token header matches; otherwise responds 403/404. */
  async function ownedRide(req, res) {
    const id = rideId(req, res);
    if (id === null) return null;
    const token = req.get('X-Manage-Token');
    const result = await pool.query(
      'SELECT post_id, manage_token_hash, is_active FROM ride_posts WHERE post_id = $1',
      [id]
    );
    const ride = result.rows[0];
    if (!ride || !ride.is_active) {
      res.status(404).json({ error: 'Ride not found' });
      return null;
    }
    const supplied = Buffer.from(hashToken(typeof token === 'string' ? token : ''));
    if (!crypto.timingSafeEqual(supplied, Buffer.from(ride.manage_token_hash))) {
      res.status(403).json({ error: 'This link cannot manage that ride' });
      return null;
    }
    return ride;
  }

  // GET /api/rides - active rides with poster contact (members only)
  router.get(
    '/',
    wrap(async (req, res) => {
      const result = await pool.query(`
        SELECT ar.*, COALESCE(ic.count, 0)::int AS interest_count
        FROM active_rides ar
        LEFT JOIN (SELECT ride_id, COUNT(*) AS count FROM ride_interests GROUP BY ride_id) ic
          ON ic.ride_id = ar.post_id
        ORDER BY ar.created_at DESC
        LIMIT 200`);
      res.json(result.rows);
    })
  );

  // POST /api/rides - poster details + ride in one request; returns the manage token once
  router.post(
    '/',
    limit(pool, 'post-ride', 10, HOUR, 'You have posted a lot of rides this hour. Please try again later.'),
    wrap(async (req, res) => {
      const ride = newRide(req.body || {});
      const token = crypto.randomBytes(24).toString('base64url');

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const places = await client.query(
          'SELECT location_id FROM locations WHERE location_id = ANY($1::int[])',
          [[ride.origin_id, ride.destination_id]]
        );
        if (places.rows.length !== 2) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Unknown origin or destination' });
        }
        const user = await client.query(
          'INSERT INTO users (name, contact_method, contact_info) VALUES ($1, $2, $3) RETURNING user_id',
          [ride.name, ride.contact_method, ride.contact_info]
        );
        const created = await client.query(
          `INSERT INTO ride_posts (user_id, post_type, origin_id, destination_id, days_of_week,
             departure_time, notes, vehicle_model, available_seats, manage_token_hash)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING post_id, expires_at`,
          [
            user.rows[0].user_id,
            ride.post_type,
            ride.origin_id,
            ride.destination_id,
            ride.days_of_week,
            ride.departure_time,
            ride.notes,
            ride.vehicle_model,
            ride.available_seats,
            hashToken(token),
          ]
        );
        await client.query('COMMIT');
        res.status(201).json({ post_id: created.rows[0].post_id, expires_at: created.rows[0].expires_at, manage_token: token });
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    })
  );

  // PUT /api/rides/:id - edit schedule/notes/seats, or { renew: true } for another 60 days
  router.put(
    '/:id',
    wrap(async (req, res) => {
      const ride = await ownedRide(req, res);
      if (!ride) return;
      const update = rideUpdate(req.body || {});
      const sets = [];
      const params = [];
      for (const [column, value] of Object.entries(update)) {
        params.push(value);
        sets.push(`${column} = $${params.length}`);
      }
      if (req.body && req.body.renew === true) sets.push(`expires_at = NOW() + INTERVAL '60 days'`);
      if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update' });
      params.push(ride.post_id);
      const result = await pool.query(
        `UPDATE ride_posts SET ${sets.join(', ')}, updated_at = NOW() WHERE post_id = $${params.length}
         RETURNING post_id, expires_at`,
        params
      );
      res.json(result.rows[0]);
    })
  );

  // DELETE /api/rides/:id - take the ride off the board (soft delete)
  router.delete(
    '/:id',
    wrap(async (req, res) => {
      const ride = await ownedRide(req, res);
      if (!ride) return;
      await pool.query('UPDATE ride_posts SET is_active = FALSE, updated_at = NOW() WHERE post_id = $1', [ride.post_id]);
      res.json({ message: 'Ride removed' });
    })
  );

  // GET /api/rides/:id/interests - who is interested (poster only)
  router.get(
    '/:id/interests',
    wrap(async (req, res) => {
      const ride = await ownedRide(req, res);
      if (!ride) return;
      const result = await pool.query(
        `SELECT interested_name, contact_method, contact_info, created_at
         FROM ride_interests WHERE ride_id = $1 ORDER BY created_at DESC`,
        [ride.post_id]
      );
      res.json(result.rows);
    })
  );

  // POST /api/rides/:id/interests - "I'm interested"; only the poster sees these details
  router.post(
    '/:id/interests',
    limit(pool, 'interest', 20, HOUR),
    wrap(async (req, res) => {
      const id = rideId(req, res);
      if (id === null) return;
      const data = interest(req.body || {});
      const ride = await pool.query('SELECT 1 FROM active_rides WHERE post_id = $1', [id]);
      if (ride.rows.length === 0) return res.status(404).json({ error: 'Ride not found' });
      try {
        await pool.query(
          `INSERT INTO ride_interests (ride_id, interested_name, contact_method, contact_info)
           VALUES ($1, $2, $3, $4)`,
          [id, data.interested_name, data.contact_method, data.contact_info]
        );
      } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'You already showed interest in this ride' });
        throw err;
      }
      res.status(201).json({ message: 'Interest sent' });
    })
  );

  return router;
};
