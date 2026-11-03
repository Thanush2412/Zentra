# FACE Prep E-Campus — Email Notifications Guide

This document lists every automated email the system sends, written for operations staff and college administrators. No technical knowledge required.

---

## What Triggers an Email?

Every email is triggered by a specific action taken inside the E-Campus portal — either by a mentor, campus manager, KAM, SME, or student. Emails go out automatically. Nobody needs to press "send."

---

## CLASS HANDOVER EMAILS

---

**When a mentor requests a handover**

- **Who receives it:** The mentor who was asked to cover the class
- **What it says:** "Your colleague [Name] needs you to cover their [Subject] class on [Date] at [Time]. Please log in to accept or decline."
- **Reply-to behaviour:** Clicking the button takes them directly to the handover dashboard

---

**When a cover mentor accepts the handover**

- **Who receives it:** The mentor who originally requested the handover
- **What it says:** "Good news — your handover for [Subject] on [Date] has been accepted by [Cover Name]."

---

**When a cover mentor declines the handover**

- **Who receives it:** The mentor who originally requested the handover
- **What it says:** "Your handover request for [Subject] on [Date] was not accepted. Please arrange an alternative or contact your Campus Manager."

---

**When the Campus Manager directly assigns a cover**

- **Who receives it:** The mentor who was assigned as cover (by the CM)
- **What it says:** "The Campus Manager [Name] has assigned you to cover [Subject] on [Date]."

---

**When a swap is proposed between two mentors**

- **Who receives it:** The mentor being proposed as the swap partner
- **What it says:** "[Mentor Name] has proposed swapping a class with you. Please review and respond on the portal."

---

## FACULTY LEAVE EMAILS

---

**When a mentor submits a leave application**

- **Who receives it:** The Campus Manager of that college (and the KAM if one is assigned)
- **What it says:** "[Mentor Name] has applied for [Leave Type] from [Start Date] to [End Date]. Their reason: [Reason]. [X] classes need cover — please review."
- **If cover mentors were nominated:** Each nominated cover mentor also gets a separate email asking them to accept or decline that specific class slot.

---

**When the Campus Manager approves or rejects a leave**

- **Who receives it:** The mentor who applied
- **What it says:** "Your [Leave Type] application has been [approved / rejected] by your Campus Manager. [If rejected: Remarks — ...]"

---

**When no Campus Manager is set up for a college**

- **Who receives it:** The System Administrator
- **What it says:** "A leave request was submitted at [College] but no Campus Manager email is on file. Please assign a CM or handle this manually."

---

## CAMPUS MANAGER LEAVE EMAILS

---

**When a Campus Manager applies for leave**

- **Who receives it:** The KAM responsible for that college
- **What it says:** "Campus Manager [Name] at [College] has applied for [Leave Type] from [Start] to [End]. Please review and approve or reject in your dashboard."

---

**When the KAM approves or rejects the CM's leave**

- **Who receives it:** The Campus Manager who applied
- **What it says:** "Your [Leave Type] application has been [approved / rejected] by [KAM Name]."

---

## STUDENT LEAVE EMAILS

---

**When a student submits a leave or OD request**

- **Who receives it:** The class teacher and all Campus Managers of that college
- **What it says:** "Student [Name] from [Class] has requested [Leave / OD / Permission] for [Date]. Please review."

---

**When the Campus Manager approves or rejects a student leave**

- **Who receives it:** The student who applied
- **What it says:** "Your [leave / OD / permission] request for [Date] has been [approved / rejected]."

---

## DEMO / L&D SESSION EMAILS

---

**When a mentor or SME proposes a session swap**

- **Who receives it:** The proposed replacement mentor or SME
- **What it says:** "[Name] has proposed you as a replacement for the [Subject] L&D session on [Date] at [Time]. Please review on the portal."

---

**When a swap is rejected**

- **Who receives it:** The person who raised the swap request
- **What it says:** "The proposed swap for [Subject] was not approved. The session has been placed back in the reallocation queue."

---

**When a swap is approved**

- **Who receives it:** Both the original mentor and the replacement mentor
- **What it says:** "The L&D session swap for [Subject] has been approved. The confirmed session is now scheduled for [Date] at [Time] with [Mentor Name] and SME [SME Name]."

---

**When an SME submits evaluation marks for a mentor**

- **Who receives it:** The mentor who was evaluated
- **What it says:** "Your L&D evaluation for [Subject] on [Date] has been submitted by SME [Name]. Your score: [X / 100] — [Cleared / Not Cleared]. Feedback: [Comments]. View the full scorecard on the portal."

