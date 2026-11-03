# E-Campus Email Registry
> Complete reference of every outgoing email in the system.  
> Source: full code audit of all API routes and lib files.  
> Last updated: October 2026

---

## How to Read This Doc

| Column | Meaning |
|---|---|
| **#** | Email ID for quick reference |
| **Trigger** | The exact user action or system event that fires the email |
| **Route** | API endpoint responsible |
| **Template** | Function from `src/lib/mail.ts` used to build the HTML |
| **To** | Primary recipient(s) — visible in the To field |
| **CC** | Copied recipient — can see all other recipients |
| **BCC** | Hidden recipient — cannot see other recipients |
| **Audit BCC** | `ADMIN_AUDIT_EMAIL` env var — appended automatically by `sendMail()` to every email |
| **Dispatch** | `await` = blocks response · `async` = fire-and-forget |
| **Subject** |  Subject line pattern |

---

## Module 1 — Class Handover & Swaps

### E-01 · Handover Request Created
| Field | Value |
|---|---|
| **Trigger** | Mentor submits a handover request for a class slot |
| **Route** | `POST /api/requests` |
| **Template** | `renderHandoverRequestEmail()` |
| **To** | Cover mentor (`coverStaff.email`) |
| **CC** | — |
| **BCC** | `ADMIN_AUDIT_EMAIL` (auto) |
| **Dispatch** | `await` (blocks response) |
| **Subject** | `[FACE Prep E-Campus] New Class Handover Request - {course}` |
| **Key details** | Requestor name, date/time, course, class group, reason, CTA → portal |

---

### E-02 · Handover Approved (by Cover Mentor or CM)
| Field | Value |
|---|---|
| **Trigger** | Cover mentor accepts OR CM directly approves the request |
| **Route** | `POST /api/requests/review` |
| **Template** | `renderHandoverApprovalEmail()` |
| **To** | Original requestor mentor (`mentors.email`) |
| **CC** | — |
| **BCC** | `ADMIN_AUDIT_EMAIL` (auto) |
| **Dispatch** | `await` |
| **Subject** | `[FACE Prep E-Campus] Handover Request Approved - {course}` |
| **Note** | Skipped silently if mentor has no email in DB (fixed — no fallback to admin) |

---

### E-03 · Handover Rejected
| Field | Value |
|---|---|
| **Trigger** | Cover mentor declines OR CM rejects the request |
| **Route** | `POST /api/requests/review` |
| **Template** | `renderHandoverRejectionEmail()` |
| **To** | Original requestor mentor |
| **CC** | — |
| **BCC** | `ADMIN_AUDIT_EMAIL` (auto) |
| **Dispatch** | `await` |
| **Subject** | `[FACE Prep E-Campus] Handover Request Rejected - {course}` |

---

### E-04 · CM Directly Assigns Cover (Reassignment)
| Field | Value |
|---|---|
| **Trigger** | CM uses "Assign Cover" action on a pending/needs-allocation request |
| **Route** | `POST /api/requests/review` (action = `cm_reassign`) |
| **Template** | `renderHandoverApprovalEmail()` |
| **To** | Newly assigned cover mentor |
| **CC** | — |
| **BCC** | `ADMIN_AUDIT_EMAIL` (auto) |
| **Dispatch** | `await` |
| **Subject** | `[Assigned by CM] Class Cover: {course} on {date}` |

---

### E-05 · Swap Proposal Sent
| Field | Value |
|---|---|
| **Trigger** | Mentor proposes a ledger-swap to another mentor |
| **Route** | `POST /api/requests/swap` |
| **Template** | `renderSwapOfferEmail()` |
| **To** | Target mentor (`targetStaff.email`) |
| **CC** | — |
| **BCC** | `ADMIN_AUDIT_EMAIL` (auto) |
| **Dispatch** | `await` |
| **Subject** | `[FACE Prep E-Campus] Class Swap Offer — {course}` |

---

## Module 2 — Faculty Leave

