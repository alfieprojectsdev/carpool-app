// The migration runner that Vercel's production build runs
// (scripts/migrate.js + scripts/migrate-core.js). The other tests apply the
// SQL files directly, so without these nothing checks the bookkeeping, the
// failure handling or the production-only gate.
//
// What no local test can check is how a migration behaves on production's
// rows; that is the Neon branch dry run in docs/PRODUCTION_READINESS.md.

import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import core from '../scripts/migrate-core.js';

const { migrate, MIGRATIONS_DIR } = core;

const CLI = path.join(process.cwd(), 'scripts', 'migrate.js');
const FILES = readdirSync(MIGRATIONS_DIR).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort();
const tmp = mkdtempSync(path.join(os.tmpdir(), 'carpool-migrate-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

// node-pg runs text without parameters over the simple query protocol, which
// accepts a whole multi-statement file in one call; PGlite needs exec() for that.
const asPgClient = (db) => ({
  query: async (text, params) => (params ? db.query(text, params) : (await db.exec(text)).at(-1) ?? { rows: [] }),
});

let db;
let lines;
const quiet = () => ({ log: (l) => lines.push(l), logError: (l) => lines.push(l) });
const run = (options = {}) => migrate(asPgClient(db), { ...quiet(), ...options });
const recorded = async () =>
  (await db.query('SELECT name FROM schema_migrations ORDER BY name')).rows.map((r) => r.name);
const exists = async (table) => (await db.query('SELECT to_regclass($1)::text AS t', [table])).rows[0].t !== null;

describe('migrate()', () => {
  beforeEach(async () => {
    db = await PGlite.create();
    lines = [];
  });
  afterEach(() => db.close());

  it('applies every migration to an empty database and records each one', async () => {
    expect(await run()).toBe(true);
    expect(await recorded()).toEqual(FILES);
    expect(await exists('ride_posts')).toBe(true);
    expect(lines).toEqual(FILES.map((f) => `  ran      ${f}`));
  });

  it('does nothing on a second run', async () => {
    await run();
    lines = [];
    expect(await run()).toBe(true);
    expect(lines).toEqual(FILES.map((f) => `  applied  ${f}`));
  });

  it('--status lists pending migrations and changes nothing', async () => {
    expect(await run({ statusOnly: true })).toBe(true);
    expect(lines).toEqual(FILES.map((f) => `  pending  ${f}`));
    expect(await recorded()).toEqual([]);
    expect(await exists('ride_posts')).toBe(false);
  });

  it('stops at a failing migration, rolls it back and records only what ran', async () => {
    const dir = mkdtempSync(path.join(tmp, 'bad-'));
    writeFileSync(path.join(dir, '001_ok.sql'), 'CREATE TABLE ok_table (id int);');
    writeFileSync(path.join(dir, '002_bad.sql'), 'CREATE TABLE half_done (id int); SELECT * FROM no_such_table;');
    writeFileSync(path.join(dir, '003_later.sql'), 'CREATE TABLE later (id int);');

    expect(await run({ dir })).toBe(false);
    expect(await recorded()).toEqual(['001_ok.sql']);
    expect(await exists('ok_table')).toBe(true);
    expect(await exists('half_done')).toBe(false);
    expect(await exists('later')).toBe(false);
    expect(lines.at(-1)).toMatch(/FAILED {3}002_bad\.sql: .*no_such_table/);
  });
});

describe('scripts/migrate.js (the build step)', () => {
  // Run from a temp dir with no inherited DATABASE_URL or VERCEL_ENV. The CLI
  // calls dotenv, so running it from the repo would load a developer's .env
  // and could reach a real database from a test.
  const cli = (args, env) => {
    const base = { ...process.env };
    delete base.DATABASE_URL;
    delete base.VERCEL_ENV;
    return spawnSync(process.execPath, [CLI, ...args], { cwd: tmp, env: { ...base, ...env }, encoding: 'utf8', timeout: 20000 });
  };
  const unreachable = 'postgres://nobody@127.0.0.1:1/none';

  it('skips outside a Vercel production build', () => {
    for (const env of [{}, { VERCEL_ENV: 'preview' }, { VERCEL_ENV: 'development' }]) {
      const result = cli(['--vercel'], { ...env, DATABASE_URL: unreachable });
      expect(result.status, JSON.stringify(env)).toBe(0);
      expect(result.stdout).toContain('skipped');
    }
  });

  it('fails a production build when DATABASE_URL is missing', () => {
    // dotenv never overrides a variable that is already set, even to ''.
    const result = cli(['--vercel'], { VERCEL_ENV: 'production', DATABASE_URL: '' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('DATABASE_URL is not set');
  });

  it('fails a production build when the database is unreachable', () => {
    const result = cli(['--vercel'], { VERCEL_ENV: 'production', DATABASE_URL: unreachable });
    expect(result.status).not.toBe(0);
  });
});
