import { describe, it, expect } from "vitest";
import { adaptQueryForPostgres } from "../src/lib/db";

describe("adaptQueryForPostgres", () => {
  it("converts ? placeholders to $n", () => {
    const { sql, params } = adaptQueryForPostgres("SELECT * FROM t WHERE a = ? AND b = ?", [1, "x"]);
    expect(sql).toBe("SELECT * FROM t WHERE a = $1 AND b = $2");
    expect(params).toEqual([1, "x"]);
  });

  it("translates INSERT OR IGNORE to ON CONFLICT DO NOTHING", () => {
    const { sql } = adaptQueryForPostgres("INSERT OR IGNORE INTO t (a) VALUES (?)", [1]);
    expect(sql).toContain("INSERT INTO t (a) VALUES ($1)");
    expect(sql).toContain("ON CONFLICT DO NOTHING");
  });

  it("translates INSERT OR REPLACE to ON CONFLICT DO UPDATE", () => {
    const { sql } = adaptQueryForPostgres("INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)", ["k", "v"]);
    expect(sql).toContain("INSERT INTO system_settings");
    expect(sql).toContain('ON CONFLICT ("key") DO UPDATE SET');
  });

  it("replaces datetime('now') with NOW()::text", () => {
    const { sql } = adaptQueryForPostgres("SELECT datetime('now')", []);
    expect(sql).toContain("NOW()::text");
  });

  it("bypasses SQLite PRAGMA foreign_keys", () => {
    const { sql } = adaptQueryForPostgres("PRAGMA foreign_keys = ON", []);
    expect(sql).toBe("SELECT 1");
  });

  it("normalizes undefined params to null", () => {
    const { params } = adaptQueryForPostgres("INSERT INTO t VALUES (?, ?)", [undefined, "x"]);
    expect(params[0]).toBeNull();
  });
});
