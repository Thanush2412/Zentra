import nodemailer from "nodemailer";

/**
 * Brand UI Constants matching FACE Prep E-Campus website design system
 */
const BRAND = {
  name: "FACE Prep",
  subtext: "E-CAMPUS",
  tagline: "University Operations Platform",
  portalUrl: "https://zentra-ruddy-chi.vercel.app",
  primaryPink: "#D528A2",
  peachCoral: "#F4A863",
  darkHeaderBg: "linear-gradient(135deg, #0F172A 0%, #1E1B4B 100%)",
  btnGradient: "linear-gradient(135deg, #D528A2 0%, #F4A863 100%)",
};

export type BadgeColor = "indigo" | "emerald" | "amber" | "rose" | "purple";

const BADGE_STYLES: Record<BadgeColor, { bg: string; text: string; border: string; label: string }> = {
  indigo: { bg: "#fdf2f8", text: "#db2777", border: "#fbcfe8", label: "Information" },
  emerald: { bg: "#ecfdf5", text: "#047857", border: "#d1fae5", label: "Approved" },
  amber: { bg: "#fef3c7", text: "#b45309", border: "#fde68a", label: "Action Required" },
  rose: { bg: "#fff1f2", text: "#be123c", border: "#ffe4e6", label: "Compliance Notice" },
  purple: { bg: "#faf5ff", text: "#6b21a8", border: "#e9d5ff", label: "SME Rating" },
};

export interface EmailDetailItem {
  label: string;
  value: string;
  highlight?: boolean;
}

/**
 * Master Responsive Email Shell Builder
 * Recreates FACE Prep E-Campus website cards, gradients, typography, and logo badge
 */
