import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { name, email, password, requested_role = "pending", college_id = null, notes } = body;

    if (!name || !email || !password) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if email already registered in users
    const existingUser = await db.get("SELECT id FROM users WHERE LOWER(email) = ?", [cleanEmail]);
    if (existingUser) {
      return NextResponse.json({ success: false, message: "An account with this email is already registered." }, { status: 400 });
    }

    // Check if pending signup request exists
    const existingRequest = await db.get(
      "SELECT id FROM signup_requests WHERE LOWER(email) = ? AND status = 'pending'",
      [cleanEmail]
    );
    if (existingRequest) {
      return NextResponse.json({ success: false, message: "A signup request for this email is already pending approval." }, { status: 400 });
    }

    const id = "req_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
    await db.run(
      `INSERT INTO signup_requests (id, name, email, password_hash, requested_role, status, college_id, notes) 
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [id, name.trim(), cleanEmail, password, requested_role, college_id || null, notes || null]
    );

    return NextResponse.json({ success: true, message: "Signup request submitted successfully. Please wait for administrator approval." });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
