import { createClient } from "@libsql/client";
import fs from "fs";
import path from "path";

function getEnvVars() {
  const env = {};
  const envFiles = [".env.local", ".env"];
  for (const file of envFiles) {
    if (fs.existsSync(file)) {
      const envContent = fs.readFileSync(file, "utf-8");
      for (const line of envContent.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!env[key]) env[key] = val;
        }
      }
    }
  }
  return env;
}

async function syncTursoToLocal() {
  const env = getEnvVars();
  let remoteUrl = env.TURSO_DATABASE_URL;
  let remoteAuthToken = env.TURSO_AUTH_TOKEN;

  // If TURSO_DATABASE_URL is set to file:database.sqlite, use the cloud Turso credentials
  if (!remoteUrl || remoteUrl.startsWith("file:")) {
    remoteUrl = "libsql://zentra-thanush-k.aws-ap-south-1.turso.io";
    remoteAuthToken = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQ1MjE2OTUsImlkIjoiMDE5ZjdkYzctNzIwMS03MDk0LTg0NjMtOTQ1M2FiZmM4MTVhIiwia2lkIjoieDlfZW5Qbmk3TGVoeER0RXpfSmptWjZDejk0Vzg5X1VhYVVya1dJWU5COCIsInJpZCI6IjU5OTZjZWJlLTczNTktNGYzNC05YTJlLTIwNjVmZTI3ZjIyMCJ9.UwFvp-pYDNO2dy9ELwXIZXNebTOZnSkCWFApwKeCJFWG0eZYPL3y1y8DitJkJOcM__fUOOcuU3seWfgbUoluCQ";
  }

  console.log(`🌐 Connecting to Remote Turso DB: ${remoteUrl.replace(/\/\/.*@/, "//***@")}...`);
  const remoteClient = createClient({
    url: remoteUrl,
    authToken: remoteAuthToken
  });

  const localDbPath = path.resolve(process.cwd(), "database.sqlite");
  console.log(`💾 Target Local DB: ${localDbPath}...`);
  const localClient = createClient({
    url: `file:${localDbPath}`
  });

  try {
    // 1. Fetch all user tables from remote
    const tablesRes = await remoteClient.execute(`
      SELECT name, sql FROM sqlite_master 
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream_%'
      ORDER BY name ASC
    `);

    const tables = tablesRes.rows;
    console.log(`📋 Found ${tables.length} tables in remote database.\n`);

    // Disable foreign keys on local during bulk transfer
    await localClient.execute("PRAGMA foreign_keys = OFF;");

    for (const tableRow of tables) {
      const tableName = String(tableRow.name);
      const createSql = String(tableRow.sql);

      if (!createSql || createSql === "null") continue;

      process.stdout.write(`⏳ Syncing table [${tableName}]... `);

      // Drop and recreate table on local
      await localClient.execute(`DROP TABLE IF EXISTS "${tableName}";`);
      await localClient.execute(createSql);

      // Fetch all rows from remote
      const rowsRes = await remoteClient.execute(`SELECT * FROM "${tableName}"`);
      const rows = rowsRes.rows;
      const columns = rowsRes.columns;

      if (rows.length === 0) {
        console.log(`0 rows.`);
        continue;
      }

      // Batch insert in chunks of 100 rows
      const chunkSize = 100;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const placeholders = `(${columns.map(() => "?").join(", ")})`;
        const fullInsertSql = `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(", ")}) VALUES ${chunk.map(() => placeholders).join(", ")}`;
        
        const flatArgs = [];
        for (const r of chunk) {
          for (const col of columns) {
            flatArgs.push(r[col] === undefined ? null : r[col]);
          }
        }

        await localClient.execute({
          sql: fullInsertSql,
          args: flatArgs
        });
      }

      console.log(`✅ ${rows.length} rows synced.`);
    }

    // 2. Fetch and recreate all indexes
    const indexesRes = await remoteClient.execute(`
      SELECT name, sql FROM sqlite_master 
      WHERE type = 'index' AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%'
    `);

    for (const idxRow of indexesRes.rows) {
      if (idxRow.sql) {
        try {
          await localClient.execute(String(idxRow.sql));
        } catch (_) {}
      }
    }

    await localClient.execute("PRAGMA foreign_keys = ON;");
    console.log("\n🎉 Full Turso remote database has been successfully downloaded and synced to local `database.sqlite`!");
  } catch (err) {
    console.error("❌ Error during database sync:", err);
    process.exit(1);
  }
}

syncTursoToLocal();
