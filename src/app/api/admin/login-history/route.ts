// Pin to Mumbai (bom1) — co-located with DB
export const preferredRegion = "bom1";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = await getDb();
    const rows = await db.all(
      "SELECT id, user_id, login_time, logout_time, ip, device FROM login_history ORDER BY login_time DESC LIMIT 50"
    );

    return NextResponse.json(
      { success: true, loginHistory: rows || [] },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
        }
      }
    );
  } catch (error: any) {
    console.error("GET /api/admin/login-history error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch login history" },
      { status: 500 }
    );
  }
}
