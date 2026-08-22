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

const REMOTE_URL = "libsql://zentra-thanush-k.aws-ap-south-1.turso.io";
const AUTH_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQ1MjE2OTUsImlkIjoiMDE5ZjdkYzctNzIwMS03MDk0LTg0NjMtOTQ1M2FiZmM4MTVhIiwia2lkIjoieDlfZW5Qbmk3TGVoeER0RXpfSmptWjZDejk0Vzg5X1VhYVVya1dJWU5COCIsInJpZCI6IjU5OTZjZWJlLTczNTktNGYzNC05YTJlLTIwNjVmZTI3ZjIyMCJ9.UwFvp-pYDNO2dy9ELwXIZXNebTOZnSkCWFApwKeCJFWG0eZYPL3y1y8DitJkJOcM__fUOOcuU3seWfgbUoluCQ";

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
  console.log("🎉 WHOLE DB DOWNLOADED & BACKED UP SUCCESSFULLY!");
  console.log(`📁 Local SQLite File: ${LOCAL_DB_PATH} (${(fs.statSync(LOCAL_DB_PATH).size / (1024 * 1024)).toFixed(2)} MB)`);
  console.log(`📄 Local SQL Dump:   ${SQL_DUMP_PATH} (${(fs.statSync(SQL_DUMP_PATH).size / (1024 * 1024)).toFixed(2)} MB)`);
  console.log("========================================================");

  // Verification of attendance on the 48 dates alone
  const DATES = [
    "2026-06-15", "2026-06-16", "2026-06-17", "2026-06-18", "2026-06-19",
    "2026-06-22", "2026-06-23", "2026-06-24", "2026-06-25",
    "2026-06-29", "2026-06-30",
    "2026-07-01", "2026-07-02", "2026-07-03",
    "2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09", "2026-07-10",
    "2026-07-13", "2026-07-14", "2026-07-15", "2026-07-16", "2026-07-17",
    "2026-07-20", "2026-07-21", "2026-07-22", "2026-07-23", "2026-07-24",
    "2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30", "2026-07-31",
    "2026-08-03", "2026-08-04",
    "2026-08-06", "2026-08-07",
    "2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14",
    "2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20", "2026-08-21"
  ];

  console.log("\n🔍 Checking attendance on Prod on the 48 dates alone for BCA:");
  const bcaStudents = await localClient.execute(
    "SELECT id, name FROM students WHERE LOWER(classGroup) LIKE '%bca%' OR LOWER(department) LIKE '%bca%'"
  );
  console.log(`   Found ${bcaStudents.rows.length} BCA students.`);

  if (bcaStudents.rows.length > 0) {
    const studentIds = bcaStudents.rows.map(s => s.id);
    const placeholders = studentIds.map(() => "?").join(",");
    const datePlaceholders = DATES.map(() => "?").join(",");

    const matchedAtt = await localClient.execute({
      sql: `SELECT COUNT(*) as cnt, COUNT(DISTINCT dateStr) as dateCount 
            FROM student_attendance 
            WHERE studentId IN (${placeholders}) AND dateStr IN (${datePlaceholders})`,
      args: [...studentIds, ...DATES]
    });

    const extraBcaAtt = await localClient.execute({
      sql: `SELECT COUNT(*) as cnt, COUNT(DISTINCT dateStr) as extraDates 
            FROM student_attendance 
            WHERE studentId IN (${placeholders}) AND dateStr NOT IN (${datePlaceholders})`,
      args: [...studentIds, ...DATES]
    });

    console.log(`   Attendance rows across approved 48 dates: ${matchedAtt.rows[0].cnt} rows (${matchedAtt.rows[0].dateCount} distinct dates present)`);
    console.log(`   Attendance rows outside 48 dates for BCA: ${extraBcaAtt.rows[0].cnt} rows (${extraBcaAtt.rows[0].extraDates} dates)`);
  }
}

main().catch(err => {
  console.error("❌ Sync failed with error:", err);
  process.exit(1);
});
