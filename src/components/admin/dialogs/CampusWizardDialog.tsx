"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  X,
  ShieldAlert,
  Sparkles,
  MapPin,
  RefreshCw,
  Plus,
  Trash2,
  Clock,
  Layers,
  Edit2
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { useApp, College, SHIFT_TIME_SLOTS } from "@/context/AppContext";
import { useToast } from "@/context/ToastContext";
import { getCurrentAcademicYear, getAcademicYearOptions } from "@/lib/academicYear";
import { DEFAULT_SHIFT_CONFIGS } from "@/lib/shiftDefaults";
import { ALL_SEMESTERS, getSemestersForCourse } from "@/lib/semesters";
import {
  ALL_SEMESTERS_KEY,
  cloneShiftParams,
  compileShiftConfigs,
  semesterParamsMapFromShiftConfigs,
  type ShiftParamsTriple,
  type SemesterParamsMap,
  type ShiftKey
} from "@/lib/shiftConfigCompiler";
import {
  generateCampusCode,
  generateCodeFromName,
  calculateShiftSchedule,
  type ShiftParams
} from "@/lib/utils";

export interface WizardCourseItem {
  id?: string;
  name: string;
  code?: string;
  description?: string;
  years: number;
  start_year?: string;
  end_year?: string;
  default_room?: string | null;
  default_shift?: string | null;
  isExisting?: boolean;
  sections?: any;
  sectionRooms?: any;
}

export interface CampusWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collegeToEdit: College | null;
  kamList: any[];
  camList: any[];
  onSaved: () => void;
  onOpenCampusConsole?: (collegeId: string) => void;
}

