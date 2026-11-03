# E-Campus Email Coverage Plan
> Comprehensive audit of every place emails CAN and SHOULD be sent.
> Based on full source code review of all 70+ API routes.
> Date: October 2026

---

## Current Infrastructure (What's Ready)

```
src/lib/mail.ts          — sendMail()  (Brevo REST → SMTP → GAS → mock)
src/lib/mailAsync.ts     — sendMailAsync()  (fire-and-forget wrapper)
src/lib/mail.ts          — sendAccountWelcomeEmail()  (defined, NOT wired up yet)
```

**Templates already in `mail.ts`:**
| Template | Used? |
|---|---|
| `renderEmailShell()` | ✅ Used everywhere |
| `renderHandoverRequestEmail()` | ✅ `/api/requests` |
| `renderHandoverApprovalEmail()` | ✅ `/api/requests/review` |
| `renderHandoverRejectionEmail()` | ✅ `/api/requests/review` |
| `renderDemoSwapEmail()` | ❌ Not wired up |
| `renderSmeEvaluationEmail()` | ❌ Not wired up |
| `renderMissedAttendanceEmail()` | ✅ `/api/send-mail` |
| `renderTimetableUpdateEmail()` | ✅ `/api/daily-configs` |
| `renderAnnouncementEmail()` | ❌ Not wired up |
| `renderDemoComplianceEmail()` | ❌ Not wired up |
| `sendAccountWelcomeEmail()` | ❌ Defined but never called |

---

## ZONE 1 — ✅ Already Has Emails (Working)

These routes already send emails correctly:

| Route | Trigger | Recipient |
|---|---|---|
| `POST /api/requests` | Handover request created | Cover mentor |
| `POST /api/requests/review` | Handover approved / rejected | Requestor mentor |
| `POST /api/requests/faculty-leave` | Leave submitted | CM + KAM |
| `POST /api/requests/faculty-leave` | Cover mentor assigned | Cover mentor (batch) |
| `POST /api/requests/faculty-leave` → approve/reject | CM decision on leave | Mentor |
| `POST /api/requests/swap` | Swap proposed | Target mentor |
| `POST /api/requests/leave` | Student leave submitted | Class teacher + CMs |
| `PUT /api/requests/leave` | Student leave approved / rejected | Student |
| `POST /api/daily-configs` | Schedule updated | All mentors (batch) |
| `POST /api/daily-configs` → auto_adapt | Next-week schedule auto-set | All mentors (batch) |
| `POST /api/notifications` | Day-order not configured reminder | Each CM |
| `POST /api/interviews` | New internal interview raised | CM of campus |
| `POST /api/interviews` | New external interview raised | KAM + regional CAMs |
| `POST /api/interviews/assign` | Mentor(s) assigned to interview | Assigned mentors + KAM |
| `PATCH /api/interviews` → completed | Interview marked complete | All students in class (BCC) |
| `POST /api/demo-sessions` → evaluate | Compliance gap found | KAM + CM + SME (CC) |
| `POST /api/student-tracker` | Task assigned to student | Student + mentor (BCC) |
| `POST /api/send-mail` | Manual admin trigger | Custom recipient |

---

## ZONE 2 — 🔴 Missing Emails (Should Be Added)

These routes handle important life-cycle events but send **zero emails**.

---

### 2A · CRITICAL — User Account Events

#### E-ACCT-01 · New Signup → Notify Admin
**Route:** `POST /api/signup`  
**Current:** Writes to DB only.  
**Gap:** Admin and KAM never know a signup request is waiting.  
**Add:**
```ts
// After DB insert — fire-and-forget
sendMailAsync({
  to: process.env.SUPER_ADMIN_EMAIL!,
  subject: `${BRAND.emailPrefix} New Signup Request — ${name}`,
  htmlBody: renderEmailShell({
    title: "New Signup Request Received",
    badgeText: "SIGNUP REQUEST",
    badgeColor: "amber",
    description: `A new user has requested access to E-Campus.`,
    details: [
      { label: "Name", value: name, highlight: true },
      { label: "Email", value: email },
      { label: "Role", value: role },
      { label: "College", value: college_id || "Not specified" },
    ],
    ctaText: "Review in Admin Panel →",
    ctaUrl: `${BRAND.portalUrl}/admin/signup-requests`
  }),
  context: "signup-admin-notify"
});
```

