// server.js
// Entry point: Wire everything together

require('dotenv').config();
const express = require('express');
const path = require('path');
const ridesRouter = require('./routes/rides');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json()); // Parse JSON request bodies
app.use(express.static('public')); // Serve static files from public/

app.use((req, res, next) => {
  res.locals.goatCounterScript = process.env.NODE_ENV === 'production'
    ? '<script data-goatcounter="https://ithinkandicode.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>'
    : '';
  next();
});

// API Routes
app.use('/api/rides', ridesRouter);

// Locations endpoint (used by form dropdowns)
app.get('/api/locations', async (req, res) => {
  const pool = require('./db/connection');
  try {
    const result = await pool.query('SELECT * FROM locations ORDER BY location_name');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching locations:', err);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

// Users endpoint (create user when posting ride)
app.post('/api/users', async (req, res) => {
  const pool = require('./db/connection');
  try {
    const { name, contact_method, contact_info } = req.body;
    const result = await pool.query(
      'INSERT INTO users (name, contact_method, contact_info) VALUES ($1, $2, $3) RETURNING *',
      [name, contact_method, contact_info]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Serve index.html for root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`✓ Server running on http://localhost:${PORT}`);
  console.log(`✓ API available at http://localhost:${PORT}/api/rides`);
});

