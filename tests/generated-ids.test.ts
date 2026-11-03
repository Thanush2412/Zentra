import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { resolve, join } from "path";
import { stableDocRef } from "@/lib/report-export";

/** MD-M11 / MD-M19: every identifier that reaches a PRIMARY KEY must be collision-resistant. */
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/route\.ts$/.test(entry)) out.push(full);
  }
  return out;
}

describe("persisted identifiers", () => {
  // College ids are name-derived on purpose, and POST /api/colleges rejects a
  // duplicate id with a clean 400 after checking the table, so the clock suffix
  // there never reaches a PRIMARY KEY conflict.
  const ALLOWLIST = [/[\\/]colleges[\\/]route\.ts$/];

  it("mints ids from crypto entropy, never the millisecond clock alone", () => {
    const offenders: string[] = [];
    for (const file of walk(resolve(process.cwd(), "src/app/api"))) {
      if (ALLOWLIST.some((re) => re.test(file))) continue;
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        const mintsId = /\b(\w*[Ii]d|\w*[Rr]eceiptNo|\w*[Rr]efNo)\b\s*[=:]/.test(line) || /["`]\[?_?"?\s*\+\s*Date\.now\(\)/.test(line);
        if (!mintsId || !line.includes("Date.now()")) return;
        if (/randomUUID|randomBytes|generateId/.test(line)) return;
        offenders.push(`${file.replace(process.cwd(), "")}:${i + 1}  ${line.trim().slice(0, 90)}`);
      });
    }
    expect(offenders, `bare clock-minted ids:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("keeps generateId time-sortable and entropy-suffixed", () => {
    const source = readFileSync(resolve(process.cwd(), "src/lib/id.ts"), "utf8");
    expect(source).toMatch(/randomBytes\(4\)/);
    expect(source).toMatch(/\$\{prefix\}_\$\{Date\.now\(\)\}_\$\{random\}/);
  });
});

describe("export document numbers", () => {
  it("returns the same reference for identical report content", () => {
    const args = [["Roll No", "Name"], [["1", "A"]], "Attendance"];
    const first = stableDocRef(args);
    expect(stableDocRef(args)).toBe(first);
    expect(stableDocRef([["Roll No", "Name"], [["1", "A"]], "Attendance"])).toBe(first);
  });

  it("changes when the exported data changes", () => {
    expect(stableDocRef([["a"], [[1]]])).not.toBe(stableDocRef([["a"], [[2]]]));
  });

  it("builds the printable reference from content, not from the clock", () => {
    const source = readFileSync(resolve(process.cwd(), "src/lib/report-export.ts"), "utf8");
    expect(source).toMatch(/stableDocRef\(\[title, subtitle, headers, rows/);
    expect(source).not.toMatch(/docId = .*Date\.now\(\)/);
  });
});
