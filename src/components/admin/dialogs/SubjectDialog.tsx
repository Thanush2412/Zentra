"use client";

import React, { useState } from "react";
import {
  GraduationCap,
  X,
  Grid,
  Edit2,
  ShieldAlert,
  Plus,
  Trash2,
  Clock,
  Sparkles,
  ClipboardPaste,
  BookOpen,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { College, Subject, Mentor, useApp } from "@/context/AppContext";
import { parseSubjectInput } from "@/lib/subjectParser";

export interface DynamicSubjectRow {
  id: string;
  name: string;
  type: string;
  weekly_hours: number;
  mentor_group?: string;
}

export interface SubjectFormState {
  name: string;
  department: string;
  semester: string;
  type: string;
  college_id: string;
  year: string;
  weekly_hours: number;
  mentor_group: string;
  mentorIds: string[];
}

export interface SubjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingSubject: Subject | null;
  form: SubjectFormState;
  onFormChange: (form: SubjectFormState) => void;
  onSubmit: (e: React.FormEvent) => void;
  error?: string | null;
  isSubmitting?: boolean;
  colleges: College[];
  coursesList: any[];
  subjectGroups: Array<{ id: string; name: string }>;
  mentors: Mentor[];
  lockDeptAndYear?: boolean;
  dynamicSubjects: DynamicSubjectRow[];
  onDynamicSubjectsChange: (rows: DynamicSubjectRow[]) => void;
}