#### E-ACCT-02 · Signup Approved / Rejected → Notify Applicant
**Route:** `POST /api/admin/signup-requests` (action: approve / reject)  
**Current:** Only writes audit log.  
**Gap:** Applicant never gets told if they were approved or rejected.  
**Add:**
```ts
// After DB status update
const applicantEmail = req.email; // available in the fetched request row
if (applicantEmail) {
  sendMailAsync({
    to: applicantEmail,
    subject: `${BRAND.emailPrefix} Your E-Campus Access Request — ${newStatus.toUpperCase()}`,
    htmlBody: renderEmailShell({
      title: newStatus === "approved" ? "Access Request Approved" : "Access Request Not Approved",
      badgeText: newStatus.toUpperCase(),
      badgeColor: newStatus === "approved" ? "emerald" : "rose",
      description: newStatus === "approved"
        ? `Congratulations! Your E-Campus account has been approved. You can now log in.`
        : `Your access request could not be approved at this time.`,
      details: [
        { label: "Role Requested", value: req.role },
        { label: "Reviewed By", value: reviewerName || "Admin" },
        ...(rejectionReason ? [{ label: "Reason", value: rejectionReason }] : [])
      ],
      ctaText: newStatus === "approved" ? "Log In to E-Campus →" : "Contact Support →",
    }),
    context: "signup-request-decision"
  });
}
```

#### E-ACCT-03 · Password Changed → Security Alert to User
**Route:** `POST /api/change-password`  
**Current:** No email.  
**Gap:** User gets no security notification if their account is compromised and password changed.  
**Add:**
```ts
// After successful password change
if (userEmail) {
  sendMailAsync({
    to: userEmail,
    subject: `${BRAND.emailPrefix} Security Alert — Password Changed`,
    htmlBody: renderEmailShell({
      title: "Your Password Has Been Changed",
      badgeText: "SECURITY NOTICE",
      badgeColor: "rose",
      description: `Your E-Campus account password was changed. If you did not make this change, contact your admin immediately.`,
      details: [
        { label: "Account", value: userEmail },
        { label: "Changed At", value: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) },
        { label: "Action Required", value: "If you did not do this, contact admin now.", highlight: true }
      ],
      ctaText: "Secure My Account →",
    }),
    context: "password-change-security"
  });
}
```

#### E-ACCT-04 · User Created / Password Reset → Welcome Email
**Route:** `POST /api/users` (create), `PUT /api/users` (reset password)  
**Current:** `sendAccountWelcomeEmail()` is **defined in mail.ts but never called**.  
**Gap:** New users don't receive their credentials. Password resets are silent.  
**Add:**
```ts
// POST - new user created
import { sendAccountWelcomeEmail } from "@/lib/mail";
await sendAccountWelcomeEmail({ to: email, name, tempPassword, role });

// PUT - password reset
if (action === "reset_password" && userEmail) {
  sendMailAsync({
    to: userEmail,
    subject: `${BRAND.emailPrefix} Your Password Has Been Reset`,
    htmlBody: renderEmailShell({
      title: "Password Reset by Admin",
      badgeText: "ACCOUNT UPDATE",
      badgeColor: "amber",
      description: `Your E-Campus account password was reset by an administrator.`,
      details: [
        { label: "Temporary Password", value: tempPassword, highlight: true },
        { label: "Reset By", value: adminName || "Admin" },
      ],
      ctaText: "Log In and Change Password →",
    }),
    context: "admin-password-reset"
  });
}
```

---

### 2B · HIGH — CM Leave