### E-06 · Leave Submitted → CM + KAM Notified
| Field | Value |
|---|---|
| **Trigger** | Mentor submits a Casual/Emergency/OD/Permission request |
| **Route** | `POST /api/requests/faculty-leave` |
| **Template** | `renderEmailShell()` |
| **To** | Campus Manager (`campus_managers.email`) + KAM (`kam_users.email`) if available |
| **CC** | — |
| **BCC** | `ADMIN_AUDIT_EMAIL` (auto) |
| **Dispatch** | `await` |
| **Subject** | `[Action Required] New {requestType} Request - {mentorName}` |
| **Note** | If no CM email found → escalation email to `SUPER_ADMIN_EMAIL` instead |

---

### E-07 · Cover Mentor Notified (per class slot)
| Field | Value |
|---|---|
| **Trigger** | Mentor selects a cover for each affected class when submitting leave |
| **Route** | `POST /api/requests/faculty-leave` |
| **Template** | `renderEmailShell()` |
| **To** | Each cover mentor (`mentors.email`) |
| **CC** | — |
| **BCC** | `ADMIN_AUDIT_EMAIL` (auto) |
| **Dispatch** | `Promise.allSettled` (batch async — does not block response) |
| **Subject** | `[Cover Request] {course} on {date} — {mentorName}` |

---

### E-08 · Leave Approved or Rejected by CM → Mentor Notified
| Field | Value |
|---|---|
| **Trigger** | CM approves or rejects a faculty leave request |
| **Route** | `POST /api/requests/faculty-leave` (action = `approve`/`reject`) |
| **Template** | `renderEmailShell()` |
| **To** | Mentor who applied (`mentors.email`) |
| **CC** | — |
| **BCC** | `ADMIN_AUDIT_EMAIL` (auto) |
| **Dispatch** | `await` |
| **Subject** | `[Update] Your {requestType} Request Has Been {APPROVED/REJECTED}` |

---

### E-09 · No CM Configured — Escalation to Super Admin
| Field | Value |
|---|---|
| **Trigger** | Leave submitted but no CM email found for the college |
| **Route** | `POST /api/requests/faculty-leave` |
| **Template** | `renderEmailShell()` |
| **To** | `SUPER_ADMIN_EMAIL` env var |
| **CC** | — |
| **BCC** | `ADMIN_AUDIT_EMAIL` (auto) |
| **Dispatch** | `await` |
| **Subject** | `[System Alert] No CM for Leave Request - {collegeId}` |

---

## Module 3 — Student Leave

### E-10 · Student Leave/OD/Permission Submitted
| Field | Value |
|---|---|
| **Trigger** | Student submits leave request |
| **Route** | `POST /api/requests/leave` |
| **Template** | `renderEmailShell()` |
| **To** | Class teacher(s) + all Campus Managers for the college (comma-joined) |
| **CC** | — |
| **BCC** | `ADMIN_AUDIT_EMAIL` (auto) |
| **Dispatch** | `await` |
| **Subject** | `[Student {TYPE} Request] {studentName} ({classGroup}) — {date}` |

---

### E-11 · Student Leave Decision
| Field | Value |
|---|---|
| **Trigger** | CM approves or rejects a student leave request |
| **Route** | `PUT /api/requests/leave` |
| **Template** | `renderEmailShell()` |
| **To** | Student (`students.email`) |
| **CC** | — |
| **BCC** | `ADMIN_AUDIT_EMAIL` (auto) |
| **Dispatch** | `await` |
| **Subject** | `[Leave Request {APPROVED/REJECTED}] Your {type} for {date}` |

---

### E-12 · Student Leave Approved via Generic Approvals Engine
| Field | Value |
|---|---|
| **Trigger** | Student leave approved through `/api/approvals` (generic approval flow) |
| **Route** | `POST /api/approvals` |
| **Template** | `renderEmailShell()` |
| **To** | Student (`students.email`) |
| **CC** | — |
| **BCC** | `ADMIN_AUDIT_EMAIL` (auto) |
| **Dispatch** | `await` |
| **Subject** | `[Leave Approved] Your {type} request for {date} has been APPROVED` |

---

## Module 4 — Campus Manager Leave