export const SubjectDialog: React.FC<SubjectDialogProps> = ({
  open,
  onOpenChange,
  editingSubject,
  form,
  onFormChange,
  onSubmit,
  error,
  isSubmitting = false,
  colleges,
  coursesList,
  subjectGroups,
  mentors,
  lockDeptAndYear = false,
  dynamicSubjects,
  onDynamicSubjectsChange
}) => {
  const [modalTab, setModalTab] = useState<"bulk" | "single">("bulk");
  const [bulkText, setBulkText] = useState("");
  const [bulkDefaultType, setBulkDefaultType] = useState("SKILL");
  const [bulkDefaultHours, setBulkDefaultHours] = useState(4);
  const [showQuickPaste, setShowQuickPaste] = useState(false);
  const [pasteStatus, setPasteStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const { subjectsList = [] } = useApp();

  if (!open) return null;

  // Offer only the selected campus's courses, keeping the row's current value so
  // an edit never silently blanks the department.
  const courseOptions = (() => {
    const scoped = form.college_id
      ? coursesList.filter(c => !c.college_id || c.college_id === form.college_id)
      : coursesList;
    const names = [...new Set(scoped.map(c => c.name as string))];
    if (form.department && !names.includes(form.department)) names.push(form.department);
    return names;
  })();

  const handleApplyBulkText = () => {
    if (!bulkText.trim()) return;
    const parsed = parseSubjectInput(bulkText, bulkDefaultType, bulkDefaultHours, form.mentor_group);
    if (parsed.length === 0) {
      setPasteStatus({
        type: "error",
        message: "No valid subjects detected. Please check the text."
      });
      return;
    }

    const hasNonEmpty = dynamicSubjects.some(r => r.name && r.name.trim() !== "");
    if (!hasNonEmpty) {
      onDynamicSubjectsChange(parsed);
    } else {
      const filtered = dynamicSubjects.filter(r => r.name && r.name.trim() !== "");
      onDynamicSubjectsChange([...filtered, ...parsed]);
    }

    setBulkText("");
    setShowQuickPaste(false);
    setPasteStatus({
      type: "success",
      message: `✓ Added ${parsed.length} subject(s) to the list!`
    });
  };

  const handleAutoGetFromClipboard = async () => {
    setPasteStatus(null);
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard?.readText) {
        setShowQuickPaste(true);
        setPasteStatus({
          type: "error",
          message: "Clipboard access not supported by browser. Please paste into the box below."
        });
        return;
      }

      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        setShowQuickPaste(true);
        setPasteStatus({
          type: "error",
          message: "Clipboard is empty. Copy some subjects (e.g. from Excel or syllabus) first!"
        });
        return;
      }

      const parsed = parseSubjectInput(text, bulkDefaultType, bulkDefaultHours, form.mentor_group);
      if (parsed.length === 0) {
        setShowQuickPaste(true);
        setPasteStatus({
          type: "error",
          message: "Could not detect subject names from clipboard. Try pasting into the text box below."
        });
        return;
      }

      const hasNonEmpty = dynamicSubjects.some(r => r.name && r.name.trim() !== "");
      if (!hasNonEmpty) {
        onDynamicSubjectsChange(parsed);
      } else {
        const filtered = dynamicSubjects.filter(r => r.name && r.name.trim() !== "");
        onDynamicSubjectsChange([...filtered, ...parsed]);
      }

      setPasteStatus({
        type: "success",
        message: `✓ Auto-retrieved ${parsed.length} subject(s) from clipboard!`
      });
    } catch {
      setShowQuickPaste(true);
      setPasteStatus({
        type: "error",
        message: "Clipboard access was denied by browser. Please paste into the text box below."
      });
    }
  };

  const handleAutoGetFromCurriculum = () => {
    setPasteStatus(null);
    if (!form.department) {
      setPasteStatus({
        type: "error",
        message: "Please select a Course / Department first to load its curriculum."
      });
      return;
    }

    // Match by department and semester
    const matching = subjectsList.filter(s =>
      s.department?.trim().toLowerCase() === form.department.trim().toLowerCase() &&
      (!form.semester || s.semester === form.semester)
    );

    // Fallback to department without semester filter if none for exact semester
    const candidates = matching.length > 0
      ? matching
      : subjectsList.filter(s => s.department?.trim().toLowerCase() === form.department.trim().toLowerCase());

    if (candidates.length === 0) {
      setPasteStatus({
        type: "error",
        message: `No existing curriculum subjects found in database for "${form.department}".`
      });
      return;
    }

    const seen = new Set<string>();
    const imported: DynamicSubjectRow[] = [];
    for (const sub of candidates) {
      const key = sub.name.trim().toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        imported.push({
          id: `row_curr_${Date.now()}_${imported.length}`,
          name: sub.name.trim(),
          type: sub.type || bulkDefaultType || "SKILL",
          weekly_hours: sub.weekly_hours || bulkDefaultHours || 4,
          mentor_group: sub.mentor_group || (sub as any).subject_group || form.mentor_group || ""
        });
      }
    }

    const hasNonEmpty = dynamicSubjects.some(r => r.name && r.name.trim() !== "");
    if (!hasNonEmpty) {
      onDynamicSubjectsChange(imported);
    } else {
      const filtered = dynamicSubjects.filter(r => r.name && r.name.trim() !== "");
      onDynamicSubjectsChange([...filtered, ...imported]);
    }

    setPasteStatus({
      type: "success",
      message: `✓ Auto-loaded ${imported.length} curriculum subject(s) for ${form.department}${matching.length > 0 ? ` (${form.semester})` : ""}!`
    });
  };

  const handleRowPaste = (e: React.ClipboardEvent<HTMLInputElement>, targetRowId: string) => {
    const pastedText = e.clipboardData.getData("text");
    if (!pastedText) return;

    const hasMultiple =
      pastedText.includes("\n") ||
      pastedText.includes("\r") ||
      pastedText.includes("\t") ||
      pastedText.includes("|") ||
      pastedText.includes(",");

    if (!hasMultiple) return; // Allow native paste for normal single-word/phrase edit

    const parsed = parseSubjectInput(pastedText, bulkDefaultType, bulkDefaultHours, form.mentor_group);
    if (parsed.length > 1 || (parsed.length === 1 && (pastedText.includes("\t") || pastedText.includes("|")))) {
      e.preventDefault();

      const allEmpty = dynamicSubjects.every(r => !r.name || !r.name.trim());
      if (allEmpty) {
        onDynamicSubjectsChange(parsed);
      } else {
        const targetIndex = dynamicSubjects.findIndex(r => r.id === targetRowId);
        if (targetIndex !== -1) {
          const before = dynamicSubjects.slice(0, targetIndex);
          const after = dynamicSubjects.slice(targetIndex + 1);
          onDynamicSubjectsChange([...before, ...parsed, ...after]);
        } else {
          const filtered = dynamicSubjects.filter(r => r.name && r.name.trim() !== "");
          onDynamicSubjectsChange([...filtered, ...parsed]);
        }
      }

      setPasteStatus({
        type: "success",
        message: `✓ Auto-populated ${parsed.length} subject(s) from paste!`
      });
    }
  };

  const handleAddRow = () => {
    onDynamicSubjectsChange([
      ...dynamicSubjects,
      {
        id: `row_${Date.now()}`,
        name: "",
        type: bulkDefaultType,
        weekly_hours: bulkDefaultHours,
        mentor_group: form.mentor_group || ""
      }
    ]);
  };

  const handleRemoveRow = (id: string) => {
    onDynamicSubjectsChange(dynamicSubjects.filter(r => r.id !== id));
  };

  const handleClearAllRows = () => {
    onDynamicSubjectsChange([]);
    setPasteStatus(null);
  };

  const handleUpdateRow = (id: string, field: keyof DynamicSubjectRow, val: any) => {
    onDynamicSubjectsChange(
      dynamicSubjects.map(r => (r.id === id ? { ...r, [field]: val } : r))
    );
  };

  const validCount = dynamicSubjects.filter(r => r.name && r.name.trim() !== "").length;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      ariaLabel="Subject"
      overlayClassName="bg-gray-900/50 backdrop-blur-sm p-4"
      panelClassName={`overflow-hidden animate-slideUp transition-all rounded-2xl ${
        editingSubject ? "max-w-md" : "max-w-4xl"
      } p-0 space-y-0 max-h-[90vh]`}
    >
      <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50/80">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900 text-base">
              {editingSubject ? "Edit Subject Details" : "Add Subjects to Curriculum"}
            </h3>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              {editingSubject
                ? "Update subject configuration and details"
                : "Configure and create multiple subjects with structured inputs or auto-paste"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!editingSubject && (
            <div className="bg-gray-200/80 p-0.5 rounded-xl flex items-center gap-0.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setModalTab("bulk");
                  if (dynamicSubjects.length === 0) {
                    onDynamicSubjectsChange([
                      { id: "row_1", name: "", type: bulkDefaultType, weekly_hours: bulkDefaultHours, mentor_group: form.mentor_group || "" }
                    ]);
                  }
                }}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  modalTab === "bulk"
                    ? "bg-white text-indigo-600 shadow-xs font-black"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Grid className="h-3.5 w-3.5" />
                <span>Structured / Bulk</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalTab("single");
                  onDynamicSubjectsChange([]);
                }}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  modalTab === "single"
                    ? "bg-white text-indigo-600 shadow-xs font-black"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Edit2 className="h-3.5 w-3.5" />
                <span>Single Subject</span>
              </button>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close subject dialog"
            onClick={() => onOpenChange(false)}
            className="h-auto w-auto p-2 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer text-gray-400 hover:text-gray-700 ml-1"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <form onSubmit={onSubmit} className="p-6 space-y-5 text-xs font-semibold max-h-[82vh] flex flex-col overflow-hidden">
        {error && (
          <div role="alert" className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-bold flex items-center gap-2 shrink-0">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* STRUCTURED BULK MODE */}
        {!editingSubject && modalTab === "bulk" && (
          <div className="space-y-4 flex-1 overflow-y-auto pr-1">
            <div className="p-4 bg-gray-50/90 border border-gray-200 rounded-xl space-y-3 shrink-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider block font-bold">Course / Department *</label>
                  <Select
                    aria-label="Course / Department"
                    required
                    disabled={lockDeptAndYear}
                    value={form.department}
                    onChange={e => onFormChange({ ...form, department: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer text-gray-800 disabled:opacity-60"
                  >
                    <option value="">— Select Course —</option>
                    {courseOptions.map(name => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider block font-bold">Target Campus *</label>
                  <Select
                    aria-label="Target Campus"
                    required
                    value={form.college_id}
                    onChange={e => onFormChange({ ...form, college_id: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer text-gray-800"
                  >
                    <option value="">— Select Campus —</option>
                    {colleges.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider block font-bold">Academic Year *</label>
                  <Select
                    aria-label="Academic Year"
                    required
                    disabled={lockDeptAndYear}
                    value={form.year}
                    onChange={e => {
                      const newYear = e.target.value;
                      let newSem = "Semester 1";
                      if (newYear === "Year 2") newSem = "Semester 3";
                      else if (newYear === "Year 3") newSem = "Semester 5";
                      else if (newYear === "Year 4") newSem = "Semester 7";
                      onFormChange({ ...form, year: newYear, semester: newSem });
                    }}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer text-gray-800 disabled:opacity-60"
                  >
                    <option value="Year 1">Year 1</option>
                    <option value="Year 2">Year 2</option>
                    <option value="Year 3">Year 3</option>
                    <option value="Year 4">Year 4</option>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider block font-bold">Target Semester *</label>
                  <Select
                    aria-label="Target Semester"
                    required
                    value={form.semester}
                    onChange={e => onFormChange({ ...form, semester: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer text-gray-800"
                  >
                    {form.year === "Year 1" && (
                      <>
                        <option value="Semester 1">Semester 1</option>
                        <option value="Semester 2">Semester 2</option>
                      </>
                    )}
                    {form.year === "Year 2" && (
                      <>
                        <option value="Semester 3">Semester 3</option>
                        <option value="Semester 4">Semester 4</option>
                      </>
                    )}
                    {form.year === "Year 3" && (
                      <>
                        <option value="Semester 5">Semester 5</option>
                        <option value="Semester 6">Semester 6</option>
                      </>
                    )}
                    {form.year === "Year 4" && (
                      <>
                        <option value="Semester 7">Semester 7</option>
                        <option value="Semester 8">Semester 8</option>
                      </>
                    )}
                  </Select>
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <label className="text-[10px] text-gray-500 uppercase tracking-wider block font-bold">
                  Default Mentor Group (Inherited by all rows unless specified per row)
                </label>
                <Select
                  aria-label="Default Mentor Group"
                  value={form.mentor_group}
                  onChange={e => onFormChange({ ...form, mentor_group: e.target.value })}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer text-gray-800"
                >
                  <option value="">— Select Default Mentor Group —</option>
                  {subjectGroups.map(sg => (
                    <option key={sg.id} value={sg.name}>
                      {sg.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {/* SIMPLIFIED SMART ACTIONS TOOLBAR */}
            <div className="p-3 bg-gradient-to-r from-indigo-50/90 via-slate-50 to-indigo-50/60 border border-indigo-100 rounded-xl space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* 1-Click Clipboard Auto-Get */}
                  <button
                    type="button"
                    onClick={handleAutoGetFromClipboard}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Read copied subjects directly from your clipboard"
                  >
                    <ClipboardPaste className="h-3.5 w-3.5" />
                    <span>Auto Get from Clipboard</span>
                  </button>

                  {/* 1-Click Existing Curriculum Auto-Get */}
                  {form.department && (
                    <button
                      type="button"
                      onClick={handleAutoGetFromCurriculum}
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 active:scale-95 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      title="Auto-load curriculum subjects mapped for this department"
                    >
                      <BookOpen className="h-3.5 w-3.5 text-indigo-600" />
                      <span>Auto Get from Curriculum</span>
                    </button>
                  )}

                  {/* Manual Paste Text Box Toggle */}
                  <button
                    type="button"
                    onClick={() => setShowQuickPaste(!showQuickPaste)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      showQuickPaste
                        ? "bg-indigo-100 text-indigo-800 border border-indigo-300"
                        : "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200"
                    }`}
                  >
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    <span>{showQuickPaste ? "Close Paste Box" : "Quick Paste Text"}</span>
                  </button>
                </div>

                <div className="text-[11px] text-slate-500 font-bold hidden sm:flex items-center gap-1">
                  <span>Smart Paste: Press</span>
                  <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono text-[10px] text-indigo-700 font-black shadow-2xs">Ctrl+V</kbd>
                  <span>in any Subject Name box</span>
                </div>
              </div>

              {/* Status Banner */}
              {pasteStatus && (
                <div
                  className={`p-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-between gap-2 ${
                    pasteStatus.type === "success"
                      ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                      : "bg-rose-50 border border-rose-200 text-rose-800"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {pasteStatus.type === "success" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                    )}
                    <span>{pasteStatus.message}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPasteStatus(null)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Quick Paste Text Drawer */}
              {showQuickPaste && (
                <div className="p-3 bg-white border border-indigo-100 rounded-xl space-y-3 mt-2 shadow-card">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800">
                      Paste Subjects (Excel table, Comma-separated, or Newline-separated):
                    </label>
                    {bulkText.trim() && (
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                        {parseSubjectInput(bulkText, bulkDefaultType, bulkDefaultHours, form.mentor_group).length} subject(s) detected
                      </span>
                    )}
                  </div>
                  <textarea
                    rows={3}
                    placeholder="e.g.&#10;Data Structures & Algorithms&#10;Computer Networks&#10;Operating Systems&#10;(or paste copied columns directly from Excel / Google Sheets)"
                    value={bulkText}
                    onChange={e => setBulkText(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:bg-white"
                  />
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-500">Default Type:</span>
                      <Select
                        value={bulkDefaultType}
                        onChange={e => setBulkDefaultType(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold"
                      >
                        <option value="SKILL">SKILL</option>
                        <option value="ACADEMIC">THEORY / ACADEMIC</option>
                        <option value="LAB">LAB</option>
                        <option value="ELECTIVE">ELECTIVE</option>
                      </Select>
                      <span className="text-[11px] font-bold text-slate-500 ml-1">Default Hrs:</span>
                      <Input
                        type="number"
                        min={1}
                        max={40}
                        value={bulkDefaultHours}
                        onChange={e => setBulkDefaultHours(Number(e.target.value) || 4)}
                        className="w-16 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-center"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setBulkText("");
                          setShowQuickPaste(false);
                        }}
                        className="text-xs font-bold text-slate-500"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        onClick={handleApplyBulkText}
                        disabled={!bulkText.trim()}
                        className="btn-gradient text-white text-xs px-3.5 py-1.5 rounded-lg font-bold cursor-pointer"
                      >
                        Apply to Subject List
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Dynamic Rows */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-extrabold text-gray-700 uppercase tracking-wider">
                    Subject Rows
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {validCount} valid {validCount === 1 ? "subject" : "subjects"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {dynamicSubjects.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllRows}
                      className="text-[11px] font-bold text-slate-400 hover:text-rose-600 transition-colors cursor-pointer mr-1"
                    >
                      Clear All
                    </button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddRow}
                    className="text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Subject Row
                  </Button>
                </div>
              </div>

              {dynamicSubjects.length === 0 ? (
                <div className="p-8 text-center bg-gray-50 border border-dashed border-gray-200 rounded-xl space-y-3">
                  <p className="text-xs font-bold text-gray-500">No subject rows added yet.</p>
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleAutoGetFromClipboard}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <ClipboardPaste className="h-3.5 w-3.5" />
                      Auto Get from Clipboard
                    </button>
                    {form.department && (
                      <button
                        type="button"
                        onClick={handleAutoGetFromCurriculum}
                        className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <BookOpen className="h-3.5 w-3.5 text-indigo-600" />
                        Auto Get from Curriculum
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleAddRow}
                      className="px-3.5 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Manual Row
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {dynamicSubjects.map((row, idx) => (
                    <div
                      key={row.id}
                      className={`flex items-center gap-2 border p-2 rounded-xl transition-all ${
                        row.name.trim()
                          ? "bg-gray-50 border-gray-200"
                          : "bg-amber-50/40 border-amber-200/80"
                      }`}
                    >
                      <span className="text-[10px] font-mono text-gray-400 w-6 text-center">{idx + 1}</span>
                      <Input
                        type="text"
                        placeholder="Subject Name e.g. Data Science (or paste list)"
                        value={row.name}
                        onPaste={e => handleRowPaste(e, row.id)}
                        onChange={e => handleUpdateRow(row.id, "name", e.target.value)}
                        className="flex-1 min-w-[130px] bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-bold focus:border-indigo-500"
                      />
                      <Select
                        value={row.type}
                        onChange={e => handleUpdateRow(row.id, "type", e.target.value)}
                        className="w-28 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                      >
                        <option value="SKILL">SKILL</option>
                        <option value="ACADEMIC">THEORY</option>
                        <option value="LAB">LAB</option>
                        <option value="ELECTIVE">ELECTIVE</option>
                      </Select>
                      <Select
                        value={row.mentor_group ?? ""}
                        onChange={e => handleUpdateRow(row.id, "mentor_group", e.target.value)}
                        className="w-36 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-bold text-gray-700"
                        title="Mentor Group for this row"
                      >
                        <option value="">{form.mentor_group ? `Default (${form.mentor_group})` : "No Group"}</option>
                        {subjectGroups.map(sg => (
                          <option key={sg.id} value={sg.name}>
                            {sg.name}
                          </option>
                        ))}
                      </Select>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={1}
                          max={40}
                          value={row.weekly_hours}
                          onChange={e => handleUpdateRow(row.id, "weekly_hours", Number(e.target.value) || 4)}
                          className="w-14 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-bold text-center"
                        />
                        <span className="text-[10px] text-gray-400 font-bold">hrs</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveRow(row.id)}
                        className="text-gray-400 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SINGLE SUBJECT MODE OR EDIT MODE */}
        {(editingSubject || modalTab === "single") && (
          <div className="space-y-3.5 overflow-y-auto pr-1">
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Subject Name *</label>
              <Input
                aria-label="Subject Name"
                type="text"
                required
                placeholder="e.g. Advanced Java & Spring Boot"
                value={form.name}
                onChange={e => onFormChange({ ...form, name: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Course / Department *</label>
                <Select
                  aria-label="Course / Department"
                  required
                  disabled={lockDeptAndYear}
                  value={form.department}
                  onChange={e => onFormChange({ ...form, department: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer disabled:opacity-60"
                >
                  <option value="">— Select Course —</option>
                  {courseOptions.map(name => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Target Campus *</label>
                <Select
                  aria-label="Target Campus"
                  required
                  value={form.college_id}
                  onChange={e => onFormChange({ ...form, college_id: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer"
                >
                  <option value="">— Select Campus —</option>
                  {colleges.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Academic Year *</label>
                <Select
                  aria-label="Academic Year"
                  required
                  disabled={lockDeptAndYear}
                  value={form.year}
                  onChange={e => {
                    const newYear = e.target.value;
                    let newSem = "Semester 1";
                    if (newYear === "Year 2") newSem = "Semester 3";
                    else if (newYear === "Year 3") newSem = "Semester 5";
                    else if (newYear === "Year 4") newSem = "Semester 7";
                    onFormChange({ ...form, year: newYear, semester: newSem });
                  }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer disabled:opacity-60"
                >
                  <option value="Year 1">Year 1</option>
                  <option value="Year 2">Year 2</option>
                  <option value="Year 3">Year 3</option>
                  <option value="Year 4">Year 4</option>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Semester *</label>
                <Select
                  aria-label="Semester"
                  required
                  value={form.semester}
                  onChange={e => onFormChange({ ...form, semester: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer"
                >
                  {form.year === "Year 1" && (
                    <>
                      <option value="Semester 1">Semester 1</option>
                      <option value="Semester 2">Semester 2</option>
                    </>
                  )}
                  {form.year === "Year 2" && (
                    <>
                      <option value="Semester 3">Semester 3</option>
                      <option value="Semester 4">Semester 4</option>
                    </>
                  )}
                  {form.year === "Year 3" && (
                    <>
                      <option value="Semester 5">Semester 5</option>
                      <option value="Semester 6">Semester 6</option>
                    </>
                  )}
                  {form.year === "Year 4" && (
                    <>
                      <option value="Semester 7">Semester 7</option>
                      <option value="Semester 8">Semester 8</option>
                    </>
                  )}
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Subject Type *</label>
                <Select
                  aria-label="Subject Type"
                  value={form.type}
                  onChange={e => onFormChange({ ...form, type: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer"
                >
                  <option value="SKILL">SKILL</option>
                  <option value="ACADEMIC">THEORY / ACADEMIC</option>
                  <option value="LAB">LAB</option>
                  <option value="ELECTIVE">ELECTIVE</option>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Weekly Hours *</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input
                    aria-label="Weekly Hours"
                    type="number"
                    min={1}
                    max={40}
                    required
                    value={form.weekly_hours}
                    onChange={e => onFormChange({ ...form, weekly_hours: Number(e.target.value) || 4 })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Mentor Group</label>
              <Select
                aria-label="Mentor Group"
                value={form.mentor_group}
                onChange={e => onFormChange({ ...form, mentor_group: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer text-gray-800"
              >
                <option value="">— Select Mentor Group —</option>
                {subjectGroups.map(sg => (
                  <option key={sg.id} value={sg.name}>
                    {sg.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 shrink-0">
          <Button
            variant="ghost"
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-auto px-4 py-2 hover:bg-gray-100 text-gray-500 rounded-xl transition-all font-bold cursor-pointer"
          >
            Cancel
          </Button>
          <LoadingButton
            type="submit"
            isLoading={isSubmitting}
            className="btn-gradient shadow-sm text-white px-5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all"
          >
            {editingSubject ? "Save Subject Changes" : "Create Subject(s)"}
          </LoadingButton>
        </div>
      </form>
    </Dialog>
  );
};