#### E-CML-01 · CM Submits Leave → Notify KAM
**Route:** `POST /api/cm-leave`  
**Current:** In-app notification only; `kam_user.email` is available in the route.  
**Gap:** KAM never gets an email when the CM for a campus goes on leave.  
**Add:**
```ts
// After insert, fire-and-forget to KAM
if (kamUser?.email) {
  sendMailAsync({
    to: kamUser.email,
    subject: `${BRAND.emailPrefix} [Action Required] CM Leave Request — ${camName}`,
    htmlBody: renderEmailShell({
      title: "Campus Manager Leave Application",
      badgeText: "CM LEAVE REQUEST",
      badgeColor: "amber",
      description: `Campus Manager <strong>${camName}</strong> has submitted a leave application.`,
      details: [
        { label: "CM Name", value: camName, highlight: true },
        { label: "College", value: collegeName },
        { label: "Leave Type", value: leaveType },
        { label: "Date Range", value: `${startDate} to ${endDate}` },
        { label: "Reason", value: reason }
      ],
      ctaText: "Review CM Leave Application →",
    }),
    context: "cm-leave-request"
  });
}
```

#### E-CML-02 · KAM Approves/Rejects CM Leave → Notify CM
**Route:** `PATCH /api/cm-leave` or approval action  
**Current:** In-app notification only.  
**Gap:** CM gets no email on the decision.  
**Add:**
```ts
if (camUser?.email) {
  sendMailAsync({
    to: camUser.email,
    subject: `${BRAND.emailPrefix} Your Leave Request Has Been ${newStatus.toUpperCase()}`,
    htmlBody: renderEmailShell({
      title: `Leave Request ${newStatus === "approved" ? "Approved" : "Rejected"}`,
      badgeText: newStatus.toUpperCase(),
      badgeColor: newStatus === "approved" ? "emerald" : "rose",
      description: `Your leave application has been reviewed by your KAM.`,
      details: [
        { label: "Date Range", value: `${startDate} to ${endDate}` },
        { label: "Status", value: newStatus.toUpperCase(), highlight: true },
        { label: "Reviewed By", value: kamName },
        ...(rejectionReason ? [{ label: "Reason", value: rejectionReason }] : [])
      ],
      ctaText: "View Leave Status →",
    }),
    context: "cm-leave-decision"
  });
}
```

---

### 2C · HIGH — Demo Session Swap

#### E-DEMO-01 · Demo Swap Requested → Notify Target Mentor/SME
**Route:** `POST /api/requests/demo-swap`  
**Current:** No email. `renderDemoSwapEmail()` template exists in mail.ts but not called.  
**Gap:** The proposed replacement is never notified.  
**Add:**
```ts
import { sendMailAsync } from "@/lib/mailAsync";
import { renderDemoSwapEmail, BRAND } from "@/lib/mail";

if (targetMentor?.email) {
  sendMailAsync({
    to: targetMentor.email,
    subject: `${BRAND.emailPrefix} Demo Swap Proposal — ${subject}`,
    htmlBody: renderDemoSwapEmail({
      requestorName: requestor.name,
      targetMentorName: targetMentor.name,
      dateStr: dateFormatted,
      time: timeSlot,
      course: subject,
      classGroup: classGroup || "General"
    }),
    context: "demo-swap-request"
  });
}
```

#### E-DEMO-02 · Demo Swap Resolved → Notify Both Parties
**Route:** `PATCH /api/requests/demo-swap` (L&D approve/reject)  
**Current:** No email.  
**Gap:** Neither mentor nor SME is told what happened to the swap.  
**Add:**
```ts
// Both requestor + target notified
const toList = [requestorEmail, targetEmail].filter(Boolean).join(",");
sendMailAsync({
  to: toList,
  subject: `${BRAND.emailPrefix} Demo Swap ${newStatus === "approved" ? "Approved" : "Declined"} — ${subject}`,
  htmlBody: renderEmailShell({
    title: `Demo Swap ${newStatus === "approved" ? "Approved" : "Declined"}`,
    badgeText: newStatus.toUpperCase(),
    badgeColor: newStatus === "approved" ? "emerald" : "rose",
    description: `The demo swap for <strong>${subject}</strong> has been reviewed.`,
    details: [
      { label: "Session", value: subject, highlight: true },
      { label: "Original Date", value: originalDate },
      { label: "Proposed Date", value: proposedDate },
      { label: "Status", value: newStatus.toUpperCase(), highlight: true },
      { label: "Reviewed By", value: reviewerName }
    ],
    ctaText: "View Demo Schedule →",
  }),
  context: "demo-swap-decision"
});
```

