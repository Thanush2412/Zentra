"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Panel } from "./Panel";
import {
  SlidersHorizontal,
  Plus,
  Trash2,
  CheckSquare,
  Target,
  RefreshCw,
  X,
  Pencil,
  Lock,
} from "lucide-react";

/**
 * Phase C (Demo Workflow Redesign): per-department CRUD for demo evaluation
 * criteria. Rendered as the "Evaluation Criteria" tab in SMEDashboard.
 *
 * Criteria types:
 *  - checkbox   → SME manually ticks/leaves unticked at evaluation time
 *  - score_rule → auto-evaluated against the final marks (threshold on `scale`)
 */

export interface DemoEvalCriterion {
  id: string;
  department: string;
  label: string;
  type: "checkbox" | "score_rule";
  threshold?: number | null;
  scale?: number | null;
  is_system?: number;
  is_active?: number;
  sort_order?: number;
}

export interface ChecklistEntry {
  criterionId: string;
  label: string;
  type: "checkbox" | "score_rule";
  met: boolean;
}

/** Fetch active criteria for a department (seeds defaults on first use). */
export async function fetchCriteriaForDepartment(department: string): Promise<DemoEvalCriterion[]> {
  if (!department) return [];
  try {
    await fetch("/api/demo-eval-criteria", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "seed", department })
    });
    const res = await fetch(`/api/demo-eval-criteria?department=${encodeURIComponent(department)}`);
    const json = await res.json();
    return json.success ? (json.criteria || []) : [];
  } catch (_) {
    return [];
  }
}

/**
 * Checklist block rendered inside the SME evaluation modal.
 * checkbox rows are manually ticked; score_rule rows auto-evaluate from `marks`.
 */
