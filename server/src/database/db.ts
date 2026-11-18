// Database access: PostgreSQL (pg) when DATABASE_URL is set, otherwise embedded PGlite (Postgres in WASM).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config';

export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}
export interface Database extends Queryable {
  kind: 'postgres' | 'pglite';
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

const here = path.dirname(fileURLToPath(import.meta.url));
function loadSchema(): string {
  for (const p of [path.join(here, 'schema.sql'), path.join(here, 'database', 'schema.sql'), path.join(process.cwd(), 'src/database/schema.sql'), path.join(process.cwd(), 'server/src/database/schema.sql')]) {
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  }
  throw new Error('schema.sql not found');
}

let db: Database | null = null;

export async function initDb(): Promise<Database> {
  if (db) return db;
  const schema = loadSchema();
  if (config.databaseUrl) {
    const pg = await import('pg');
    const pool = new pg.default.Pool({
      connectionString: config.databaseUrl,
      max: 10,
      ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
    });
    await pool.query(schema);
    db = {
      kind: 'postgres',
      query: async (sql, params) => pool.query(sql, params as unknown[]) as never,
      tx: async (fn) => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const res = await fn({ query: async (sql, params) => client.query(sql, params as unknown[]) as never });
          await client.query('COMMIT');
          return res;
        } catch (e) {
          await client.query('ROLLBACK').catch(() => {});
          throw e;
        } finally {
          client.release();
        }
      },
      close: () => pool.end(),
    };
  } else {
    const { PGlite } = await import('@electric-sql/pglite');
    const dir = config.pgliteDir === 'memory' ? undefined : path.resolve(config.pgliteDir);
    if (dir) fs.mkdirSync(dir, { recursive: true });
    const lite = new PGlite(dir);
    await lite.exec(schema);
    // PGlite runs a single connection; serialise transactions to keep them isolated.
    let chain: Promise<unknown> = Promise.resolve();
    db = {
      kind: 'pglite',
      query: async (sql, params) => lite.query(sql, params as unknown[]) as never,
      tx: (fn) => {
        const run = chain.then(() => lite.transaction(async (t) => fn({ query: async (sql, params) => t.query(sql, params as unknown[]) as never })));
        chain = run.catch(() => {});
        return run;
      },
      close: () => lite.close(),
    };
  }
  console.log(`[db] connected (${db.kind})`);
  return db;
}

export function getDb(): Database {
  if (!db) throw new Error('Database not initialised');
  return db;
}
