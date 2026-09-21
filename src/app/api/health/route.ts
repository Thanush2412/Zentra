export const preferredRegion = "bom1";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * Health check for uptime monitoring (API_OPTIMIZATION_PLAN item 21).
 * Intentionally unauthenticated (allowlisted in src/middleware.ts) so external
 * monitors can reach it. Exposes no user data — only liveness + pool stats.
 */
export async function GET() {
  const startedAt = Date.now();
  try {
    const db = await getDb();
    await db.get("SELECT 1");

    let poolStats: Record<string, any> = {};
    try {
      const pool = (db as any).pool;
      if (pool) {
        poolStats = {
          total: pool.totalCount,
          idle: pool.idleCount,
          waiting: pool.waitingCount,
        };
      }
    } catch (_) {}

    return NextResponse.json({
      success: true,
      status: "ok",
      db: "connected",
      latencyMs: Date.now() - startedAt,
      pool: poolStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        status: "degraded",
        db: "unreachable",
        error: error?.message || "Unknown error",
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