### E-13 · CM Leave Submitted → KAM Notified
| Field | Value |
|---|---|
| **Trigger** | Campus Manager submits a leave request |
| **Route** | `POST /api/cm-leave` |
| **Template** | `renderEmailShell()` |
| **To** | KAM (`kam_users.email`) |
| **CC** | — |
| **BCC** | `ADMIN_AUDIT_EMAIL` (auto) |
| **Dispatch** | `sendMailAsync` (fire-and-forget) |
| **Subject** | `[FACE Prep E-Campus] [Action Required] CM Leave Request — {cmName}` |

---

### E-14 · KAM Decides on CM Leave → CM Notified
| Field | Value |
|---|---|
| **Trigger** | KAM approves or rejects the CM's leave request |
| **Route** | `PATCH /api/cm-leave` |
| **Template** | `renderEmailShell()` |
| **To** | Campus Manager (`campus_managers.email`) |
| **CC** | — |
| **BCC** | `ADMIN_AUDIT_EMAIL` (auto) |
| **Dispatch** | `sendMailAsync` (fire-and-forget) |
| **Subject** | `[FACE Prep E-Campus] Your {requestType} Request Has Been {APPROVED/REJECTED}` |

---

## Module 5 — Demo / L&D Sessions

### E-15 · Demo Swap Proposed (Internal — Mentor Replacement)
| Field | Value |
|---|---|
| **Trigger** | Mentor proposes another mentor as their replacement for an L&D session |
| **Route** | `POST /api/requests/demo-swap` (action = `request`, swapType = `internal`) |
| **Template** | `renderSwapOfferEmail()` |
| **To** | Proposed replacement mentor (`mentors.email`) |
| **CC** | — |
| **BCC** | `ADMIN_AUDIT_EMAIL` (auto) |
| **Dispatch** | `sendMailAsync` (fire-and-forget) |
| **Subject** | `[FACE Prep E-Campus] Demo Swap Proposal — {subject}` |

---

### E-16 · Demo Swap Proposed (External — SME Replacement)
| Field | Value |
|---|---|
| **Trigger** | SME proposes another SME as replacement evaluator |
| **Route** | `POST /api/requests/demo-swap` (action = `request`, swapType ≠ `internal`) |
| **Template** | `renderEmailShell()` |
| **To** | Proposed replacement SME (`sme_users.email`) |
| **CC** | — |
| **BCC** | `ADMIN_AUDIT_EMAIL` (auto) |
| **Dispatch** | `sendMailAsync` (fire-and-forget) |
| **Subject** | `[FACE Prep E-Campus] L&D Swap Proposal — {subject}` |

---

### E-17 · Demo Swap Rejected
| Field | Value |
|---|---|
| **Trigger** | SME/L&D rejects the swap proposal |
| **Route** | `POST /api/requests/demo-swap` (action = `resolve`, status = `rejected`) |
| **Template** | `renderEmailShell()` |
| **To** | Original requestor — mentor (`mentors.email`) or SME (`sme_users.email`) |
| **CC** | — |
| **BCC** | `ADMIN_AUDIT_EMAIL` (auto) |
| **Dispatch** | `sendMailAsync` (fire-and-forget) |
| **Subject** | `[FACE Prep E-Campus] Demo Swap Declined — {subject}` |

---

### E-18 · Demo Swap Approved → Both Parties Notified
| Field | Value |
|---|---|
| **Trigger** | L&D approves the swap; session is confirmed with new details |
| **Route** | `POST /api/requests/demo-swap` (action = `resolve`, status = `approved`) |
| **Template** | `renderEmailShell()` |
| **To** | Original mentor + proposed replacement mentor (comma-joined, deduplicated) |
| **CC** | — |
| **BCC** | `ADMIN_AUDIT_EMAIL` (auto) |
| **Dispatch** | `sendMailAsync` (fire-and-forget) |
| **Subject** | `[FACE Prep E-Campus] Demo Swap Approved — {subject} on {finalDate}` |

---

