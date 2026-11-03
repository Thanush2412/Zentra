import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

/**
 * Postgres folds a bare identifier to lowercase, so `SELECT MAX(x) AS maxR` arrives as
 * `row.maxr`. POSTGRES_CAMEL_MAP only knows real schema columns, so a computed aggregate
 * alias is never rescued — reading `row.maxR` silently yields undefined. Both
 * /api/fees/bulk (receipt counter restarted → duplicate receipt_no) and
 * /api/demo-eval-criteria (sort order flattened to 0) had that bug.
 * Aggregate aliases must be quoted: AS "maxR".
 */
const AGGREGATE_ALIAS = /\b(?:AS|as)\s+([a-z][a-z0-9]*[A-Z][A-Za-z0-9]*)\b(?!\s*;?\s*")/;
const HAS_AGGREGATE = /\b(MAX|MIN|COUNT|SUM|AVG|COALESCE)\s*\(/i;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter(f => /\.tsx?$/.test(f))
    .map(f => join(dir, f));
}

describe("SQL aggregate aliases survive Postgres case folding", () => {
  const files = [...sourceFiles("src/app/api"), ...sourceFiles("src/lib")];
  const offenders: string[] = [];

  for (const file of files) {
    readFileSync(file, "utf8").split("\n").forEach((line, i) => {
      if (!HAS_AGGREGATE.test(line)) return;
      const match = line.match(AGGREGATE_ALIAS);
      if (match) offenders.push(`${file}:${i + 1} → AS ${match[1]}`);
    });
  }

  it("walks every server source file", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("has no bare camelCase aggregate alias anywhere in the API or lib", () => {
    expect(offenders).toEqual([]);
  });
});
