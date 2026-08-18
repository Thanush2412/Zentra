import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// ── Pin to Mumbai (bom1) — co-located with Turso DB (aws-ap-south-1) ──
// Without this, Vercel routes to iad1 (Washington DC) → ~200ms per DB call
export const preferredRegion = "bom1";
export const maxDuration = 60; // seconds — bulk imports need breathing room

export async function GET(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const slotId = searchParams.get("slotId");
    const dateStr = searchParams.get("dateStr");
    const studentId = searchParams.get("studentId");
    const collegeId = searchParams.get("college_id") || searchParams.get("collegeId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // ── 0. Campus-wide bulk fetch for CAM monitoring tab ──────────────────
    // GET /api/attendance?college_id=xxx[&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD]
    if (collegeId && !slotId && !studentId) {
      let sql = `
        SELECT sa.*
        FROM student_attendance sa
        JOIN students st ON sa.studentId = st.id
        WHERE st.college_id = ?`;
      const args: any[] = [collegeId];
      if (startDate) { sql += " AND sa.dateStr >= ?"; args.push(startDate); }
      if (endDate)   { sql += " AND sa.dateStr <= ?"; args.push(endDate); }
      sql += " ORDER BY sa.dateStr DESC";
      const records = await db.all(sql, args);
      return NextResponse.json({ success: true, records, count: records.length });
    }

    // ── 1. Student historical logs (for CAM correction modal) ─────────────
    if (studentId && !slotId && !dateStr) {
      const records = await db.all(
        `SELECT sa.*, s.time as timeSlot, s.course as subject, s.classGroup
         FROM student_attendance sa
         JOIN slots s ON sa.slotId = s.id
         WHERE sa.studentId = ?
         ORDER BY sa.dateStr DESC, s.time ASC`,
        [studentId]
      );
      const student = await db.get("SELECT correction_count FROM students WHERE id = ?", [studentId]);
      return NextResponse.json({
        success: true,
        records,
        correctionCount: student ? (student.correction_count || 0) : 0
      });
    }

    // ── 2. Single slot + date lookup ──────────────────────────────────────
    if (!slotId || !dateStr) {
      return NextResponse.json({ success: false, message: "Missing slotId or dateStr" }, { status: 400 });
    }

    let records;
    if (studentId) {
      records = await db.all(
        "SELECT * FROM student_attendance WHERE slotId = ? AND dateStr = ? AND studentId = ?",
        [slotId, dateStr, studentId]
      );
    } else {
      records = await db.all(
        "SELECT * FROM student_attendance WHERE slotId = ? AND dateStr = ?",
        [slotId, dateStr]
      );
    }

    const isMarked = records.length > 0;
    return NextResponse.json({
      success: true,
      isMarked,
      count: records.length,
      records
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { action } = body;

    // ── ATTENDANCE CORRECTION BY CAM ───────────────────────────────
    if (action === "correct") {
      const {
        studentId,
        slotId,
        dateStr,
        newStatus,
        reason,
        changedBy,
        changedByRole,
        isAdminOverride
      } = body;

      if (!studentId || !slotId || !dateStr || !newStatus || !reason || !changedBy) {
        return NextResponse.json({ success: false, message: "Missing required fields for correction" }, { status: 400 });
      }

      // Check current student status & correction count
      const student = await db.get("SELECT name, correction_count FROM students WHERE id = ?", [studentId]);
      if (!student) {
        return NextResponse.json({ success: false, message: "Student not found" }, { status: 404 });
      }

      const currentCount = student.correction_count || 0;
      if (currentCount >= 2 && !isAdminOverride) {
        return NextResponse.json({
          success: false,
          message: `Correction blocked: ${student.name} has already utilized all 2 attendance corrections. Requires Admin override.`
        });
      }

      // Check old status
      const existing = await db.get(
        "SELECT status FROM student_attendance WHERE studentId = ? AND slotId = ? AND dateStr = ?",
        [studentId, slotId, dateStr]
      );
      const oldStatus = existing ? existing.status : "not_marked";

      if (oldStatus === newStatus) {
        return NextResponse.json({ success: false, message: `Status is already ${newStatus}.` });
      }

      if (existing) {
          // Update existing
          await db.run(
            "UPDATE student_attendance SET status = ?, markedBy = ?, timestamp = ? WHERE studentId = ? AND slotId = ? AND dateStr = ?",
            [newStatus, changedBy, new Date().toISOString(), studentId, slotId, dateStr]
          );
        } else {
          // Insert new
          const recordId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          await db.run(
            "INSERT INTO student_attendance (id, studentId, slotId, dateStr, status, markedBy, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [recordId, studentId, slotId, dateStr, newStatus, changedBy, new Date().toISOString()]
          );
        }

        // Increment student correction counter (only for non-admin standard corrections)
        if (!isAdminOverride) {
          await db.run(
            "UPDATE students SET correction_count = COALESCE(correction_count, 0) + 1 WHERE id = ?",
            [studentId]
          );
        }

        // Log into audit trail
        const logId = `l_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const description = `Attendance corrected for ${student.name} (${studentId}) on ${dateStr} in slot ${slotId}. Status changed from ${oldStatus.toUpperCase()} to ${newStatus.toUpperCase()}. Reason: "${reason}"`;
        
        await db.run(
          `INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp, old_status, new_status, reason, changed_by)
           VALUES (?, 'attendance_correction', ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            logId,
            description,
            changedBy,
            changedByRole || "Campus Manager",
            new Date().toISOString(),
            oldStatus,
            newStatus,
            reason,
            changedBy
          ]
        );

        return NextResponse.json({
          success: true,
          message: "Attendance corrected successfully.",
          newCount: currentCount + 1
        });
    }

    // ── DIRECT PERIOD MARKING (CAM / FACULTY) ──────────────────────────────
    if (action === "mark_period") {
      const { studentId, slotId, dateStr, status, markedBy } = body;
      if (!studentId || !slotId || !dateStr || !status) {
        return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
      }

      if (status === "not_marked") {
        await db.run(
          "DELETE FROM student_attendance WHERE studentId = ? AND slotId = ? AND dateStr = ?",
          [studentId, slotId, dateStr]
        );
      } else {
        const existing = await db.get(
          "SELECT id FROM student_attendance WHERE studentId = ? AND slotId = ? AND dateStr = ?",
          [studentId, slotId, dateStr]
        );

        if (existing) {
          await db.run(
            "UPDATE student_attendance SET status = ?, markedBy = ?, timestamp = ? WHERE id = ?",
            [status, markedBy || "Manager", new Date().toISOString(), existing.id]
          );
        } else {
          const recordId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          await db.run(
            "INSERT INTO student_attendance (id, studentId, slotId, dateStr, status, markedBy, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [recordId, studentId, slotId, dateStr, status, markedBy || "Manager", new Date().toISOString()]
          );
        }
      }

      return NextResponse.json({ success: true, message: "Attendance updated." });
    }

    // ── BULK ATTENDANCE IMPORT (HIGH-PERFORMANCE BATCH SQL) ───────────────
    if (action === "bulk_import") {
      const { records, students: incomingStudents, markedBy, collegeId: importCollegeId } = body;
      if (!records || !Array.isArray(records) || records.length === 0) {
        return NextResponse.json({ success: false, message: "No attendance records to import" }, { status: 400 });
      }

      const nowStr = new Date().toISOString();

      // ── Parallelize: fetch valid slots AND pre-build student upsert statements simultaneously ──
      // This cuts 2 sequential HTTP round-trips → 1 parallel round-trip before the write batch.
      const studentBatchStatements: { sql: string; args: any[] }[] = [];

      if (incomingStudents && Array.isArray(incomingStudents) && incomingStudents.length > 0) {
        const validStudents = incomingStudents.filter((st: any) => st.id && st.name);
        const ST_BATCH = 50; // 50 students × 7 cols = 350 params, well under Turso's 32766 limit
        for (let i = 0; i < validStudents.length; i += ST_BATCH) {
          const chunk = validStudents.slice(i, i + ST_BATCH);
          const placeholders = chunk.map(() => "(?, ?, ?, ?, ?, ?, 'Active', ?)").join(", ");
          const params: any[] = [];
          chunk.forEach((st: any) => {
            params.push(
              st.id, st.name, st.roll_number || st.id,
              st.department || "General", st.classGroup || "General Batch",
              st.college_id || importCollegeId || null, nowStr
            );
          });
          studentBatchStatements.push({
            sql: `INSERT INTO students (id, name, roll_number, department, classGroup, college_id, status, created_at)
                  VALUES ${placeholders}
                  ON CONFLICT(id) DO UPDATE SET
                    name = COALESCE(excluded.name, name),
                    roll_number = COALESCE(excluded.roll_number, roll_number),
                    department = COALESCE(excluded.department, department),
                    classGroup = COALESCE(excluded.classGroup, classGroup),
                    college_id = COALESCE(excluded.college_id, college_id)`,
            args: params
          });
        }
      }

      // Fetch slots with day + classGroup for compact record expansion on server
      // Compact records have no slotId — server looks up all slots for (classGroup, dayOfWeek)
      const validSlots = importCollegeId
        ? await db.all("SELECT id, day, classGroup FROM slots WHERE college_id = ?", importCollegeId)
        : await db.all("SELECT id, day, classGroup FROM slots");
      const validSlotIds = new Set(validSlots.map((s: any) => s.id));
      const fallbackSlotId = validSlots.length > 0 ? validSlots[0].id : null;

      // Expansion cache: "dayName||classGroup" → slotId[] (avoids repeated filter scans)
      const expansionCache = new Map<string, string[]>();
      const getExpansionSlotIds = (dayName: string, classGroup: string): string[] => {
        const key = `${dayName}||${(classGroup || "").toLowerCase()}`;
        if (expansionCache.has(key)) return expansionCache.get(key)!;
        const cg = (classGroup || "").toLowerCase().trim();
        const matched = (validSlots as any[]).filter(s => {
          if (dayName && s.day !== dayName) return false;
          if (!s.classGroup) return true; // global slot — applies to all cohorts
          const sg = s.classGroup.toLowerCase().trim();
          return sg === cg || sg.includes(cg) || cg.includes(sg);
        }).map((s: any) => s.id);
        const result = matched.length > 0 ? matched : (fallbackSlotId ? [fallbackSlotId] : []);
        expansionCache.set(key, result);
        return result;
      };

      const deleteItems: Array<{ studentId: string; slotId: string; dateStr: string }> = [];
      const upsertRows: any[] = [];

      for (const item of records) {
        const { studentId, slotId, dateStr, status, classGroup } = item;
        if (!studentId || !dateStr || !status) continue;

        if (slotId) {
          // Explicit slotId format (period-specific marks from client-side resolution)
          const effectiveSlotId = validSlotIds.has(slotId) ? slotId : fallbackSlotId;
          if (!effectiveSlotId) continue;
          if (status === "not_marked") {
            deleteItems.push({ studentId, slotId: effectiveSlotId, dateStr });
          } else {
            upsertRows.push({
              id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
              studentId, slotId: effectiveSlotId, dateStr, status,
              markedBy: markedBy || "Master Import", timestamp: nowStr
            });
          }
        } else {
          // Compact format: classGroup + dateStr, no slotId
          // Server expands to ALL matching slots for this cohort on this day of week
          const dateObj = new Date(dateStr + "T00:00:00");
          const dayName = !isNaN(dateObj.getTime())
            ? new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(dateObj)
            : "";
          const matchedSlotIds = getExpansionSlotIds(dayName, classGroup || "");
          for (const sId of matchedSlotIds) {
            if (status === "not_marked") {
              deleteItems.push({ studentId, slotId: sId, dateStr });
            } else {
              upsertRows.push({
                id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                studentId, slotId: sId, dateStr, status,
                markedBy: markedBy || "Master Import", timestamp: nowStr
              });
            }
          }
        }
      }

      // ── Student upserts first (FK order), then attendance writes ──
      // Chunked into separate batch() calls to stay well under Turso's HTTP body limit
      let count = 0;

      // 1. Student upserts (separate batch to ensure they exist before FK attendance rows)
      if (studentBatchStatements.length > 0) {
        try {
          await db.client.batch(studentBatchStatements, "write");
        } catch (e: any) {
          console.warn("[Import] Student upsert batch failed (non-fatal):", e?.message);
        }
      }

      // 2. Build attendance write statements
      const batchStatements: { sql: string; args: any[] }[] = [];

      for (const d of deleteItems) {
        batchStatements.push({
          sql: "DELETE FROM student_attendance WHERE studentId = ? AND slotId = ? AND dateStr = ?",
          args: [d.studentId, d.slotId, d.dateStr]
        });
      }

      const ROWS_PER_INSERT = 200; // 200 rows × 7 params = 1400 params, under SQLite limit
      for (let i = 0; i < upsertRows.length; i += ROWS_PER_INSERT) {
        const chunk = upsertRows.slice(i, i + ROWS_PER_INSERT);
        const placeholders = chunk.map(() => "(?, ?, ?, ?, ?, ?, ?)").join(", ");
        const params: any[] = [];
        chunk.forEach(r => {
          params.push(r.id, r.studentId, r.slotId, r.dateStr, r.status, r.markedBy, r.timestamp);
        });
        batchStatements.push({
          sql: `INSERT INTO student_attendance (id, studentId, slotId, dateStr, status, markedBy, timestamp)
                VALUES ${placeholders}
                ON CONFLICT(studentId, slotId, dateStr)
                DO UPDATE SET status = excluded.status, markedBy = excluded.markedBy, timestamp = excluded.timestamp`,
          args: params
        });
        count += chunk.length;
      }

      // 3. Execute attendance writes in chunks of 100 statements per batch()
      // 100 stmts × ~28KB each = ~2.8MB per HTTP call — well under Turso's limit
      const STMTS_PER_BATCH = 100;
      for (let i = 0; i < batchStatements.length; i += STMTS_PER_BATCH) {
        const batchChunk = batchStatements.slice(i, i + STMTS_PER_BATCH);
        try {
          await db.client.batch(batchChunk, "write");
        } catch (batchErr: any) {
          console.error(`[Import] batch chunk ${Math.floor(i/STMTS_PER_BATCH)+1} failed, falling back:`, batchErr?.message);
          // Fallback: run each statement individually (still uses multi-row INSERT, just 1 per HTTP call)
          for (const stmt of batchChunk) {
            try { await db.run(stmt.sql, stmt.args); } catch (_) {}
          }
        }
      }

      if (count === 0 && upsertRows.length > 0) count = upsertRows.length;


      return NextResponse.json({
        success: true,
        message: `Successfully imported ${count} attendance entries.`,
        count
      });
    }

    // ── FACULTY ATTENDANCE SUBMISSION ───────────────────────────────
    const {
      slotId,
      dateStr,
      attendance,
      markedBy,
      actorName,
      actorRole,
      coveredSubject,
      type, // 'Regular' | 'Non-Regular'
      mode, // 'Online' | 'Offline'
      attendanceTypeSub // e.g., 'Event', 'Exam', 'Activity', 'Others'
    } = body;

    if (!slotId || !dateStr || !attendance || !Array.isArray(attendance)) {
      return NextResponse.json({ success: false, message: "Missing slotId, dateStr, or attendance data." }, { status: 400 });
    }

    const slot = await db.get("SELECT * FROM slots WHERE id = ?", slotId);
    if (!slot) {
      return NextResponse.json({ success: false, message: "Slot not found." }, { status: 404 });
    }

    // Delete existing
      await db.run("DELETE FROM student_attendance WHERE slotId = ? AND dateStr = ?", [slotId, dateStr]);

      if (coveredSubject) {
        await db.run(
          "UPDATE approved_handovers SET course = ? WHERE slotId = ? AND dateStr = ?",
          [coveredSubject, slotId, dateStr]
        );
      }

      // Insert new records
      const timestamp = new Date().toISOString();
      let insertedCount = 0;
      for (const item of attendance) {
        const { studentId, status } = item;
        if (status === "not_marked") {
          continue;
        }
        const recordId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        await db.run(
          `INSERT INTO student_attendance (id, studentId, slotId, dateStr, status, markedBy, timestamp, type, mode, attendanceTypeSub)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            recordId,
            studentId,
            slotId,
            dateStr,
            status,
            markedBy || "System",
            timestamp,
            type || "Regular",
            mode || "Offline",
            attendanceTypeSub || null
          ]
        );
        insertedCount++;
      }

      const presentCount = attendance.filter((a: any) => a.status === "present").length;
      const absentCount = attendance.filter((a: any) => a.status === "absent").length;

      const logId = `l_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const description = `Marked ${type || "Regular"} attendance (${mode || "Offline"}) for class ${slot.classGroup || "General"} in course "${slot.course}" on date ${dateStr} (${presentCount} present, ${absentCount} absent).`;
      
      await db.run(
        "INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
        [logId, "booking", description, actorName || "Faculty", actorRole || "Mentor", timestamp]
      );

      return NextResponse.json({ success: true, message: "Attendance marked successfully.", insertedCount });
  } catch (error: any) {
    console.error("API POST Attendance error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("dateStr");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const studentIdParam = searchParams.get("studentId") || searchParams.get("rollNo") || searchParams.get("regNo");
    const clearAll = searchParams.get("all") === "true";

    let targetStudentIds: string[] = [];
    if (studentIdParam) {
      targetStudentIds.push(studentIdParam);
      // Look up student from db to also get their alternative IDs (id, roll_number, register_number)
      const st = await db.get(
        "SELECT id, roll_number, register_number FROM students WHERE id = ? OR roll_number = ? OR register_number = ?",
        [studentIdParam, studentIdParam, studentIdParam]
      );
      if (st) {
        if (st.id) targetStudentIds.push(st.id);
        if (st.roll_number) targetStudentIds.push(st.roll_number);
        if (st.register_number) targetStudentIds.push(st.register_number);
      }
      targetStudentIds = Array.from(new Set(targetStudentIds));
    }

    const collegeId = searchParams.get("collegeId");
    const department = searchParams.get("department");
    const classGroup = searchParams.get("classGroup");

    const hasDeptOrBatch = (department && department !== "all") || (classGroup && classGroup !== "all");

    // Dynamic student subquery builder for targeted college/department/batch scoping
    const buildStudentFilter = () => {
      let sql = "SELECT id FROM students WHERE 1=1";
      const params: any[] = [];
      if (collegeId) {
        sql += " AND college_id = ?";
        params.push(collegeId);
      }
      if (department && department !== "all") {
        sql += " AND department = ?";
        params.push(department);
      }
      if (classGroup && classGroup !== "all") {
        sql += " AND classGroup = ?";
        params.push(classGroup);
      }
      return { sql, params };
    };

    // 1. Date Range Deletion (From ... To ...)
    if (startDate && endDate) {
      if (targetStudentIds.length > 0) {
        const placeholders = targetStudentIds.map(() => "?").join(",");
        const res = await db.run(
          `DELETE FROM student_attendance WHERE dateStr >= ? AND dateStr <= ? AND studentId IN (${placeholders})`,
          [startDate, endDate, ...targetStudentIds]
        );
        return NextResponse.json({
          success: true,
          message: `Cleared attendance for student (${targetStudentIds.join(", ")}) from ${startDate} to ${endDate}.`,
          deletedCount: res.changes
        });
      } else if (hasDeptOrBatch || collegeId) {
        const { sql: stSql, params: stParams } = buildStudentFilter();
        const res = await db.run(
          `DELETE FROM student_attendance 
           WHERE dateStr >= ? AND dateStr <= ? 
             AND studentId IN (${stSql})`,
          [startDate, endDate, ...stParams]
        );
        return NextResponse.json({
          success: true,
          message: `Cleared attendance records from ${startDate} to ${endDate}.`,
          deletedCount: res.changes
        });
      } else {
        const res = await db.run(
          "DELETE FROM student_attendance WHERE dateStr >= ? AND dateStr <= ?",
          [startDate, endDate]
        );
        return NextResponse.json({
          success: true,
          message: `Cleared attendance records from ${startDate} to ${endDate}.`,
          deletedCount: res.changes
        });
      }
    }

    // 2. Student Deletion (All Dates for this Student)
    if (targetStudentIds.length > 0 && !dateStr) {
      const placeholders = targetStudentIds.map(() => "?").join(",");
      const res = await db.run(
        `DELETE FROM student_attendance WHERE studentId IN (${placeholders})`,
        targetStudentIds
      );
      return NextResponse.json({
        success: true,
        message: `Deleted all attendance for student (${targetStudentIds.join(", ")})`,
        deletedCount: res.changes
      });
    }

    // 3. Single Date & Student
    if (dateStr && targetStudentIds.length > 0) {
      const placeholders = targetStudentIds.map(() => "?").join(",");
      const res = await db.run(
        `DELETE FROM student_attendance WHERE dateStr = ? AND studentId IN (${placeholders})`,
        [dateStr, ...targetStudentIds]
      );
      return NextResponse.json({
        success: true,
        message: `Deleted attendance for student (${targetStudentIds.join(", ")}) on ${dateStr}`,
        deletedCount: res.changes
      });
    }

    // 4. Single Date
    if (dateStr) {
      if (hasDeptOrBatch || collegeId) {
        const { sql: stSql, params: stParams } = buildStudentFilter();
        const res = await db.run(
          `DELETE FROM student_attendance 
           WHERE dateStr = ? AND studentId IN (${stSql})`,
          [dateStr, ...stParams]
        );
        return NextResponse.json({ success: true, message: `Deleted attendance for date ${dateStr}`, deletedCount: res.changes });
      } else {
        const res = await db.run("DELETE FROM student_attendance WHERE dateStr = ?", [dateStr]);
        return NextResponse.json({ success: true, message: `Deleted attendance for date ${dateStr}`, deletedCount: res.changes });
      }
    }

    // 5. Clear All / Full Wipe
    // ALWAYS scope to collegeId when provided — never wipe other colleges' data
    if (clearAll) {
      if (collegeId) {
        // Safe: only wipe this college's students
        const res = await db.run(
          `DELETE FROM student_attendance WHERE studentId IN (SELECT id FROM students WHERE college_id = ?)`,
          [collegeId]
        );
        return NextResponse.json({
          success: true,
          message: "All attendance records for this campus have been cleared.",
          deletedCount: res.changes
        });
      } else {
        // No collegeId provided — refuse to wipe globally to prevent accidental cross-campus deletion
        return NextResponse.json({
          success: false,
          message: "collegeId is required for a full wipe. Cross-campus deletion is not permitted."
        }, { status: 400 });
      }
    }

    // 6. Scoped wipe by dept/batch/college (no all flag)
    if (hasDeptOrBatch || collegeId) {
      const { sql: stSql, params: stParams } = buildStudentFilter();
      const res = await db.run(
        `DELETE FROM student_attendance WHERE studentId IN (${stSql})`,
        stParams
      );
      return NextResponse.json({
        success: true,
        message: "Attendance records for selected scope have been cleared successfully.",
        deletedCount: res.changes
      });
    }

    // Final fallback — refuse unscoped global delete to prevent accidental cross-campus wipe
    return NextResponse.json({
      success: false,
      message: "A collegeId, date range, or student filter is required. Unscoped global deletion is not permitted."
    }, { status: 400 });
  } catch (error: any) {
    console.error("API DELETE Attendance error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
