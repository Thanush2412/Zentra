import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

async function ensureTable(db: any) {
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS sme_availability (
        id TEXT PRIMARY KEY,
        sme_id TEXT NOT NULL,
        day_of_week TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        slot_type TEXT DEFAULT 'demo',
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
    try { await db.exec("ALTER TABLE sme_availability ADD COLUMN slot_type TEXT DEFAULT 'demo';"); } catch (_) {}

    const countRes = await db.get("SELECT COUNT(*) as count FROM sme_availability");
    if (!countRes || Number(countRes.count) === 0) {
      const smes = await db.all("SELECT id FROM sme_users");
      for (const s of smes) {
        for (const d of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]) {
          await db.run(
            "INSERT INTO sme_availability (id, sme_id, day_of_week, start_time, end_time, slot_type, is_active) VALUES (?, ?, ?, ?, ?, 'demo', 1)",
            [`sme_avail_${s.id}_${d.toLowerCase()}_1`, s.id, d, "09:00 AM", "05:30 PM"]
          ).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.error("Error in ensureTable for sme_availability:", err);
  }
}

export async function GET(req: NextRequest) {
  try {
    const db = await getDb();
    await ensureTable(db);
    const { searchParams } = new URL(req.url);
    const smeId = searchParams.get("smeId");
    const day = searchParams.get("day");
    const slotType = searchParams.get("slotType");

    let sql = "SELECT * FROM sme_availability WHERE 1=1";
    const params: any[] = [];

    if (smeId) {
      sql += " AND sme_id = ?";
      params.push(smeId);
    }
    if (day) {
      sql += " AND LOWER(day_of_week) = LOWER(?)";
      params.push(day);
    }
    if (slotType) {
      sql += " AND (slot_type = ? OR slot_type = 'both')";
      params.push(slotType);
    }

    sql += " ORDER BY day_of_week, start_time";
    const availability = await db.all(sql, ...params);

    return NextResponse.json({ success: true, availability });
  } catch (error: any) {
    console.error("Error fetching SME availability:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = await getDb();
    await ensureTable(db);
    const body = await req.json();
    const { smeId, windows, day } = body;

    if (!smeId) {
      return NextResponse.json({ success: false, error: "Missing smeId" }, { status: 400 });
    }

    // If a specific day is passed, clear that day's windows and re-insert
    if (day) {
      await db.run("DELETE FROM sme_availability WHERE sme_id = ? AND LOWER(day_of_week) = LOWER(?)", smeId, day);
      if (Array.isArray(windows)) {
        for (const w of windows) {
          if (w.startTime && w.endTime) {
            const id = w.id || `sme_avail_${smeId}_${day.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            const sType = w.slotType || w.slot_type || "demo";
            await db.run(
              "INSERT INTO sme_availability (id, sme_id, day_of_week, start_time, end_time, slot_type, is_active, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
              [id, smeId, day, w.startTime, w.endTime, sType, w.isActive !== undefined ? (w.isActive ? 1 : 0) : 1]
            );
          }
        }
      }
    } else if (Array.isArray(windows)) {
      // Bulk update: Clear all for this SME and re-insert
      await db.run("DELETE FROM sme_availability WHERE sme_id = ?", smeId);
      for (const w of windows) {
        if (w.day && w.startTime && w.endTime) {
          const id = w.id || `sme_avail_${smeId}_${w.day.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const sType = w.slotType || w.slot_type || "demo";
          await db.run(
            "INSERT INTO sme_availability (id, sme_id, day_of_week, start_time, end_time, slot_type, is_active, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
            [id, smeId, w.day, w.startTime, w.endTime, sType, w.isActive !== undefined ? (w.isActive ? 1 : 0) : 1]
          );
        }
      }
    }

    const updated = await db.all("SELECT * FROM sme_availability WHERE sme_id = ? ORDER BY day_of_week, start_time", smeId);
    return NextResponse.json({ success: true, availability: updated });
  } catch (error: any) {
    console.error("Error saving SME availability:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const smeId = searchParams.get("smeId");
    const day = searchParams.get("day");

    if (id) {
      await db.run("DELETE FROM sme_availability WHERE id = ?", id);
    } else if (smeId && day) {
      await db.run("DELETE FROM sme_availability WHERE sme_id = ? AND LOWER(day_of_week) = LOWER(?)", smeId, day);
    } else {
      return NextResponse.json({ success: false, error: "Missing id or smeId + day" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting SME availability window:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
