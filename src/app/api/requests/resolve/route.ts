export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb, type QueryFailure } from "@/lib/db";
import { requireAuth } from "@/lib/authGuard";
import { generateId } from "@/lib/id";

export async function POST(request: Request) {
  try {
    const { errorResponse } = await requireAuth(request, { allowedRoles: ["cm", "kam", "admin"] });
    if (errorResponse) return errorResponse;
    const db = await getDb();
    const body = await request.json();
    const { debtorId, creditorId, subject, month, approverName } = body;

    if (!debtorId || !creditorId || !subject || !month) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    // 1+2. The mentor lookups and the handover match all key off the body, so one
    // round trip answers all three. A failed mentor read must not read as "not found".
    const resolveFailures: QueryFailure[] = [];
    const [debtorRows, creditorRows, matchRows] = await db.multiQuery([
      { sql: "SELECT name FROM mentors WHERE id = ?", params: [debtorId] },
      { sql: "SELECT name FROM mentors WHERE id = ?", params: [creditorId] },
      {
        sql: `SELECT ah.slotId, ah.dateStr
      FROM approved_handovers ah
      JOIN slots s ON s.id = ah.slotId
      WHERE ah.originalMentorId = ? AND ah.coverStaffId = ? AND s.course = ? AND ah.dateStr LIKE ?
      LIMIT 1`,
        params: [debtorId, creditorId, subject, `${month}%`],
      },
    ], resolveFailures);
    if (resolveFailures.length > 0) {
      return NextResponse.json({ success: false, message: "Could not verify this resolution. Please try again." }, { status: 500 });
    }
    const debtor = debtorRows[0];
    const creditor = creditorRows[0];
    const match = matchRows[0];

    if (!debtor || !creditor) {
      return NextResponse.json({ success: false, message: "Debtor or Creditor mentor not found." }, { status: 404 });
    }

    let slotId = match?.slotId;
    let dateStr = match?.dateStr || `${month}-01`;

    if (!slotId) {
      // Both fallbacks key off the body and only their preference order makes them a
      // chain, so one round trip answers both. The slotId feeds the ledger INSERT.
      const slotFallbackFailures: QueryFailure[] = [];
      const [courseSlots, mentorSlots] = await db.multiQuery([
        { sql: "SELECT id FROM slots WHERE course = ? LIMIT 1", params: [subject] },
        { sql: "SELECT id FROM slots WHERE mentorId = ? OR mentorId = ? LIMIT 1", params: [debtorId, creditorId] },
      ], slotFallbackFailures);
      if (slotFallbackFailures.length > 0) {
        return NextResponse.json({ success: false, message: "Could not locate a slot for this resolution. Please try again." }, { status: 500 });
      }
      slotId = courseSlots[0]?.id || mentorSlots[0]?.id || "resolved_slot";
    }

    const resolutionId = generateId("h_res");
    const requestId = generateId("res");
    const logId = generateId("log");

    // The compensation row and its audit entry are one act: separated, a failure on
    // the second left a ledger that had been settled with no trail proving it.
    await db.transaction(async (tx) => {
      await tx.run(
        `INSERT INTO approved_handovers (id, requestId, slotId, dateStr, originalMentorId, coverStaffId, coverStaffName, course, ledger_month) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [resolutionId, requestId, slotId, dateStr, creditorId, debtorId, debtor.name, subject, month]
      );

      const logDesc = `CAM resolved past-month balance: ${debtor.name} compensated ${creditor.name} for subject "${subject}" in ${month}`;
      await tx.run(
        "INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp) VALUES (?, 'handover_approval', ?, ?, 'CAM Resolution', ?)",
        [logId, logDesc, approverName || "System / CAM", new Date().toISOString()]
      );
    });

    return NextResponse.json({ success: true, message: "Balance successfully resolved" });
  } catch (error: any) {
    console.error("API POST Resolve Request error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
