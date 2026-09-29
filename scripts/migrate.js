#!/usr/bin/env node
// Apply pending SQL migrations from db/migrations/ in filename order.
//
//   DATABASE_URL=postgres://... npm run db:migrate            apply pending
//   DATABASE_URL=postgres://... npm run db:migrate -- --status
//   node scripts/migrate.js --vercel                           used by `npm run build`
//
// With --vercel it only runs when Vercel is building Production
// (VERCEL_ENV=production), so merging to main applies pending migrations
// before the new code goes live. If a migration fails, the build fails and
// the previous deployment stays up. Local, CI and preview builds skip it, so
// a pull request can never change the production database.
//
// The migration logic is in migrate-core.js. test/migrate.test.mjs covers
// both files.
const { Client } = require('pg');
const { migrate } = require('./migrate-core');
require('dotenv').config();

if (process.argv.includes('--vercel') && process.env.VERCEL_ENV !== 'production') {
  console.log('migrate: skipped (not a Vercel production build)');
  process.exit(0);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    if (!(await migrate(client, { statusOnly: process.argv.includes('--status') }))) process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
