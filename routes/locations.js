// routes/locations.js
const express = require('express');
const router = express.Router();
const pool = require('../db/connection');

// GET /api/locations - List all locations
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM locations ORDER BY location_name ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching locations:', err);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

// POST /api/locations - Add new location (or return existing one)
router.post('/', async (req, res) => {
  try {
    const { location_name, location_type } = req.body;

    // Validation
    if (!location_name || location_name.trim().length === 0) {
      return res.status(400).json({ error: 'Location name is required' });
    }

    if (location_name.length > 100) {
      return res.status(400).json({ error: 'Location name too long (max 100 characters)' });
    }

    const validTypes = ['residential', 'commercial', 'terminal'];
    const finalType = validTypes.includes(location_type) ? location_type : 'commercial';
    const trimmedName = location_name.trim();

    // Check if already exists (case-insensitive)
    const existingCheck = await pool.query(
      'SELECT location_id, location_name, location_type FROM locations WHERE LOWER(location_name) = LOWER($1)',
      [trimmedName]
    );

    if (existingCheck.rows.length > 0) {
      // ✅ Return existing instead of error
      return res.status(200).json(existingCheck.rows[0]);
    }

    // ✅ Insert new location
    const result = await pool.query(
      'INSERT INTO locations (location_name, location_type) VALUES ($1, $2) RETURNING *',
      [trimmedName, finalType]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating location:', err);
    res.status(500).json({ error: 'Failed to create location' });
  }
});

module.exports = router;