### E-19 · SME Evaluation Score → Mentor Notified
| Field | Value |
|---|---|
| **Trigger** | SME submits evaluation marks for a demo session |
| **Route** | `POST /api/demo-sessions` (action = `evaluate`) |
| **Template** | `renderSmeEvaluationEmail()` |
| **To** | Evaluated mentor (`mentors.email`) |
| **CC** | — |
| **BCC** | `ADMIN_AUDIT_EMAIL` (auto) |
| **Dispatch** | `sendMailAsync` (fire-and-forget, dynamic import) |
| **Subject** | `[FACE Prep E-Campus] Your L&D Evaluation Score — {subject} ({date})` |
| **Key details** | Score `{marks}/100`, pass/fail verdict, SME name, feedback, group |

---

### E-20 · Demo Compliance Gap → KAM + CM Escalation
| Field | Value |
|---|---|
| **Trigger** | Evaluation has unmet criteria (checklist items not ticked or mark below threshold) |
| **Route** | `POST /api/demo-sessions` (action = `evaluate`) |
| **Template** | `renderDemoComplianceEmail()` |
| **To** | All KAMs (`kam_users.email`) + Campus Managers for mentor's college |
| **CC** | Evaluating SME (`sme_users.email`) |
| **BCC** | `ADMIN_AUDIT_EMAIL` (auto) |
| **Dispatch** | `await` |
| **Subject** | `[Demo Compliance Gap] {mentorName} — {subject} ({date})` |
| **Key details** | Unmet criteria list, final mark, SME name, department |

---

## Module 6 — Interviews

### E-21 · Internal Interview Request Raised → CM Notified
| Field | Value |
|---|---|
| **Trigger** | Mentor creates a new internal student interview request |
| **Route** | `POST /api/interviews` (type = `internal`) |
| **Template** | `renderEmailShell()` |
| **To** | All Campus Managers for the college (comma-joined) |
| **CC** | — |
| **BCC** | `ADMIN_AUDIT_EMAIL` (auto) |
| **Dispatch** | `await` |
| **Subject** | `[New Interview Request] {subject} — {classGroup} by {mentorName}` |

---

### E-22 · External Interview Request Raised → KAM + Regional CAMs
| Field | Value |
|---|---|
| **Trigger** | Mentor creates a new external interview request |
| **Route** | `POST /api/interviews` (type = `external`) via `dispatchExternalInterviewNotifications()` |
| **Template** | `renderEmailShell()` |
| **To** | KAM + all regional CAMs under the same KAM cluster |
| **CC** | — |
| **BCC** | All recipient emails (hidden from each other) |
| **Dispatch** | `await` |
| **Subject** | `[External Interview Request] {subject} — Regional Notification ({N} Colleges)` |

---

### E-23 · Mentor(s) Assigned to Interview
| Field | Value |
|---|---|
| **Trigger** | CM assigns mentor(s) to conduct an interview session |
| **Route** | `POST /api/interviews/assign` |
| **Template** | `renderEmailShell()` |
| **To** | All assigned mentor email addresses (comma-joined) |
| **CC** | — |
| **BCC** | `ADMIN_AUDIT_EMAIL` (auto) |
| **Dispatch** | `await` |
| **Subject** | `[Interview Assignment] You have been assigned — {subject} on {date}` |
| **Key details** | Subject, class group, date, type (internal/external), student count, GMeet link if external |

---

### E-24 · KAM Notified of Interview Assignment (Internal)
| Field | Value |
|---|---|
| **Trigger** | CM assigns mentor(s) to an internal interview |
| **Route** | `POST /api/interviews/assign` |
| **Template** | `renderEmailShell()` |
| **To** | KAM for the college (`kam_users.email`) |
| **CC** | — |
| **BCC** | `ADMIN_AUDIT_EMAIL` (auto) |
| **Dispatch** | `await` |
| **Subject** | `[Interview Assigned] {subject} — {collegeId}` |

---

### E-25 · Interview Completed → Students Notified (Results Ready)
| Field | Value |
|---|---|
| **Trigger** | CM marks an interview as `completed` |
| **Route** | `PATCH /api/interviews` (status = `completed`) |
| **Template** | `renderEmailShell()` |
| **To** | — |
| **CC** | — |
| **BCC** | All students in the class group (batched in groups of 10) |
| **Dispatch** | `await` (batched loop) |
| **Subject** | `[Interview Results Ready] {subject} — {classGroup}` |
| **Note** | Students are always BCC'd — no class roster exposure |

