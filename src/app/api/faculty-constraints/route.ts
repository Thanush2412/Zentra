import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = await getDb();
    const rows = await db.all("SELECT * FROM faculty_configs");
    
    const workloadLimits: { [key: string]: number } = {};
    const shifts: { [key: string]: string } = {};

    for (const row of rows) {
      workloadLimits[row.mentor_id] = row.max_hours;
      shifts[row.mentor_id] = row.shift;
    }

    return NextResponse.json({ success: true, workloadLimits, shifts });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { mentorId, maxHours, shift } = body;

    if (!mentorId) {
      return NextResponse.json({ success: false, message: "Missing mentorId" }, { status: 400 });
    }

    // Get current record if exists
    const existing = await db.get("SELECT * FROM faculty_configs WHERE mentor_id = ?", [mentorId]);
    
    const updatedMaxHours = maxHours !== undefined ? Number(maxHours) : (existing ? existing.max_hours : 16);
    const updatedShift = shift !== undefined ? shift : (existing ? existing.shift : "general");

    await db.run(
      "INSERT OR REPLACE INTO faculty_configs (mentor_id, max_hours, shift) VALUES (?, ?, ?)",
      [mentorId, updatedMaxHours, updatedShift]
    );

    return NextResponse.json({ 
      success: true, 
      message: "Faculty config updated successfully", 
      config: { mentorId, maxHours: updatedMaxHours, shift: updatedShift } 
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
