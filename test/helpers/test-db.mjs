// A pg-Pool look-alike backed by PGlite (Postgres compiled to WASM), with the
// real migrations applied. PGlite has one connection, so access is serialised:
// pool.query() waits its turn and pool.connect() holds the connection until
// release(), like a one-connection pg Pool.
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const MIGRATIONS = path.join(process.cwd(), 'db', 'migrations');

export async function createTestPool() {
  // Match node-postgres: int8 and numeric come back as strings.
  const pglite = new PGlite({ parsers: { 20: (v) => v, 1700: (v) => v } });
  for (const file of readdirSync(MIGRATIONS).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort()) {
    await pglite.exec(readFileSync(path.join(MIGRATIONS, file), 'utf8'));
  }

  let queue = Promise.resolve();
  const lock = () => {
    let release;
    const next = new Promise((resolve) => (release = resolve));
    const acquired = queue.then(() => release);
    queue = queue.then(() => next);
    return acquired;
  };

  const run = async (text, params) => {
    const result = await pglite.query(text, params);
    return { rows: result.rows, rowCount: result.affectedRows || result.rows.length };
  };

  return {
    pglite,
    async query(text, params) {
      const release = await lock();
      try {
        return await run(text, params);
      } finally {
        release();
      }
    },
    async connect() {
      const release = await lock();
      return { query: run, release };
    },
    on() {},
    async end() {
      await pglite.close();
    },
  };
}
