// db/connection.js
// Shared PostgreSQL pool. Production uses Neon via DATABASE_URL; local
// development can use either DATABASE_URL or the DB_* variables.

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        // Serverless: each instance keeps a small pool; Neon's pooled
        // endpoint (-pooler host) multiplexes the rest.
        max: 3,
        idleTimeoutMillis: 30000,
        // Neon can take a few seconds to wake a suspended compute.
        connectionTimeoutMillis: 15000,
      }
    : {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
      }
);

// An idle client can error when Neon closes the connection. The pool drops
// that client and makes a new one on the next query; exiting the process here
// (as this file used to) would kill the whole server for it.
pool.on('error', (err) => {
  console.error('Idle database client error:', err.message);
});

module.exports = pool;