---

**When evaluation criteria are not fully met (compliance gap)**

- **Who receives it:**
  - **To:** KAM + Campus Manager(s) of that college
  - **CC:** The SME who conducted the evaluation
- **What it says:** "A compliance gap was detected during [Mentor Name]'s L&D evaluation for [Subject] on [Date]. The following criteria were not met: [list]. Final score: [X/100]. Action may be required."

---

## INTERVIEW EMAILS

---

**When a mentor raises a new internal interview request**

- **Who receives it:** All Campus Managers of that college
- **What it says:** "Mentor [Name] has raised an internal interview request for [Subject] — [Class Group] on [Target Date]. Please review and assign evaluators."

---

**When an external interview request is raised**

- **Who receives it:** The KAM and all Campus Managers across the regional college cluster (each recipient cannot see the others)
- **What it says:** "A new external interview has been raised for [Subject] by [College]. Your college may be asked to provide evaluator capacity. Please review on the portal."

---

**When a Campus Manager assigns mentors to conduct an interview**

- **Who receives it:** Every mentor who was assigned
- **What it says:** "You have been assigned to conduct a [Internal / External] interview for [Subject] with [Class Group] on [Date]. Student count: [N]. [Google Meet link if external]"

---

**When the KAM is notified of an internal interview assignment**

- **Who receives it:** The KAM for that college
- **What it says:** "Campus Manager [Name] has assigned [Mentor Names] to conduct an interview for [Subject] on [Date]. [N] students involved."

---

**When an interview is marked as completed**

- **Who receives it:** All students in the class group (each student cannot see classmates' emails)
- **What it says:** "Your [Subject] interview evaluation results are ready. Log in to the portal to view your score. Verified by Campus Manager [Name]."

---

## CAMPUS SCHEDULE EMAILS

---

**When the campus calendar is updated**

- **Who receives it:** All mentors at that college (each mentor cannot see others' emails)
- **What it says:** "The campus schedule has been updated. [Date Range] has been set as a [Working Day / Holiday / Event / Exam Day] — [Day Order if applicable] — [Offline / Online] mode. Notes: [...]"

---

**When next week's schedule is auto-configured**

- **Who receives it:** All mentors at that college (each mentor cannot see others' emails)
- **What it says:** "Next week's campus schedule ([Monday] to [Sunday]) has been automatically set up based on this week's pattern. Please review your timetable."

---

**When a day's schedule is not configured (reminder)**

- **Who receives it:** The Campus Manager
- **What it says:** "Reminder: the day order for [Date] has not been configured yet. Please set it up in the daily schedule section before classes begin."

---

## TASK TRACKER EMAILS

---

**When a task is assigned to students**

- **Who receives it:** The students assigned (each student cannot see others' emails)
- **What it says:** "A new task has been assigned to you. Log in to view the details and complete it before the deadline."

---

## ANNOUNCEMENT EMAILS

---

**When a college-specific announcement is created**

- **Who receives it:** All mentors and Campus Managers at that college (each recipient cannot see others' emails)
- **What it says:** The full announcement title and description, with a link to the portal.
- **Note:** System-wide announcements (not scoped to one college) only show as in-app notifications — no email is sent, to avoid sending to hundreds of colleges at once.

---

## ISSUE / ESCALATION EMAILS

---

**When a high or critical priority campus issue is logged**

- **Who receives it:** The KAM responsible for that college
- **What it says:** "A [HIGH / CRITICAL] priority issue has been raised at [College]: [Issue Title]. Description: [Details]. Please review and take action on the portal."

---

## ADMIN MANUAL EMAIL

---

**When an administrator sends a manual notification**

- **Who receives it:** Whichever users the admin specifies (validated against known portal users)
- **What it says:** Whatever the admin writes, using the standard E-Campus email template

---

## Privacy Notes

- **BCC is used** whenever an email goes to a group (students in a class, mentors at a college). This means nobody in the group can see the email addresses of others.
- Every email that goes out is silently copied to the internal audit mailbox for compliance records.
- All emails can be turned off system-wide by the admin using the mailing toggle in Settings. When disabled, emails are skipped but in-app notifications still work normally.

---

## Email Sender Identity

All automated emails come from:

> **From:** FACE Prep E-Campus  
> **Reply-To:** No reply (automated notification — do not reply)  
> **Footer:** © [Current Year] FACE Prep E-Campus Operations. All rights reserved.
