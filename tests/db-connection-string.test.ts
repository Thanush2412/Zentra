import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync, unlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { resolveConnectionString, resolveSslConfig } from "../src/lib/db";

vi.spyOn(console, "log").mockImplementation(() => {});

afterEach(() => {
  delete process.env.DB_POOLER_HOST;
  delete process.env.DB_SSL_VERIFY;
  delete process.env.DB_SSL_CA_PATH;
});

describe("resolveConnectionString", () => {
  it("routes a direct Supabase URL through the IPv4 pooler", () => {
    const out = new URL(resolveConnectionString(
      "postgresql://postgres:pw@db.abcdefghij.supabase.co:5432/postgres"
    ));
    expect(out.hostname).toBe("aws-0-ap-southeast-2.pooler.supabase.com");
    expect(out.port).toBe("6543");
    expect(out.username).toBe("postgres.abcdefghij");
    expect(out.password).toBe("pw");
  });

  it("adds a port when the URL omits one", () => {
    const out = new URL(resolveConnectionString(
      "postgresql://postgres.abcdefghij:pw@db.abcdefghij.supabase.co/postgres"
    ));
    expect(out.port).toBe("6543");
  });

  it("keeps an explicitly chosen pooler port", () => {
    const out = new URL(resolveConnectionString(
      "postgresql://postgres:pw@db.abcdefghij.supabase.co:5433/postgres"
    ));
    expect(out.port).toBe("5433");
  });

  it("honors the DB_POOLER_HOST override", () => {
    process.env.DB_POOLER_HOST = "aws-0-ap-south-1.pooler.supabase.com";
    const out = new URL(resolveConnectionString(
      "postgresql://postgres:pw@db.abcdefghij.supabase.co/postgres"
    ));
    expect(out.hostname).toBe("aws-0-ap-south-1.pooler.supabase.com");
  });

  it("leaves local and non-Supabase URLs untouched", () => {
    const local = "postgresql://timetable:pw@localhost:5432/fp_timetable";
    expect(resolveConnectionString(local)).toBe(local);

    const other = "postgresql://user:pw@ep-something.neon.tech:5432/db?sslmode=require";
    expect(resolveConnectionString(other)).toBe(other);
  });

  it("passes an unparseable URL through instead of throwing", () => {
    expect(resolveConnectionString("not-a-url")).toBe("not-a-url");
  });
});

describe("resolveSslConfig", () => {
  it("skips TLS for a local server", () => {
    expect(resolveSslConfig(true)).toBeUndefined();
  });

  it("encrypts without verifying the server by default", () => {
    expect(resolveSslConfig(false)).toEqual({ rejectUnauthorized: false });
  });

  it("verifies against the system trust store once DB_SSL_VERIFY is on", () => {
    process.env.DB_SSL_VERIFY = "true";
    expect(resolveSslConfig(false)).toEqual({ rejectUnauthorized: true });
  });

  it("reads 1, yes and TRUE as on, and anything else as off", () => {
    for (const value of ["1", "yes", "TRUE"]) {
      process.env.DB_SSL_VERIFY = value;
      expect(resolveSslConfig(false)).toEqual({ rejectUnauthorized: true });
    }
    process.env.DB_SSL_VERIFY = "false";
    expect(resolveSslConfig(false)).toEqual({ rejectUnauthorized: false });
  });

  it("loads a Supabase CA bundle when DB_SSL_CA_PATH is set", () => {
    const caPath = join(tmpdir(), "fp-timetable-test-ca.pem");
    writeFileSync(caPath, "-----BEGIN CERTIFICATE-----\ntest-bundle\n");
    process.env.DB_SSL_VERIFY = "true";
    process.env.DB_SSL_CA_PATH = caPath;
    try {
      const ssl = resolveSslConfig(false) as any;
      expect(ssl.rejectUnauthorized).toBe(true);
      expect(ssl.ca).toBe(readFileSync(caPath, "utf8"));
    } finally {
      unlinkSync(caPath);
    }
  });

  it("fails loudly when verification is on but the CA file cannot be read", () => {
    process.env.DB_SSL_VERIFY = "true";
    process.env.DB_SSL_CA_PATH = join(tmpdir(), "fp-timetable-definitely-absent.pem");
    expect(() => resolveSslConfig(false)).toThrow(/DB_SSL_CA_PATH/);
  });
});
