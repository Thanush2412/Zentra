import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { rows } = body;

    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    // Load all students and colleges to do matching/creation in memory
    const allStudents = await db.all("SELECT id, name, email, phone, college_id, register_number FROM students");
    const colleges = await db.all("SELECT id, name FROM colleges");
    
    let processedCount = 0;
    let skippedCount = 0;
    const skippedRows: any[] = [];

    // Clean dates & inputs
    const now = new Date().toISOString();
    const finalDueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Read counter for receipts
    const maxReceiptRow = await db.get("SELECT MAX(receipt_no) as maxR FROM fee_payments");
    let receiptNum = 100001;
    if (maxReceiptRow && maxReceiptRow.maxR) {
      const match = maxReceiptRow.maxR.match(/\d+/);
      if (match) {
        receiptNum = parseInt(match[0]) + 1;
      }
    }

    // Process rows sequentially
    for (const row of rows) {
      const rowEmail = (row.email || "").toLowerCase().trim();
      const rowName = (row.studentName || "").toUpperCase().trim();
      const rowPhone = String(row.phone || "").replace(/\D/g, "");
      const rowReg = String(row.registerNumber || "").trim();

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

      // If student is still not found, create new student and user account
      if (!student) {
        if (!row.studentName) {
          skippedCount++;
          skippedRows.push({ ...row, reason: "Missing student name in Excel row" });
          continue;
        }

        try {
          // 1. Resolve college_id from collegeName
          const rowCollege = String(row.collegeName || "").toLowerCase().trim();
          let collegeId = colleges[0]?.id || "Clg_sriAmaraavat";
          const matchedCol = colleges.find(c => 
            c.name.toLowerCase().includes(rowCollege) || 
            rowCollege.includes(c.name.toLowerCase())
          );
          if (matchedCol) {
            collegeId = matchedCol.id;
          }

          // 2. Generate safe unique email
          let email = rowEmail;
          if (!email || email.startsWith("@") || !email.includes("@")) {
            const cleanName = rowName.toLowerCase().replace(/[^a-z0-9]/g, "");
            email = `${cleanName}_${Math.floor(100 + Math.random() * 900)}@gmail.com`;
          }

          // Generate student ID
          const newStudentId = `student_bulk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
          const dept = row.t && String(row.t).toLowerCase().includes("fintec") ? "B. Com(Fintech)" : (row.year || "B. Com");
          const classGroup = `${dept} Year II`;

          // Insert into students table
          await db.run(
            `INSERT INTO students (id, name, email, classGroup, department, college_id, phone, register_number, password_hash, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [newStudentId, row.studentName, email, classGroup, dept, collegeId, row.phone || "", rowReg, "123456", now, now]
          );

          // Insert into users table
          await db.run(
            `INSERT INTO users (id, email, password_hash, role, reference_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [newStudentId, email, "123456", "student", newStudentId, now, now]
          );

          // Assign to student reference for subsequent fee insertion
          student = {
            id: newStudentId,
            name: row.studentName,
            email: email,
            phone: row.phone || "",
            college_id: collegeId,
            register_number: rowReg
          };
          
          // Push to matched list in-memory to prevent duplicate creations within same run
          allStudents.push(student);
        } catch (e: any) {
          skippedCount++;
          skippedRows.push({ ...row, reason: "Database creation error: " + e.message });
          continue;
        }
      }

      const amount = Number(row.amount) || 0; // College Fee Target
      const fpcPaid = Number(row.paid) || 0; // FPC Fee Paid
      const fpcPending = Number(row.pending) || 0; // FPC Fee Pending
      const fpcAmount = fpcPaid + fpcPending; // FPC Fee Target
      const feeStatus = fpcPaid >= fpcAmount ? 'paid' : fpcPaid > 0 ? 'partial' : 'unpaid';

      // Insert or Update student_fees
      const feeId = `fee_${student.id}_bulk_${Date.now().toString(36)}`;
      const rowTermName = row.semester 
        ? (row.semester.toLowerCase().includes("tuition") ? row.semester : `${row.semester} Tuition Fee`) 
        : "Semester I Tuition Fee";
      
      // Check if fee with same term already exists for student to update or insert
      const existingFee = await db.get(
        "SELECT id, amount, paid_amount, fpc_amount, fpc_pending FROM student_fees WHERE student_id = ? AND term_name = ?",
        [student.id, rowTermName]
      );

      if (existingFee) {
        // Update fee
        await db.run(
          "UPDATE student_fees SET amount = ?, paid_amount = ?, fpc_amount = ?, fpc_pending = ?, academic_year = ?, status = ?, pay_link = ?, updated_at = ? WHERE id = ?",
          [amount, fpcPaid, fpcAmount, fpcPending, row.year || null, feeStatus, row.payLink || null, now, existingFee.id]
        );

        // If new payments are specified, record payment transaction
        if (fpcPaid > (existingFee.paid_amount || 0)) {
          const extraPaid = fpcPaid - (existingFee.paid_amount || 0);
          const payId = `pay_${student.id}_bulk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,5)}`;
          const receiptNo = `RCPT-${receiptNum++}`;
          const refNo = `REF-BULK-${Date.now().toString(36).toUpperCase()}`;

          await db.run(
            `INSERT INTO fee_payments (id, fee_id, student_id, college_id, amount, payment_method, reference_no, receipt_no, payment_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [payId, existingFee.id, student.id, student.college_id, extraPaid, "online", refNo, receiptNo, now]
          );
        }
      } else {
        // Insert new fee
        await db.run(
          `INSERT INTO student_fees (id, student_id, college_id, term_name, amount, paid_amount, fpc_amount, fpc_pending, academic_year, due_date, status, pay_link, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [feeId, student.id, student.college_id, rowTermName, amount, fpcPaid, fpcAmount, fpcPending, row.year || null, finalDueDate, feeStatus, row.payLink || null, now, now]
        );

        // If paid, insert payment record
        if (fpcPaid > 0) {
          const payId = `pay_${student.id}_bulk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,5)}`;
          const receiptNo = `RCPT-${receiptNum++}`;
          const refNo = `REF-BULK-${Date.now().toString(36).toUpperCase()}`;

          await db.run(
            `INSERT INTO fee_payments (id, fee_id, student_id, college_id, amount, payment_method, reference_no, receipt_no, payment_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [payId, feeId, student.id, student.college_id, fpcPaid, "online", refNo, receiptNo, now]
          );
        }
      }

      processedCount++;
    }

    return NextResponse.json({
      success: true,
      processedCount,
      skippedCount,
      skippedRows,
      message: `Successfully processed ${processedCount} records. Skipped ${skippedCount} unknown students.`
    });
  } catch (error: any) {
    console.error("POST /api/fees/bulk error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
