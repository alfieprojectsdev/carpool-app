// routes/rides.js
// All ride-related endpoints in ONE place

const express = require('express');
const router = express.Router();
const pool = require('../db/connection');

// GET /api/rides - List all active rides
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM active_rides ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching rides:', err);
    res.status(500).json({ error: 'Failed to fetch rides' });
  }
});

// GET /api/rides/:id - Get single ride
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM active_rides WHERE post_id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ride not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching ride:', err);
    res.status(500).json({ error: 'Failed to fetch ride' });
  }
});

// POST /api/rides - Create new ride post
router.post('/', async (req, res) => {
  try {
    const { user_id, post_type, origin_id, destination_id, days_of_week, departure_time, notes } = req.body;
    
    const result = await pool.query(
      `INSERT INTO ride_posts 
       (user_id, post_type, origin_id, destination_id, days_of_week, departure_time, notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [user_id, post_type, origin_id, destination_id, days_of_week, departure_time, notes]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating ride:', err);
    res.status(500).json({ error: 'Failed to create ride' });
  }
});

// PUT /api/rides/:id - Update ride post
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { days_of_week, departure_time, notes } = req.body;
    
    const result = await pool.query(
      `UPDATE ride_posts 
       SET days_of_week = $1, departure_time = $2, notes = $3, updated_at = CURRENT_TIMESTAMP
       WHERE post_id = $4 AND is_active = true
       RETURNING *`,
      [days_of_week, departure_time, notes, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ride not found or already inactive' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating ride:', err);
    res.status(500).json({ error: 'Failed to update ride' });
  }
});

// DELETE /api/rides/:id - Deactivate ride post (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'UPDATE ride_posts SET is_active = false WHERE post_id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    res.json({ message: 'Ride deactivated successfully' });
  } catch (err) {
    console.error('Error deleting ride:', err);
    res.status(500).json({ error: 'Failed to delete ride' });
  }
});

// GET /api/rides/:id/interests - Get list of interested people
router.get('/:id/interests', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT interested_name, contact_method, contact_info, created_at FROM ride_interests WHERE ride_id = $1 ORDER BY created_at DESC',
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching interests:', err);
    res.status(500).json({ error: 'Failed to fetch interests' });
  }
});

// POST /api/rides/:id/interests - Show interest
router.post('/:id/interests', async (req, res) => {
  try {
    const { id } = req.params;
    const { interested_name, contact_method, contact_info } = req.body;

    // Check if already interested (by name - simple POC check)
    const existing = await pool.query(
      'SELECT * FROM ride_interests WHERE ride_id = $1 AND interested_name ILIKE $2',
      [id, interested_name]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'You already showed interest in this ride' });
    }

    const result = await pool.query(
      'INSERT INTO ride_interests (ride_id, interested_name, contact_method, contact_info) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, interested_name, contact_method, contact_info]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error adding interest:', err);
    res.status(500).json({ error: 'Failed to add interest' });
  }
});

module.exports = router;