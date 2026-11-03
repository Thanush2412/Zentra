import { describe, it, expect } from "vitest";
import { createPostgresAdapter } from "../src/lib/db";

type QueryResult = { rows: any[]; rowCount: number };

interface FakePool {
  query: (sql: string, params?: any[]) => Promise<QueryResult>;
  calls: string[];
  maxInFlight: number;
}

/** Pool stub whose latency is seeded by column so slower queries resolve out of order. */
function fakePool(opts: { delayByCol?: (col: number) => number; failOn?: (sql: string) => boolean } = {}): any {
  const pool: any = {
    calls: [] as string[],
    inFlight: 0,
    maxInFlight: 0,
    async query(sql: string, params?: any[]): Promise<QueryResult> {
      pool.calls.push(sql);
      pool.inFlight++;
      pool.maxInFlight = Math.max(pool.maxInFlight, pool.inFlight);
      const col = Number(params?.[0] ?? 0);
      try {
        if (opts.failOn?.(sql)) throw new Error(`boom: ${sql}`);
        await new Promise((res) => setTimeout(res, opts.delayByCol?.(col) ?? 0));
        return { rows: [{ v: sql }], rowCount: 1 };
      } finally {
        pool.inFlight--;
      }
    },
  };
  return pool;
}

const noop = { sql: "SELECT 1 WHERE 1=0", params: [] };
const slice = (n: number) => ({ sql: `SELECT * FROM t${n} WHERE id = ?`, params: [n] });

describe("db.multiQuery fan-out", () => {
  it("never dispatches role-gated noop placeholders", async () => {
    const pool = fakePool();
    const db = createPostgresAdapter(pool as any);
    const res = await db.multiQuery([noop, slice(1), noop, slice(2), noop]);

    expect(pool.calls).toHaveLength(2);
    expect(res).toEqual([[], [{ v: "SELECT * FROM t1 WHERE id = $1" }], [], [{ v: "SELECT * FROM t2 WHERE id = $1" }], []]);
  });

  it("keeps result indices aligned when queries finish out of order", async () => {
    const pool = fakePool({ delayByCol: (col) => (col === 0 ? 40 : 1) });
    const db = createPostgresAdapter(pool as any);
    const queries = Array.from({ length: 20 }, (_, i) => slice(i));
    const res = await db.multiQuery(queries);

    expect(res).toHaveLength(20);
    res.forEach((rows, i) => expect(rows[0].v).toBe(`SELECT * FROM t${i} WHERE id = $${1}`));
  });

  it("caps in-flight queries so one burst cannot drain the pool", async () => {
    const pool = fakePool({ delayByCol: () => 5 });
    const db = createPostgresAdapter(pool as any);
    await db.multiQuery(Array.from({ length: 41 }, (_, i) => slice(i)));

    expect(pool.calls).toHaveLength(41);
    expect(pool.maxInFlight).toBeLessThanOrEqual(12);
  });

  it("still returns an empty slice at the failed index", async () => {
    const pool = fakePool({ failOn: (sql) => sql.includes("t2") });
    const db = createPostgresAdapter(pool as any);
    const spy = console.error;
    console.error = () => {};
    const res = await db.multiQuery([slice(1), slice(2), noop, slice(3)]);
    console.error = spy;

    expect(res[1]).toEqual([]);
    expect(res[0][0].v).toContain("t1");
    expect(res[3][0].v).toContain("t3");
  });

  it("records every failure in the collector so partial reads are detectable", async () => {
    const pool = fakePool({ failOn: (sql) => sql.includes("t2") || sql.includes("t3") });
    const db = createPostgresAdapter(pool as any);
    const spy = console.error;
    console.error = () => {};
    const failures: { sql: string; error: string }[] = [];
    const res = await db.multiQuery([slice(1), slice(2), noop, slice(3)], failures);
    console.error = spy;

    expect(res).toHaveLength(4);
    expect(failures).toHaveLength(2);
    expect(failures.map((f) => f.sql).join()).toContain("t2");
    expect(failures[0].error).toContain("boom");
  });
});
