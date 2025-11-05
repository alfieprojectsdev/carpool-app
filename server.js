// server.js
require('dotenv').config();
const pool = require('./db/connection');
const express = require('express');
const path = require('path');
const ridesRouter = require('./routes/rides');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ ADD: Set EJS as view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.static('public'));

app.use((req, res, next) => {
  res.locals.goatCounterScript = process.env.NODE_ENV === 'production'
    ? '<script data-goatcounter="https://ithinkandicode.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>'
    : '';
  next();
});

// API Routes
app.use('/api/rides', ridesRouter);

// Locations endpoint
app.get('/api/locations', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM locations ORDER BY location_name');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching locations:', err);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

// POST /api/locations - Add new location
router.post('/locations', async (req, res) => {
  try {
    const { location_name, location_type } = req.body;

    // Validation
    if (!location_name || location_name.trim().length === 0) {
      return res.status(400).json({ error: 'Location name is required' });
    }

    if (location_name.length > 100) {
      return res.status(400).json({ error: 'Location name too long (max 100 characters)' });
    }

    // Default to 'commercial' if not specified
    const validTypes = ['residential', 'commercial', 'terminal'];
    const finalType = validTypes.includes(location_type) ? location_type : 'commercial';

    const trimmedName = location_name.trim();

    // Check if location already exists (case-insensitive)
    const existingCheck = await pool.query(
      'SELECT location_id FROM locations WHERE LOWER(location_name) = LOWER($1)',
      [trimmedName]
    );

    if (existingCheck.rows.length > 0) {
     // Auto-select existing location instead of erroring
     const existingId = existingCheck.rows[0].location_id;
     await loadLocations();
     document.getElementById(modal.dataset.selectId).value = existingId;
     alert(`This location already exists. Selected for you!`);
     modal.remove();
     return;
   }

    // Insert new location
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

// Users endpoint
app.post('/api/users', async (req, res) => {
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

// ✅ CHANGE: Render template instead of static file
app.get('/', (req, res) => {
  res.render('index');
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