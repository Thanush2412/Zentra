import { getDb } from "@/lib/db";
import { sendMail, renderEmailShell, BadgeColor } from "@/lib/mail";

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
  actionType?: "created" | "accepted" | "declined" | "assigned";
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
      actorName = "Campus Manager"
    } = options;

    if (!originCollegeId) return;

    // 1. Fetch origin college & its assigned KAM
    const originCollege = await db.get("SELECT * FROM colleges WHERE id = ?", [originCollegeId]);
    const kamId = originCollege?.kam_id;

    // 2. Fetch all colleges managed by this KAM (Region/Cluster colleges or all DB colleges)
    let regionalColleges: any[] = [];
    if (kamId) {
      regionalColleges = await db.all("SELECT * FROM colleges WHERE kam_id = ?", [kamId]);
    }
    if (!regionalColleges || regionalColleges.length <= 1) {
      regionalColleges = await db.all("SELECT * FROM colleges");
    }

    const regionalCollegeIds = regionalColleges.map((c: any) => c.id).filter(Boolean);

    // 3. Fetch KAM user details
    let kamUser: any = null;
    if (kamId) {
      kamUser = await db.get("SELECT * FROM kam_users WHERE id = ?", [kamId]);
    }

    // 4. Fetch all CAMs across ALL regional colleges under this KAM
    let regionalCAMs: any[] = [];
    if (regionalCollegeIds.length > 0) {
      const placeholders = regionalCollegeIds.map(() => "?").join(",");
      regionalCAMs = await db.all(
        `SELECT * FROM campus_managers WHERE college_id IN (${placeholders}) OR kam_id = ?`,
        [...regionalCollegeIds, kamId || ""]
      );
    }

    // 5. Fetch target college CAMs if specified
    let targetCAMs: any[] = [];
    let targetCollege: any = null;
    if (targetCollegeId && targetCollegeId !== originCollegeId) {
      targetCollege = await db.get("SELECT * FROM colleges WHERE id = ?", [targetCollegeId]);
      targetCAMs = await db.all("SELECT * FROM campus_managers WHERE college_id = ?", [targetCollegeId]);
    }

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
    const userQueries: any[] = [];
    if (notificationUserIds.size > 0) {
      const idsArr = Array.from(notificationUserIds);
      const placeholders = idsArr.map(() => "?").join(",");
      const matchedUsers = await db.all(
        `SELECT id FROM users WHERE reference_id IN (${placeholders}) OR email IN (${placeholders})`,
        [...idsArr, ...idsArr]
      );
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
    }

    // 8. Insert In-App Notifications for all affected Users
    const now = new Date().toISOString();
    for (const userId of Array.from(notificationUserIds)) {
      const notifId = `notif_ext_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      try {
        await db.run(
          `INSERT INTO notifications (id, user_id, title, message, is_read, link, created_at)
           VALUES (?, ?, ?, ?, 0, ?, ?)`,
          [notifId, userId, notifTitle, notifMsg, "/cam", now]
        );
      } catch (errNotif) {
        console.warn("Error inserting in-app notification:", errNotif);
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

    const toEmailList = Array.from(emailRecipients).join(", ");

    if (toEmailList) {
      const regionalCollegeNames = regionalColleges.map((c: any) => c.name).join(", ");
      
      await sendMail({
        to: toEmailList,
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
          ctaText: gmeetLink ? "Join Google Meet Room →" : "Open Zentra Dashboard →",
          ctaUrl: gmeetLink || undefined
        })
      });
    }

    console.log(`[External Notification] Successfully notified ${notificationUserIds.size} users and sent emails to: ${toEmailList}`);
  } catch (error) {
    console.error("Failed to dispatch external interview notifications:", error);
  }
}
