import { TursoDbAdapter } from "./db";

export interface MentorAvailabilityParams {
  mentorId: string;
  dateStr: string; // "YYYY-MM-DD"
  dayOfWeek?: string; // "Monday", "Tuesday", etc.
  timeSlot?: string; // e.g. "09:00 AM - 10:00 AM" or "09.00 AM - 10.00 AM"
  shift?: string; // "shift_1", "shift_2", "general"
  excludeHandoverId?: string;
  excludeInterviewId?: string;
  excludeDemoSwapId?: string;
}

export interface MentorAvailabilityResult {
  available: boolean;
  reason?: string;
  busyType?: "leave" | "permission" | "od" | "slot" | "handover" | "interview" | "demo";
  details?: Record<string, any>;
}

export interface SmeAvailabilityParams {
  smeId: string;
  dateStr: string;
  timeSlot?: string;
  excludeDemoSwapId?: string;
}

export interface SmeAvailabilityResult {
  available: boolean;
  reason?: string;
  busyType?: "demo" | "leave" | "other";
  details?: Record<string, any>;
}

/**
 * Normalizes time string representations for comparisons.
 * Converts "09.00 AM" -> "09:00 AM"
 */
function normalizeTime(timeStr: string): string {
  return (timeStr || "").replace(/\./g, ":").trim().toUpperCase();
}

/**
 * Checks if a target time falls within or overlaps with a time range or slot.
 */
function isTimeSlotOverlap(slotTime1: string, slotTime2: string): boolean {
  if (!slotTime1 || !slotTime2) return true; // If one isn't specified, assume conflict
  const t1 = normalizeTime(slotTime1);
  const t2 = normalizeTime(slotTime2);
  if (t1 === t2) return true;

  // Partial match check (e.g. "09:00 AM" in "09:00 AM - 10:00 AM")
  if (t1.includes(t2) || t2.includes(t1)) return true;
  return false;
}

/**
 * Unified Availability Engine for Mentors.
 * Checks across:
 * 1. Approved Faculty Leaves & Permissions (faculty_leave_requests)
 * 2. Regular Teaching Timetable Slots (slots)
 * 3. Approved Handover Substitution Duties (approved_handovers)
 * 4. Scheduled Student Interview Panels (student_interviews & student_interview_slots)
 * 5. Scheduled Demo Evaluations & Demo Swaps (demo_swap_requests)
 */
