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
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { College, Subject, Mentor } from "@/context/AppContext";

export interface DynamicSubjectRow {
  id: string;
  name: string;
  type: string;
  weekly_hours: number;
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
  const [showPasteAccordion, setShowPasteAccordion] = useState(false);

  if (!open) return null;

  const handleBulkPaste = () => {
    if (!bulkText.trim()) return;
    const lines = bulkText.split("\n").map(l => l.trim()).filter(Boolean);
    const newRows: DynamicSubjectRow[] = lines.map((line, idx) => ({
      id: `row_${Date.now()}_${idx}`,
      name: line.replace(/^[-•*0-9.]+\s*/, "").trim(),
      type: bulkDefaultType,
      weekly_hours: bulkDefaultHours
    }));
    onDynamicSubjectsChange([...dynamicSubjects.filter(r => r.name.trim() !== ""), ...newRows]);
    setBulkText("");
    setShowPasteAccordion(false);
  };

  const handleAddRow = () => {
    onDynamicSubjectsChange([
      ...dynamicSubjects,
      { id: `row_${Date.now()}`, name: "", type: bulkDefaultType, weekly_hours: bulkDefaultHours }
    ]);
  };

  const handleRemoveRow = (id: string) => {
    onDynamicSubjectsChange(dynamicSubjects.filter(r => r.id !== id));
  };

  const handleUpdateRow = (id: string, field: keyof DynamicSubjectRow, val: any) => {
    onDynamicSubjectsChange(
      dynamicSubjects.map(r => (r.id === id ? { ...r, [field]: val } : r))
    );
  };

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
                : "Configure and create multiple subjects with structured inputs"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!editingSubject && (
            <div className="bg-gray-200/80 p-0.5 rounded-xl flex items-center gap-0.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setModalTab("bulk")}
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
                onClick={() => setModalTab("single")}
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
                    {coursesList.map(dept => (
                      <option key={dept.id} value={dept.name}>
                        {dept.name}
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
                <label className="text-[10px] text-gray-500 uppercase tracking-wider block font-bold">Mentor Group</label>
                <Select
                  aria-label="Mentor Group"
                  value={form.mentor_group}
                  onChange={e => onFormChange({ ...form, mentor_group: e.target.value })}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer text-gray-800"
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

            {/* Quick Bulk Paste Accordion */}
            <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
              <button
                type="button"
                onClick={() => setShowPasteAccordion(!showPasteAccordion)}
                className="w-full p-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-left font-bold text-gray-700 cursor-pointer transition-colors"
              >
                <span className="flex items-center gap-1.5 text-xs">
                  <Sparkles className="h-4 w-4 text-indigo-600" />
                  Quick Paste Multiple Subject Names (Comma or Newline Separated)
                </span>
                {showPasteAccordion ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {showPasteAccordion && (
                <div className="p-3.5 space-y-3 bg-white border-t border-gray-100">
                  <textarea
                    rows={3}
                    placeholder="e.g.&#10;Data Structures & Algorithms&#10;Computer Networks&#10;Operating Systems"
                    value={bulkText}
                    onChange={e => setBulkText(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  />
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Select
                        value={bulkDefaultType}
                        onChange={e => setBulkDefaultType(e.target.value)}
                        className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 text-xs font-bold"
                      >
                        <option value="SKILL">SKILL</option>
                        <option value="ACADEMIC">THEORY / ACADEMIC</option>
                        <option value="LAB">LAB</option>
                      </Select>
                      <Input
                        type="number"
                        min={1}
                        max={40}
                        value={bulkDefaultHours}
                        onChange={e => setBulkDefaultHours(Number(e.target.value) || 4)}
                        className="w-20 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 text-xs font-bold"
                      />
                      <span className="text-[10px] text-gray-400 font-bold">hrs/wk</span>
                    </div>
                    <Button
                      type="button"
                      onClick={handleBulkPaste}
                      className="btn-gradient text-white text-xs px-3.5 py-1.5 rounded-lg font-bold"
                    >
                      Insert Lines as Rows
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Dynamic Rows */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Subject List ({dynamicSubjects.length} items)
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddRow}
                  className="text-xs font-bold flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Subject Row
                </Button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {dynamicSubjects.map((row, idx) => (
                  <div
                    key={row.id}
                    className="flex items-center gap-2 bg-gray-50 border border-gray-200 p-2 rounded-xl"
                  >
                    <span className="text-[10px] font-mono text-gray-400 w-6 text-center">{idx + 1}</span>
                    <Input
                      type="text"
                      placeholder="Subject Name e.g. Data Science"
                      value={row.name}
                      onChange={e => handleUpdateRow(row.id, "name", e.target.value)}
                      className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-bold"
                    />
                    <Select
                      value={row.type}
                      onChange={e => handleUpdateRow(row.id, "type", e.target.value)}
                      className="w-32 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                    >
                      <option value="SKILL">SKILL</option>
                      <option value="ACADEMIC">THEORY</option>
                      <option value="LAB">LAB</option>
                      <option value="ELECTIVE">ELECTIVE</option>
                    </Select>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={1}
                        max={40}
                        value={row.weekly_hours}
                        onChange={e => handleUpdateRow(row.id, "weekly_hours", Number(e.target.value) || 4)}
                        className="w-16 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-bold text-center"
                      />
                      <span className="text-[10px] text-gray-400 font-bold">hrs</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveRow(row.id)}
                      className="text-gray-400 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
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
                  {coursesList.map(dept => (
                    <option key={dept.id} value={dept.name}>
                      {dept.name}
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
