export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb, type QueryFailure } from "@/lib/db";
import { generateId } from "@/lib/id";
import { hashPasswordAsync } from "@/lib/auth";
import { ensureMigration } from "@/lib/migrations";

/** Roles a public signup may ask for. Staff/admin roles are only granted by an admin. */
const SELF_SERVICE_ROLES = new Set(["student", "mentor", "pending"]);
const SIGNUP_WINDOW_MS = 60 * 60_000;
const MAX_SIGNUPS_PER_IP = 10;

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { name, email, password, college_id = null, notes } = body;
    // Never store a privileged requested role from an unauthenticated form.
    const rawRole = String(body.requested_role || "pending").toLowerCase().trim();
    const requested_role = SELF_SERVICE_ROLES.has(rawRole) ? rawRole : "pending";

    if (!name || !email || !password) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }
    if (String(password).length < 8 || String(password).length > 128) {
      return NextResponse.json({ success: false, message: "Password must be between 8 and 128 characters." }, { status: 400 });
    }

    // Per-IP rate limit (reuses the login_attempts ledger with a "signup:" key).
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "127.0.0.1";
    try {
      await ensureMigration("login_attempts");
      const since = new Date(Date.now() - SIGNUP_WINDOW_MS).toISOString();
      const recent = await db.get("SELECT COUNT(*) AS n FROM login_attempts WHERE email_key = ? AND attempted_at >= ?", [`signup:${ip}`, since]);
      if (Number(recent?.n || 0) >= MAX_SIGNUPS_PER_IP) {
        return NextResponse.json({ success: false, message: "Too many signup requests from this network. Please try again later." }, { status: 429 });
      }
      await db.run(
        "INSERT INTO login_attempts (id, email_key, ip, success, attempted_at) VALUES (?, ?, ?, 1, ?)",
        [generateId("signup"), `signup:${ip}`, ip, new Date().toISOString()]
      );
    } catch (err) {
      console.warn("[signup] rate-limit check failed:", err);
    }

    const cleanEmail = email.toLowerCase().trim();

    // Both duplicate probes key off the posted email and decide whether the request is
    // stored, so they share one round trip — and a failed probe has to abort rather than
    // read as "this email is free".
    const clashFailures: QueryFailure[] = [];
    const [userRows, requestRows] = await db.multiQuery(
      [
        { sql: "SELECT id FROM users WHERE LOWER(email) = ?", params: [cleanEmail] },
        { sql: "SELECT id FROM signup_requests WHERE LOWER(email) = ? AND status = 'pending'", params: [cleanEmail] },
      ],
      clashFailures
    );
    if (clashFailures.length > 0) {
      return NextResponse.json({ success: false, message: "Could not check this email. Please try again." }, { status: 500 });
    }
    if (userRows.length > 0) {
      return NextResponse.json({ success: false, message: "An account with this email is already registered." }, { status: 400 });
    }
    if (requestRows.length > 0) {
      return NextResponse.json({ success: false, message: "A signup request for this email is already pending approval." }, { status: 400 });
    }

    const id = generateId("req");
    await db.run(
      `INSERT INTO signup_requests (id, name, email, password_hash, requested_role, status, college_id, notes) 
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [id, String(name).trim(), cleanEmail, await hashPasswordAsync(String(password)), requested_role, college_id || null, notes || null]
    );

    return NextResponse.json({ success: true, message: "Signup request submitted successfully. Please wait for administrator approval." });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