---

## Module 7 — Campus Schedule

### E-26 · Schedule Updated → All Mentors Notified
| Field | Value |
|---|---|
| **Trigger** | Admin/CM configures a date or date range in the campus calendar |
| **Route** | `POST /api/daily-configs` |
| **Template** | `renderEmailShell()` |
| **To** | — |
| **CC** | — |
| **BCC** | All mentor emails for the college (deduplicated) |
| **Dispatch** | `await` (single batch call) |
| **Subject** | `[FACE Prep E-Campus] Campus Schedule Update - {startDate}` |
| **Key details** | Date range, day type, day order, session mode, campus notes |

---

### E-27 · Next Week Auto-Configured → All Mentors Notified
| Field | Value |
|---|---|
| **Trigger** | Admin/CM uses "Auto-Adapt Next Week" to copy current week's pattern |
| **Route** | `POST /api/daily-configs` (action = `auto_adapt_next_week`) |
| **Template** | `renderEmailShell()` |
| **To** | — |
| **CC** | — |
| **BCC** | All mentor emails for the college (deduplicated) |
| **Dispatch** | `await` (single batch call) |
| **Subject** | `[FACE Prep E-Campus] Next Week Schedule Auto-Configured` |

---

### E-28 · Day Order Not Configured Reminder → CM
| Field | Value |
|---|---|
| **Trigger** | System detects a working day with no day-order set (triggered from notifications route) |
| **Route** | `POST /api/notifications` |
| **Template** | `renderEmailShell()` |
| **To** | Campus Manager (`campus_managers.email`) |
| **CC** | — |
| **BCC** | `ADMIN_AUDIT_EMAIL` (auto) |
| **Dispatch** | `await` |
| **Subject** | `[Reminder] Day Order Not Configured — {date}` |

---

## Module 8 — Student Task Tracker

### E-29 · Task Assigned to Student(s)
| Field | Value |
|---|---|
| **Trigger** | Mentor/CM assigns a tracker task to students |
| **Route** | `POST /api/student-tracker` |
| **Template** | `renderEmailShell()` |
| **To** | — |
| **CC** | — |
| **BCC** | All eligible student emails (class roster hidden) |
| **Dispatch** | `await` |
| **Subject** | Dynamic based on task name |
| **Note** | Skipped if no valid student emails found |

---

## Module 9 — Announcements

### E-30 · New Announcement → Mentors + CMs of College
| Field | Value |
|---|---|
| **Trigger** | Admin creates an announcement scoped to a specific college |
| **Route** | `POST /api/announcements` |
| **Template** | `renderAnnouncementEmail()` |
| **To** | First mentor/CM email (visible sender anchor) |
| **CC** | — |
| **BCC** | All remaining mentor + CM emails for the college |
| **Dispatch** | `sendMailAsync` (fire-and-forget) |
| **Subject** | `[FACE Prep E-Campus] {title}` |
| **Note** | Only fires when `college_id` is set — system-wide announcements use in-app only |

---

## Module 10 — Issues

### E-31 · High/Critical Priority Issue Raised → KAM Alerted
| Field | Value |
|---|---|
| **Trigger** | CM logs a campus issue with priority = `high` or `critical` |
| **Route** | `POST /api/issues` |
| **Template** | `renderEmailShell()` |
| **To** | KAM for the college (via `colleges.kam_id → kam_users.email`) |
| **CC** | — |
| **BCC** | `ADMIN_AUDIT_EMAIL` (auto) |
| **Dispatch** | `sendMailAsync` (fire-and-forget) |
| **Subject** | `[FACE Prep E-Campus] [{PRIORITY} Issue] {title} — {collegeName}` |

---

## Module 11 — Manual Dispatch

### E-32 · Admin Manual Email Blast
| Field | Value |
|---|---|
| **Trigger** | Admin triggers a manual email from the Admin Dashboard |
| **Route** | `POST /api/send-mail` |
| **Template** | Any template from `ALLOWED_TEMPLATES` or custom HTML |
| **To** | Admin-specified recipient list (validated against known users in DB) |
| **CC** | — |
| **BCC** | `ADMIN_AUDIT_EMAIL` (auto) |
| **Dispatch** | `await` |
| **Subject** | Admin-specified |