export async function checkMentorAvailability(
  db: TursoDbAdapter,
  params: MentorAvailabilityParams
): Promise<MentorAvailabilityResult> {
  const { mentorId, dateStr, shift } = params;
  if (!mentorId || !dateStr) {
    return { available: false, reason: "Missing mentorId or dateStr" };
  }

  // Derive day of week if not supplied
  const dayOfWeek =
    params.dayOfWeek ||
    new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" });

  const timeSlot = params.timeSlot ? normalizeTime(params.timeSlot) : undefined;

  // ---------------------------------------------------------------------------
  // 1. Check Faculty Leaves & Permissions (faculty_leave_requests)
  // ---------------------------------------------------------------------------
  const activeLeave = await db.get(
    `SELECT id, request_type, leave_category, start_date, end_date, reason
     FROM faculty_leave_requests
     WHERE mentor_id = ?
       AND status = 'approved'
       AND ? >= start_date AND ? <= end_date`,
    [mentorId, dateStr, dateStr]
  );

  if (activeLeave) {
    const isPermission = activeLeave.request_type === "Permission";
    const isOD = activeLeave.request_type === "OD";
    const reqType = isPermission ? "permission" : isOD ? "od" : "leave";
    const label = isPermission ? "Permission" : isOD ? "On Duty (OD)" : "Approved Leave";

    return {
      available: false,
      busyType: reqType,
      reason: `Mentor is on ${label} (${activeLeave.leave_category || "General"}) from ${activeLeave.start_date} to ${activeLeave.end_date}.`,
      details: activeLeave
    };
  }

  // ---------------------------------------------------------------------------
  // 2. Check Regular Timetable Slots
  // ---------------------------------------------------------------------------
  if (timeSlot) {
    let slotQuery = `SELECT id, course, classGroup, day, time, shift FROM slots WHERE mentorId = ? AND LOWER(day) = LOWER(?)`;
    const slotParams: any[] = [mentorId, dayOfWeek];

    if (shift) {
      slotQuery += ` AND (shift = ? OR shift = 'general')`;
      slotParams.push(shift);
    }

    const mentorSlots = await db.all(slotQuery, slotParams);
    for (const slot of mentorSlots) {
      if (isTimeSlotOverlap(slot.time, timeSlot)) {
        // Check if this slot was handed over to someone else on this specific date
        const isHandedOver = await db.get(
          `SELECT id FROM approved_handovers WHERE slotId = ? AND dateStr = ? AND originalMentorId = ?`,
          [slot.id, dateStr, mentorId]
        );

        if (!isHandedOver) {
          return {
            available: false,
            busyType: "slot",
            reason: `Mentor has a scheduled class: "${slot.course}" (${slot.classGroup}) at ${slot.time}.`,
            details: slot
          };
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Check Approved Handover Substitution Duties
  // ---------------------------------------------------------------------------
  let handoverQuery = `
    SELECT ah.id, ah.slotId, ah.originalMentorId, ah.coverStaffId, ah.dateStr,
           s.course, s.classGroup, s.day, s.time, s.shift
    FROM approved_handovers ah
    JOIN slots s ON s.id = ah.slotId
    WHERE ah.coverStaffId = ? AND ah.dateStr = ?
  `;
  const handoverParams: any[] = [mentorId, dateStr];
  if (params.excludeHandoverId) {
    handoverQuery += ` AND ah.id != ?`;
    handoverParams.push(params.excludeHandoverId);
  }

  const coveringHandovers = await db.all(handoverQuery, handoverParams);
  for (const h of coveringHandovers) {
    if (!timeSlot || isTimeSlotOverlap(h.time, timeSlot)) {
      return {
        available: false,
        busyType: "handover",
        reason: `Mentor is already covering a substitution class: "${h.course}" (${h.classGroup}) at ${h.time}.`,
        details: h
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Check Scheduled Student Interview Panels
  // ---------------------------------------------------------------------------
  const interviewSlots = await db.all(
    `SELECT sis.id, sis.interview_id, sis.slot_start_time, sis.slot_end_time, si.subject, si.target_date
     FROM student_interview_slots sis
     JOIN student_interviews si ON si.id = sis.interview_id
     WHERE sis.mentor_id = ? AND si.target_date = ? AND sis.status != 'cancelled'`,
    [mentorId, dateStr]
  );

  for (const islot of interviewSlots) {
    const islotTime = `${islot.slot_start_time} - ${islot.slot_end_time}`;
    if (!timeSlot || isTimeSlotOverlap(islotTime, timeSlot)) {
      return {
        available: false,
        busyType: "interview",
        reason: `Mentor is assigned to a Student Interview panel (${islot.subject}) at ${islotTime}.`,
        details: islot
      };
    }
  }

  // Also check assigned_mentor_ids in student_interviews
  const directInterviews = await db.all(
    `SELECT id, subject, target_date, preferred_start_time, assigned_mentor_ids, status
     FROM student_interviews
     WHERE target_date = ? AND status IN ('assigned', 'capacity_partially_accepted', 'scheduled')`,
    [dateStr]
  );

  for (const di of directInterviews) {
    if (params.excludeInterviewId && di.id === params.excludeInterviewId) continue;
    try {
      const ids: string[] = di.assigned_mentor_ids ? JSON.parse(di.assigned_mentor_ids) : [];
      if (ids.includes(mentorId)) {
        const diTime = di.preferred_start_time || "09:00 AM";
        if (!timeSlot || isTimeSlotOverlap(diTime, timeSlot)) {
          return {
            available: false,
            busyType: "interview",
            reason: `Mentor is allocated to an active Interview panel for "${di.subject}".`,
            details: di
          };
        }
      }
    } catch (_) {}
  }

  // ---------------------------------------------------------------------------
  // 5. Check Scheduled Demo Evaluations & Demo Swaps
  // ---------------------------------------------------------------------------
  let demoQuery = `
    SELECT id, sessionId, subject, stream, dateStr, timeSlot, status, proposedMentorId, proposedDateStr, proposedTimeSlot
    FROM demo_swap_requests
    WHERE status IN ('pending', 'pending_peer', 'pending_sme', 'approved')
      AND (
        (mentorId = ? AND dateStr = ?) OR
        (proposedMentorId = ? AND proposedDateStr = ?)
      )
  `;
  const demoParams: any[] = [mentorId, dateStr, mentorId, dateStr];
  if (params.excludeDemoSwapId) {
    demoQuery += ` AND id != ?`;
    demoParams.push(params.excludeDemoSwapId);
  }

  const activeDemos = await db.all(demoQuery, demoParams);
  for (const demo of activeDemos) {
    const dTime = (demo.proposedMentorId === mentorId && demo.proposedTimeSlot) ? demo.proposedTimeSlot : demo.timeSlot;
    if (!timeSlot || isTimeSlotOverlap(dTime, timeSlot)) {
      return {
        available: false,
        busyType: "demo",
        reason: `Mentor is engaged in a Demo Session (${demo.subject}) at ${dTime}.`,
        details: demo
      };
    }
  }

  return { available: true };
}

/**
 * Availability Engine for SMEs (Subject Matter Experts).
 * Checks:
 * 1. Demo Swap commitments & active demo evaluation sessions.
 */
export async function checkSmeAvailability(
  db: TursoDbAdapter,
  params: SmeAvailabilityParams
): Promise<SmeAvailabilityResult> {
  const { smeId, dateStr, timeSlot } = params;
  if (!smeId || !dateStr) {
    return { available: false, reason: "Missing smeId or dateStr" };
  }

  let demoQuery = `
    SELECT id, sessionId, subject, stream, dateStr, timeSlot, status, proposedSmeId, proposedDateStr, proposedTimeSlot
    FROM demo_swap_requests
    WHERE status IN ('pending', 'pending_peer', 'pending_sme', 'approved')
      AND (
        (smeId = ? AND dateStr = ?) OR
        (proposedSmeId = ? AND proposedDateStr = ?)
      )
  `;
  const demoParams: any[] = [smeId, dateStr, smeId, dateStr];
  if (params.excludeDemoSwapId) {
    demoQuery += ` AND id != ?`;
    demoParams.push(params.excludeDemoSwapId);
  }

  const activeDemos = await db.all(demoQuery, demoParams);
  for (const demo of activeDemos) {
    const dTime = (demo.proposedSmeId === smeId && demo.proposedTimeSlot) ? demo.proposedTimeSlot : demo.timeSlot;
    if (!timeSlot || isTimeSlotOverlap(dTime, timeSlot)) {
      return {
        available: false,
        busyType: "demo",
        reason: `SME is scheduled for Demo Evaluation (${demo.subject}) at ${dTime}.`,
        details: demo
      };
    }
  }

  return { available: true };
}
