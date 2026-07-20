import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// GET /api/fees?role=fee_manager
// GET /api/fees?role=cam&camId=Cam1
// GET /api/fees?role=student&studentId=student_fin_01
export async function GET(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role");
    const camId = searchParams.get("camId");
    const studentId = searchParams.get("studentId");
    const fromDate = searchParams.get("from");
    const toDate = searchParams.get("to");

    let dateFilterFees = "";
    let dateFilterPayments = "";
    const dateParams: string[] = [];

    if (fromDate) {
      dateFilterFees += " AND created_at >= ?";
      dateFilterPayments += " AND payment_date >= ?";
      dateParams.push(fromDate);
    }
    if (toDate) {
      dateFilterFees += " AND created_at <= ?";
      dateFilterPayments += " AND payment_date <= ?";
      // append 23:59:59 to include the whole day if toDate is just YYYY-MM-DD
      dateParams.push(toDate.includes("T") ? toDate : `${toDate}T23:59:59.999Z`);
    }

    if (role === "fee_manager") {
      // Full cross-college data
      const colleges = await db.all("SELECT * FROM colleges ORDER BY name");
      const students = await db.all("SELECT id, name, email, classGroup, department, college_id, register_number, phone, batch_start_year, batch_end_year, semester FROM students ORDER BY name");
      const fees = await db.all(`SELECT * FROM student_fees WHERE 1=1 ${dateFilterFees} ORDER BY created_at DESC`, ...dateParams);
      const payments = await db.all(`SELECT * FROM fee_payments WHERE 1=1 ${dateFilterPayments} ORDER BY payment_date DESC`, ...dateParams);
      const cams = await db.all("SELECT cm.*, c.name as college_name FROM campus_managers cm JOIN colleges c ON cm.college_id = c.id");

      // Aggregate stats
      const totalFees = fees.reduce((s: number, f: any) => s + f.amount, 0);
      const totalPaid = fees.reduce((s: number, f: any) => s + f.paid_amount, 0);
      const totalOutstanding = totalFees - totalPaid;
      const paidCount = fees.filter((f: any) => f.status === 'paid').length;
      const partialCount = fees.filter((f: any) => f.status === 'partial').length;
      const unpaidCount = fees.filter((f: any) => f.status === 'unpaid').length;

      return NextResponse.json({
        success: true,
        colleges, students, fees, payments, cams,
        stats: { totalFees, totalPaid, totalOutstanding, paidCount, partialCount, unpaidCount, totalStudents: students.length }
      });
    }

    if (role === "cam" && camId) {
      const cam = await db.get("SELECT * FROM campus_managers WHERE id = ?", camId);
      if (!cam) return NextResponse.json({ success: false, message: "CAM not found" }, { status: 404 });

      const collegeId = cam.college_id;
      const students = await db.all(
        "SELECT id, name, email, classGroup, department, batch_start_year, batch_end_year, semester FROM students WHERE college_id = ? ORDER BY name",
        collegeId
      );
      const studentIds = students.map((s: any) => s.id);

      let fees: any[] = [];
      let payments: any[] = [];
      if (studentIds.length > 0) {
        const ph = studentIds.map(() => "?").join(",");
        fees = await db.all(`SELECT * FROM student_fees WHERE student_id IN (${ph}) ${dateFilterFees} ORDER BY created_at DESC`, ...studentIds, ...dateParams);
        payments = await db.all(`SELECT * FROM fee_payments WHERE student_id IN (${ph}) ${dateFilterPayments} ORDER BY payment_date DESC`, ...studentIds, ...dateParams);
      }

      const totalFees = fees.reduce((s: number, f: any) => s + f.amount, 0);
      const totalPaid = fees.reduce((s: number, f: any) => s + f.paid_amount, 0);
      const paidCount = fees.filter((f: any) => f.status === 'paid').length;
      const partialCount = fees.filter((f: any) => f.status === 'partial').length;
      const unpaidCount = fees.filter((f: any) => f.status === 'unpaid').length;

      return NextResponse.json({
        success: true,
        collegeId,
        students, fees, payments,
        stats: {
          totalFees, totalPaid,
          totalOutstanding: totalFees - totalPaid,
          paidCount, partialCount, unpaidCount,
          totalStudents: students.length,
          collectionRate: totalFees > 0 ? Math.round((totalPaid / totalFees) * 100) : 0
        }
      });
    }

    if (role === "student" && studentId) {
      const student = await db.get("SELECT * FROM students WHERE id = ?", studentId);
      if (!student) return NextResponse.json({ success: false, message: "Student not found" }, { status: 404 });

      const fees = await db.all(`SELECT * FROM student_fees WHERE student_id = ? ${dateFilterFees} ORDER BY created_at DESC`, studentId, ...dateParams);
      const payments = await db.all(`SELECT * FROM fee_payments WHERE student_id = ? ${dateFilterPayments} ORDER BY payment_date DESC`, studentId, ...dateParams);

      const totalFees = fees.reduce((s: number, f: any) => s + f.amount, 0);
      const totalPaid = fees.reduce((s: number, f: any) => s + f.paid_amount, 0);

      return NextResponse.json({
        success: true,
        student: { id: student.id, name: student.name, email: student.email, classGroup: student.classGroup, department: student.department, batch_start_year: student.batch_start_year, batch_end_year: student.batch_end_year, semester: student.semester },
        fees, payments,
        stats: {
          totalFees, totalPaid,
          totalOutstanding: totalFees - totalPaid,
          paidCount: fees.filter((f: any) => f.status === 'paid').length,
          partialCount: fees.filter((f: any) => f.status === 'partial').length,
          unpaidCount: fees.filter((f: any) => f.status === 'unpaid').length
        }
      });
    }

    return NextResponse.json({ success: false, message: "Invalid role or missing parameters" }, { status: 400 });
  } catch (error: any) {
    console.error("GET /api/fees error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/fees — Process a payment or update a fee directly
export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { feeId, studentId, amount, paymentMethod, referenceNo, isDirectUpdate, paidAmount, status } = body;

    if (!feeId || !studentId) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    const fee = await db.get("SELECT * FROM student_fees WHERE id = ?", feeId);
    if (!fee) return NextResponse.json({ success: false, message: "Fee record not found" }, { status: 404 });

    const now = new Date().toISOString();

    if (isDirectUpdate) {
      const targetPaid = Number(paidAmount);
      const targetStatus = status || (targetPaid >= fee.amount ? 'paid' : targetPaid > 0 ? 'partial' : 'unpaid');

      await db.run(
        "UPDATE student_fees SET paid_amount = ?, status = ?, updated_at = ? WHERE id = ?",
        [targetPaid, targetStatus, now, feeId]
      );

      const diff = targetPaid - fee.paid_amount;
      if (diff !== 0) {
        const payId = "pay_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
        const receiptNo = "RCP" + Date.now().toString().slice(-6);
        const refNo = referenceNo || "MANUAL_ADJ";
        const method = "Manual Adjustment";

        await db.run(
          `INSERT INTO fee_payments (id, fee_id, student_id, college_id, amount, payment_method, reference_no, receipt_no, payment_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [payId, feeId, studentId, fee.college_id, diff, method, refNo, receiptNo, now]
        );
      }

      return NextResponse.json({
        success: true,
        message: "Fee record updated successfully",
        newStatus: targetStatus,
        newPaidAmount: targetPaid
      });
    } else {
      // Standard transaction pathway
      const method = paymentMethod || "manual";
      const payAmount = Number(amount);
      const newPaid = Math.min(fee.paid_amount + payAmount, fee.amount);
      const newStatus = newPaid >= fee.amount ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';

      await db.run(
        "UPDATE student_fees SET paid_amount = ?, status = ?, updated_at = ? WHERE id = ?",
        [newPaid, newStatus, now, feeId]
      );

      const payId = "pay_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
      const receiptNo = "RCP" + Date.now().toString().slice(-6);
      const refNo = referenceNo || ("REF" + Date.now().toString(36).toUpperCase());

      await db.run(
        `INSERT INTO fee_payments (id, fee_id, student_id, college_id, amount, payment_method, reference_no, receipt_no, payment_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [payId, feeId, studentId, fee.college_id, payAmount, method, refNo, receiptNo, now]
      );

      return NextResponse.json({
        success: true,
        message: "Payment recorded successfully",
        receiptNo,
        newStatus,
        newPaidAmount: newPaid
      });
    }
  } catch (error: any) {
    console.error("POST /api/fees error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
