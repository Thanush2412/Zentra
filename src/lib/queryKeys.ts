/**
 * Central query-key registry. The first key segment is the data domain so
 * broadcastDataChanged(domain) can invalidate a whole family at once.
 */
export const qk = {
  notifications: (userId: string) => ["notifications", userId] as const,
  notificationsFull: (userId: string) => ["notifications", userId, "full"] as const,
  myFeedback: (userId: string) => ["feedback", "mine", userId] as const,
  skillTracker: (collegeId: string, mentorId?: string) => ["skill-tracker", collegeId, mentorId || "all"] as const,
  skillReport: (collegeId: string, month: string, year: string) =>
    ["skill-development", collegeId, month, year] as const,
  placement: (college: string, passingYear: string, degree: string) =>
    ["placement", college, passingYear, degree] as const,
  codingStats: (college: string) => ["coding-stats", college] as const,
  weeklyPlan: (collegeId: string, mentorId: string) => ["weekly-plan", collegeId, mentorId] as const,
  weeklyPlanBasic: (collegeId: string, mentorId: string) =>
    ["weekly-plan", "basic", collegeId, mentorId] as const,
  campusAudits: (collegeId: string) => ["campus-audits", collegeId] as const,
  observations: (collegeId: string) => ["observations", collegeId] as const,
  exams: (collegeId: string) => ["exams", collegeId] as const,
  examMarks: (collegeId: string) => ["exams", "marks", collegeId] as const,
  examRoster: (examId: string) => ["exams", "roster", examId] as const,
  examEditRequests: (examId: string) => ["requests", "exam-edit", examId] as const,
  adminUsers: (collegeId: string) => ["admin-users", collegeId] as const,
  adminKams: () => ["admin-kams"] as const,
  adminFeedback: (collegeId: string) => ["admin-feedback", collegeId] as const,
  loginHistory: (collegeId: string) => ["login-history", collegeId] as const,
  announcements: (collegeId: string) => ["announcements", collegeId] as const,
  systemSettings: () => ["system-settings"] as const,
  approvals: (status = "all", collegeId = "all") => ["approvals", status, collegeId] as const,
  studentExams: (studentId: string, collegeId: string, scope = "") => ["student-exams", studentId, collegeId, scope] as const,
  studentAchievements: (studentId: string) => ["student-achievements", studentId] as const,
  studentMaterials: (collegeId: string, groupId: string) => ["student-materials", collegeId, groupId] as const,
  studentInterviews: (studentId: string, scope = "") => ["student-interviews", studentId, scope] as const,
  studentFees: (studentId: string) => ["fees", "student", studentId] as const,
  materials: (scope: string) => ["materials", scope] as const,
  dailyConfigs: (collegeId: string) => ["daily-configs", collegeId] as const,
  lndDailyConfigs: (collegeIds: string, scope: string) => ["daily-configs", "lnd", collegeIds, scope] as const,
  contestLinks: (collegeId: string, collegeName: string, department: string, classGroup: string) =>
    ["contest-links", collegeId, collegeName, department, classGroup] as const,
  studentCodingStats: (studentId: string, scope: string) => ["coding-stats", "student", studentId, scope] as const,
  interviewList: (scope: string) => ["interviews", scope] as const,
  demoCriteria: (collegeId: string) => ["demo-eval-criteria", collegeId] as const,
  cmPunch: (userId: string, collegeId: string) => ["cm-attendance", userId, collegeId] as const,
  mentorAttendance: (mentorId: string) => ["mentor-attendance", mentorId] as const,
  incomingCovers: (mentorId: string) => ["requests", "incoming-covers", mentorId] as const,
  cmLeave: (userId: string) => ["cm-leave", userId] as const,
  kamStudents: (collegeId: string, query: string) => ["kam", "students", collegeId, query] as const,
  kamStudentProgress: (studentId: string, collegeId: string) => ["kam", "student-progress", studentId, collegeId] as const,
  kamMentorProgress: (mentorId: string) => ["kam", "mentor-progress", mentorId] as const,
  kamPanel: (panel: string, collegeId: string, params: string) => ["kam", panel, collegeId, params] as const,
  fees: (tab: string, collegeId: string, year: string, extra: string) => ["fees", tab, collegeId, year, extra] as const,
  demoReallocations: (collegeId: string) => ["demo-reallocations", collegeId] as const,
  facultyLeave: (collegeId: string) => ["requests", "faculty-leave", collegeId] as const,
  mentorNps: (college: string, month: string) => ["mentor-nps", college, month] as const,
  clientNps: (college: string) => ["client-nps", college] as const,
  achievements: (collegeId: string) => ["achievements", collegeId] as const,
} as const;

// Maps the coarse change domains broadcast by AppContext mutations to the
// query-key roots whose cached tab data they invalidate.
const DOMAIN_ROOTS: Record<string, string[]> = {
  slots: ["weekly-plan", "student-exams", "exams"],
  requests: ["requests", "weekly-plan"],
  attendance: ["attendance", "cm-attendance", "campus-audits", "observations", "kam"],
  kams: ["kam", "admin-kams"],
  cams: ["admin-users", "interviews", "kam"],
  weeklyTasks: ["weekly-plan"],
  studentTracker: ["skill-tracker", "skill-development"],
  // A day-order or exam write is read by four different roles through three
  // different query roots; a write that only refreshes its own screen leaves
  // the other portals on yesterday's timetable.
  "daily-configs": ["daily-configs"],
  exams: ["exams", "student-exams"],
  materials: ["materials", "student-materials"],
  demos: ["demo-reallocations", "demo-sessions"],
  holidays: ["holidays"],
  announcements: ["announcements"],
  events: ["events"],
};

export function queryRootsForDomain(domain: string): string[] {
  return [domain, ...(DOMAIN_ROOTS[domain] || [])];
}
