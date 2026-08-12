# 📊 Zentra Role-by-Role Flowcharts & Approval Authorities

This document contains **pure visual flowcharts** for each of the 5 login roles, explicitly highlighting **WHO APPROVES** each action.

---

# 🎓 1. STUDENT ROLE FLOWCHART

```mermaid
flowchart TD
    Start[🔑 Student Login /api/login] --> Dash[StudentDashboard.tsx]

    Dash -->|View Schedule| Timetable[📅 View Class Timetable]
    Dash -->|View Tests| Marks[💯 View Test 1, Test 2 & Internal Marks]
    Dash -->|View Tasks| SkillTracker[📊 View Skill Tracker Submissions & Viva Grades]

    Dash -->|Apply Leave / OD| Form[📝 Fill Leave / OD Form: Type, Date, Reason]
    Form --> API_Leave[POST /api/requests/leave]
    API_Leave --> Email_CM[📩 Email Alert Sent to CM]
    Email_CM --> CM_Decision{🏢 APPROVER: Campus Manager}
    
    CM_Decision -->|APPROVED| Appr[✅ Status = Approved]
    Appr --> Auto_Att[⚙️ Auto-marked Present Excused in student_attendance]
    Auto_Att --> Student_Mail1[📩 Email Sent to Student: Approved]

    CM_Decision -->|REJECTED| Rej[❌ Status = Rejected]
    Rej --> Student_Mail2[📩 Email Sent to Student: Rejected]

    Dash -->|View Interviews| MyInterviews[🎤 'My Interviews' Tab]
    MyInterviews --> Fetch[GET /api/data?role=student]
    Fetch --> EvalCard[📊 Display Ratings: Comm, Content, Tech, Conf, Remarks & Clearance Status]
```

---

# 👨‍🏫 2. FACULTY MENTOR ROLE FLOWCHART

```mermaid
flowchart TD
    Start[🔑 Mentor Login /api/login] --> Dash[MentorDashboard.tsx]

    Dash -->|Daily Arrival| Punch[⏰ MentorPunchWidget: Punch In / Out]

    Dash -->|Class Period| MarkAtt[📋 Mark Class Attendance]
    MarkAtt --> WindowCheck{⏱️ Check Attendance Window}
    WindowCheck -->|Within Period + 15m| DirectSubmit[POST /api/attendance -> Attendance Saved]
    WindowCheck -->|> 15m Buffer| RequestCAM[Request Late Marking]
    RequestCAM --> CAM_AttDecision{🏢 APPROVER: Campus Manager}
    CAM_AttDecision -->|APPROVED| LateSaved[INSERT student_attendance: CAM Late Approval]

    Dash -->|Apply Faculty Leave/OD| FacLeaveForm[📝 Fill Faculty Leave / Permission / OD Form]
    FacLeaveForm --> API_FacLeave[POST /api/requests/faculty-leave]
    API_FacLeave --> CM_FacDecision{🏢 APPROVER: Campus Manager}
    CM_FacDecision -->|APPROVED| FacAppr[✅ Faculty Leave Approved + Email Sent]
    CM_FacDecision -->|REJECTED| FacRej[❌ Faculty Leave Rejected + Email Sent]

    Dash -->|Request Class Cover| HandoverForm[🔄 Select Slot, Target Cover Staff & Reason]
    HandoverForm --> API_Handover[POST /api/requests/handover]
    API_Handover --> CoverDecision{👨‍🏫 APPROVER: Cover Staff Mentor}
    CoverDecision -->|ACCEPTED| HandoverApproved[UPDATE approved_handovers -> Slot Transfers on Grid]
    CoverDecision -->|DECLINED / TIMEOUT| CMEmergency{🏢 APPROVER: Campus Manager Emergency}
    CMEmergency -->|APPROVED| HandoverApproved

    Dash -->|Raise Interview Request| IntForm[🎤 Fill Subject, Target Date >= Today+2, Type]
    IntForm --> IntRuleCheck{Rule Check: Subject != Tamil & Date >= Today+2}
    IntRuleCheck -->|Valid| API_IntPOST[POST /api/interviews]
    API_IntPOST --> CM_IntAlloc{🏢 APPROVER & ALLOCATOR: Campus Manager}
    CM_IntAlloc --> AllocMentors[Assigns Evaluator Mentors & GMeet Link]
    AllocMentors --> ConductEval[Mentor Conducts & Grades: Comm, Content, Tech, Conf]
    ConductEval --> API_Eval[POST /api/interviews/evaluate]
    API_Eval --> IntVerif{🏢 APPROVER & VERIFIER: Campus Manager}
    IntVerif --> IntComplete[PATCH /api/interviews -> Status = Completed + Batch Student Emails]
```

