// db/schema.sql をそのまま流し込むだけの素朴なマイグレーション。
// すべて IF NOT EXISTS で書いてあるので、何度実行しても安全。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";
import { loadEnv } from "./env.mjs";

loadEnv();

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "..", "db", "schema.sql"), "utf8");

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query(sql);
  const { rows } = await client.query(
    `select table_name from information_schema.tables where table_schema = 'hiiragi' order by table_name`,
  );
  console.log("hiiragi スキーマのテーブル:");
  for (const r of rows) console.log("  -", r.table_name);
  console.log("マイグレーション完了");
} finally {
  await client.end();
}
