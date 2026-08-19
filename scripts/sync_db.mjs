import { createClient } from "@libsql/client";
import fs from "fs";
import path from "path";

// Parse .env.local manually
function loadEnv() {
  const envFiles = [".env.local", ".env"];
  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, "utf-8");
      content.split("\n").forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const eqIdx = trimmed.indexOf("=");
          if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      });
    }
  }
}

loadEnv();

const REMOTE_URL = process.env.TURSO_DATABASE_URL;
const AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!REMOTE_URL || !AUTH_TOKEN) {
  console.error("❌ Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env.local");
  process.exit(1);
}

const LOCAL_DB_PATH = path.resolve(process.cwd(), "database.sqlite");
const SQL_DUMP_PATH = path.resolve(process.cwd(), "local_backup.sql");

async function main() {
  console.log("🔗 Connecting to remote Turso Cloud Database...");
  console.log(`   URL: ${REMOTE_URL}`);

  const remoteClient = createClient({
    url: REMOTE_URL,
    authToken: AUTH_TOKEN
  });

  if (fs.existsSync(LOCAL_DB_PATH)) {
    try {
      fs.unlinkSync(LOCAL_DB_PATH);
      console.log("🗑️ Cleared previous local database.sqlite");
    } catch (e) {
      console.warn("⚠️ Could not delete previous database.sqlite:", e.message);
    }
  }

  const localClient = createClient({
    url: `file:${LOCAL_DB_PATH}`
  });

  const sqlStream = fs.createWriteStream(SQL_DUMP_PATH, { encoding: "utf-8" });

  sqlStream.write("-- =============================================\n");
  sqlStream.write(`-- LOCAL SQL DUMP EXPORTED AT: ${new Date().toISOString()}\n`);
  sqlStream.write(`-- Source: ${REMOTE_URL}\n`);
  sqlStream.write("-- =============================================\n\n");
  sqlStream.write("PRAGMA foreign_keys = OFF;\n");
  sqlStream.write("BEGIN TRANSACTION;\n\n");

  await localClient.execute("PRAGMA foreign_keys = OFF;");
  await localClient.execute("PRAGMA synchronous = OFF;");
  await localClient.execute("PRAGMA journal_mode = MEMORY;");

  console.log("📋 Fetching tables and schema from remote...");
  const tableQuery = await remoteClient.execute(
    "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream_%' ORDER BY name;"
  );

  const tables = tableQuery.rows;
  console.log(`✅ Found ${tables.length} tables to sync.`);

  for (const table of tables) {
    const tableName = String(table.name);
    const createTableSql = String(table.sql);

    console.log(`\n📦 Processing table: [${tableName}]...`);
    sqlStream.write(`-- Table: ${tableName}\n`);
    sqlStream.write(`DROP TABLE IF EXISTS "${tableName}";\n`);
    sqlStream.write(`${createTableSql};\n`);

    await localClient.executeMultiple(`DROP TABLE IF EXISTS "${tableName}"; ${createTableSql};`);

    const countRes = await remoteClient.execute(`SELECT COUNT(*) as total FROM "${tableName}"`);
    const totalCount = Number(countRes.rows[0]?.total || 0);
    console.log(`   Total records: ${totalCount}`);

    if (totalCount === 0) continue;

    const fetchBatchSize = 1000;
    let offset = 0;

    while (offset < totalCount) {
      const rowsRes = await remoteClient.execute(`SELECT * FROM "${tableName}" LIMIT ${fetchBatchSize} OFFSET ${offset}`);
      const rows = rowsRes.rows;

      if (rows.length === 0) break;

      const columns = Object.keys(rows[0]);
      const quotedCols = columns.map(c => `"${c}"`).join(", ");

      // Execute batch insert in chunks of 100 statements
      const stmts = [];
      const sqlInserts = [];

      for (const row of rows) {
        const placeholders = columns.map(() => "?").join(", ");
        const values = columns.map(c => {
          const val = row[c];
          return val === undefined ? null : val;
        });

        stmts.push({
          sql: `INSERT INTO "${tableName}" (${quotedCols}) VALUES (${placeholders})`,
          args: values
        });

        const formattedValues = values.map(v => {
          if (v === null || v === undefined) return "NULL";
          if (typeof v === "number") return v;
          if (typeof v === "boolean") return v ? 1 : 0;
          return `'${String(v).replace(/'/g, "''")}'`;
        }).join(", ");

        sqlInserts.push(`INSERT INTO "${tableName}" (${quotedCols}) VALUES (${formattedValues});`);
      }

      await localClient.batch(stmts, "write");
      sqlStream.write(sqlInserts.join("\n") + "\n");

      offset += rows.length;
      process.stdout.write(`   ⚡ Transferred ${offset}/${totalCount} rows...\r`);
    }
    console.log(`\n   ✅ Completed table [${tableName}] (${totalCount} rows synced)`);
    sqlStream.write("\n");
  }

  console.log("\n📑 Fetching custom indexes...");
  const indexQuery = await remoteClient.execute(
    "SELECT name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY name;"
  );

  for (const idx of indexQuery.rows) {
    if (idx.sql) {
      try {
        await localClient.execute(String(idx.sql));
        sqlStream.write(`${idx.sql};\n`);
      } catch (err) {
        // Ignore duplicate index creation
      }
    }
  }

  sqlStream.write("\nCOMMIT;\n");
  sqlStream.write("PRAGMA foreign_keys = ON;\n");
  sqlStream.end();

  await localClient.execute("PRAGMA foreign_keys = ON;");

  console.log("\n========================================================");
  console.log("🎉 DATABASE SYNC & SQL DUMP COMPLETED SUCCESSFULLY!");
  console.log(`📁 Local SQLite File: ${LOCAL_DB_PATH} (${(fs.statSync(LOCAL_DB_PATH).size / (1024 * 1024)).toFixed(2)} MB)`);
  console.log(`📄 Local SQL Dump:   ${SQL_DUMP_PATH} (${(fs.statSync(SQL_DUMP_PATH).size / (1024 * 1024)).toFixed(2)} MB)`);
  console.log("========================================================");
}

main().catch(err => {
  console.error("❌ Sync failed with error:", err);
  process.exit(1);
});
