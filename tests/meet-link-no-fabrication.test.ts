import { existsSync, readFileSync } from "fs";
import { readdirSync, statSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { createGoogleCalendarEvent, generateStudentGCalUrl } from "@/lib/google-calendar";

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.(ts|tsx)$/.test(full)) out.push(full);
  }
  return out;
}

describe("Google Meet links are never fabricated", () => {
  it("returns no link when the session has none and Calendar creation is not configured", async () => {
    delete process.env.NEXT_PUBLIC_GAS_MAIL_URL;
    const result = await createGoogleCalendarEvent({
      title: "Structured Interview: React (III BCA)",
      targetDate: "2026-11-04",
      interviewId: "int_1"
    });

    expect(result.gmeet_link).toBeNull();
    expect(result.meet_id).toBeNull();
    expect(result.event_created).toBe(false);
    expect(result.ics_content).not.toContain("X-GOOGLE-CONFERENCE");
    expect(result.ics_content).not.toContain("meet.google.com");
    expect(result.ics_content).toContain("will be shared by your evaluator");
  });

  it("keeps a link that an evaluator or CM actually saved", async () => {
    const real = "https://meet.google.com/mqb-afwp-ppq";
    const result = await createGoogleCalendarEvent({
      title: "Structured Interview: DSA",
      targetDate: "2026-11-04",
      existingMeetLink: real,
      interviewId: "int_2"
    });

    expect(result.gmeet_link).toBe(real);
    expect(result.meet_id).toBe("mqb-afwp-ppq");
    expect(result.ics_content).toContain(`URL:${real}`);
    expect(result.ics_content).toContain(`X-GOOGLE-CONFERENCE:${real}`);
    expect(result.gcal_link).toContain(encodeURIComponent(real));
  });

  it("omits the location and join line from a student calendar link when there is no room", () => {
    const withoutLink = generateStudentGCalUrl({
      studentName: "Aarthi R",
      subject: "React",
      targetDate: "2026-11-04",
      slotStartTime: "09:00 AM",
      slotEndTime: "09:15 AM"
    });
    expect(withoutLink).not.toContain("location=");
    expect(withoutLink).not.toContain("Join%20Google%20Meet");

    const withLink = generateStudentGCalUrl({
      studentName: "Aarthi R",
      subject: "React",
      targetDate: "2026-11-04",
      slotStartTime: "09:00 AM",
      slotEndTime: "09:15 AM",
      gmeetLink: "https://meet.google.com/mqb-afwp-ppq"
    });
    expect(withLink).toContain(`location=${encodeURIComponent("https://meet.google.com/mqb-afwp-ppq")}`);
  });

  it("ships no Meet-code generator", async () => {
    const mod = await import("@/lib/google-calendar");
    expect((mod as any).generateGoogleMeetCode).toBeUndefined();
    expect(existsSync(join(process.cwd(), "src/lib/google-calendar.ts"))).toBe(true);
  });

  it("never builds a meet.google.com URL out of an id or random chunk", () => {
    const offenders = sourceFiles(join(process.cwd(), "src"))
      .filter((file) => readFileSync(file, "utf8").includes("meet.google.com/${"))
      .map((file) => file.replace(process.cwd(), ""));
    expect(offenders).toEqual([]);
  });

  it("does not persist a Meet link from the interviews GET handler", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/interviews/route.ts"), "utf8");
    expect(route).not.toContain("UPDATE student_interviews SET gmeet_link");
    expect(route).toContain("effectiveGmeet = studentSlots.find((s: any) => s.gmeet_link)?.gmeet_link || null");
  });
});
