import { describe, it, expect } from "vitest";
import { adaptQueryForPostgres } from "../src/lib/db";

/**
 * docs/ISSUES_BACKEND.md BE-H03 claims the student weekly_academic_tasks query
 * "mixes ? and $N::text", is "invalid for both databases" and "always throws a
 * runtime error". It is valid: the adapter numbers the ? placeholders in order
 * of appearance and leaves explicit $N tokens alone, so ? ? ? $4 $5 bind to the
 * five supplied params. These tests pin that contract so a later edit to either
 * side cannot silently break the binding.
 */
const STUDENT_WEEKLY_TASKS_SQL =
  "SELECT * FROM weekly_academic_tasks WHERE (class_group IN (SELECT DISTINCT classGroup FROM students WHERE id = ? OR email = ? OR (college_id = ? AND college_id IS NOT NULL))) OR ($4::text IS NOT NULL AND mentor_id IN (SELECT id FROM mentors WHERE college_id = $5::text)) ORDER BY week_number ASC LIMIT 500";

function placeholderIndexes(sql: string): number[] {
  return [...sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));
}

describe("adaptQueryForPostgres placeholder numbering", () => {
  it("numbers the ? placeholders in order and preserves explicit $N tokens", () => {
    const { sql } = adaptQueryForPostgres(STUDENT_WEEKLY_TASKS_SQL, []);

    expect(sql).toContain("$1");
    expect(sql).toContain("$2");
    expect(sql).toContain("$3");
    expect(sql).toContain("$4::text");
    expect(sql).toContain("$5::text");
    expect(sql).not.toContain("?");
  });

  it("binds every placeholder exactly once for the five params the caller supplies", () => {
    const params = ["mentor_1", "m@faceprep.in", "college_a", "college_a", "college_a"];
    const { sql } = adaptQueryForPostgres(STUDENT_WEEKLY_TASKS_SQL, params);
    const indexes = placeholderIndexes(sql);

    expect(new Set(indexes).size).toBe(indexes.length); // no duplicate numbering
    expect(Math.max(...indexes)).toBe(params.length); // last token has a value
    expect(indexes.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]); // no gap
  });

  it("counts ? occurrences against params for the scoped role branches", () => {
    const branches = [
      "SELECT * FROM student_attendance WHERE slotId = ? AND dateStr = ? AND studentId = ?",
      "SELECT * FROM mentors WHERE college_id IN (?,?)",
      "SELECT sa.id FROM student_attendance sa WHERE (sa.slotId IN (SELECT id FROM slots WHERE mentorId = ?) OR sa.markedBy = ?) AND sa.dateStr >= ?",
      "SELECT id FROM users WHERE (LOWER(id) = ? OR LOWER(email) = ? OR LOWER(reference_id) = ?)"
    ];
    for (const sql of branches) {
      const count = (sql.match(/\?/g) || []).length;
      const adapted = adaptQueryForPostgres(sql, Array.from({ length: count }, (_, i) => i));
      expect(placeholderIndexes(adapted.sql)).toEqual(
        Array.from({ length: count }, (_, i) => i + 1)
      );
    }
  });

  it("leaves a query with no placeholders untouched", () => {
    const { sql, params } = adaptQueryForPostgres("SELECT 1 WHERE 1 = 0", []);
    expect(sql).toBe("SELECT 1 WHERE 1 = 0");
    expect(params).toEqual([]);
  });
});
