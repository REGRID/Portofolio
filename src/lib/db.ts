import { Pool } from 'pg';

let pool: Pool | undefined;

export function getDbPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      options: '-c search_path=portfolio,public',
    });
  }
  return pool;
}

export async function query(text: string, params?: unknown[]) {
  const p = getDbPool();
  return p.query(text, params);
}
