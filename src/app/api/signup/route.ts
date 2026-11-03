export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb, type QueryFailure } from "@/lib/db";
import { generateId } from "@/lib/id";
import { hashPassword } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { name, email, password, requested_role = "pending", college_id = null, notes } = body;

    if (!name || !email || !password) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
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
      [id, name.trim(), cleanEmail, hashPassword(password), requested_role, college_id || null, notes || null]
    );

    return NextResponse.json({ success: true, message: "Signup request submitted successfully. Please wait for administrator approval." });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
