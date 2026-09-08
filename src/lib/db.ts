import { Pool, type QueryResultRow } from "pg";

/**
 * Supabase(Postgres) への接続はサーバー側だけ。
 * dev では HMR のたびに Pool が増えないよう globalThis に載せる。
 * テーブルはすべて `hiiragi.` を付けて書くので search_path には依存しない。
 */
const globalForPg = globalThis as unknown as { hiiragiPool?: Pool };

export const pool =
  globalForPg.hiiragiPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
    idleTimeoutMillis: 30_000,
  });

if (process.env.NODE_ENV !== "production") globalForPg.hiiragiPool = pool;

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query<T>(text, params as never[]);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
