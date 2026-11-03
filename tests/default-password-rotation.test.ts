import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { DEFAULT_PASSWORD } from "@/lib/authConfig";

const ACCOUNT_ROUTES = [
  "src/app/api/users/route.ts",
  "src/app/api/mentors/route.ts",
  "src/app/api/mentors/bulk/route.ts",
  "src/app/api/students/route.ts",
  "src/app/api/cam/route.ts",
  "src/app/api/cm/route.ts",
  "src/app/api/smes/route.ts"
];

function route(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

describe("accounts minted on the shared default password are rotated", () => {
  it.each(ACCOUNT_ROUTES)("%s stamps must_change_password when it writes a users row", (rel) => {
    const source = route(rel);
    const inserts = source.match(/INSERT INTO users \([^)]*\)/g) || [];
    expect(inserts.length).toBeGreaterThan(0);
    inserts.forEach((columns) => {
      expect(columns).toContain("must_change_password");
    });
  });

  it("reads the flag as a Postgres boolean, not only as SQLite 0/1", () => {
    expect(route("src/app/api/login/route.ts")).toContain("Boolean(user.must_change_password)");
    expect(route("src/lib/authGuard.ts")).toContain("Boolean(user.must_change_password)");
    expect(route("src/app/api/login/route.ts")).not.toContain("must_change_password === 1");
  });

  it("sources the default password from the environment with one shared constant", () => {
    const config = route("src/lib/authConfig.ts");
    expect(config).toContain("process.env.DEFAULT_USER_PASSWORD");
    expect(typeof DEFAULT_PASSWORD).toBe("string");
    ACCOUNT_ROUTES.filter((rel) => rel !== "src/app/api/users/route.ts").forEach((rel) => {
      expect(route(rel)).toContain('import { DEFAULT_PASSWORD } from "@/lib/authConfig"');
    });
  });
});
