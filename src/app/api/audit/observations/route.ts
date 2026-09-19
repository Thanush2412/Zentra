// Pin to Mumbai (bom1) — co-located with Supabase DB
export const preferredRegion = "bom1";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { CLASSROOM_SNAPS, sbRest, sbHeaders, normCollegeName } from "@/lib/audit-sources";
import { sendMail, renderEmailShell } from "@/lib/mail";

// ── Classroom Observation Log — proxied from the legacy classroom_snaps table ──
// GET  ?college=<name>            → list observations for a college (or all if omitted & allowed)
// POST { formData multipart }     → upload photo to storage bucket + insert row (+ escalation mail)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const college = (searchParams.get("college") || "").trim();
    const limit = Math.min(parseInt(searchParams.get("limit") || "60", 10) || 60, 200);

    let path = `${CLASSROOM_SNAPS.table}?select=*&order=created_at.desc&limit=${limit}`;
    if (college) {
      // Legacy rows store the college verbatim — fetch a superset then fuzzy-match server-side
      path += `&college=ilike.${encodeURIComponent("%" + college.replace(/[%_]/g, "") + "%")}`;
    }

    const rows: any[] = await sbRest(CLASSROOM_SNAPS.url, CLASSROOM_SNAPS.key, path);

    // Extra safety: fuzzy filter client-side-invisible matching (server does the scoping)
    const scoped = college
      ? rows.filter(r => {
          const a = normCollegeName(String(r.college || ""));
          const b = normCollegeName(college);
          return a === b || a.includes(b) || b.includes(a);
        })
      : rows;

    return NextResponse.json({ success: true, count: scoped.length, observations: scoped });
  } catch (err: any) {
    console.error("Observations GET error:", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to load classroom observations" },
      { status: 500 }
    );
  }
}

interface ObsPayload {
  college: string;
  manager_name?: string | null;
  class_name?: string | null;
  department?: string | null;
  subject?: string | null;
  course_name?: string | null;
  course_type?: string | null;
  teacher_name?: string | null;
  mentor_name?: string | null;
  notes?: string | null;
  comments?: string | null;
  observation_date?: string | null;
  photo_url?: string | null;
  photo_lat?: number | null;
  photo_lng?: number | null;
  photo_location_accuracy?: number | null;
  rating_professionalism?: number | null;
  rating_class_handling?: number | null;
  rating_skill_development?: number | null;
  rating_student_engagement?: number | null;
  rating_tasks_followup?: number | null;
  rating_session_plan_adherence?: number | null;
  rating_study_material_sharing?: number | null;
  overall_rating?: number | null;
  satisfaction_status?: string | null;
  satisfaction_remarks?: string | null;
}

