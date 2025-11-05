// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const pool = require('./db/connection');

const ridesRouter = require('./routes/rides');
const locationsRouter = require('./routes/locations');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Use EJS for rendering
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Inject GoatCounter script (optional analytics)
app.use((req, res, next) => {
  res.locals.goatCounterScript = process.env.NODE_ENV === 'production'
    ? '<script data-goatcounter="https://ithinkandicode.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>'
    : '';
  next();
});

// API routes
app.use('/api/rides', ridesRouter);
app.use('/api/locations', locationsRouter);

// Users endpoint
app.post('/api/users', async (req, res) => {
  try {
    const { name, contact_method, contact_info } = req.body;

    if (!name || !contact_method || !contact_info) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      'INSERT INTO users (name, contact_method, contact_info) VALUES ($1, $2, $3) RETURNING *',
      [name.trim(), contact_method.trim(), contact_info.trim()]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Render home page
app.get('/', (req, res) => {
  res.render('index');
});

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`✓ Server running on http://localhost:${PORT}`);
  console.log(`✓ API available at http://localhost:${PORT}/api/rides`);
  console.log(`✓ API available at http://localhost:${PORT}/api/locations`);
});
