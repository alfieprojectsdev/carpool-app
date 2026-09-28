// routes/locations.js
const express = require('express');
const { requireMember } = require('../lib/membership');
const { limit } = require('../lib/rate-limit');
const { location } = require('../lib/validation');

module.exports = function locationsRouter(pool, wrap) {
  const router = express.Router();
  router.use(requireMember);

  // GET /api/locations
  router.get(
    '/',
    wrap(async (req, res) => {
      const result = await pool.query(
        'SELECT location_id, location_name, location_type FROM locations ORDER BY location_name ASC'
      );
      res.json(result.rows);
    })
  );

  // POST /api/locations - add a place, or return the existing one (case-insensitive)
  router.post(
    '/',
    limit(pool, 'add-location', 10, 60 * 60 * 1000, 'Too many new locations this hour.'),
    wrap(async (req, res) => {
      const { location_name, location_type } = location(req.body || {});
      const inserted = await pool.query(
        `INSERT INTO locations (location_name, location_type) VALUES ($1, $2)
         ON CONFLICT DO NOTHING
         RETURNING location_id, location_name, location_type`,
        [location_name, location_type]
      );
      if (inserted.rows.length > 0) {
        return res.status(201).json({ ...inserted.rows[0], is_existing: false });
      }
      const existing = await pool.query(
        'SELECT location_id, location_name, location_type FROM locations WHERE LOWER(location_name) = LOWER($1)',
        [location_name]
      );
      res.status(200).json({ ...existing.rows[0], is_existing: true });
    })
  );

  return router;
};
