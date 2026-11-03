import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { normalizePgRow } from "../src/lib/db";
import { PG_SCHEMA_COLUMN_COUNT } from "../src/lib/pgColumnCase.generated";

/**
 * Postgres folds unquoted identifiers to lowercase, so the row keys the app gets
 * back depend on POSTGRES_CAMEL_MAP. That map was hand-maintained and was silently
 * missing 5 schema columns, which crashed the admin audit-log filter. It is now
 * generated from postgres_schema.sql, and this test is the guard that fails if the
 * generated file goes stale or the generator's parse collapses.
 */
const SQL_KEYWORDS = new Set([
  "BEGIN", "END", "IF", "ELSE", "ELSIF", "THEN", "LOOP", "FOREACH", "RETURN",
  "RAISE", "NOTICE", "EXCEPTION", "UNIQUE", "NOW", "VARCHAR", "TEXT", "INTEGER",
]);

function mixedCaseColumnsInSchema(): string[] {
  const ddl = readFileSync(`${process.cwd()}/postgres_schema.sql`, "utf8");
  const found = new Set<string>();
  for (const line of ddl.split("\n")) {
    const match = line.match(/^\s+([a-z][a-z_]*[A-Z][A-Za-z0-9]*)\s+[A-Za-z]/);
    if (match && !SQL_KEYWORDS.has(match[1].toUpperCase())) found.add(match[1]);
  }
  return [...found];
}

describe("Postgres column casing map covers the schema", () => {
  it("finds the mixed-case columns to check", () => {
    expect(mixedCaseColumnsInSchema().length).toBeGreaterThan(20);
  });

  it("has a generated file that agrees with the schema about how many columns exist", () => {
    expect(PG_SCHEMA_COLUMN_COUNT).toBe(mixedCaseColumnsInSchema().length);
  });

  it("restores camelCase for every mixed-case column in postgres_schema.sql", () => {
    const uncovered = mixedCaseColumnsInSchema().filter((col) => {
      const folded = col.toLowerCase();
      const row = normalizePgRow({ [folded]: "value" });
      return row[folded] === "value" && row[col] === undefined;
    });
    expect(uncovered).toEqual([]);
  });
});
