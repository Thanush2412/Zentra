export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb, chunkList, inPlaceholders } from "@/lib/db";
import { requireAuth } from "@/lib/authGuard";
import { generateId } from "@/lib/id";
import { getInstitutionDateStrOffset } from "@/lib/localDate";

export async function POST(request: Request) {
  try {
    const { errorResponse } = await requireAuth(request, {
      allowedRoles: ["fee_manager", "admin"]
    });
    if (errorResponse) return errorResponse;

    const db = await getDb();
    const body = await request.json();
    const { rows } = body;

    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    let processedCount = 0;
    let skippedCount = 0;
    const skippedRows: any[] = [];

    const now = new Date().toISOString();
    const finalDueDate = getInstitutionDateStrOffset(30);

    await db.transaction(async (tx) => {
      // Load all students and colleges to do matching in memory
      const allStudents = await tx.all("SELECT id, name, email, phone, college_id, register_number FROM students");

      // Read counter for receipts
      // Quoted alias: Postgres folds bare identifiers to lowercase, so `as maxR` would
      // arrive as `maxr` and the counter would silently restart at 100001 every import.
      const maxReceiptRow = await tx.get('SELECT MAX(receipt_no) as "maxR" FROM fee_payments');
      let receiptNum = 100001;
      if (maxReceiptRow && maxReceiptRow.maxR) {
        const match = String(maxReceiptRow.maxR).match(/\d+/);
        if (match) {
          receiptNum = parseInt(match[0]) + 1;
        }
      }

      // Pass 1: resolve every row to a student without touching the database.
      // A per-row SELECT inside the transaction was ~2 round trips per accepted
      // row (~400 for a 200-row sheet), which spent most of maxDuration before
      // anything was written.
      const resolved: Array<{
        row: any;
        student: any;
        termName: string;
        amount: number;
        fpcPaid: number;
        fpcAmount: number;
        fpcPending: number;
        feeStatus: string;
      }> = [];

      for (const row of rows) {
        const rowEmail = (row.email || "").toLowerCase().trim();
        const rowName = (row.studentName || "").toUpperCase().trim();
        const rowPhone = String(row.phone || "").replace(/\D/g, "");
        let rowReg = String(row.registerNumber || "").trim();
        if (rowEmail && rowReg.toLowerCase() === rowEmail.split("@")[0].toLowerCase()) {
          rowReg = "";
        }

        // Find student
        let student = null;

        // 1. Match by Registration Number if provided
        if (rowReg) {
          student = allStudents.find(s => s.register_number && String(s.register_number).trim() === rowReg);
        }

        // 2. Match by email
        if (!student) {
          student = allStudents.find(s => {
            const dbEmail = (s.email || "").toLowerCase().trim();
            if (rowEmail && dbEmail === rowEmail) return true;
            if (rowEmail && rowEmail.includes('@') && dbEmail.startsWith(rowEmail.split('@')[0] + '@')) return true;
            return false;
          });
        }

        // 3. Fallback to name match
        if (!student) {
          student = allStudents.find(s => {
            const dbName = (s.name || "").toUpperCase().trim();
            return dbName === rowName;
          });
        }

        // 4. Fallback to phone match
        if (!student && rowPhone) {
          student = allStudents.find(s => {
            const dbPhone = String(s.phone || "").replace(/\D/g, "");
            return dbPhone === rowPhone || (rowPhone.length >= 10 && dbPhone.endsWith(rowPhone.slice(-10)));
          });
        }

        // Imports must never mint login accounts from a spreadsheet — unknown rows are reported back.
        if (!student) {
          skippedCount++;
          skippedRows.push({
            ...row,
            reason: row.studentName
              ? `No matching student record for "${row.studentName}". Add the student first, then re-import.`
              : "Missing student name and no matching student record."
          });
          continue;
        }

        const amount = Number(row.amount) || 0; // College Fee Target
        const fpcPaid = Number(row.paid) || 0; // FPC Fee Paid
        const fpcPending = Number(row.pending) || 0; // FPC Fee Pending
        const fpcAmount = fpcPaid + fpcPending; // FPC Fee Target
        const feeStatus = fpcPaid >= fpcAmount ? 'paid' : fpcPaid > 0 ? 'partial' : 'unpaid';
        const rowTermName = row.semester
          ? (row.semester.toLowerCase().includes("tuition") ? row.semester : `${row.semester} Tuition Fee`)
          : "Semester I Tuition Fee";

        resolved.push({ row, student, termName: rowTermName, amount, fpcPaid, fpcAmount, fpcPending, feeStatus });
      }

      if (resolved.length === 0) return;

      // Pass 2: prefetch the fee rows this upload can update.
      type FeeKey = string;
      const feeByKey = new Map<FeeKey, any>();
      const studentIds = Array.from(new Set(resolved.map(r => r.student.id)));
      for (const chunk of chunkList(studentIds, 400)) {
        const fees = await tx.all(
          `SELECT id, student_id, term_name, paid_amount FROM student_fees WHERE student_id IN (${inPlaceholders(chunk.length)})`,
          chunk
        );
        for (const f of fees) feeByKey.set(`${f.student_id}|${f.term_name}`, f);
      }

      const feeInserts: any[][] = [];
      const feeUpdates = new Map<string, any[]>();
      const paymentInserts: any[][] = [];

      for (const r of resolved) {
        const { row, student, termName, amount, fpcPaid, fpcAmount, fpcPending, feeStatus } = r;
        const key = `${student.id}|${termName}`;
        const existing = feeByKey.get(key);

        if (existing) {
          const previousPaid = Number(existing.paid_amount) || 0;
          // If new payments are specified, record payment transaction
          if (fpcPaid > previousPaid) {
            const extraPaid = fpcPaid - previousPaid;
            paymentInserts.push([
              generateId(`pay_${student.id}_bulk`), existing.id, student.id, student.college_id,
              extraPaid, "online", `REF-BULK-${generateId("r")}`, `RCPT-${receiptNum++}`, now
            ]);
          }
          // One student can appear twice on one sheet; the map entry carries the
          // merged state forward so the second row does not re-book the same money.
          existing.paid_amount = fpcPaid;
          feeUpdates.set(existing.id, [
            existing.id, amount, fpcPaid, fpcAmount, fpcPending,
            row.year || null, feeStatus, row.payLink || null, now
          ]);
        } else {
          // One student can appear on several rows of the same upload; a clock-only
          // suffix gave them all the same primary key and rolled the whole batch back.
          const feeId = `fee_${student.id}_${generateId("bulk")}`;
          feeInserts.push([
            feeId, student.id, student.college_id, termName, amount, fpcPaid, fpcAmount,
            fpcPending, row.year || null, finalDueDate, feeStatus, row.payLink || null, now, now
          ]);
          if (fpcPaid > 0) {
            paymentInserts.push([
              generateId(`pay_${student.id}_bulk`), feeId, student.id, student.college_id,
              fpcPaid, "online", `REF-BULK-${generateId("r")}`, `RCPT-${receiptNum++}`, now
            ]);
          }
          feeByKey.set(key, { id: feeId, paid_amount: fpcPaid });
        }

        processedCount++;
      }

      // Rows are independent statements batched into one round trip per chunk.
      for (const chunk of chunkList(feeInserts, 100)) {
        const placeholders = chunk.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
        await tx.run(
          `INSERT INTO student_fees (id, student_id, college_id, term_name, amount, paid_amount, fpc_amount, fpc_pending, academic_year, due_date, status, pay_link, created_at, updated_at)
           VALUES ${placeholders}`,
          chunk.flat()
        );
      }

      const updates = Array.from(feeUpdates.values());
      for (const chunk of chunkList(updates, 100)) {
        const values = chunk
          .map(() => "(?::varchar, ?::numeric, ?::numeric, ?::numeric, ?::numeric, ?::varchar, ?::varchar, ?::text, ?::timestamp)")
          .join(", ");
        await tx.run(
          `UPDATE student_fees AS f
           SET amount = v.amount, paid_amount = v.paid_amount, fpc_amount = v.fpc_amount,
               fpc_pending = v.fpc_pending, academic_year = v.academic_year, status = v.status,
               pay_link = v.pay_link, updated_at = v.updated_at
           FROM (VALUES ${values}) AS v(id, amount, paid_amount, fpc_amount, fpc_pending, academic_year, status, pay_link, updated_at)
           WHERE f.id = v.id`,
          chunk.flat()
        );
      }

      for (const chunk of chunkList(paymentInserts, 200)) {
        const placeholders = chunk.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
        await tx.run(
          `INSERT INTO fee_payments (id, fee_id, student_id, college_id, amount, payment_method, reference_no, receipt_no, payment_date)
           VALUES ${placeholders}`,
          chunk.flat()
        );
      }
    });

    return NextResponse.json({
      success: true,
      processedCount,
      skippedCount,
      skippedRows,
      message: `Successfully processed ${processedCount} records. Skipped ${skippedCount} rows (unknown or invalid students).`
    });
  } catch (error: any) {
    console.error("POST /api/fees/bulk error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