export function EvaluationChecklist({
  department,
  marks,
  entries,
  onChange
}: {
  department: string;
  marks: number;
  entries: ChecklistEntry[];
  onChange: (next: ChecklistEntry[]) => void;
}) {
  const [criteria, setCriteria] = useState<DemoEvalCriterion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchCriteriaForDepartment(department).then((rows) => {
      if (cancelled) return;
      setCriteria(rows);
      // Initialise entries preserving existing ticks, adding new criteria, dropping removed ones
      onChange(
        rows.map((c) => {
          const prev = entries.find((e) => e.criterionId === c.id);
          if (c.type === "score_rule") {
            const threshold = c.threshold ?? 0;
            const scale = c.scale ?? 5;
            const normalized = (marks / 100) * scale; // /100 rubric → criteria scale
            return { criterionId: c.id, label: c.label, type: c.type, met: normalized >= threshold };
          }
          return { criterionId: c.id, label: c.label, type: c.type, met: prev?.met ?? false };
        })
      );
      setLoading(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [department]);

  // Live score_rule re-evaluation as marks change
  useEffect(() => {
    if (criteria.length === 0) return;
    const next = criteria.map((c) => {
      const prev = entries.find((e) => e.criterionId === c.id);
      if (c.type === "score_rule") {
        const threshold = c.threshold ?? 0;
        const scale = c.scale ?? 5;
        const normalized = (marks / 100) * scale;
        return { criterionId: c.id, label: c.label, type: c.type, met: normalized >= threshold };
      }
      return prev || { criterionId: c.id, label: c.label, type: c.type, met: false };
    });
    const changed = JSON.stringify(next) !== JSON.stringify(entries);
    if (changed) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marks, criteria]);

  if (loading) {
    return (
      <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 text-[10px] font-bold text-slate-400 text-center">
        Loading compliance criteria for {department}…
      </div>
    );
  }

  if (criteria.length === 0) return null;

  return (
    <div className="space-y-2 p-3 bg-rose-50/30 dark:bg-rose-950/10 rounded-xl border border-rose-100 dark:border-rose-900/40">
      <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block mb-2">
        Compliance Checklist — {department} (unmet items escalate to KAM / CM)
      </span>
      {entries.map((entry) => (
        <div key={entry.criterionId} className="flex items-center justify-between gap-3">
          <label className="text-[10.5px] font-bold text-slate-600 dark:text-slate-300 flex-1 flex items-center gap-2">
            {entry.type === "checkbox" ? (
              <input
                type="checkbox"
                checked={entry.met}
                onChange={(e) =>
                  onChange(entries.map((x) => x.criterionId === entry.criterionId ? { ...x, met: e.target.checked } : x))
                }
                className="h-3.5 w-3.5 accent-rose-600 cursor-pointer"
              />
            ) : (
              <Target className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
            )}
            {entry.label}
          </label>
          {entry.type === "score_rule" && (
            <span
              className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                entry.met
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-rose-100 text-rose-700 border border-rose-300"
              }`}
            >
              {entry.met ? "Pass" : "Fail"}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Full criteria manager: department picker + CRUD list. Used as the SME
 * "Evaluation Criteria" tab.
 */
export function DemoEvalCriteriaPanel({
  departments,
  smeName
}: {
  departments: string[];
  smeName?: string;
}) {
  const [selectedDept, setSelectedDept] = useState<string>(departments[0] || "General");
  const [criteria, setCriteria] = useState<DemoEvalCriterion[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<"checkbox" | "score_rule">("checkbox");
  const [newThreshold, setNewThreshold] = useState<string>("3.5");
  const [newScale, setNewScale] = useState<string>("5");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editThreshold, setEditThreshold] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (dept: string) => {
    setLoading(true);
    const rows = await fetchCriteriaForDepartment(dept);
    setCriteria(rows);
    setLoading(false);
  }, []);

  useEffect(() => { load(selectedDept); }, [selectedDept, load]);

  const callApi = async (payload: any) => {
    setBusy(true);
    try {
      await fetch("/api/demo-eval-criteria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, createdBy: smeName, updatedBy: smeName, deletedBy: smeName })
      });
      await load(selectedDept);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title="EVALUATION CRITERIA"
      subtitle="Configure the compliance checklist evaluators must complete for each department — unmet items trigger KAM/CM escalation mail"
    >
      <div className="space-y-5">
        {/* Department selector */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Department:</span>
          {departments.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setSelectedDept(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                selectedDept === d
                  ? "bg-pink-600 text-white shadow-2xs"
                  : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Add criterion */}
        <div className="p-3.5 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-xl flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">New criterion</label>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Materials shared with students before demo"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>
          <div>
            <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Type</label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as "checkbox" | "score_rule")}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold cursor-pointer"
            >
              <option value="checkbox">Checkbox (manual)</option>
              <option value="score_rule">Mark rule (auto)</option>
            </select>
          </div>
          {newType === "score_rule" && (
            <>
              <div className="w-24">
                <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Min mark</label>
                <input
                  type="number"
                  step="0.1"
                  value={newThreshold}
                  onChange={(e) => setNewThreshold(e.target.value)}
                  className="w-full px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-center"
                />
              </div>
              <div className="w-20">
                <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Scale</label>
                <input
                  type="number"
                  value={newScale}
                  onChange={(e) => setNewScale(e.target.value)}
                  className="w-full px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-center"
                />
              </div>
            </>
          )}
          <button
            type="button"
            disabled={busy || !newLabel.trim()}
            onClick={async () => {
              await callApi({
                action: "create",
                department: selectedDept,
                label: newLabel.trim(),
                type: newType,
                threshold: newType === "score_rule" ? parseFloat(newThreshold) : null,
                scale: newType === "score_rule" ? parseFloat(newScale) : null
              });
              setNewLabel("");
            }}
            className="px-4 py-2 rounded-lg text-xs font-black bg-pink-600 hover:bg-pink-700 text-white disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-2xs"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>

        {/* Fixed system criteria note */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-xl text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 flex items-start gap-2">
          <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5 text-slate-400" />
          <span>
            The four mandatory compliance checks (tracker sheet, weekly plan, demo-per-plan, mark threshold) are fixed system criteria — every department always has them and they cannot be edited or deleted. Add your own department-specific criteria below.
          </span>
        </div>

        {/* Criteria list */}
        {loading ? (
          <div className="py-8 text-center text-xs font-bold text-slate-400 italic">Loading criteria…</div>
        ) : criteria.length === 0 ? (
          <div className="py-8 text-center text-xs font-bold text-slate-400 italic bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl">
            No criteria configured for {selectedDept} yet.
          </div>
        ) : (
          <div className="space-y-2">
            {criteria.map((c) => (
              <div
                key={c.id}
                className={`p-3.5 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 ${c.is_system === 1
                  ? "border-slate-200/60 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/20"
                  : "border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900"
                  }`}
              >
                {editingId === c.id ? (
                  <div className="flex-1 flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      className="flex-1 min-w-[180px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                    />
                    {c.type === "score_rule" && (
                      <input
                        type="number"
                        step="0.1"
                        value={editThreshold}
                        onChange={(e) => setEditThreshold(e.target.value)}
                        className="w-24 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-center"
                      />
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        await callApi({
                          action: "update",
                          id: c.id,
                          label: editLabel.trim() || c.label,
                          threshold: c.type === "score_rule" ? parseFloat(editThreshold) : undefined
                        });
                        setEditingId(null);
                      }}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-black bg-emerald-600 text-white cursor-pointer"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-black border border-slate-200 text-slate-500 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>                    <div className="flex items-center gap-2.5 min-w-0">
                      {c.type === "checkbox" ? (
                        <CheckSquare className={`h-4 w-4 shrink-0 ${c.is_system === 1 ? "text-slate-400" : "text-pink-500"}`} />
                      ) : (
                        <Target className={`h-4 w-4 shrink-0 ${c.is_system === 1 ? "text-slate-400" : "text-indigo-500"}`} />
                      )}
                      <span className={`text-xs font-black truncate ${c.is_system === 1 ? "text-slate-600 dark:text-slate-300" : "text-slate-900 dark:text-white"}`}>{c.label}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase shrink-0 ${
                          c.type === "checkbox"
                            ? "bg-pink-50 text-pink-700 border border-pink-100"
                            : "bg-indigo-50 text-indigo-700 border border-indigo-100"
                        }`}>
                        {c.type === "checkbox" ? "Manual" : `≥ ${c.threshold}/${c.scale ?? 5}`}
                      </span>
                      {c.is_system === 1 && (
                        <span className="px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase shrink-0 bg-slate-200 text-slate-500 border border-slate-300 flex items-center gap-0.5">
                          <Lock className="h-2.5 w-2.5" /> Fixed
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {c.is_system !== 1 && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(c.id);
                              setEditLabel(c.label);
                              setEditThreshold(String(c.threshold ?? ""));
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer transition-all"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => callApi({ action: "delete", id: c.id })}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-all disabled:opacity-50"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}
