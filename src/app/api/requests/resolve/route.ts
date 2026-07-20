import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { debtorId, creditorId, subject, month, approverName } = body;

    if (!debtorId || !creditorId || !subject || !month) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    // 1. Fetch mentors to verify existence and get names
    const [debtor, creditor] = await Promise.all([
      db.get("SELECT name FROM mentors WHERE id = ?", debtorId),
      db.get("SELECT name FROM mentors WHERE id = ?", creditorId)
    ]);

    if (!debtor || !creditor) {
      return NextResponse.json({ success: false, message: "Debtor or Creditor mentor not found." }, { status: 404 });
    }

    // 2. Find a matching approved handover to get the correct slotId and dateStr
    const match = await db.get(`
      SELECT ah.slotId, ah.dateStr 
      FROM approved_handovers ah
      JOIN slots s ON s.id = ah.slotId
      WHERE ah.originalMentorId = ? AND ah.coverStaffId = ? AND s.course = ? AND ah.dateStr LIKE ?
      LIMIT 1
    `, debtorId, creditorId, subject, `${month}%`);

    let slotId = match?.slotId;
    let dateStr = match?.dateStr || `${month}-01`;

    if (!slotId) {
      // Fallback: search for any slot with this course
      const anySlot = await db.get("SELECT id FROM slots WHERE course = ? LIMIT 1", subject);
      slotId = anySlot?.id;
    }

    if (!slotId) {
      // Fallback: search for any slot assigned to the debtor/creditor
      const anyMentorSlot = await db.get("SELECT id FROM slots WHERE mentorId = ? OR mentorId = ? LIMIT 1", debtorId, creditorId);
      slotId = anyMentorSlot?.id || "resolved_slot";
    }

    const resolutionId = "h_res_" + Date.now();
    const requestId = "res_" + Date.now();

    // 3. Insert reversed approved handover (creditor is original, debtor is cover staff)
    await db.run(`
      INSERT INTO approved_handovers (id, requestId, slotId, dateStr, originalMentorId, coverStaffId, coverStaffName, course, ledger_month) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, resolutionId, requestId, slotId, dateStr, creditorId, debtorId, debtor.name, subject, month);

    // 4. Log in audit logs
    const logId = "l_" + Date.now();
    const logDesc = `CAM resolved past-month balance: ${debtor.name} compensated ${creditor.name} for subject "${subject}" in ${month}`;
    await db.run(
      "INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp) VALUES (?, 'handover_approval', ?, ?, 'CAM Resolution', ?)",
      logId,
      logDesc,
      approverName || "System / CAM",
      new Date().toISOString()
    );

    return NextResponse.json({ success: true, message: "Balance successfully resolved" });
  } catch (error: any) {
    console.error("API POST Resolve Request error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