---

## Module 12 — Account (Welcome)

### E-33 · New User Account Welcome
| Field | Value |
|---|---|
| **Trigger** | New user account created with a temporary password |
| **Route** | `sendAccountWelcomeEmail()` in `src/lib/mail.ts` |
| **Template** | Inline (inside `sendAccountWelcomeEmail`) |
| **To** | New user email |
| **CC** | — |
| **BCC** | `ADMIN_AUDIT_EMAIL` (auto) |
| **Dispatch** | `await` |
| **Subject** | `[FACE Prep E-Campus] Your Account Is Ready` |
| **⚠️ Note** | Function defined but **not yet called** from `/api/users` — needs wiring |

---

## Infrastructure Reference

### Email Provider Chain (in order)
```
1. Brevo REST API v3    → uses BREVO_API_KEY
2. Brevo SMTP           → uses SMTP_USER + SMTP_PASS
3. Google Apps Script   → uses NEXT_PUBLIC_GAS_MAIL_URL (HTTPS only)
4. Console mock log     → last resort, always "succeeds"
```

### Environment Variables Used
| Variable | Purpose |
|---|---|
| `BREVO_API_KEY` | Primary Brevo REST API authentication |
| `BREVO_SENDER_EMAIL` | From address |
| `BREVO_SENDER_NAME` | From display name (default: "FACE Prep E-Campus") |
| `SMTP_HOST` | Brevo SMTP host (default: `smtp-relay.brevo.com`) |
| `SMTP_PORT` | SMTP port (default: `587`) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `NEXT_PUBLIC_GAS_MAIL_URL` | Google Apps Script webhook URL (must be HTTPS) |
| `ADMIN_AUDIT_EMAIL` | Receives hidden BCC copy of every outgoing email |
| `SUPER_ADMIN_EMAIL` | Fallback escalation when no CM is configured |
| `NEXT_PUBLIC_APP_URL` | Used to build portal deep-links and logo URL |

### Admin Toggle
All emails respect the global mailing toggle in DB:
```sql
SELECT value FROM system_settings WHERE key = 'mailing_enabled'
-- value = 'false' or '0'  →  all emails silently skipped
```

### Audit Logging
Failed email attempts (all 3 providers down) are written to:
```sql
INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp)
VALUES (?, 'mail_failure', ?, 'System', 'System', ?)
```

---

## Quick Lookup — Who Gets Email for What

| Event | Recipient |
|---|---|
| Handover requested | Cover mentor |
| Handover approved/rejected | Requestor mentor |
| CM directly assigns cover | Newly assigned mentor |
| Swap proposed | Target mentor |
| Faculty leave submitted | CM + KAM |
| Leave cover slot assigned | Each cover mentor (async batch) |
| Faculty leave approved/rejected | Mentor |
| No CM found for leave | Super admin (escalation) |
| Student leave submitted | Class teacher + all CMs |
| Student leave decided | Student |
| CM leave submitted | KAM |
| CM leave decided | Campus Manager |
| Demo swap proposed (mentor) | Proposed replacement mentor |
| Demo swap proposed (SME) | Proposed replacement SME |
| Demo swap rejected | Original requestor |
| Demo swap approved | Both original + replacement mentor |
| SME evaluation completed | Evaluated mentor (their own score) |
| Demo compliance gap found | KAM + CM (To), SME (CC) |
| Internal interview raised | All CMs of campus |
| External interview raised | KAM + all regional CAMs (BCC) |
| Mentor assigned to interview | Assigned mentor(s) |
| Interview assignment (KAM view) | KAM |
| Interview completed | All students in class (BCC) |
| Schedule updated | All mentors of campus (BCC) |
| Day order missing | Campus Manager |
| Task assigned to student | Students (BCC) |
| Announcement created (college) | Mentors + CMs of college (BCC) |
| High-priority issue raised | KAM |
| Manual admin blast | Admin-specified list |