---

### 2D · MEDIUM — Announcements

#### E-ANN-01 · New Announcement → Notify Targeted Roles
**Route:** `POST /api/announcements`  
**Current:** No email. `renderAnnouncementEmail()` template exists in mail.ts.  
**Gap:** Mentors/students don't get email notification of important announcements.  
**Logic:** Only send email for `priority === "high"` or `category === "urgent"` to avoid spam.  
**Add:**
```ts
import { sendMailAsync } from "@/lib/mailAsync";
import { renderAnnouncementEmail, BRAND } from "@/lib/mail";

// Only email for high-priority announcements
if (priority === "high" || category === "urgent") {
  const recipients = await db.all(
    `SELECT email FROM mentors WHERE college_id = ? AND email IS NOT NULL`,
    [collegeId]
  );
  const validEmails = recipients.map(r => r.email).filter(Boolean);
  
  if (validEmails.length > 0) {
    sendMailAsync({
      to: validEmails[0], // Use bcc for the rest
      bcc: validEmails.slice(1),
      subject: `${BRAND.emailPrefix} ${title}`,
      htmlBody: renderAnnouncementEmail({
        recipientName: "Team",
        title,
        message: content,
        category: category || "Announcement",
        dateStr: new Date().toLocaleDateString("en-IN")
      }),
      context: "announcement-notify"
    });
  }
}
```

---

### 2E · MEDIUM — SME Evaluation Published

#### E-SME-01 · SME Evaluation Done → Notify Mentor
**Route:** `POST /api/demo-sessions` (action = evaluate)  
**Current:** Only compliance email exists (renderDemoComplianceEmail). The mentor who was evaluated never receives their score.  
**Gap:** Mentor doesn't know they received an evaluation.  
**Template:** `renderSmeEvaluationEmail()` already exists in mail.ts.  
**Add:**
```ts
import { renderSmeEvaluationEmail, BRAND } from "@/lib/mail";

if (mentorEmail) {
  sendMailAsync({
    to: mentorEmail,
    subject: `${BRAND.emailPrefix} Your L&D Evaluation Score is Ready`,
    htmlBody: renderSmeEvaluationEmail({
      mentorName: mentorName,
      smeName: smeName,
      rating: `${finalMark} / ${maxMark}`,
      feedback: evaluationSummary || "Review full scorecard on portal",
      mentorGroup: classGroup || department || "General"
    }),
    context: "sme-evaluation-published"
  });
}
```

---

### 2F · LOW — Tickets / Issues

#### E-TICK-01 · Support Ticket Resolved → Notify Submitter
**Route:** `PATCH /api/tickets` (status = "resolved" / "closed")  
**Current:** No email.  
**Gap:** Ticket submitter never knows their issue was resolved.  
**Add:**
```ts
if (ticketEmail && newStatus === "resolved") {
  sendMailAsync({
    to: ticketEmail,
    subject: `${BRAND.emailPrefix} Your Support Ticket Has Been Resolved`,
    htmlBody: renderEmailShell({
      title: "Support Ticket Resolved",
      badgeText: "RESOLVED",
      badgeColor: "emerald",
      description: `Your support ticket has been reviewed and resolved.`,
      details: [
        { label: "Ticket", value: ticketTitle, highlight: true },
        { label: "Resolved By", value: resolvedBy || "Support Team" },
        { label: "Resolution", value: resolution || "Issue resolved." }
      ],
      ctaText: "View Ticket →",
    }),
    context: "ticket-resolved"
  });
}
```

#### E-ISS-01 · Campus Issue → Notify KAM on High Priority
**Route:** `POST /api/issues`  
**Current:** No email.  
**Gap:** KAM unaware of critical campus issues.  
**Add:**
```ts
if ((priority === "high" || severity === "critical") && kamEmail) {
  sendMailAsync({
    to: kamEmail,
    subject: `${BRAND.emailPrefix} [High Priority Issue] ${issueTitle} — ${collegeName}`,
    htmlBody: renderEmailShell({
      title: "High Priority Campus Issue Raised",
      badgeText: "URGENT — ACTION NEEDED",
      badgeColor: "rose",
      description: `A high-priority issue has been logged for your campus cluster.`,
      details: [
        { label: "Issue", value: issueTitle, highlight: true },
        { label: "Campus", value: collegeName },
        { label: "Priority", value: priority.toUpperCase() },
        { label: "Raised By", value: raisedBy },
        { label: "Description", value: description }
      ],
      ctaText: "View Issue on Dashboard →",
    }),
    context: "high-priority-issue"
  });
}
```