---

# 🏢 3. CAMPUS MANAGER (CAM / CM) ROLE FLOWCHART

```mermaid
flowchart TD
    Start[🔑 CAM Login /api/login] --> Dash[CAMDashboard.tsx Scoped to college_id]

    Dash -->|Student Leave Requests| ReviewStudLeave[📋 Review Pending Student Leave & OD Requests]
    ReviewStudLeave --> CM_StudLeave{🏢 ROLE: CAM Approves?}
    CM_StudLeave -->|APPROVE| PUT_StudAppr[PUT /api/requests/leave -> Status = Approved]
    PUT_StudAppr --> AutoExcused[⚙️ Auto-inserts Present Excused for All Class Periods]
    AutoExcused --> MailStudent1[📩 Email Sent to Student]
    CM_StudLeave -->|REJECT| PUT_StudRej[PUT /api/requests/leave -> Status = Rejected]
    PUT_StudRej --> MailStudent2[📩 Email Sent to Student]

    Dash -->|Faculty Leave Requests| ReviewFacLeave[📋 Review Pending Faculty Leave / Permission / OD]
    ReviewFacLeave --> CM_FacLeave{🏢 ROLE: CAM Approves?}
    CM_FacLeave -->|APPROVE| PUT_FacAppr[PUT /api/requests/faculty-leave -> Status = Approved]
    PUT_FacAppr --> MailFaculty1[📩 Email Sent to Mentor]
    CM_FacLeave -->|REJECT| PUT_FacRej[PUT /api/requests/faculty-leave -> Status = Rejected]
    PUT_FacRej --> MailFaculty2[📩 Email Sent to Mentor]

    Dash -->|Class Handovers| EmergencyCover[🔄 Review Pending Handovers & Emergency Overrides]
    EmergencyCover --> CM_Cover{🏢 ROLE: CAM Approves Emergency Cover?}
    CM_Cover -->|APPROVE| PUT_Cover[INSERT approved_handovers -> Transferred Slot Active]

    Dash -->|Faculty Attendance Audit| MissedLogs[⚠️ Audit Missed Faculty Attendance Logs]
    MissedLogs --> SendWarning[📩 1-Click Send Warning Email to Faculty]

    Dash -->|Interview Allocations| ReviewInterviews[🎤 Review Pending Interview Requests]
    ReviewInterviews --> CM_IntAlloc{🏢 ROLE: CAM Allocates & Approves?}
    CM_IntAlloc --> AssignMentors[POST /api/interviews/assign -> Assigns Mentors & GMeet Link]
    AssignMentors --> ReviewScores[Verifies Scores Submitted by Mentors]
    ReviewScores --> CM_IntVerify{🏢 ROLE: CAM Verifies Scores?}
    CM_IntVerify -->|VERIFY & COMPLETE| CompletePatch[PATCH /api/interviews -> Status = Completed]
    CompletePatch --> BatchMail[📩 Batch Email Dispatched to Student Cohort]

    Dash -->|Student Directory| ExcelImport[📥 Download Template & Import Bulk Students Excel]
```

---

# 📈 4. KEY ACCOUNT MANAGER (KAM) ROLE FLOWCHART

