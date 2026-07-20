import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = await getDb();
    const smes = await db.all("SELECT * FROM sme_users ORDER BY name ASC");
    return NextResponse.json({ success: true, smes });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { id, name, email, subject } = body;

    if (!id || !name || !email) {
      return NextResponse.json({ success: false, message: "Missing required fields: id, name, email" }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check unique constraints
    const existingSme = await db.get("SELECT id FROM sme_users WHERE id = ? OR LOWER(email) = ?", [id, cleanEmail]);
    if (existingSme) {
      return NextResponse.json({ success: false, message: "An SME with this ID or Email already exists." }, { status: 400 });
    }

    await db.run(
      "INSERT INTO sme_users (id, name, email, subject) VALUES (?, ?, ?, ?)",
      [id, name, cleanEmail, subject || null]
    );

    // Clean old credentials associated with this email
    await db.run("DELETE FROM users WHERE LOWER(email) = ?", cleanEmail);

    // Create corresponding entry in centralized users table
    const now = new Date().toISOString();
    await db.run(
      `INSERT INTO users (id, email, password_hash, role, reference_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, cleanEmail, "password123", "sme", id, "Active", now, now]
    );

    return NextResponse.json({ success: true, message: "SME created successfully." });
  } catch (error: any) {
    console.error("API POST SMEs error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { id, name, email, subject } = body;

    if (!id) {
      return NextResponse.json({ success: false, message: "Missing required field: id" }, { status: 400 });
    }

    const cleanEmail = email ? email.toLowerCase().trim() : null;

    if (name && cleanEmail) {
      // Full update
      await db.run(
        "UPDATE sme_users SET name = ?, email = ?, subject = ? WHERE id = ?",
        [name, cleanEmail, subject || null, id]
      );

      // Clean old credentials associated with this email (excluding current SME ID)
      await db.run("DELETE FROM users WHERE LOWER(email) = ? AND reference_id != ?", [cleanEmail, id]);

      // Create or update centralized users table entry
      const now = new Date().toISOString();
      await db.run(
        `INSERT OR REPLACE INTO users (id, email, password_hash, role, reference_id, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, cleanEmail, "password123", "sme", id, "Active", now, now]
      );
    } else {
      // Partial update (just group name mapping)
      await db.run(
        "UPDATE sme_users SET subject = ? WHERE id = ?",
        [subject || null, id]
      );
    }

    return NextResponse.json({ success: true, message: "SME updated successfully." });
  } catch (error: any) {
    console.error("API PUT SMEs error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, message: "Missing required field: id" }, { status: 400 });
    }

    // Delete from both users and sme_users
    await db.run("DELETE FROM users WHERE role = 'sme' AND reference_id = ?", id);
    await db.run("DELETE FROM sme_users WHERE id = ?", id);

    return NextResponse.json({ success: true, message: "SME deleted successfully." });
  } catch (error: any) {
    console.error("API DELETE SMEs error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
