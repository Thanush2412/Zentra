"use client";

import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, MessageSquareQuote, Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/context/ToastContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SCORE_OPTIONS, monthLabel } from "@/lib/studentNps";

interface MineAnswer {
  month_key: string;
  score: number | null;
  likes: string | null;
  improve: string | null;
  submitted_at: string | null;
}

const PILL_TONES: Record<number, string> = {
  1: "peer-checked:border-rose-400 peer-checked:bg-rose-50 peer-checked:text-rose-700",
  2: "peer-checked:border-orange-400 peer-checked:bg-orange-50 peer-checked:text-orange-700",
  3: "peer-checked:border-amber-400 peer-checked:bg-amber-50 peer-checked:text-amber-700",
  4: "peer-checked:border-lime-400 peer-checked:bg-lime-50 peer-checked:text-lime-700",
  5: "peer-checked:border-emerald-400 peer-checked:bg-emerald-50 peer-checked:text-emerald-700"
};

/**
 * Monthly class-feedback survey for the student portal. One answer per student per
 * month; the server upserts on (month, student), so re-answering edits this month
 * and last month's answer stays untouched.
 */
export function StudentMonthlyNpsCard({ studentId }: { studentId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [score, setScore] = useState<number | null>(null);
  const [likes, setLikes] = useState("");
  const [improve, setImprove] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const mineQuery = useQuery<{ success: boolean; month_key: string; mine: MineAnswer | null }>({
    queryKey: ["student-nps", "mine", studentId],
    queryFn: () => apiFetch("/api/audit/student-nps"),
    enabled: !!studentId
  });

  const saved = mineQuery.data?.mine || null;
  const monthKey = mineQuery.data?.month_key || "";

  // Prefill from the stored answer so editing starts where the student left off.
  useEffect(() => {
    if (!saved) return;
    setScore(saved.score);
    setLikes(saved.likes || "");
    setImprove(saved.improve || "");
  }, [saved]);

  const showForm = !saved || editing;

  const submit = async () => {
    if (score === null) {
      setError("Pick a rating first — it is the only required answer.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await apiFetch("/api/audit/student-nps", {
        method: "POST",
        body: { score, likes: likes.trim(), improve: improve.trim() }
      });
      await queryClient.invalidateQueries({ queryKey: ["student-nps", "mine", studentId] });
      setEditing(false);
      toast("Thanks — your feedback for this month is saved.", "success");
    } catch (err: any) {
      setError(err?.message || "Could not save your feedback. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!studentId) return null;

  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100/80 pb-4">
        <div className="space-y-1">
          <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#D528A2]" />
            This Month&apos;s Class Feedback
          </h2>
          <p className="text-[11px] text-slate-400 font-semibold">
            {monthKey ? `${monthLabel(monthKey)} · takes under a minute` : "Takes under a minute"}
          </p>
        </div>
        {saved ? (
          <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-black uppercase tracking-wide text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Submitted
          </span>
        ) : (
          <span className="shrink-0 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-[10px] font-black uppercase tracking-wide text-amber-700">
            Waiting for you
          </span>
        )}
      </div>

      {mineQuery.isLoading ? (
        <div className="h-16 rounded-xl bg-slate-50 animate-pulse" aria-busy="true" aria-label="Loading your feedback" />
      ) : mineQuery.isError ? (
        <p className="text-[11px] font-bold text-rose-600">
          Could not load your feedback for this month.{" "}
          <button
            type="button"
            onClick={() => mineQuery.refetch()}
            className="underline cursor-pointer font-black"
          >
            Retry
          </button>
        </p>
      ) : !showForm && saved ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-50/70 border border-slate-100">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-bold text-slate-700">
              You rated this month{" "}
              <span className="font-black text-slate-900">
                {saved.score ?? "—"}/5
                {saved.score ? ` · ${SCORE_OPTIONS.find(o => o.value === saved.score)?.label || ""}` : ""}
              </span>
            </p>
            {(saved.likes || saved.improve) ? (
              <p className="text-[11px] font-semibold text-slate-500 flex items-start gap-1.5">
                <MessageSquareQuote className="h-3.5 w-3.5 shrink-0 mt-0.5 text-slate-400" />
                <span className="line-clamp-2">{saved.improve || saved.likes}</span>
              </p>
            ) : (
              <p className="text-[11px] font-semibold text-slate-400">Rating only — no written note.</p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="cursor-pointer shrink-0">
            Edit my answer
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          <fieldset>
            <legend className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">
              How are this month&apos;s classes working for you?
            </legend>
            <div className="flex flex-wrap gap-2">
              {SCORE_OPTIONS.map(option => (
                <label
                  key={option.value}
                  className="relative cursor-pointer"
                  title={`${option.value}/5 — ${option.label}`}
                >
                  <input
                    type="radio"
                    name="student-nps-score"
                    value={option.value}
                    checked={score === option.value}
                    onChange={() => {
                      setScore(option.value);
                      setError("");
                    }}
                    className="peer sr-only"
                  />
                  <span
                    className={`flex flex-col items-center justify-center min-w-[76px] min-h-[52px] px-3 rounded-xl border-2 border-slate-200 bg-white text-slate-600 font-bold transition-all peer-focus-visible:ring-2 peer-focus-visible:ring-[#D528A2]/40 hover:border-slate-300 ${PILL_TONES[option.value]}`}
                  >
                    <span className="text-base font-black leading-none">{option.value}</span>
                    <span className="text-[10px] font-bold mt-1">{option.label}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="text-[10.5px] font-semibold text-slate-400 mt-2">
              5 keeps your campus in the good books; 1 or 2 is read as dissatisfaction, same as the mentor scorecard.
            </p>
          </fieldset>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="nps-likes" className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                What is going well? <span className="normal-case font-semibold text-slate-400">(optional)</span>
              </label>
              <Textarea
                id="nps-likes"
                rows={3}
                maxLength={500}
                value={likes}
                onChange={(e) => setLikes(e.target.value)}
                placeholder="Things you want the classes to keep doing"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="nps-improve" className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                What should change next month? <span className="normal-case font-semibold text-slate-400">(optional)</span>
              </label>
              <Textarea
                id="nps-improve"
                rows={3}
                maxLength={500}
                value={improve}
                onChange={(e) => setImprove(e.target.value)}
                placeholder="Pace, doubts, materials, scheduling — anything specific"
              />
            </div>
          </div>

          {error ? (
            <p role="alert" className="text-[11px] font-bold text-rose-600">
              {error}
            </p>
          ) : null}

          <div className="flex items-center gap-3">
            <Button
              variant="brand"
              size="sm"
              disabled={score === null || saving}
              isLoading={saving}
              loadingText="Saving…"
              onClick={submit}
              className="cursor-pointer"
            >
              {saved ? "Update my answer" : "Submit feedback"}
            </Button>
            {editing ? (
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)} className="cursor-pointer">
                Cancel
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

export default StudentMonthlyNpsCard;