export function renderEmailShell({
  title,
  badgeText,
  badgeColor = "indigo",
  description,
  details = [],
  ctaText = "Log in to FACE Prep E-Campus Portal →",
  ctaUrl = BRAND.portalUrl,
  footerText = "This is an automated operational notification from FACE Prep E-Campus.",
}: {
  title: string;
  badgeText: string;
  badgeColor?: BadgeColor;
  description: string;
  details?: EmailDetailItem[];
  ctaText?: string;
  ctaUrl?: string;
  footerText?: string;
}) {
  const badgeStyle = BADGE_STYLES[badgeColor] || BADGE_STYLES.indigo;

  const rowsHtml = details
    .map(
      (item, idx) => `
      <tr style="border-bottom: 1px solid #f1f5f9; ${idx === details.length - 1 ? "border-bottom: none;" : ""}">
        <td style="padding: 12px 18px; font-weight: 700; color: #64748b; width: 140px; font-size: 12.5px; text-align: left; text-transform: uppercase; letter-spacing: 0.03em;">${item.label}</td>
        <td style="padding: 12px 18px; color: ${item.highlight ? badgeStyle.text : "#0f172a"}; font-weight: ${item.highlight ? "800" : "600"}; font-size: 13.5px; text-align: left;">${item.value}</td>
      </tr>
    `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Outfit', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; line-height: 1.5;">
      <div style="background-color: #f8fafc; padding: 36px 16px; min-height: 100%;">
        <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06); border: 1px solid #e2e8f0;">
          
          <!-- Official FACE Prep E-Campus Image Logo Header -->
          <div style="background-color: #ffffff; padding: 28px 24px 20px 24px; text-align: center; border-bottom: 1px solid #f1f5f9;">
            <a href="${BRAND.portalUrl}" target="_blank" style="display: inline-block; text-decoration: none;">
              <img src="https://zentra-ruddy-chi.vercel.app/E-Campus.png" alt="FACE Prep E-Campus" style="height: 52px; width: auto; max-width: 240px; border: 0; outline: none; text-decoration: none; display: block; margin: 0 auto;" />
            </a>
            <div style="color: #64748b; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; margin-top: 10px;">University Operations Platform</div>
          </div>
   
          <!-- Main Content Body -->
          <div style="padding: 32px 28px;">
            
            <!-- Category Badge & Heading -->
            <div style="margin-bottom: 24px; text-align: left;">
              <span style="display: inline-block; background-color: ${badgeStyle.bg}; color: ${badgeStyle.text}; font-weight: 800; font-size: 10px; padding: 5px 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.06em; border: 1px solid ${badgeStyle.border};">
                ${badgeText}
              </span>
              <h1 style="color: #0f172a; font-size: 21px; font-weight: 800; margin: 12px 0 6px 0; letter-spacing: -0.02em; line-height: 1.3;">${title}</h1>
              <p style="color: #64748b; font-size: 14px; font-weight: 500; margin: 0; line-height: 1.5;">${description}</p>
            </div>
   
            <!-- Details Card Table -->
            ${
              details.length > 0
                ? `
            <div style="border: 1px solid #e2e8f0; border-radius: 18px; overflow: hidden; background-color: #ffffff; margin-bottom: 28px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
              <table style="width: 100%; border-collapse: collapse; text-align: left;">
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
            </div>
            `
                : ""
            }
   
            <!-- Reusable Brand CTA Button -->
            <div style="text-align: center; margin-top: 28px; margin-bottom: 8px;">
              <a href="${ctaUrl}" target="_blank" style="display: inline-block; background: ${BRAND.btnGradient}; color: #ffffff; font-weight: 800; font-size: 13.5px; padding: 14px 28px; border-radius: 14px; text-decoration: none; box-shadow: 0 6px 18px rgba(213, 40, 162, 0.3); letter-spacing: 0.01em;">
                ${ctaText}
              </a>
            </div>

          </div>
   
          <!-- Footer Branding -->
          <div style="background-color: #f8fafc; padding: 22px 28px; text-align: center; border-top: 1px solid #f1f5f9;">
            <p style="color: #94a3b8; font-size: 11.5px; margin: 0; font-weight: 600;">${footerText}</p>
            <p style="color: #cbd5e1; font-size: 10.5px; margin-top: 6px; font-weight: 500;">&copy; 2026 FACE Prep E-Campus Operations. All rights reserved.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Backwards Compatible Legacy Format Wrapper
 */
export function formatZentraEmail(opts: {
  title: string;
  badgeText: string;
  badgeColor: "indigo" | "emerald" | "amber" | "rose";
  description: string;
  details: EmailDetailItem[];
  footerText?: string;
}) {
  return renderEmailShell(opts);
}

/* ==========================================================================
   SPECIALIZED NOTIFICATION TEMPLATES MATCHING WEBSITE UI
   ========================================================================== */

/**
 * 1. Faculty Handover Request Email
 */
export function renderHandoverRequestEmail(data: {
  requestorName: string;
  coverStaffName: string;
  dateStr: string;
  time: string;
  course: string;
  classGroup: string;
  reason?: string;
}) {
  return renderEmailShell({
    title: "Class Coverage Requested",
    badgeText: "Faculty Handover Request",
    badgeColor: "indigo",
    description: `Dear <strong>${data.coverStaffName}</strong>, <strong>${data.requestorName}</strong> has requested you to cover their scheduled class session.`,
    details: [
      { label: "Requesting Faculty", value: data.requestorName, highlight: true },
      { label: "Date & Time", value: `${data.dateStr} • ${data.time}` },
      { label: "Course / Subject", value: data.course },
      { label: "Class Cohort", value: data.classGroup },
      { label: "Reason", value: data.reason || "Operational Handover" },
    ],
    ctaText: "Review & Accept Handover Request →",
  });
}

/**
 * 2. Handover Approval Confirmation Email
 */
export function renderHandoverApprovalEmail(data: {
  requestorName: string;
  coverStaffName: string;
  dateStr: string;
  time: string;
  course: string;
  classGroup: string;
  reviewerName?: string;
}) {
  return renderEmailShell({
    title: "Handover Approved",
    badgeText: "Handover Confirmed",
    badgeColor: "emerald",
    description: `Dear <strong>${data.requestorName}</strong>, your class handover request has been approved by <strong>${data.reviewerName || "Management"}</strong>.`,
    details: [
      { label: "Covering Faculty", value: data.coverStaffName, highlight: true },
      { label: "Date & Time", value: `${data.dateStr} • ${data.time}` },
      { label: "Subject", value: data.course },
      { label: "Cohort", value: data.classGroup },
      { label: "Status", value: "Approved & Assigned" },
    ],
    ctaText: "View Handover Status on Portal →",
  });
}

/**
 * 3. Handover Rejection Notice Email
 */
export function renderHandoverRejectionEmail(data: {
  requestorName: string;
  coverStaffName: string;
  dateStr: string;
  time: string;
  course: string;
  classGroup: string;
  reviewerName?: string;
  rejectionReason?: string;
}) {
  return renderEmailShell({
    title: "Handover Request Declined",
    badgeText: "Handover Notice",
    badgeColor: "rose",
    description: `Dear <strong>${data.requestorName}</strong>, your class handover request could not be approved at this time.`,
    details: [
      { label: "Proposed Cover", value: data.coverStaffName },
      { label: "Date & Time", value: `${data.dateStr} • ${data.time}` },
      { label: "Subject", value: data.course },
      { label: "Reviewed By", value: data.reviewerName || "Management" },
      { label: "Reason", value: data.rejectionReason || "Scheduling conflict", highlight: true },
    ],
    ctaText: "Open Handover Dashboard →",
  });
}

/**
 * 4. Demo Swap Proposal Email
 */
export function renderDemoSwapEmail(data: {
  requestorName: string;
  targetMentorName: string;
  dateStr: string;
  time: string;
  course: string;
  classGroup: string;
}) {
  return renderEmailShell({
    title: "Demo Swap Request Received",
    badgeText: "Demo Swap Proposal",
    badgeColor: "amber",
    description: `Dear <strong>${data.targetMentorName}</strong>, <strong>${data.requestorName}</strong> has proposed a demo session swap with you.`,
    details: [
      { label: "Proposer", value: data.requestorName, highlight: true },
      { label: "Proposed Session", value: `${data.dateStr} • ${data.time}` },
      { label: "Subject", value: data.course },
      { label: "Cohort", value: data.classGroup },
    ],
    ctaText: "Respond to Swap Proposal →",
  });
}

/**
 * 5. SME Evaluation Rating Notification Email
 */
export function renderSmeEvaluationEmail(data: {
  mentorName: string;
  smeName: string;
  rating: string;
  feedback: string;
  mentorGroup: string;
}) {
  return renderEmailShell({
    title: "SME Evaluation Published",
    badgeText: "SME Feedback",
    badgeColor: "purple",
    description: `Dear <strong>${data.mentorName}</strong>, Subject Matter Expert <strong>${data.smeName}</strong> has evaluated your demo teaching performance.`,
    details: [
      { label: "Mentor Group", value: data.mentorGroup },
      { label: "Overall Score", value: data.rating, highlight: true },
      { label: "Evaluator", value: data.smeName },
      { label: "Key Feedback", value: data.feedback },
    ],
    ctaText: "View Detailed Scorecard →",
  });
}

/**
 * 6. Missed Attendance Compliance Warning Email
 */
export function renderMissedAttendanceEmail(data: {
  mentorName: string;
  dateStr: string;
  dayName: string;
  time: string;
  course: string;
  classGroup: string;
}) {
  return renderEmailShell({
    title: "Action Required: Missed Attendance Marking",
    badgeText: "Compliance Warning",
    badgeColor: "rose",
    description: `Dear <strong>${data.mentorName}</strong>, this is an official compliance alert that student attendance logs have not been submitted for your class.`,
    details: [
      { label: "Session Date", value: `${data.dateStr} (${data.dayName})` },
      { label: "Period / Time", value: data.time },
      { label: "Course / Subject", value: data.course },
      { label: "Class Cohort", value: data.classGroup, highlight: true },
    ],
    ctaText: "Submit Attendance Logs Now →",
    footerText: "Immediate submission is required for academic record compliance.",
  });
}

/**
 * 7. Timetable / Schedule Update Email
 */
export function renderTimetableUpdateEmail(data: {
  recipientName: string;
  title: string;
  message: string;
  details?: EmailDetailItem[];
}) {
  return renderEmailShell({
    title: data.title || "Timetable Schedule Update",
    badgeText: "Schedule Notice",
    badgeColor: "indigo",
    description: `Dear <strong>${data.recipientName}</strong>, ${data.message}`,
    details: data.details || [],
    ctaText: "View Updated Timetable →",
  });
}

/**
 * 8. Announcement & Broadcast Notice Email
 */
export function renderAnnouncementEmail(data: {
  recipientName: string;
  title: string;
  message: string;
  category?: string;
  dateStr?: string;
}) {
  return renderEmailShell({
    title: data.title,
    badgeText: data.category || "University Notice",
    badgeColor: "indigo",
    description: `Dear <strong>${data.recipientName}</strong>, ${data.message}`,
    details: data.dateStr ? [{ label: "Published Date", value: data.dateStr }] : [],
    ctaText: "Open E-Campus Portal →",
  });
}

/* ==========================================================================
   CENTRALIZED BREVO DISPATCH UTILITY
   ========================================================================== */

/**
 * Centralized sendMail function utilizing Brevo REST API v3 with SMTP fallback
 */
export async function sendMail({ to, subject, htmlBody }: { to: string; subject: string; htmlBody: string }) {
  try {
    if (!to || !to.includes("@")) {
      return { success: false, error: "Invalid recipient email address" };
    }

    const auditBcc = process.env.ADMIN_AUDIT_EMAIL || "";
    const recipients = [to.trim(), auditBcc].filter(Boolean);

    // 1. Primary: Direct Brevo Transactional Email REST API v3 (xkeysib Key)
    const brevoApiKey = process.env.BREVO_API_KEY || "";
    const senderName = process.env.BREVO_SENDER_NAME || "FACE Prep E-Campus";
    const senderEmail = process.env.BREVO_SENDER_EMAIL || "thanush@faceprep.in";

    if (brevoApiKey) {
      try {
        const toList = recipients.map((email) => ({ email }));
        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            accept: "application/json",
            "api-key": brevoApiKey,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            sender: { name: senderName, email: senderEmail },
            to: toList,
            subject,
            htmlContent: htmlBody,
          }),
        });

        const data = await res.json();
        if (res.ok && data.messageId) {
          console.log("Email dispatched via Brevo REST API! Message ID:", data.messageId);
          return { success: true, messageId: data.messageId };
        } else {
          console.warn("Brevo REST API notice:", data);
        }
      } catch (brevoErr) {
        console.error("Brevo API call failed, falling back to SMTP...", brevoErr);
      }
    }

    // 2. Secondary: Brevo SMTP Delivery via nodemailer (xsmtpsib Key)
    const host = process.env.SMTP_HOST || "smtp-relay.brevo.com";
    const port = parseInt(process.env.SMTP_PORT || "587", 10);
    const user = process.env.SMTP_USER || "";
    const pass = process.env.SMTP_PASS || "";

    if (user && pass) {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });

      const info = await transporter.sendMail({
        from: `"${senderName}" <${senderEmail}>`,
        to: recipients.join(", "),
        subject,
        html: htmlBody,
      });

      console.log("Email dispatched via Brevo SMTP:", info.messageId);
      return { success: true, messageId: info.messageId };
    }

    // 3. Fallback: Google Apps Script Webhook
    const gasUrl = process.env.NEXT_PUBLIC_GAS_MAIL_URL || "";
    if (gasUrl) {
      const res = await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: recipients.join(","),
          subject,
          htmlBody,
        }),
      });
      if (!res.ok) throw new Error(`Google Apps Script responded with status: ${res.status}`);
      return await res.json();
    }

    // 4. Fallback: Console Mock Log
    console.log("------------------- MOCK EMAIL TRIGGERED -------------------");
    console.log(`To: ${recipients.join(",")}`);
    console.log(`Subject: ${subject}`);
    console.log("------------------------------------------------------------");
    return { success: true, mocked: true };
  } catch (err: any) {
    console.error("Mail utility error:", err);
    return { success: false, error: err.message };
  }
}