```mermaid
flowchart TD
    Start[🔑 KAM Login /api/login] --> Dash[KAMDashboard.tsx Across All Campuses]

    Dash -->|Task Delegation| DelegateTask[📋 Create Deliverable / SLA Task for Campus Manager]
    DelegateTask --> POST_Task[POST /api/tasks]
    POST_Task --> KAM_TaskAssigned{📈 ROLE: KAM Assigns & Delegates}
    KAM_TaskAssigned --> CAM_Notified[📩 Notification Sent to Campus Manager]

    Dash -->|Escalated Issues| ViewIssues[⚠️ Audit Escalated Campus Infrastructure / Academic Issues]
    ViewIssues --> KAM_IssueResolve{📈 ROLE: KAM Approves & Resolves Issue}
    KAM_IssueResolve --> IssueClosed[Status = Resolved]

    Dash -->|Multi-Campus Audit| AuditMetrics[📊 Audit Timetable Slots, Faculty Workload & Interview Metrics Across All Colleges]
```

---

# 🛡️ 5. SYSTEM ADMIN ROLE FLOWCHART

```mermaid
flowchart TD
    Start[🔑 Admin Login /api/login] --> Dash[AdminDashboard.tsx System Control]

    Dash -->|User Signups| ReviewSignups[👥 Review Pending User Signups]
    ReviewSignups --> Admin_Signup{🛡️ ROLE: System Admin Approves?}
    Admin_Signup -->|APPROVE| UserCreated[INSERT INTO users & mentors/students]
    Admin_Signup -->|REJECT| UserRejected[DELETE signup_request]

    Dash -->|Campus Setup| ManageColleges[🏛️ Add, Edit, Delete Colleges & Departments]

    Dash -->|Master Timetable Engine| TimetableConfig[⚙️ Configure Slot Timings, Working Days, Workload Limits]

    Dash -->|Audit Traces| AuditLogs[🔍 Inspect Master Security Audit Logs]
```

---

## 🏛️ 6. Quick Approval Authority Reference Table

| Action / Workflow | Requesting Role | 🎯 WHO APPROVES? | API Endpoint Used | Result / Side-Effect |
| :--- | :--- | :--- | :--- | :--- |
| **Student Leave / OD** | 🎓 Student | 🏢 **Campus Manager (CAM)** | `PUT /api/requests/leave` | Auto-excuses class attendance as `present` + Sends decision email. |
| **Faculty Leave / OD / Permission** | 👨‍🏫 Mentor | 🏢 **Campus Manager (CAM)** | `PUT /api/requests/faculty-leave` | Approves leave + Sends decision email to mentor. |
| **Class Handover (Regular)** | 👨‍🏫 Mentor A | 👨‍🏫 **Cover Staff Mentor B** | `PUT /api/requests/resolve` | Slot transfers responsibility to Mentor B on timetable grid. |
| **Class Handover (Emergency)** | 👨‍🏫 Mentor A | 🏢 **Campus Manager (CAM)** | `PUT /api/requests/resolve` | Emergency CAM override transfers slot responsibility. |
| **Late Attendance Punch (>15m)** | 👨‍🏫 Mentor | 🏢 **Campus Manager (CAM)** | `Academic Monitoring` | CAM approves late period attendance marking. |
| **Interview Request Creation** | 👨‍🏫 Mentor | 🏢 **Campus Manager (CAM)** | `POST /api/interviews` | Validates date (≥ +2 days, non-Tamil), alerts CM via email. |
| **Interview Allocation & GMeet** | 🏢 CAM | 🏢 **Campus Manager (CAM)** | `POST /api/interviews/assign` | Assigns evaluator mentors and GMeet link to session. |
| **Interview Score Verification** | 🏢 CAM | 🏢 **Campus Manager (CAM)** | `PATCH /api/interviews` | Verifies score ratings, marks completed, sends batch student emails. |
| **KAM Deliverables & Tasks** | 📈 KAM | 📈 **Key Account Manager (KAM)** | `POST /api/tasks` | Creates task assigned to Campus Manager. |
| **User Signups & System Setup** | 👥 User | 🛡️ **System Admin** | `Admin Panel` | Approves user signup requests and initializes credentials. |
