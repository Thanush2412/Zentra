import { NextResponse } from "next/server";
import { sendMail, formatZentraEmail } from "@/lib/mail";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { to, subject, htmlBody, template, data } = body;

    if (!to || !subject) {
      return NextResponse.json({ success: false, message: "Missing to or subject" }, { status: 400 });
    }

    let finalHtml = htmlBody;

    if (template === "missed_attendance" && data) {
      finalHtml = formatZentraEmail({
        title: "Action Required: Missed Attendance Marking",
        badgeText: "Compliance Warning",
        badgeColor: "rose",
        description: `Dear <strong>${data.mentorName}</strong>, this is an official compliance notification that student attendance records have not been submitted for your class session.`,
        details: [
          { label: "Date", value: `${data.dateStr} (${data.dayName})` },
          { label: "Period/Time", value: data.time },
          { label: "Course", value: data.course },
          { label: "Student Group", value: data.classGroup, highlight: true }
        ],
        footerText: "Please log in to your Zentra Portal to submit the logs immediately."
      });
    }

    if (!finalHtml) {
      return NextResponse.json({ success: false, message: "Missing htmlBody or template details" }, { status: 400 });
    }

    const res = await sendMail({ to, subject, htmlBody: finalHtml });
    return NextResponse.json(res);
  } catch (error: any) {
    console.error("API POST send-mail error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