---

## ZONE 3 — Where `sendMailAsync` Should Replace `await sendMail`

These routes currently `await sendMail(...)` directly, which blocks the response.  
They should use `sendMailAsync()` from `mailAsync.ts` instead:

| Route | Line approx | Blocking call | Priority |
|---|---|---|---|
| `POST /api/requests` | handover email | `await sendMail` | Medium |
| `POST /api/requests/review` | approval/rejection email | `await sendMail` | High |
| `POST /api/requests/review` → cm_reassign | assigned cover email | `await sendMail` | Medium |
| `POST /api/requests/faculty-leave` → approve | mentor decision email | `await sendMail` | High |
| `POST /api/interviews` | CM notification | `await sendMail` | Medium |
| `POST /api/interviews/assign` | mentor assignment emails | `await sendMail` | Medium |
| `POST /api/notifications` | day-order reminder | `await sendMail` | Low |

**Pattern to apply:**
```ts
// Before (blocks response):
await sendMail({ to, subject, htmlBody });

// After (fire-and-forget):
sendMailAsync({ to, subject, htmlBody, context: "meaningful-label" });
// then immediately return NextResponse.json(...)
```

---

## ZONE 4 — Existing Templates Not Wired Up

These templates are **coded and ready** in `mail.ts` but currently unused:

| Template | Should Be Used In | Action |
|---|---|---|
| `renderDemoSwapEmail()` | `POST /api/requests/demo-swap` | Wire up (E-DEMO-01) |
| `renderSmeEvaluationEmail()` | `POST /api/demo-sessions` action=evaluate | Wire up (E-SME-01) |
| `renderAnnouncementEmail()` | `POST /api/announcements` (high priority only) | Wire up (E-ANN-01) |
| `renderDemoComplianceEmail()` | `POST /api/demo-sessions` action=evaluate | Already called — ✅ wired |
| `sendAccountWelcomeEmail()` | `POST /api/users` (create) | Wire up (E-ACCT-04) |

---

## Implementation Order (Priority)

### Phase 1 — Account & Security (Do First)
1. `E-ACCT-04` — Welcome email when user is created (wire up `sendAccountWelcomeEmail`)
2. `E-ACCT-02` — Signup request approved/rejected email to applicant
3. `E-ACCT-03` — Password change security alert
4. `E-ACCT-01` — New signup → admin notification

### Phase 2 — CM Leave (Do Second)
5. `E-CML-01` — CM submits leave → email KAM
6. `E-CML-02` — KAM decides leave → email CM

### Phase 3 — Demo / SME (Do Third)
7. `E-DEMO-01` — Demo swap request → email target
8. `E-DEMO-02` — Demo swap resolved → email both parties
9. `E-SME-01` — SME evaluation published → email mentor

### Phase 4 — Lower Priority
10. `E-ANN-01` — High-priority announcement → email mentors
11. `E-TICK-01` — Ticket resolved → email submitter
12. `E-ISS-01` — High-priority issue → email KAM

### Phase 5 — Non-Blocking Refactor
13. Convert all `await sendMail(...)` in response-critical paths to `sendMailAsync(...)`

---

## Summary Count

| Zone | Count | Status |
|---|---|---|
| Already working correctly | 18 trigger points | ✅ Done |
| Missing — Critical | 4 (account lifecycle) | 🔴 Add |
| Missing — High | 4 (CM leave + demo swap) | 🔴 Add |
| Missing — Medium | 2 (announcement + SME) | 🟡 Add |
| Missing — Low | 2 (tickets + issues) | 🟢 Add |
| Templates unused | 5 | 🟡 Wire up |
| Blocking → async refactor | 7 call sites | 🟡 Refactor |

**Total new email triggers to add: 12**
