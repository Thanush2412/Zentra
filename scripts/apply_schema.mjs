/**
 * Applies postgres_schema.sql to the database in DATABASE_URL / POSTGRES_URL.
 *
 * Runtime migrations (src/lib/migrations.ts) only CREATE TABLE / ALTER what they
 * own, so a brand-new database still needs this file once. Every statement is
 * IF NOT EXISTS, so it is safe to re-run against an existing database — but it
 * also (re)creates indexes, which lock tables. Run it in a quiet window.
 */
import fs from "fs";
import path from "path";
import pg from "pg";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const fullPath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(fullPath)) continue;
    for (const line of fs.readFileSync(fullPath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx <= 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

loadEnv();

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!connectionString) {
  console.error("DATABASE_URL or POSTGRES_URL is required.");
  process.exit(1);
}

const schemaPath = path.resolve(process.cwd(), "postgres_schema.sql");
const sql = fs.readFileSync(schemaPath, "utf8");
const isLocalHost = /localhost|127\.0\.0\.1/.test(connectionString);

const client = new pg.Client({
  connectionString,
  ssl: isLocalHost ? undefined : { rejectUnauthorized: false },
});

try {
  await client.connect();
  const startedAt = Date.now();
  await client.query(sql);
  console.log(`Applied ${schemaPath} in ${Date.now() - startedAt}ms.`);
  console.log("Indexes in scripts/performance-indexes.sql still need a separate run.");
} finally {
  await client.end();
}
