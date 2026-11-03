-- One-time indexes for the dashboard/auth hot paths.
-- Safe to re-run: every statement is IF NOT EXISTS.
-- Apply in Supabase -> SQL Editor during a quiet period (index builds take locks).

-- Auth fallbacks
CREATE INDEX IF NOT EXISTS idx_users_reference_id ON users(reference_id);
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_mentors_email_lower ON mentors(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_students_email_lower ON students(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_campus_managers_email_lower ON campus_managers(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_kam_users_email_lower ON kam_users(LOWER(email));

-- Attendance windows and campus scoping
CREATE INDEX IF NOT EXISTS idx_student_attendance_studentid ON student_attendance(studentid);
CREATE INDEX IF NOT EXISTS idx_student_attendance_slotid ON student_attendance(slotid);
CREATE INDEX IF NOT EXISTS idx_student_attendance_student_date ON student_attendance(studentid, datestr);
CREATE INDEX IF NOT EXISTS idx_student_attendance_slot_date ON student_attendance(slotid, datestr);
CREATE INDEX IF NOT EXISTS idx_student_attendance_date ON student_attendance(datestr);
CREATE INDEX IF NOT EXISTS idx_slots_college ON slots(college_id);
CREATE INDEX IF NOT EXISTS idx_slots_mentor ON slots(mentorid);
CREATE INDEX IF NOT EXISTS idx_students_college ON students(college_id);
CREATE INDEX IF NOT EXISTS idx_mentors_college ON mentors(college_id);

-- Lists and feeds
CREATE INDEX IF NOT EXISTS idx_leave_requests_studentid ON leave_requests(studentid);
CREATE INDEX IF NOT EXISTS idx_leave_requests_timestamp ON leave_requests(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_faculty_leave_status ON faculty_leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_handover_requests_timestamp ON handover_requests(timestamp DESC);

ANALYZE users, mentors, students, campus_managers, kam_users, student_attendance, slots,
        leave_requests, notifications, audit_logs, faculty_leave_requests, handover_requests;
