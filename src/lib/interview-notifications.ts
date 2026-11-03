import { after } from "next/server";
import { getDb, readInChunks, chunkList, type QueryFailure } from "@/lib/db";
import { renderEmailShell, BadgeColor } from "@/lib/mail";
import { dispatchMail } from "@/lib/mailAsync";
import { generateId } from "@/lib/id";

interface ExternalInterviewNotificationOptions {
  interviewId: string;
  subject: string;
  classGroup?: string;
  targetDate: string;
  type: string;
  topics?: string;
  studentCount?: number;
  mentorName?: string;
  originCollegeId: string;
  targetCollegeId?: string;
  notes?: string;
  actionType?: "created" | "accepted" | "declined" | "assigned" | "pending_confirmation";
  gmeetLink?: string;
  gcalLink?: string;
  actorName?: string;
}

/**
 * Sends in-app and email notifications for external interviews.
 * Notifies:
 * 1. The origin college KAM.
 * 2. All other colleges & CAMs managed by the SAME KAM (Regional College Cluster).
 * 3. The target/partner college CAM & KAM (if specified).
 */
export async function dispatchExternalInterviewNotifications(
  options: ExternalInterviewNotificationOptions
) {
  try {
    const db = await getDb();
    const {
      interviewId,
      subject,
      classGroup = "All Classes",
      targetDate,
      type = "external",
      topics = "General Review",
      studentCount = 0,
      mentorName = "Mentor",
      originCollegeId,
      targetCollegeId,
      actionType = "created",
      gmeetLink = "",
      actorName = "Campus Team"
    } = options;

    if (!originCollegeId) return;

    // 1+3+5. The origin college, the target college and the target CAMs all key off
    // the options, so they leave as one round trip. Recipient rendering only: a
    // failed slice degrades to a missing recipient instead of failing the caller.
    const wantsTarget = Boolean(targetCollegeId && targetCollegeId !== originCollegeId);
    const recipientFailures: QueryFailure[] = [];
    const [originCollegeRows, targetCollegeRows, targetCamRows] = await db.multiQuery([
      { sql: "SELECT * FROM colleges WHERE id = ?", params: [originCollegeId] },
      wantsTarget
        ? { sql: "SELECT * FROM colleges WHERE id = ?", params: [targetCollegeId] }
        : { sql: "SELECT 1 WHERE 1=0" },
      wantsTarget
        ? { sql: "SELECT * FROM campus_managers WHERE college_id = ?", params: [targetCollegeId] }
        : { sql: "SELECT 1 WHERE 1=0" },
    ], recipientFailures);
    if (recipientFailures.length > 0) {
      console.warn("[interview-notifications] origin/target lookup incomplete:", recipientFailures.map(f => f.error).join("; "));
    }
    const originCollege = originCollegeRows[0];
    const kamId = originCollege?.kam_id;

    // 2+3. The regional cluster and the KAM user both key off kamId.
    let regionalColleges: any[] = [];
    let kamUser: any = null;
    if (kamId) {
      const clusterFailures: QueryFailure[] = [];
      const [regionalRows, kamRows] = await db.multiQuery([
        { sql: "SELECT * FROM colleges WHERE kam_id = ? AND id != ?", params: [kamId, originCollegeId] },
        { sql: "SELECT * FROM kam_users WHERE id = ?", params: [kamId] },
      ], clusterFailures);
      if (clusterFailures.length > 0) {
        console.warn("[interview-notifications] cluster lookup incomplete:", clusterFailures.map(f => f.error).join("; "));
      }
      regionalColleges = regionalRows;
      kamUser = kamRows[0] || null;
    }

    const regionalCollegeIds = regionalColleges.map((c: any) => c.id).filter(Boolean);

    // 4. Fetch all CAMs across ALL regional colleges under this KAM
    let regionalCAMs: any[] = [];
    if (regionalCollegeIds.length > 0) {
      const placeholders = regionalCollegeIds.map(() => "?").join(",");
      regionalCAMs = await db.all(
        `SELECT * FROM campus_managers WHERE college_id IN (${placeholders}) OR kam_id = ?`,
        [...regionalCollegeIds, kamId || ""]
      );
    }

    // 5. Target college CAMs (read above with the origin/target batch)
    const targetCAMs: any[] = targetCamRows;
    const targetCollege: any = targetCollegeRows[0];

    // 6. Gather target User IDs for In-App Notifications
    const notificationUserIds = new Set<string>();

    // Add KAM
    if (kamId) {
      notificationUserIds.add(kamId);
      if (kamUser?.email) notificationUserIds.add(kamUser.email);
    }

    // Add all Regional CAMs
    regionalCAMs.forEach((cam: any) => {
      if (cam.id) notificationUserIds.add(cam.id);
      if (cam.email) notificationUserIds.add(cam.email);
    });

    // Add Target CAMs
    targetCAMs.forEach((cam: any) => {
      if (cam.id) notificationUserIds.add(cam.id);
      if (cam.email) notificationUserIds.add(cam.email);
    });

    // Also match centralized `users` table records for these reference IDs / emails
    if (notificationUserIds.size > 0) {
      const idsArr = Array.from(notificationUserIds);
      const matchedUsers = await readInChunks(db, idsArr, (chunk, ph) => ({
        sql: `SELECT id FROM users WHERE reference_id IN (${ph}) OR email IN (${ph})`,
        params: [...chunk, ...chunk]
      }));
      matchedUsers.forEach((u: any) => notificationUserIds.add(u.id));
    }

    // 7. Determine notification titles & text based on actionType
    let notifTitle = `[External Interview] ${subject}`;
    let notifMsg = `External interview request for ${subject} (${classGroup}) on ${targetDate}.`;
    let badgeColor: BadgeColor = "purple";
    let badgeText = "External Interview";

    if (actionType === "created") {
      notifTitle = `[External Interview Request] ${subject}`;
      notifMsg = `A new external interview for ${subject} has been raised by ${mentorName} for ${originCollege?.name || "Campus"}.`;
    } else if (actionType === "accepted") {
      notifTitle = `[External Interview Accepted] ${subject}`;
      notifMsg = `External interview for ${subject} accepted by ${actorName}. GMeet Link is ready.`;
      badgeColor = "emerald";
    } else if (actionType === "declined") {
      notifTitle = `[External Interview Declined] ${subject}`;
      notifMsg = `External interview for ${subject} was declined by partner CM and cascaded to next priority.`;
      badgeColor = "rose";
    } else if (actionType === "assigned") {
      notifTitle = `[External Interview Assigned] ${subject}`;
      notifMsg = `Mentors assigned for external interview ${subject} on ${targetDate}.`;
      badgeColor = "indigo";
    } else if (actionType === "pending_confirmation") {
      notifTitle = `[External Interview Awaiting Confirmation] ${subject}`;
      notifMsg = `The priority allocation for ${subject} on ${targetDate} is ready. Please confirm your campus allocation.`;
      badgeColor = "indigo";
    }

    // 8. Insert In-App Notifications for all affected Users
    // One role lookup and one multi-row INSERT. The previous loop cost two round-trips
    // per recipient, which for a regional broadcast meant hundreds of sequential queries.
    const now = new Date().toISOString();
    const candidates = Array.from(notificationUserIds);
    if (candidates.length > 0) {
      try {
        const roleRows: any[] = await readInChunks(db, candidates, (chunk, ph) => ({
          sql: `SELECT id, reference_id, email, role FROM users
                WHERE id IN (${ph}) OR reference_id IN (${ph}) OR email IN (${ph})`,
          params: [...chunk, ...chunk, ...chunk]
        }));
        const candidateSet = new Set(candidates);
        const roleByCandidate = new Map<string, string>();
        for (const row of roleRows || []) {
          for (const key of [row.id, row.reference_id, row.email]) {
            if (key && candidateSet.has(key)) roleByCandidate.set(key, row.role || "cm");
          }
        }

        const notifRows: any[][] = [];
        for (const userId of candidates) {
          const role = roleByCandidate.get(userId) || "cm";
          const link = role === "student" ? "/student/interviews" : role === "mentor" ? "/mentor/interviews" : role === "kam" ? "/kam/analytics" : "/cm/interviews";
          notifRows.push([generateId("notif_ext"), userId, notifTitle, notifMsg, link, now]);
        }

        for (const part of chunkList(notifRows, 500)) {
          await db.run(
            `INSERT INTO notifications (id, user_id, title, message, is_read, link, created_at)
             VALUES ${part.map(() => "(?, ?, ?, ?, 0, ?, ?)").join(", ")}`,
            part.flat()
          );
        }
      } catch (errNotif) {
        console.warn("Error inserting in-app notifications:", errNotif);
      }
    }

    // 9. Dispatch Branded Email Notifications
    const emailRecipients = new Set<string>();

    if (kamUser?.email) emailRecipients.add(kamUser.email);
    regionalCAMs.forEach((cam: any) => {
      if (cam.email) emailRecipients.add(cam.email);
    });
    targetCAMs.forEach((cam: any) => {
      if (cam.email) emailRecipients.add(cam.email);
    });

    const recipientEmails = Array.from(emailRecipients);

    if (recipientEmails.length > 0) {
      const regionalCollegeNames = regionalColleges.map((c: any) => c.name).join(", ");
      
      await dispatchMail({
        bcc: recipientEmails,
        subject: `${notifTitle} — Regional Notification (${regionalColleges.length} Colleges)`,
        htmlBody: renderEmailShell({
          title: notifTitle,
          badgeText: badgeText,
          badgeColor: badgeColor,
          description: `${notifMsg}<br/><br/><strong>Region Colleges Covered:</strong> ${regionalCollegeNames || originCollege?.name}`,
          details: [
            { label: "Subject", value: subject, highlight: true },
            { label: "Class Group", value: classGroup },
            { label: "Target Date", value: targetDate },
            { label: "Origin College", value: originCollege?.name || originCollegeId },
            ...(targetCollege ? [{ label: "Target College", value: targetCollege.name }] : []),
            ...(studentCount ? [{ label: "Student Count", value: String(studentCount) }] : []),
            ...(gmeetLink ? [{ label: "Google Meet Link", value: gmeetLink, highlight: true }] : []),
            ...(options.gcalLink ? [{ label: "Google Calendar Event", value: options.gcalLink }] : []),
            { label: "Topics", value: topics },
            { label: "KAM in Charge", value: kamUser?.name || "Regional KAM" }
          ],
          ctaText: gmeetLink ? "Join Google Meet Room →" : "Open E-Campus Dashboard →",
          ctaUrl: gmeetLink || undefined
        }),
        context: "regional-interview-broadcast"
      });
    }

    console.log(`[External Notification] Successfully notified ${notificationUserIds.size} users; regional mail queued for ${recipientEmails.length} staff addresses`);
  } catch (error) {
    console.error("Failed to dispatch external interview notifications:", error);
  }
}

/**
 * Schedule the broadcast for after the response and return immediately.
 * A regional notification costs eight lookups, a chunked notification insert and
 * a relay leg that can burn 12s — none of which is what the caller clicked for.
 * Every interview route uses this; `dispatchExternalInterviewNotifications` stays
 * exported for callers that genuinely need to wait for the work.
 */
export function notifyExternalInterviewsAfterResponse(options: ExternalInterviewNotificationOptions): void {
  after(() => { void dispatchExternalInterviewNotifications(options); });
}
