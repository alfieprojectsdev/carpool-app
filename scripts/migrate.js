#!/usr/bin/env node
// Apply pending SQL migrations from db/migrations/ in filename order.
//
//   DATABASE_URL=postgres://... npm run db:migrate            apply pending
//   DATABASE_URL=postgres://... npm run db:migrate -- --status
//
// Each file runs in its own transaction and is recorded in schema_migrations.
// Files are written to be re-runnable.
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

const dir = path.join(__dirname, '..', 'db', 'migrations');
const statusOnly = process.argv.includes('--status');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    const applied = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
    const files = fs.readdirSync(dir).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`  applied  ${file}`);
        continue;
      }
      if (statusOnly) {
        console.log(`  pending  ${file}`);
        continue;
      }
      await client.query('BEGIN');
      try {
        await client.query(fs.readFileSync(path.join(dir, file), 'utf8'));
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`  ran      ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  FAILED   ${file}: ${err.message}`);
        process.exitCode = 1;
        break;
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