export const CampusWizardDialog: React.FC<CampusWizardDialogProps> = ({
  open,
  onOpenChange,
  collegeToEdit,
  kamList,
  camList,
  onSaved,
  onOpenCampusConsole
}) => {
  const { createCollege, updateCollege, createCourse, updateCAM, coursesList, colleges } = useApp();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [successCreatedId, setSuccessCreatedId] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCampusCodeCustomized, setIsCampusCodeCustomized] = useState(false);
  const [draftLastSaved, setDraftLastSaved] = useState<string | null>(null);

  // Step 1 Form
  const [form, setForm] = useState({
    id: "",
    name: "",
    address: "",
    kam_id: "",
    has_shifts: 1,
    shift_configs: "",
    rooms: "",
    code: "",
    academic_year: getCurrentAcademicYear(),
    manager: "",
    working_days: 5
  });

  // Step 2 Courses
  const [wizardCourses, setWizardCourses] = useState<WizardCourseItem[]>([]);
  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseYears, setNewCourseYears] = useState(3);
  const [newCourseShift, setNewCourseShift] = useState("general");

  // Step 3 Shifts
  const [shiftParams, setShiftParams] = useState<ShiftParamsTriple>(
    () => cloneShiftParams(DEFAULT_SHIFT_CONFIGS)
  );
  const [activeShiftTab, setActiveShiftTab] = useState<"shift_1" | "shift_2" | "general">("general");

  // Step 3 semester overrides: `shiftParams` always holds the *active* semester's
  // triple; every other semester keeps its own copy in `semesterParamsMap`.
  const [semesterParamsMap, setSemesterParamsMap] = useState<SemesterParamsMap>({});
  const [activeConfigSemester, setActiveConfigSemester] = useState<string>(ALL_SEMESTERS_KEY);
  const [newBreakName, setNewBreakName] = useState("Lunch Break");
  const [newBreakDuration, setNewBreakDuration] = useState(30);
  const [newBreakAfterPeriod, setNewBreakAfterPeriod] = useState(3);

  // Initialize or reset form when dialog opens
  useEffect(() => {
    if (!open) return;
    setModalError(null);
    setSuccessCreatedId(null);

    if (collegeToEdit) {
      setForm({
        id: collegeToEdit.id,
        name: collegeToEdit.name,
        address: collegeToEdit.address || "",
        kam_id: collegeToEdit.kam_id || "",
        has_shifts: collegeToEdit.has_shifts === undefined ? 1 : collegeToEdit.has_shifts,
        shift_configs: collegeToEdit.shift_configs || "",
        rooms: collegeToEdit.rooms || "",
        code: (collegeToEdit as any).code || "",
        academic_year: (collegeToEdit as any).academic_year || getCurrentAcademicYear(),
        manager: (collegeToEdit as any).manager || "",
        working_days: (collegeToEdit as any).working_days === undefined ? 5 : Number((collegeToEdit as any).working_days)
      });
      setIsCampusCodeCustomized(true);
      setStep(1);

      // Load existing courses
      const existing = coursesList.filter(
        d => d.college_id === collegeToEdit.id || (collegeToEdit.id === colleges[0]?.id && !d.college_id)
      );
      setWizardCourses(
        existing.map(c => ({
          ...c,
          isExisting: true,
          years: Number(c.years) || 3
        }))
      );

      // Parse shift configs
      if (collegeToEdit.shift_configs) {
        try {
          const parsed = JSON.parse(collegeToEdit.shift_configs);
          const stored = parsed.custom_shift_params as Partial<ShiftParamsTriple> | undefined;
          if (stored) {
            setShiftParams(prev => cloneShiftParams({
              shift_1: { ...prev.shift_1, ...stored.shift_1 },
              shift_2: { ...prev.shift_2, ...stored.shift_2 },
              general: { ...prev.general, ...stored.general }
            }));
          }
        } catch (_) {}
      }
      setSemesterParamsMap(semesterParamsMapFromShiftConfigs(collegeToEdit.shift_configs));
      setActiveConfigSemester(ALL_SEMESTERS_KEY);
    } else {
      // New campus mode
      setStep(1);
      setIsCampusCodeCustomized(false);
      setWizardCourses([]);
      setForm({
        id: "",
        name: "",
        address: "",
        kam_id: kamList[0]?.id || "",
        has_shifts: 1,
        shift_configs: "",
        rooms: "",
        code: "",
        academic_year: getCurrentAcademicYear(),
        manager: "",
        working_days: 5
      });
      setShiftParams(cloneShiftParams(DEFAULT_SHIFT_CONFIGS));
      setSemesterParamsMap({});
      setActiveConfigSemester(ALL_SEMESTERS_KEY);
    }
  }, [open, collegeToEdit, coursesList, colleges, kamList]);

  if (!open) return null;

  // Semesters actually taught here, plus any stored override, so a schedule
  // that exists in the data is always reachable in the picker.
  const semestersInScope = (() => {
    const inScope = new Set<string>();
    wizardCourses.forEach(c => {
      getSemestersForCourse(c.years).forEach(s => inScope.add(s));
    });
    Object.keys(semesterParamsMap).forEach(s => inScope.add(s));
    if (activeConfigSemester !== ALL_SEMESTERS_KEY) inScope.add(activeConfigSemester);
    return inScope.size > 0 ? Array.from(inScope) : ALL_SEMESTERS;
  })();

  const hasSemesterOverride = (semester: string) =>
    semester !== ALL_SEMESTERS_KEY && Boolean(semesterParamsMap[semester]);

  const handleSemesterChange = (nextSemester: string) => {
    if (nextSemester === activeConfigSemester) return;
    const updatedMap: SemesterParamsMap = {
      ...semesterParamsMap,
      [activeConfigSemester]: cloneShiftParams(shiftParams)
    };
    setSemesterParamsMap(updatedMap);
    const target = updatedMap[nextSemester] || updatedMap[ALL_SEMESTERS_KEY] || shiftParams;
    setShiftParams(cloneShiftParams(target));
    setActiveConfigSemester(nextSemester);
  };

  const patchShift = (key: ShiftKey, patch: Partial<ShiftParams>) => {
    setShiftParams(prev => ({
      ...prev,
      [key]: { ...prev[key], ...patch }
    }));
  };

  const patchShiftBreaks = (
    key: ShiftKey,
    updater: (existing: ShiftParams["breaks"]) => ShiftParams["breaks"]
  ) => {
    setShiftParams(prev => ({
      ...prev,
      [key]: { ...prev[key], breaks: updater(prev[key].breaks) }
    }));
  };

  const handleAddBreak = (key: ShiftKey) => {
    const name = newBreakName.trim();
    if (!name) {
      setModalError("Break name is required.");
      return;
    }
    if (shiftParams[key].breaks.some(b => b.afterPeriod === newBreakAfterPeriod)) {
      setModalError(`A break is already configured after Period ${newBreakAfterPeriod}.`);
      return;
    }
    patchShiftBreaks(key, existing => [
      ...existing,
      {
        id: `brk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        name,
        duration: Number(newBreakDuration) || 0,
        afterPeriod: Number(newBreakAfterPeriod) || 1
      }
    ]);
    setModalError(null);
  };

  const handleAddCourseToWizard = () => {
    if (!newCourseName.trim()) return;
    const item: WizardCourseItem = {
      name: newCourseName.trim(),
      code: generateCodeFromName(newCourseName.trim()),
      years: Number(newCourseYears) || 3,
      default_shift: newCourseShift,
      isExisting: false
    };
    setWizardCourses(prev => [...prev, item]);
    setNewCourseName("");
    setNewCourseYears(3);
  };

  const handleRemoveCourseFromWizard = (index: number) => {
    setWizardCourses(prev => prev.filter((_, i) => i !== index));
  };

  const handleNextStep = () => {
    setModalError(null);
    if (step === 1) {
      if (!form.name.trim()) {
        setModalError("Campus Name is required.");
        return;
      }
      if (!form.address.trim()) {
        setModalError("Campus Address / Location is required.");
        return;
      }
      if (!form.kam_id) {
        setModalError("Please select a Key Account Manager.");
        return;
      }
      if (!form.code.trim()) {
        const autoCode = generateCampusCode(form.name);
        setForm(prev => ({ ...prev, code: autoCode }));
      }
    }
    if (step === 2 && wizardCourses.length === 0) {
      setModalError("Please add at least one course to this campus.");
      return;
    }
    setStep(step + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const finalMap: SemesterParamsMap = {
      ...semesterParamsMap,
      [activeConfigSemester]: cloneShiftParams(shiftParams)
    };
    const compiled = compileShiftConfigs(
      finalMap[ALL_SEMESTERS_KEY] || shiftParams,
      finalMap,
      form.has_shifts === 1
    );
    if (!compiled.ok) {
      setModalError(
        compiled.errors.length === 1
          ? compiled.errors[0]
          : `${compiled.errors[0]} (+${compiled.errors.length - 1} more)`
      );
      return;
    }

    setIsSubmitting(true);

    try {
      let collegeId = form.id;
      if (!collegeToEdit) {
        const cleanCode = form.code || generateCampusCode(form.name) || Date.now().toString();
        collegeId = "Clg_" + cleanCode.trim().replace(/[^a-zA-Z0-9]/g, "");
      }

      const updatedForm = {
        ...form,
        id: collegeId,
        shift_configs: JSON.stringify(compiled.configs)
      };

      let res;
      if (collegeToEdit) {
        res = await updateCollege(updatedForm);
      } else {
        res = await createCollege(updatedForm);
      }

      if (res.success) {
        // Assign Campus Manager if selected
        if (updatedForm.manager) {
          const selectedCam = camList.find(c => c.id === updatedForm.manager);
          if (selectedCam) {
            await updateCAM({
              id: selectedCam.id,
              name: selectedCam.name,
              email: selectedCam.email,
              college_id: updatedForm.id,
              kam_id: selectedCam.kam_id
            });
          }
        }

        // Create new courses
        const newCourses = wizardCourses.filter(c => !c.isExisting);
        for (const course of newCourses) {
          await createCourse({
            name: course.name,
            college_id: updatedForm.id,
            code: course.code?.trim().toUpperCase() || generateCodeFromName(course.name),
            description: course.description || "",
            years: Number(course.years) || 3,
            start_date: new Date().toISOString().slice(0, 10),
            end_date: new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            start_year: new Date().getFullYear().toString(),
            end_year: (new Date().getFullYear() + (Number(course.years) || 3)).toString(),
            default_shift: course.default_shift || undefined
          });
        }

        onSaved();
        if (!collegeToEdit) {
          setSuccessCreatedId(updatedForm.id);
        } else {
          toast("Campus updated successfully.", "success");
          onOpenChange(false);
        }
      } else {
        setModalError(res.message || "Failed to save campus.");
      }
    } catch (err: any) {
      setModalError(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      ariaLabel="Campus Setup Wizard"
      overlayClassName="bg-gray-900/50 backdrop-blur-sm p-4 overflow-y-auto"
      panelClassName={`overflow-hidden animate-slideUp flex flex-col my-auto max-h-[90vh] transition-all duration-300 ${
        step === 3 ? "max-w-5xl" : "max-w-2xl"
      } p-0 space-y-0`}
    >
      {/* Header */}
      <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-3">
          <h3 className="font-extrabold text-gray-900 text-sm flex items-center gap-1.5">
            <Building2 className="h-5 w-5 text-indigo-600" />
            {collegeToEdit ? "Edit Campus" : successCreatedId ? "Campus Created!" : "Add New Campus"}
          </h3>
          {draftLastSaved && !collegeToEdit && !successCreatedId && (
            <span className="text-[10px] font-black text-pink-700 bg-gradient-to-r from-pink-50 to-amber-50 border border-pink-200/80 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-2xs">
              <span className="h-1.5 w-1.5 rounded-full bg-pink-500 animate-pulse" />
              Draft Auto-Saved ({draftLastSaved})
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close campus dialog"
          onClick={() => onOpenChange(false)}
          className="h-auto w-auto p-1 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer text-gray-500 hover:text-gray-800"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Success Screen */}
      {successCreatedId ? (
        <div className="p-8 space-y-6 animate-fadeIn text-center">
          <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto text-emerald-600">
            <Building2 className="h-8 w-8" />
          </div>
          <div>
            <h4 className="font-black text-gray-900 text-base">Campus Created Successfully!</h4>
            <p className="text-xs text-gray-500 font-semibold mt-1">
              {form.name} is now registered in the timetable network.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
            <Button
              onClick={() => {
                onOpenChange(false);
                if (onOpenCampusConsole && successCreatedId) onOpenCampusConsole(successCreatedId);
              }}
              className="btn-gradient text-white font-bold text-xs py-2.5 rounded-xl shadow-sm"
            >
              Open Campus Console
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-xs font-bold py-2.5 rounded-xl"
            >
              Done
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 text-xs font-semibold">
          {/* Stepper */}
          <div className="flex items-center px-6 py-4 bg-gray-50 border-b border-gray-200 shrink-0 gap-0">
            {[
              { step: 1, label: "Campus Info" },
              { step: 2, label: "Courses" },
              { step: 3, label: "Shift Config" },
              { step: 4, label: "Review" }
            ].map((s, idx) => {
              const isActive = step === s.step;
              const isDone = step > s.step;
              return (
                <React.Fragment key={s.step}>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div
                      className={`h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-black transition-all ${
                        isDone ? "text-white" : isActive ? "text-white" : "text-gray-400"
                      }`}
                      style={{
                        background: isDone ? "#10b981" : isActive ? "linear-gradient(135deg,#6366f1,#4f46e5)" : "#e5e7eb",
                        boxShadow: isActive ? "0 0 0 4px rgba(99,102,241,0.18), 0 2px 8px rgba(99,102,241,0.35)" : "none"
                      }}
                    >
                      {isDone ? "✓" : s.step}
                    </div>
                    <span
                      className={`text-[9.5px] uppercase tracking-wider font-extrabold whitespace-nowrap transition-colors ${
                        isActive ? "text-indigo-600" : isDone ? "text-emerald-600" : "text-gray-400"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {idx < 3 && (
                    <div
                      className="flex-1 h-[3px] mx-2 rounded-full transition-all"
                      style={{
                        background: isDone
                          ? "linear-gradient(to right,#10b981,#34d399)"
                          : isActive
                          ? "linear-gradient(to right,#6366f1 30%,#e5e7eb)"
                          : "#e5e7eb"
                      }}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          <div className="p-6 overflow-y-auto space-y-4 flex-1">
            {modalError && (
              <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-bold flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                {modalError}
              </div>
            )}

            {/* STEP 1: CAMPUS INFO */}
            {step === 1 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 col-span-2">
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Campus Name *</label>
                    <Input
                      aria-label="Campus Name"
                      type="text"
                      required
                      placeholder="e.g. FP South Campus"
                      value={form.name}
                      onChange={e => {
                        const name = e.target.value;
                        const autoCode = generateCampusCode(name);
                        setForm(prev => ({
                          ...prev,
                          name,
                          code: isCampusCodeCustomized ? prev.code : autoCode
                        }));
                      }}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">
                        Campus Code
                        <span className="ml-1 text-indigo-500 font-bold normal-case">(Auto)</span>
                      </label>
                      {!collegeToEdit && form.name && (
                        <button
                          type="button"
                          onClick={() => {
                            const code = generateCampusCode(form.name);
                            setIsCampusCodeCustomized(false);
                            setForm(prev => ({ ...prev, code }));
                          }}
                          className="text-[10px] text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw className="h-2.5 w-2.5" />
                          <span>Sync</span>
                        </button>
                      )}
                    </div>
                    <Input
                      aria-label="Campus Code"
                      type="text"
                      required
                      disabled={!!collegeToEdit}
                      value={form.code}
                      onChange={e => {
                        setIsCampusCodeCustomized(true);
                        setForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }));
                      }}
                      className={`w-full border border-gray-200 rounded-xl px-3.5 py-2.5 font-bold tracking-wider uppercase focus:outline-none focus:ring-1 focus:ring-indigo-600 ${
                        collegeToEdit ? "bg-gray-100 text-gray-400" : "bg-gray-50 text-gray-900"
                      }`}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Academic Year *</label>
                    <Select
                      aria-label="Academic Year"
                      required
                      value={form.academic_year}
                      onChange={e => setForm({ ...form, academic_year: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer"
                    >
                      {getAcademicYearOptions().map(yr => (
                        <option key={yr} value={yr}>
                          {yr}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="space-y-1 col-span-2">
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Address / Location *</label>
                    <Input
                      aria-label="Address / Location"
                      type="text"
                      required
                      placeholder="e.g. 78, West Tambaram, Chennai"
                      value={form.address}
                      onChange={e => setForm({ ...form, address: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">KAM Owner *</label>
                    <Select
                      aria-label="KAM Owner"
                      required
                      value={form.kam_id}
                      onChange={e => setForm({ ...form, kam_id: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer"
                    >
                      <option value="">Select KAM</option>
                      {kamList.map((kam: any) => (
                        <option key={kam.id} value={kam.id}>
                          {kam.name}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Campus Manager (Optional)</label>
                    <Select
                      aria-label="Campus Manager"
                      value={form.manager}
                      onChange={e => setForm({ ...form, manager: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer"
                    >
                      <option value="">Select CM (Optional)</option>
                      {camList.map((cam: any) => (
                        <option key={cam.id} value={cam.id}>
                          {cam.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                {/* Shift Mode Toggle */}
                <div className="space-y-1 pt-2">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Shift Mode *</label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, has_shifts: 0 })}
                      className={`flex-1 p-3 rounded-xl border-2 transition-all cursor-pointer text-left ${
                        form.has_shifts === 0
                          ? "border-indigo-500 bg-indigo-50 text-indigo-800"
                          : "border-gray-200 bg-white text-gray-500"
                      }`}
                    >
                      <div className="font-extrabold text-[11px]">General Shift</div>
                      <div className="text-[9px] opacity-70">Single unified shift</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, has_shifts: 1 })}
                      className={`flex-1 p-3 rounded-xl border-2 transition-all cursor-pointer text-left ${
                        form.has_shifts === 1
                          ? "border-indigo-500 bg-indigo-50 text-indigo-800"
                          : "border-gray-200 bg-white text-gray-500"
                      }`}
                    >
                      <div className="font-extrabold text-[11px]">Multiple Shifts</div>
                      <div className="text-[9px] opacity-70">Shift 1 & Shift 2 independently</div>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: COURSES */}
            {step === 2 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Add Course to Campus</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Input
                      type="text"
                      placeholder="Course Name e.g. B.Tech Computer Science"
                      value={newCourseName}
                      onChange={e => setNewCourseName(e.target.value)}
                      className="sm:col-span-2 bg-white text-xs font-bold"
                    />
                    <div className="flex gap-1.5">
                      <Select
                        value={newCourseYears}
                        onChange={e => setNewCourseYears(Number(e.target.value) || 3)}
                        className="bg-white text-xs font-bold"
                      >
                        <option value={2}>2 Years</option>
                        <option value={3}>3 Years</option>
                        <option value={4}>4 Years</option>
                        <option value={5}>5 Years</option>
                      </Select>
                      <Button
                        type="button"
                        onClick={handleAddCourseToWizard}
                        className="btn-gradient text-white text-xs px-3 rounded-lg font-bold"
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Campus Courses ({wizardCourses.length})
                  </span>
                  {wizardCourses.map((c, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 bg-white border border-gray-200 rounded-xl"
                    >
                      <div>
                        <span className="font-extrabold text-xs text-gray-900 block">{c.name}</span>
                        <span className="text-[9px] text-gray-400">
                          {c.years} Year(s) · Code: {c.code || "—"}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveCourseFromWizard(idx)}
                        className="text-gray-400 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {wizardCourses.length === 0 && (
                    <div className="text-center py-6 text-gray-400 italic">No courses added yet.</div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 3: SHIFT CONFIG */}
            {step === 3 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex border-b border-gray-200 gap-4">
                  {(form.has_shifts === 1 ? (["shift_1", "shift_2", "general"] as const) : (["general"] as const)).map(sh => (
                    <button
                      key={sh}
                      type="button"
                      onClick={() => setActiveShiftTab(sh)}
                      className={`pb-2 px-1 text-xs font-black transition-all cursor-pointer ${
                        (form.has_shifts === 1 ? activeShiftTab : "general") === sh
                          ? "border-b-2 border-indigo-600 text-indigo-600"
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    >
                      {shiftParams[sh].label}
                    </button>
                  ))}
                </div>

                {/* Semester scope — same period editor, values kept per semester */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-indigo-50/40 p-2.5 rounded-xl border border-indigo-100/50">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
                    Configure semester
                  </span>
                  <Select
                    aria-label="Configure semester"
                    value={activeConfigSemester}
                    onChange={e => handleSemesterChange(e.target.value)}
                    className="flex-1 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 font-bold text-xs focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer"
                  >
                    <option value={ALL_SEMESTERS_KEY}>All Semesters (default fallback)</option>
                    {semestersInScope.map(sem => (
                      <option key={sem} value={sem}>
                        {sem}
                        {hasSemesterOverride(sem) ? " · custom" : ""}
                      </option>
                    ))}
                  </Select>
                  <span
                    role="status"
                    className="text-[10px] font-bold text-slate-400 sm:max-w-[46%]"
                  >
                    {activeConfigSemester === ALL_SEMESTERS_KEY
                      ? "Fallback for every semester"
                      : hasSemesterOverride(activeConfigSemester)
                        ? "Custom for this semester"
                        : "Inherits All Semesters until edited"}
                  </span>
                </div>

                {(() => {
                  // A campus without shifts only runs the general schedule, so
                  // never edit a tab that is not shown.
                  const editTab: ShiftKey = form.has_shifts === 1 ? activeShiftTab : "general";
                  const p = shiftParams[editTab];
                  const schedule = calculateShiftSchedule(p);

                  return (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Start Time</label>
                          <Input
                            type="time"
                            value={p.startTime}
                            onChange={e => patchShift(editTab, { startTime: e.target.value })}
                            className="bg-white text-xs font-bold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Period Duration</label>
                          <Input
                            type="number"
                            min={20}
                            max={120}
                            value={p.periodDuration}
                            onChange={e => patchShift(editTab, { periodDuration: Number(e.target.value) || 50 })}
                            className="bg-white text-xs font-bold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Total Periods</label>
                          <Input
                            type="number"
                            min={1}
                            max={12}
                            value={p.periodsCount}
                            onChange={e => patchShift(editTab, { periodsCount: Number(e.target.value) || 5 })}
                            className="bg-white text-xs font-bold"
                          />
                        </div>
                      </div>

                      {/* Breaks for this semester + shift */}
                      <div className="bg-white border border-gray-200 rounded-xl p-3.5 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            Breaks · {p.label}
                          </span>
                          <span className="text-[9px] font-bold text-gray-400">
                            {p.breaks.length === 0
                              ? "None — periods run back to back"
                              : `${p.breaks.length} configured`}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                          <div className="space-y-1">
                            <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Name</label>
                            <Input
                              type="text"
                              value={newBreakName}
                              onChange={e => setNewBreakName(e.target.value)}
                              placeholder="e.g. Lunch Break"
                              className="bg-white text-xs font-bold"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">After period</label>
                            <Select
                              aria-label="Break after period"
                              value={Math.min(newBreakAfterPeriod, p.periodsCount)}
                              onChange={e => setNewBreakAfterPeriod(Number(e.target.value) || 1)}
                              className="bg-white text-xs font-bold cursor-pointer"
                            >
                              {Array.from({ length: p.periodsCount }, (_, i) => i + 1).map(n => (
                                <option key={n} value={n}>
                                  Period {n}
                                </option>
                              ))}
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Minutes</label>
                            <Input
                              type="number"
                              min={5}
                              max={120}
                              value={newBreakDuration}
                              onChange={e => setNewBreakDuration(Number(e.target.value) || 5)}
                              className="bg-white text-xs font-bold"
                            />
                          </div>
                          <Button type="button" variant="outline" onClick={() => handleAddBreak(editTab)} className="w-full">
                            <Plus className="h-3.5 w-3.5" /> Add break
                          </Button>
                        </div>

                        {p.breaks.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {p.breaks
                              .slice()
                              .sort((a, b) => a.afterPeriod - b.afterPeriod)
                              .map(br => (
                                <span
                                  key={br.id}
                                  className="flex items-center gap-1.5 pl-2.5 pr-1 py-1 bg-amber-50 border border-amber-200 rounded-lg text-[10px] font-bold text-amber-800"
                                >
                                  {br.name} · {br.duration} min after Period {br.afterPeriod}
                                  <button
                                    type="button"
                                    aria-label={`Remove ${br.name}`}
                                    onClick={() =>
                                      patchShiftBreaks(editTab, list => list.filter(b => b.id !== br.id))
                                    }
                                    className="p-0.5 rounded hover:bg-amber-200/70 text-amber-600 cursor-pointer"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </span>
                              ))}
                          </div>
                        )}
                      </div>

                      {/* Timetable Schedule Preview */}
                      <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                          {schedule.error
                            ? schedule.error
                            : `${p.label} · ${activeConfigSemester} — ${p.periodsCount} periods, ends ${schedule.overallEndTime}`}
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                          {schedule.items.map((item, i) => (
                            <div
                              key={i}
                              className={`p-2 rounded-lg border text-center ${
                                item.type === "break"
                                  ? "bg-amber-50 border-amber-200 text-amber-800"
                                  : "bg-indigo-50/50 border-indigo-100 text-indigo-900"
                              }`}
                            >
                              <span className="font-extrabold text-[11px] block">{item.name}</span>
                              <span className="text-[9px] text-gray-500 font-mono font-semibold">
                                {item.startTimeStr} - {item.endTimeStr}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* STEP 4: REVIEW */}
            {step === 4 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                  <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">Campus Summary</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-gray-400 text-[10px] block font-bold">Name</span>
                      <span className="font-black text-gray-900 text-sm">{form.name}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[10px] block font-bold">Code</span>
                      <span className="font-black text-indigo-600 font-mono text-sm">{form.code}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[10px] block font-bold">Location</span>
                      <span className="text-gray-700 font-bold">{form.address}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[10px] block font-bold">Courses</span>
                      <span className="text-gray-700 font-bold">{wizardCourses.length} Registered</span>
                    </div>
                  </div>
                </div>

                {(() => {
                  const finalMap: SemesterParamsMap = {
                    ...semesterParamsMap,
                    [activeConfigSemester]: cloneShiftParams(shiftParams)
                  };
                  const preview = compileShiftConfigs(
                    finalMap[ALL_SEMESTERS_KEY] || shiftParams,
                    finalMap,
                    form.has_shifts === 1
                  );
                  if (!preview.ok) {
                    return (
                      <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[11px] font-bold text-rose-700">
                        {preview.errors[0]}
                      </div>
                    );
                  }
                  const overrides = Object.keys(preview.configs.semester_configs);
                  const keys = form.has_shifts === 1
                    ? (["shift_1", "shift_2", "general"] as const)
                    : (["general"] as const);
                  return (
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                      <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">Period Schedule</span>
                      <div className="flex flex-wrap gap-2">
                        {keys.map(k => (
                          <span
                            key={k}
                            className="px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-700"
                          >
                            {shiftParams[k].label}: {preview.configs[k].length} periods
                          </span>
                        ))}
                      </div>
                      <p className="text-[10px] font-bold text-gray-500">
                        {overrides.length > 0
                          ? `Semester overrides: ${overrides.join(", ")}`
                          : "Same periods for every semester."}
                      </p>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Footer Navigation */}
          <div className="flex justify-between gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/50 shrink-0">
            <div>
              {step > 1 && (
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setStep(step - 1)}
                  className="h-auto px-4 py-2 text-gray-500 rounded-xl font-bold"
                >
                  ← Back
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                type="button"
                onClick={() => onOpenChange(false)}
                className="h-auto px-4 py-2 text-gray-500 rounded-xl font-bold"
              >
                Cancel
              </Button>
              {step < 4 ? (
                <Button
                  type="button"
                  onClick={handleNextStep}
                  className="btn-gradient px-5 py-2 text-white rounded-xl shadow-sm font-bold"
                >
                  Next Step →
                </Button>
              ) : (
                <LoadingButton
                  type="submit"
                  isLoading={isSubmitting}
                  className="btn-gradient px-5 py-2 text-white rounded-xl shadow-sm font-bold"
                >
                  {collegeToEdit ? "Save Campus Changes" : "Confirm & Create Campus"}
                </LoadingButton>
              )}
            </div>
          </div>
        </form>
      )}
    </Dialog>
  );
};