const RATING_FIELDS = [
  "rating_professionalism",
  "rating_class_handling",
  "rating_skill_development",
  "rating_student_engagement",
  "rating_tasks_followup",
  "rating_session_plan_adherence",
  "rating_study_material_sharing"
] as const;

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";

    let payload: ObsPayload;
    let photoFile: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      photoFile = form.get("photo") instanceof File ? (form.get("photo") as File) : null;
      const raw = form.get("payload");
      if (!raw) return NextResponse.json({ success: false, message: "Missing payload field" }, { status: 400 });
      payload = JSON.parse(String(raw));
    } else {
      payload = await request.json();
    }

    if (!payload.college) {
      return NextResponse.json({ success: false, message: "Missing college" }, { status: 400 });
    }
    if (!payload.overall_rating || Number(payload.overall_rating) < 1) {
      return NextResponse.json({ success: false, message: "Overall rating is required" }, { status: 400 });
    }
    const remarks = String(payload.satisfaction_remarks || payload.notes || "").trim();
    if (payload.satisfaction_status === "not_satisfied" && remarks.split(/\s+/).filter(Boolean).length < 20) {
      return NextResponse.json(
        { success: false, message: "Remarks must be at least 20 words when not satisfied" },
        { status: 400 }
      );
    }

    // ── Optional photo upload to the legacy storage bucket (server-side creds)
    if (photoFile && photoFile.size > 0) {
      if (photoFile.size > 8 * 1024 * 1024) {
        return NextResponse.json({ success: false, message: "Photo must be under 8MB" }, { status: 400 });
      }
      const ext = (photoFile.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const objectPath = `${payload.college || "unknown"}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const upRes = await fetch(
        `${CLASSROOM_SNAPS.url}/storage/v1/object/${CLASSROOM_SNAPS.bucket}/${encodeURIComponent(objectPath)}`,
        {
          method: "POST",
          headers: { ...sbHeaders(CLASSROOM_SNAPS.key), "cache-control": "3600", "x-upsert": "false" },
          body: await photoFile.arrayBuffer()
        }
      );
      if (!upRes.ok) {
        const t = await upRes.text().catch(() => "");
        console.error("Photo upload failed:", upRes.status, t.slice(0, 200));
        return NextResponse.json(
          { success: false, message: `Photo upload failed (${upRes.status}). Check bucket write policy.` },
          { status: 502 }
        );
      }
      payload.photo_url = `${CLASSROOM_SNAPS.url}/storage/v1/object/public/${CLASSROOM_SNAPS.bucket}/${objectPath
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`;
    }

    // Normalize fields to match the legacy table shape (both aliases populated)
    const row: ObsPayload = {
      ...payload,
      class_name: payload.class_name ?? payload.department ?? null,
      subject: payload.subject ?? payload.course_name ?? null,
      teacher_name: payload.teacher_name ?? payload.mentor_name ?? null,
      mentor_name: payload.mentor_name ?? payload.teacher_name ?? null,
      comments: payload.comments ?? payload.notes ?? null,
      notes: payload.notes ?? payload.comments ?? null
    };

    await sbRest(CLASSROOM_SNAPS.url, CLASSROOM_SNAPS.key, CLASSROOM_SNAPS.table, {
      method: "POST",
      headers: sbHeaders(CLASSROOM_SNAPS.key, { Prefer: "return=minimal" }),
      body: JSON.stringify(row)
    });

    // ── Escalation mail when the CM logs a "not satisfied" observation
    if (payload.satisfaction_status === "not_satisfied") {
      const recipient = process.env.OBSERVATION_ESCALATION_EMAIL;
      if (recipient) {
        const dimScores = RATING_FIELDS.map(f => ({ label: f.replace("rating_", "").replace(/_/g, " "), value: (payload as any)[f] }))
          .filter(d => d.value != null)
          .map(d => ({ label: d.label, value: `${d.value}/5` }));
        try {
          const htmlBody = renderEmailShell({
            title: "Classroom Observation — Not Satisfied",
            badgeText: "Escalation",
            badgeColor: "rose",
            description: `A campus observation logged for ${payload.college} was marked NOT SATISFIED and requires senior review.`,
            details: [
              { label: "Campus", value: payload.college, highlight: true },
              { label: "Mentor / Teacher", value: payload.mentor_name || payload.teacher_name || "—" },
              { label: "Class / Department", value: payload.department || payload.class_name || "—" },
              { label: "Subject", value: payload.course_name || payload.subject || "—" },
              { label: "Observation Date", value: payload.observation_date || "—" },
              { label: "Overall Rating", value: `${payload.overall_rating}/5`, highlight: true },
              ...dimScores,
              { label: "Remarks", value: remarks || "—" }
            ]
          });
          await sendMail({ to: recipient, subject: `⚠️ Not-Satisfied Observation — ${payload.college}`, htmlBody });
        } catch (mailErr) {
          console.warn("Observation escalation mail failed:", mailErr);
        }
      }
    }

    return NextResponse.json({ success: true, photo_url: payload.photo_url || null });
  } catch (err: any) {
    console.error("Observations POST error:", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to save classroom observation" },
      { status: 500 }
    );
  }
}
