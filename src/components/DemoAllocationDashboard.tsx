"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useApp } from "../context/AppContext";
import { useToast } from "../context/ToastContext";
import {
  Calendar,
  Clock,
  Plus,
  User,
  RefreshCw,
  Trash2,
  Edit2,
  Check,
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Settings,
  Grid,
  List,
  Compass,
  Users,
  Award,
  Layers,
  BookOpen,
  HelpCircle,
  Moon,
  Coffee,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Upload,
  Table,
  Download,
  FileSpreadsheet,
  FileCheck,
  ChevronRight,
  Building2,
  SlidersHorizontal,
  FileText
} from "lucide-react";
import { formatTimeLabel, getWeekDates } from "../lib/utils";
import { Card } from "./Card";
import { Panel } from "./Panel";

export function DemoAllocationDashboard() {
  const {
    colleges,
    mentors,
    slots,
    smes,
    demoSessions,
    setDemoSessions,
    demoRules,
    subjectsList,
    subjectGroups,
    daysOfWeek,
    updateMentor,
    refreshData,
    smeAvailability,
    bookDemoSession,
    bulkBookDemoSessions,
    deleteDemoSession,
    createDemoRule,
    deleteDemoRule,
    leaveRequests,
    holidays,
    demoSwapRequests,
    resolveDemoSwap
  } = useApp();

  const { toast } = useToast();

  // Filters State
  const [selectedCollegeId, setSelectedCollegeId] = useState<string>("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("All");

  // Date selection - defaults dynamically to current date
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => new Date().toISOString().slice(0, 10));

  // Scheduling generation states
  const [targetDemosCount, setTargetDemosCount] = useState<number>(1);
  const [previewSessions, setPreviewSessions] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<"idle" | "generating" | "done">("idle");
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSwapRequestsModal, setShowSwapRequestsModal] = useState(false);
  const [swapRequestsTab, setSwapRequestsTab] = useState<"pending" | "resolved">("pending");

  // Excel Timetable & Allocation Import/Export States
  const [showDemoExcelImportModal, setShowDemoExcelImportModal] = useState(false);
  const [demoImportPreview, setDemoImportPreview] = useState<{ parsed: any[]; warnings: string[]; validCount: number; targetSubjectGroup: string } | null>(null);
  const [isImportingDemoExcel, setIsImportingDemoExcel] = useState(false);
  const [showExcelDropdown, setShowExcelDropdown] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateMentorGroup, setTemplateMentorGroup] = useState<string>("");

  // Left Sidebar & Tab Navigation States
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [allocatorTab, setAllocatorTab] = useState<"matrix" | "rules" | "queue">("matrix");
  const [rulesSelectedGroup, setRulesSelectedGroup] = useState<string>("All");

  // Per-Mentor Custom Weekly Demo Targets state
  const [mentorTargets, setMentorTargets] = useState<Record<string, number>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("fp_mentor_demo_targets");
        if (saved) return JSON.parse(saved);
      } catch (_) { }
    }
    return {};
  });

  const handleSetMentorTarget = (mentorId: string, count: number) => {
    const updated = { ...mentorTargets, [mentorId]: Math.max(0, count) };
    setMentorTargets(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("fp_mentor_demo_targets", JSON.stringify(updated));
    }
  };

  // Head SME mapping state
  const [headSmeMap, setHeadSmeMap] = useState<Record<string, string>>({});

  // Dept rules input state — local editable values before saving
  const [deptRuleInputs, setDeptRuleInputs] = useState<Record<string, number>>({});

  // Manual Override States
  const [editSession, setEditSession] = useState<any | null>(null);

  // Exceptions list for unplaced sessions
  const [exceptions, setExceptions] = useState<any[]>([]);

  // Cell Popover State for viewing mentors
  const [cellPopover, setCellPopover] = useState<any | null>(null);

  // Auto-select "all" colleges on load
  React.useEffect(() => {
    if (colleges.length > 0 && !selectedCollegeId) {
      setSelectedCollegeId("all");
    }
  }, [colleges, selectedCollegeId]);

  // Sync target demos count from dept rules when department filter changes
  React.useEffect(() => {
    if (selectedGroupId && selectedGroupId !== "All") {
      const rule = demoRules?.find(r => r.subject?.toLowerCase().trim() === selectedGroupId.toLowerCase().trim());
      setTargetDemosCount(rule ? rule.target : 1);
    } else {
      setTargetDemosCount(1);
    }
  }, [selectedGroupId, demoRules]);

  // Derived: Current selected college
  const currentCollege = useMemo(() => {
    return colleges.find(c => c.id === selectedCollegeId);
  }, [colleges, selectedCollegeId]);

  // Derived: All unique class groups/cohorts in slots for modal choices
  const classGroups = useMemo(() => {
    const groups = new Set<string>();
    slots.forEach(s => {
      if (s.classGroup) {
        groups.add(s.classGroup.trim());
      }
    });
    return Array.from(groups);
  }, [slots]);

  // Automatically select all colleges on load if none selected
  React.useEffect(() => {
    if (!selectedCollegeId) {
      setSelectedCollegeId("all");
    }
  }, [selectedCollegeId]);

  // Helper to parse slot time string into minutes from midnight (supports any string format)
  const parseSlotTimeToMinutes = (t: string) => {
    if (!t) return 9999;
    const match = t.match(/(\d{1,2})(?:[:.](\d{2}))?\s*(AM|PM)?/i);
    if (!match) return 9999;
    let hr = parseInt(match[1], 10);
    const min = match[2] ? parseInt(match[2], 10) : 0;
    const ampm = match[3] ? match[3].toUpperCase() : null;
    if (ampm === "PM" && hr < 12) hr += 12;
    if (ampm === "AM" && hr === 12) hr = 0;
    return hr * 60 + min;
  };

  // Helper to accurately extract startMin and endMin from period strings (e.g. "Period 1 (8.30 AM - 9.25 AM)")
  const extractSlotStartAndEnd = (timeSlotStr: string) => {
    if (!timeSlotStr) return { startMin: 540, endMin: 600 };
    const matches = Array.from(timeSlotStr.matchAll(/(\d{1,2})(?:[:.](\d{2}))?\s*(AM|PM)?/gi));
    if (matches.length >= 2) {
      const parseM = (m: RegExpMatchArray) => {
        let hr = parseInt(m[1], 10);
        const min = m[2] ? parseInt(m[2], 10) : 0;
        const ampm = m[3] ? m[3].toUpperCase() : null;
        if (ampm === "PM" && hr < 12) hr += 12;
        if (ampm === "AM" && hr === 12) hr = 0;
        return hr * 60 + min;
      };
      return {
        startMin: parseM(matches[0]),
        endMin: parseM(matches[1])
      };
    } else if (matches.length === 1) {
      const s = parseSlotTimeToMinutes(matches[0][0]);
      return { startMin: s, endMin: s + 50 };
    }
    return { startMin: 540, endMin: 600 };
  };

  // Standardized helper to resolve canonical mentor group
  const getMentorGroup = (m: any): string => {
    if (!m) return "General";
    return (m.mentor_group || m.subject_group || m.department || "General").trim();
  };

  // Standardized helper to resolve SMEs for a subject group
  const getSmesForSubjectGroup = useCallback((groupName: string) => {
    if (!groupName) return [];
    const target = groupName.toLowerCase().trim();
    const targetWords = target.split(/[\s/,&+-]+/).filter(w => w.length > 2);

    return smes.filter(s => {
      if (!s) return false;
      const sub = (s.subject || "").toLowerCase().trim();
      const headGroup = (s.head_subject_group || "").toLowerCase().trim();
      const mGroup = (s.mentor_group || "").toLowerCase().trim();
      const sName = (s.name || "").toLowerCase().trim();

      // 1. Direct group lead match in subjectGroups
      const isGroupLead = subjectGroups.some(g => {
        const gName = (g.name || "").toLowerCase().trim();
        const gMatch = gName === target || targetWords.some(w => gName.includes(w));
        const smeMatch = (g.lead_sme_id && g.lead_sme_id === s.id) || 
                         (g.lead_sme_name && g.lead_sme_name.toLowerCase().trim() === sName);
        return gMatch && smeMatch;
      });
      if (isGroupLead) return true;

      // 2. Exact match on subject / head group / mentor group
      if (sub === target || headGroup === target || mGroup === target) return true;

      // 3. Substring / word overlap match
      if (sub && (sub.includes(target) || target.includes(sub))) return true;
      if (headGroup && (headGroup.includes(target) || target.includes(headGroup))) return true;
      if (mGroup && (mGroup.includes(target) || target.includes(mGroup))) return true;

      if (targetWords.length > 0) {
        if (targetWords.some(w => (sub && sub.includes(w)) || (headGroup && headGroup.includes(w)) || (mGroup && mGroup.includes(w)))) {
          return true;
        }
      }

      return false;
    });
  }, [smes, subjectGroups]);

  const mentorGroups = useMemo(() => {
    const groups = new Set<string>();

    // 1. From API subjectGroups
    if (subjectGroups && Array.isArray(subjectGroups)) {
      subjectGroups.forEach((g: any) => {
        const gName = typeof g === "string" ? g : g.name || g.group_name;
        if (gName && gName.trim()) groups.add(gName.trim());
      });
    }

    // 2. From registered Mentors DB
    mentors.forEach(m => {
      const g = getMentorGroup(m);
      if (g) groups.add(g);
    });

    // 3. From registered SMEs DB
    smes.forEach(s => {
      if (s.subject && s.subject.trim()) groups.add(s.subject.trim());
      if (s.head_subject_group && s.head_subject_group.trim()) groups.add(s.head_subject_group.trim());
    });

    // 4. From active Demo Rules DB
    if (demoRules && Array.isArray(demoRules)) {
      demoRules.forEach((r: any) => {
        if (r.subject && r.subject.trim()) groups.add(r.subject.trim());
      });
    }

    return Array.from(groups).sort((a, b) => (a || "").localeCompare(b || ""));
  }, [mentors, smes, subjectGroups, demoRules]);

  // Derived: List of 5 consecutive dates of the week containing selectedDateStr
  const currentWeekDates = useMemo(() => {
    return getWeekDates(0, selectedDateStr);
  }, [selectedDateStr]);

  // Derived: Filtered list of mentors (used by scheduler and grid)
  const filteredMentors = useMemo(() => {
    if (mentors.length === 0) return [];
    return mentors.filter(m => {
      const matchCollege = !selectedCollegeId || selectedCollegeId === "all" || m.college_id === selectedCollegeId;

      let matchGroup = true;
      if (selectedGroupId && selectedGroupId !== "All") {
        const mGroup = getMentorGroup(m);
        matchGroup = mGroup.toLowerCase() === selectedGroupId.toLowerCase().trim();
      }

      return matchCollege && matchGroup;
    });
  }, [mentors, selectedCollegeId, selectedGroupId]);

  // Earliest and Latest SME Demo Windows across active SME availability
  const smeDemoBounds = useMemo(() => {
    const activeDemoWindows = (smeAvailability || []).filter(
      (a: any) => a.is_active !== 0 && (a.slot_type || a.slotType || "demo") !== "training"
    );

    if (activeDemoWindows.length === 0) {
      return { minStartMin: 540, maxEndMin: 1050 }; // Default: 09:00 AM (540) to 05:30 PM (1050)
    }

    let minStart = 9999;
    let maxEnd = 0;
    activeDemoWindows.forEach((w: any) => {
      const s = parseSlotTimeToMinutes(w.start_time);
      const e = parseSlotTimeToMinutes(w.end_time);
      if (s < minStart) minStart = s;
      if (e > maxEnd) maxEnd = e;
    });

    if (minStart >= 9999) minStart = 540;
    if (maxEnd <= 0) maxEnd = 1050;

    return { minStartMin: minStart, maxEndMin: maxEnd };
  }, [smeAvailability]);

  // Derived: Clean timetable slots for the selected college / group
  const collegeTimeSlots = useMemo(() => {
    if (!selectedCollegeId) return [];

    let targetColleges = colleges;
    if (selectedCollegeId !== "all") {
      targetColleges = colleges.filter(c => c.id === selectedCollegeId);
    } else if (filteredMentors.length > 0) {
      // If all mentors belong to a single college or primary college, prioritize that college's shift definition
      const mentorCollegeIds = Array.from(new Set(filteredMentors.map(m => m.college_id).filter(Boolean)));
      if (mentorCollegeIds.length === 1) {
        targetColleges = colleges.filter(c => c.id === mentorCollegeIds[0]);
      }
    }

    const uniqueSlots = new Set<string>();

    // 1. Extract from college shift configs
    targetColleges.forEach(c => {
      if (c.shift_configs) {
        try {
          const parsed = JSON.parse(c.shift_configs);
          const s1 = parsed.shift_1 || [];
          const s2 = parsed.shift_2 || [];
          const gen = parsed.general || [];
          (s1.length > 0 ? s1 : (gen.length > 0 ? gen : s2)).forEach((t: string) => {
            if (t && t.trim()) uniqueSlots.add(t.trim());
          });
        } catch (_) { }
      }
    });

    // 2. If no shift config found, extract from master slots
    if (uniqueSlots.size === 0) {
      slots.forEach(s => {
        if ((selectedCollegeId === "all" || s.college_id === selectedCollegeId) && s.time) {
          uniqueSlots.add(s.time.trim());
        }
      });
    }

    if (uniqueSlots.size === 0) {
      return [
        "Period 1 (08:30 AM - 09:25 AM)",
        "Period 2 (09:25 AM - 10:20 AM)",
        "Period 3 (10:35 AM - 11:30 AM)",
        "Period 4 (11:30 AM - 12:25 PM)",
        "Period 5 (01:15 PM - 02:05 PM)",
        "Period 6 (02:05 PM - 02:55 PM)"
      ];
    }

    // Sort cleanly by period start time
    return Array.from(uniqueSlots).sort((a, b) => {
      const aStart = extractSlotStartAndEnd(a).startMin;
      const bStart = extractSlotStartAndEnd(b).startMin;
      return aStart - bStart;
    });
  }, [slots, selectedCollegeId, colleges, filteredMentors]);

  const standardShiftSlots = useMemo(() => {
    const list: string[] = [];
    colleges.forEach(c => {
      if ((selectedCollegeId === "all" || c.id === selectedCollegeId) && c.shift_configs) {
        try {
          const parsed = JSON.parse(c.shift_configs);
          const s1 = parsed.shift_1 || [];
          const s2 = parsed.shift_2 || [];
          const gen = parsed.general || [];
          [...s1, ...s2, ...gen].forEach((t: string) => list.push(t.trim().toLowerCase()));
        } catch (_) { }
      }
    });
    return Array.from(new Set(list));
  }, [selectedCollegeId, colleges]);

  // Helper: check if a mentor has a class, demo, or is blocked on a specific day/date/time
  const getMentorStatusAtSlot = (mentorId: string, dateStr: string, dbTimeSlot: string, currentPreviews: any[] = []) => {
    // 1. Check if they have a demo session in database
    const dbDemo = demoSessions.find(ds => ds.mentorId === mentorId && ds.dateStr === dateStr && ds.timeSlot === dbTimeSlot);
    if (dbDemo) {
      return {
        status: "demo",
        label: `Demo: ${dbDemo.subject}`,
        details: `SME: ${dbDemo.smeName}`,
        session: dbDemo
      };
    }

    // 2. Check if they have a preview demo session
    const previewDemo = currentPreviews.find(p => p.mentorId === mentorId && p.dateStr === dateStr && p.timeSlot === dbTimeSlot);
    if (previewDemo) {
      return {
        status: "preview",
        label: `Preview: ${previewDemo.subject}`,
        details: `SME: ${previewDemo.smeName}`,
        session: previewDemo
      };
    }

    // 3. Check if they are on leave
    const isLeave = leaveRequests?.some((l: any) => l.mentorId === mentorId && l.dateStr === dateStr && l.status === "approved");
    if (isLeave) {
      return { status: "blocked", label: "On Leave", details: "Leave Approved" };
    }

    // 4. Check if they are teaching a regular class
    const dayName = currentWeekDates.find(w => w.dateStr === dateStr)?.day || "";
    const teachSlot = slots.find(s => s.mentorId === mentorId && s.day === dayName && s.time === dbTimeSlot);
    if (teachSlot) {
      return {
        status: "occupied",
        label: teachSlot.course,
        group: teachSlot.classGroup,
        details: `Class in ${teachSlot.location}`
      };
    }

    return { status: "free", label: "Available", details: "" };
  };

  // Helper: check if an SME is free on a given date/time (checks DB collisions + dynamic configured availability windows)
  const isSmeFree = (smeId: string, dateStr: string, time: string, newlyScheduled: any[] = []) => {
    const dayName = currentWeekDates.find(w => w.dateStr === dateStr)?.day || "";

    // 1. Check if SME has configured custom availability windows for this weekday
    const smeWindows = (smeAvailability || []).filter(
      (a: any) => a.sme_id === smeId && a.day_of_week?.toLowerCase().trim() === dayName.toLowerCase().trim() && a.is_active !== 0
    );

    const { startMin: slotStartMin, endMin: slotEndMin } = extractSlotStartAndEnd(time);

    if (smeWindows.length > 0) {
      // Strict Check: Only consider windows explicitly designated for Demo Evaluation (slot_type !== 'training')
      const withinDemoWindow = smeWindows.some((w: any) => {
        const isDemoType = (w.slot_type || w.slotType || "demo") !== "training";
        if (!isDemoType) return false;
        const winStartMin = parseSlotTimeToMinutes(w.start_time);
        const winEndMin = parseSlotTimeToMinutes(w.end_time);
        return slotStartMin >= winStartMin && slotEndMin <= winEndMin;
      });

      if (!withinDemoWindow) return false;
    } else {
      // Default working hours: 09:00 AM (540 min) to 05:30 PM (1050 min)
      if (slotStartMin < 540 || slotEndMin > 1050) return false;
    }

    // 2. Check collision with existing confirmed demo sessions
    const databaseBusy = demoSessions.some(ds => ds.smeId === smeId && ds.dateStr === dateStr && ds.timeSlot === time);
    if (databaseBusy) return false;

    // 3. Check collision with preview newly scheduled sessions
    const previewBusy = newlyScheduled.some(p => p.smeId === smeId && p.dateStr === dateStr && p.timeSlot === time);
    return !previewBusy;
  };

  // Helper: check if a class group (stream) is free on a given date/time
  const isGroupFree = (groupName: string, dateStr: string, time: string) => {
    const dayName = currentWeekDates.find(w => w.dateStr === dateStr)?.day || "";
    const hasClass = slots.some(s => s.classGroup === groupName && s.day === dayName && s.time === time);
    if (hasClass) return false;

    const hasDemo = demoSessions.some(ds => ds.stream === groupName && ds.dateStr === dateStr && ds.timeSlot === time);
    return !hasDemo;
  };

  // Derived: Total available free slots for the filtered mentors over the selected dates
  const totalFreeSlotsCount = useMemo(() => {
    let count = 0;
    currentWeekDates.forEach(date => {
      collegeTimeSlots.forEach(time => {
        if (time.toLowerCase().includes("lunch") || time.toLowerCase().includes("break")) return;
        filteredMentors.forEach(mentor => {
          if (getMentorStatusAtSlot(mentor.id, date.dateStr, time).status === "free") {
            count++;
          }
        });
      });
    });
    return count;
  }, [filteredMentors, currentWeekDates, collegeTimeSlots]);

  // Helper: Hard block for 3 consecutive busy periods
  const checkConsecutiveHardClash = (entityId: string, isSme: boolean, dateStr: string, timeSlot: string, currentGenerated: any[] = []) => {
    const idx = collegeTimeSlots.indexOf(timeSlot);
    if (idx === -1) return false;

    const isBusy = (slotName: string) => {
      if (!slotName) return false;
      if (isSme) {
        const hasDbDemo = demoSessions.some(ds => ds.smeId === entityId && ds.dateStr === dateStr && ds.timeSlot === slotName);
        const hasGenDemo = currentGenerated.some(g => g.smeId === entityId && g.dateStr === dateStr && g.timeSlot === slotName);
        return hasDbDemo || hasGenDemo;
      } else {
        const status = getMentorStatusAtSlot(entityId, dateStr, slotName, currentGenerated);
        return status.status !== "free";
      }
    };

    const prev1 = idx > 0 ? collegeTimeSlots[idx - 1] : "";
    const prev2 = idx > 1 ? collegeTimeSlots[idx - 2] : "";
    if (prev1 && prev2 && isBusy(prev1) && isBusy(prev2)) return true;

    const next1 = idx < collegeTimeSlots.length - 1 ? collegeTimeSlots[idx + 1] : "";
    if (prev1 && next1 && isBusy(prev1) && isBusy(next1)) return true;

    const next2 = idx < collegeTimeSlots.length - 2 ? collegeTimeSlots[idx + 2] : "";
    if (next1 && next2 && isBusy(next1) && isBusy(next2)) return true;

    return false;
  };

  // Helper: Soft penalty check for any consecutive busy period (back-to-back)
  const checkHasSingleConsecutive = (entityId: string, isSme: boolean, dateStr: string, timeSlot: string, currentGenerated: any[] = []) => {
    const idx = collegeTimeSlots.indexOf(timeSlot);
    if (idx === -1) return false;

    const isBusy = (slotName: string) => {
      if (!slotName) return false;
      if (isSme) {
        const hasDbDemo = demoSessions.some(ds => ds.smeId === entityId && ds.dateStr === dateStr && ds.timeSlot === slotName);
        const hasGenDemo = currentGenerated.some(g => g.smeId === entityId && g.dateStr === dateStr && g.timeSlot === slotName);
        return hasDbDemo || hasGenDemo;
      } else {
        const status = getMentorStatusAtSlot(entityId, dateStr, slotName, currentGenerated);
        return status.status !== "free";
      }
    };

    const prev1 = idx > 0 ? collegeTimeSlots[idx - 1] : "";
    const next1 = idx < collegeTimeSlots.length - 1 ? collegeTimeSlots[idx + 1] : "";

    return (prev1 && isBusy(prev1)) || (next1 && isBusy(next1));
  };

  // Pre-validate a pending swap request against constraints in real time
  const validateProposedSwap = (req: any) => {
    if (!req) return { valid: false, message: "Invalid request details." };

    if (req.swapType === "mentor") {
      const mentorStatus = getMentorStatusAtSlot(req.proposedMentorId, req.dateStr, req.timeSlot);
      if (mentorStatus.status !== "free") {
        return { valid: false, message: `Mentor ${req.proposedMentorName} is busy: ${mentorStatus.label || mentorStatus.details}` };
      }

      const dailyLoad = demoSessions.filter(ds => ds.mentorId === req.proposedMentorId && ds.dateStr === req.dateStr).length;
      if (dailyLoad >= 2) {
        return { valid: false, message: `Mentor ${req.proposedMentorName} daily load exceeds limit (2/day).` };
      }

      if (checkConsecutiveHardClash(req.proposedMentorId, false, req.dateStr, req.timeSlot)) {
        return { valid: false, message: `Mentor ${req.proposedMentorName} consecutive limit exceeded.` };
      }

      return { valid: true, message: "Conflict-Free Match" };

    } else if (req.swapType === "time") {
      const isHoliday = holidays.some(h => h.date === req.proposedDateStr);
      if (isHoliday) return { valid: false, message: `Proposed date is a holiday.` };

      const mentorStatus = getMentorStatusAtSlot(req.mentorId, req.proposedDateStr, req.proposedTimeSlot);
      if (mentorStatus.status !== "free") {
        return { valid: false, message: `Mentor ${req.mentorName} is busy: ${mentorStatus.label || mentorStatus.details}` };
      }

      if (!isSmeFree(req.proposedSmeId, req.proposedDateStr, req.proposedTimeSlot)) {
        return { valid: false, message: `SME ${req.smeName} is busy.` };
      }

      if (!isGroupFree(req.stream, req.proposedDateStr, req.proposedTimeSlot)) {
        return { valid: false, message: `Group stream ${req.stream} is busy.` };
      }

      const mentorDailyLoad = demoSessions.filter(ds => ds.mentorId === req.mentorId && ds.dateStr === req.proposedDateStr).length;
      if (mentorDailyLoad >= 2) {
        return { valid: false, message: `Mentor ${req.mentorName} daily load exceeds limit (2/day).` };
      }

      const smeDailyLoad = demoSessions.filter(ds => ds.smeId === req.proposedSmeId && ds.dateStr === req.proposedDateStr).length;
      if (smeDailyLoad >= 2) {
        return { valid: false, message: `SME ${req.smeName} daily load exceeds limit (2/day).` };
      }

      if (checkConsecutiveHardClash(req.mentorId, false, req.proposedDateStr, req.proposedTimeSlot)) {
        return { valid: false, message: `Mentor ${req.mentorName} consecutive limit exceeded.` };
      }
      if (checkConsecutiveHardClash(req.proposedSmeId, true, req.proposedDateStr, req.proposedTimeSlot)) {
        return { valid: false, message: `SME ${req.smeName} consecutive limit exceeded.` };
      }

      return { valid: true, message: "Conflict-Free Match" };
    }

    return { valid: false, message: "Unsupported swap type." };
  };

  const runSchedulerEngine = (previousAllocations: any[] = []) => {
    const generated: any[] = [];
    const mentorsToSchedule = filteredMentors;

    const datesToSchedule = currentWeekDates
      .map(w => w.dateStr)
      .filter(dateStr => !holidays.some(h => h.date === dateStr));

    const regularSlots = collegeTimeSlots.filter(t => {
      const lower = t.toLowerCase();
      const isStandard = standardShiftSlots.includes(t.trim().toLowerCase());
      return isStandard && !lower.includes("lunch") && !lower.includes("break");
    });

    const slotsToEvaluate = collegeTimeSlots.filter(t => {
      const lower = t.toLowerCase();
      return !lower.includes("lunch") && !lower.includes("break");
    });

    // Build list of demands (weekly demo counts required)
    interface Demand {
      mentor: any;
      stream: string;
      subjectGroup: string;
      targetIdx: number;
    }
    let demands: Demand[] = [];
    for (const mentor of mentorsToSchedule) {
      const subjectGroup = getMentorGroup(mentor);
      const mentorClasses = slots.filter(s => s.mentorId === mentor.id && s.classGroup);
      const stream = (mentorClasses.length > 0 ? mentorClasses[0].classGroup : null) || "General Stream";

      const target = mentorTargets[mentor.id] !== undefined
        ? mentorTargets[mentor.id]
        : (demoRules?.find(r => r.subject?.toLowerCase().trim() === subjectGroup.toLowerCase().trim())?.target || targetDemosCount);

      for (let targetIdx = 0; targetIdx < target; targetIdx++) {
        demands.push({ mentor, stream, subjectGroup, targetIdx });
      }
    }

    interface Candidate {
      demand: Demand;
      dateStr: string;
      timeSlot: string;
      sme: any;
      score: number;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 1: Regular College Hours + Different Days (Max 1 demo per mentor per day)
    // ─────────────────────────────────────────────────────────────────────────
    while (demands.length > 0) {
      const candidates: Candidate[] = [];

      for (const demand of demands) {
        const mentor = demand.mentor;
        let eligibleSmes = getSmesForSubjectGroup(demand.subjectGroup).sort((a: any, b: any) => {
          const aHead = (a.is_head_sme || a.head_subject_group === demand.subjectGroup) ? 1 : 0;
          const bHead = (b.is_head_sme || b.head_subject_group === demand.subjectGroup) ? 1 : 0;
          return bHead - aHead;
        });
        if (eligibleSmes.length === 0) {
          eligibleSmes = [...smes];
        }
        if (eligibleSmes.length === 0) continue;

        for (const dateStr of datesToSchedule) {
          // Strict Rule: Max 1 demo per mentor per day in Phase 1
          const mentorDailyLoad = generated.filter(g => g.mentorId === mentor.id && g.dateStr === dateStr).length;
          if (mentorDailyLoad >= 1) continue;

          for (const timeSlot of regularSlots) {
            const mentorStatus = getMentorStatusAtSlot(mentor.id, dateStr, timeSlot, generated);
            if (mentorStatus.status !== "free") continue;

            const hasGroupDemoClash = generated.some(g =>
              g.stream === demand.stream && g.dateStr === dateStr && g.timeSlot === timeSlot
            );
            if (hasGroupDemoClash) continue;

            if (!isGroupFree(demand.stream, dateStr, timeSlot)) continue;

            for (const sme of eligibleSmes) {
              const isSmeOnLeave = leaveRequests?.some((l: any) => l.mentorId === sme.id && l.dateStr === dateStr && l.status === "approved");
              if (isSmeOnLeave) continue;

              if (!isSmeFree(sme.id, dateStr, timeSlot, generated)) continue;

              // SME daily limit
              const smeDailyLoad = generated.filter(g => g.smeId === sme.id && g.dateStr === dateStr).length;
              if (smeDailyLoad >= 2) continue;

              // Check consecutive hard clash (3 consecutive)
              if (checkConsecutiveHardClash(sme.id, true, dateStr, timeSlot, generated)) continue;

              // Compute Score (Core hierarchy: Group -> Subject -> Subject Group -> Head SME -> Demo Slot)
              let score = 0;
              const isHeadSme = sme.is_head_sme === 1 || sme.head_subject_group === demand.subjectGroup;
              if (isHeadSme) score += 50; // Priority score boost for Subject Group Head SME

              score += 30; // Group free weight

              const mentorWeeklyLoad = generated.filter(g => g.mentorId === mentor.id).length;
              score += Math.max(0, 25 - (mentorWeeklyLoad * (25 / targetDemosCount))); // Mentor weekly load

              const smeWeeklyLoad = generated.filter(g => g.smeId === sme.id).length;
              score += Math.max(0, 20 - (smeWeeklyLoad * 4)); // SME weekly load

              const dayLoad = generated.filter(g => g.dateStr === dateStr).length;
              score += Math.max(0, 15 - (dayLoad * 3)); // Day spread load balancing

              const slotLoad = generated.filter(g => g.timeSlot === timeSlot).length;
              score += Math.max(0, 10 - (slotLoad * 2)); // Period spread load balancing

              if (sme.subject?.toLowerCase().trim() === demand.subjectGroup.toLowerCase().trim()) score += 5; // Subject match

              const wasScheduledPreviously = previousAllocations.some(p =>
                p.mentorId === mentor.id && p.dateStr === dateStr && p.timeSlot === timeSlot
              );
              if (wasScheduledPreviously) score -= 25; // Regenerate rotation penalty

              // Soft consecutive penalty check
              const hasConsecutiveMentorDemo = checkHasSingleConsecutive(mentor.id, false, dateStr, timeSlot, generated);
              const hasConsecutiveSmeDemo = checkHasSingleConsecutive(sme.id, true, dateStr, timeSlot, generated);
              if (hasConsecutiveMentorDemo || hasConsecutiveSmeDemo) {
                score -= 15;
              }

              score += Math.random() * 0.01; // Tie-breaker

              candidates.push({ demand, dateStr, timeSlot, sme, score });
            }
          }
        }
      }

      if (candidates.length === 0) break;

      candidates.sort((a, b) => b.score - a.score);
      const best = candidates[0];

      generated.push({
        mentorId: best.demand.mentor.id,
        mentorName: best.demand.mentor.name,
        collegeName: colleges.find(c => c.id === best.demand.mentor.college_id)?.name || "",
        smeId: best.sme.id,
        smeName: best.sme.name,
        dateStr: best.dateStr,
        timeSlot: best.timeSlot,
        subject: best.demand.subjectGroup,
        stream: best.demand.stream,
        week: 1
      });

      const dIndex = demands.findIndex(d =>
        d.mentor.id === best.demand.mentor.id && d.targetIdx === best.demand.targetIdx
      );
      if (dIndex !== -1) demands.splice(dIndex, 1);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 2: Regular College Hours + Allow Second Demo on Same Day (Max 2 demos)
    // ─────────────────────────────────────────────────────────────────────────
    while (demands.length > 0) {
      const candidates: Candidate[] = [];

      for (const demand of demands) {
        const mentor = demand.mentor;
        let eligibleSmes = smes.filter(sme =>
          sme.subject?.toLowerCase().trim() === demand.subjectGroup.toLowerCase().trim()
        );
        if (eligibleSmes.length === 0) continue;

        for (const dateStr of datesToSchedule) {
          // Relaxed rule: Allow up to 2 demos per mentor per day in Phase 2
          const mentorDailyLoad = generated.filter(g => g.mentorId === mentor.id && g.dateStr === dateStr).length;
          if (mentorDailyLoad >= 2) continue;

          for (const timeSlot of regularSlots) {
            const mentorStatus = getMentorStatusAtSlot(mentor.id, dateStr, timeSlot, generated);
            if (mentorStatus.status !== "free") continue;

            if (checkConsecutiveHardClash(mentor.id, false, dateStr, timeSlot, generated)) continue;

            const hasGroupDemoClash = generated.some(g =>
              g.stream === demand.stream && g.dateStr === dateStr && g.timeSlot === timeSlot
            );
            if (hasGroupDemoClash) continue;

            if (!isGroupFree(demand.stream, dateStr, timeSlot)) continue;

            for (const sme of eligibleSmes) {
              const isSmeOnLeave = leaveRequests?.some((l: any) => l.mentorId === sme.id && l.dateStr === dateStr && l.status === "approved");
              if (isSmeOnLeave) continue;

              if (!isSmeFree(sme.id, dateStr, timeSlot, generated)) continue;

              const smeDailyLoad = generated.filter(g => g.smeId === sme.id && g.dateStr === dateStr).length;
              if (smeDailyLoad >= 2) continue;

              if (checkConsecutiveHardClash(sme.id, true, dateStr, timeSlot, generated)) continue;

              let score = 0;
              score += 30; // Group free

              const mentorWeeklyLoad = generated.filter(g => g.mentorId === mentor.id).length;
              score += Math.max(0, 25 - (mentorWeeklyLoad * (25 / targetDemosCount)));

              const smeWeeklyLoad = generated.filter(g => g.smeId === sme.id).length;
              score += Math.max(0, 20 - (smeWeeklyLoad * 4));

              const dayLoad = generated.filter(g => g.dateStr === dateStr).length;
              score += Math.max(0, 15 - (dayLoad * 3));

              const slotLoad = generated.filter(g => g.timeSlot === timeSlot).length;
              score += Math.max(0, 10 - (slotLoad * 2));

              if (sme.subject?.toLowerCase().trim() === demand.subjectGroup.toLowerCase().trim()) score += 5;

              const wasScheduledPreviously = previousAllocations.some(p =>
                p.mentorId === mentor.id && p.dateStr === dateStr && p.timeSlot === timeSlot
              );
              if (wasScheduledPreviously) score -= 25;

              // Soft consecutive penalty check
              const hasConsecutiveMentorDemo = checkHasSingleConsecutive(mentor.id, false, dateStr, timeSlot, generated);
              const hasConsecutiveSmeDemo = checkHasSingleConsecutive(sme.id, true, dateStr, timeSlot, generated);
              if (hasConsecutiveMentorDemo || hasConsecutiveSmeDemo) {
                score -= 15;
              }

              score += Math.random() * 0.01;

              candidates.push({ demand, dateStr, timeSlot, sme, score });
            }
          }
        }
      }

      if (candidates.length === 0) break;

      candidates.sort((a, b) => b.score - a.score);
      const best = candidates[0];

      generated.push({
        mentorId: best.demand.mentor.id,
        mentorName: best.demand.mentor.name,
        collegeName: colleges.find(c => c.id === best.demand.mentor.college_id)?.name || "",
        smeId: best.sme.id,
        smeName: best.sme.name,
        dateStr: best.dateStr,
        timeSlot: best.timeSlot,
        subject: best.demand.subjectGroup,
        stream: best.demand.stream,
        week: 1
      });

      const dIndex = demands.findIndex(d =>
        d.mentor.id === best.demand.mentor.id && d.targetIdx === best.demand.targetIdx
      );
      if (dIndex !== -1) demands.splice(dIndex, 1);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 3: Beyond College Hours (Last resort fallback)
    // ─────────────────────────────────────────────────────────────────────────
    while (demands.length > 0) {
      const candidates: Candidate[] = [];

      for (const demand of demands) {
        const mentor = demand.mentor;
        let eligibleSmes = smes.filter(sme =>
          sme.subject?.toLowerCase().trim() === demand.subjectGroup.toLowerCase().trim()
        );
        if (eligibleSmes.length === 0) continue;

        for (const dateStr of datesToSchedule) {
          const mentorDailyLoad = generated.filter(g => g.mentorId === mentor.id && g.dateStr === dateStr).length;
          if (mentorDailyLoad >= 2) continue;

          for (const timeSlot of slotsToEvaluate) {
            const mentorStatus = getMentorStatusAtSlot(mentor.id, dateStr, timeSlot, generated);
            if (mentorStatus.status !== "free") continue;

            if (checkConsecutiveHardClash(mentor.id, false, dateStr, timeSlot, generated)) continue;

            const hasGroupDemoClash = generated.some(g =>
              g.stream === demand.stream && g.dateStr === dateStr && g.timeSlot === timeSlot
            );
            if (hasGroupDemoClash) continue;

            if (!isGroupFree(demand.stream, dateStr, timeSlot)) continue;

            for (const sme of eligibleSmes) {
              const isSmeOnLeave = leaveRequests?.some((l: any) => l.mentorId === sme.id && l.dateStr === dateStr && l.status === "approved");
              if (isSmeOnLeave) continue;

              if (!isSmeFree(sme.id, dateStr, timeSlot, generated)) continue;

              const smeDailyLoad = generated.filter(g => g.smeId === sme.id && g.dateStr === dateStr).length;
              if (smeDailyLoad >= 2) continue;

              if (checkConsecutiveHardClash(sme.id, true, dateStr, timeSlot, generated)) continue;

              let score = 0;
              score += 30; // Group free

              const mentorWeeklyLoad = generated.filter(g => g.mentorId === mentor.id).length;
              score += Math.max(0, 25 - (mentorWeeklyLoad * (25 / targetDemosCount)));

              const smeWeeklyLoad = generated.filter(g => g.smeId === sme.id).length;
              score += Math.max(0, 20 - (smeWeeklyLoad * 4));

              const dayLoad = generated.filter(g => g.dateStr === dateStr).length;
              score += Math.max(0, 15 - (dayLoad * 3));

              const slotLoad = generated.filter(g => g.timeSlot === timeSlot).length;
              score += Math.max(0, 10 - (slotLoad * 2));

              if (sme.subject?.toLowerCase().trim() === demand.subjectGroup.toLowerCase().trim()) score += 5;

              const wasScheduledPreviously = previousAllocations.some(p =>
                p.mentorId === mentor.id && p.dateStr === dateStr && p.timeSlot === timeSlot
              );
              if (wasScheduledPreviously) score -= 25;

              // Soft consecutive penalty check
              const hasConsecutiveMentorDemo = checkHasSingleConsecutive(mentor.id, false, dateStr, timeSlot, generated);
              const hasConsecutiveSmeDemo = checkHasSingleConsecutive(sme.id, true, dateStr, timeSlot, generated);
              if (hasConsecutiveMentorDemo || hasConsecutiveSmeDemo) {
                score -= 15;
              }

              // Beyond-Hours Penalty (Fallback only)
              const isBeyondHoursSlot = !standardShiftSlots.includes(timeSlot.trim().toLowerCase());
              if (isBeyondHoursSlot) {
                score -= 35;
              }

              score += Math.random() * 0.01;

              candidates.push({ demand, dateStr, timeSlot, sme, score });
            }
          }
        }
      }

      if (candidates.length === 0) break;

      candidates.sort((a, b) => b.score - a.score);
      const best = candidates[0];

      generated.push({
        mentorId: best.demand.mentor.id,
        mentorName: best.demand.mentor.name,
        collegeName: colleges.find(c => c.id === best.demand.mentor.college_id)?.name || "",
        smeId: best.sme.id,
        smeName: best.sme.name,
        dateStr: best.dateStr,
        timeSlot: best.timeSlot,
        subject: best.demand.subjectGroup,
        stream: best.demand.stream,
        week: 1
      });

      const dIndex = demands.findIndex(d =>
        d.mentor.id === best.demand.mentor.id && d.targetIdx === best.demand.targetIdx
      );
      if (dIndex !== -1) demands.splice(dIndex, 1);
    }

    const exceptions: any[] = [];
    for (const demand of demands) {
      const mentor = demand.mentor;
      const subjectGroup = demand.subjectGroup;

      const matchingSmes = smes.filter(s => s.subject?.toLowerCase().trim() === subjectGroup.toLowerCase().trim());
      if (matchingSmes.length === 0) {
        exceptions.push({
          id: "exc_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9),
          mentorId: mentor.id,
          mentorName: mentor.name,
          subject: subjectGroup,
          stream: demand.stream,
          reason: "No SME Available",
          recommendation: `Add a Subject Matter Expert for "${subjectGroup}" subject group.`
        });
        continue;
      }

      const isMentorOnLeaveAllDays = datesToSchedule.every(d =>
        leaveRequests?.some((l: any) => l.mentorId === mentor.id && l.dateStr === d && l.status === "approved")
      );
      if (isMentorOnLeaveAllDays) {
        exceptions.push({
          id: "exc_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9),
          mentorId: mentor.id,
          mentorName: mentor.name,
          subject: subjectGroup,
          stream: demand.stream,
          reason: "SME Leave Conflict",
          recommendation: `Schedule during weeks where mentor or SME leaves do not conflict.`
        });
        continue;
      }

      const mentorFreeSlots = datesToSchedule.some(d =>
        regularSlots.some(t => getMentorStatusAtSlot(mentor.id, d, t, generated).status === "free")
      );
      if (!mentorFreeSlots) {
        exceptions.push({
          id: "exc_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9),
          mentorId: mentor.id,
          mentorName: mentor.name,
          subject: subjectGroup,
          stream: demand.stream,
          reason: "Mentor Timetable Busy",
          recommendation: `Clear some classes for ${mentor.name} in their timetable or select a different week.`
        });
        continue;
      }

      const groupFreeSlots = datesToSchedule.some(d =>
        regularSlots.some(t => isGroupFree(demand.stream, d, t))
      );
      if (!groupFreeSlots) {
        exceptions.push({
          id: "exc_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9),
          mentorId: mentor.id,
          mentorName: mentor.name,
          subject: subjectGroup,
          stream: demand.stream,
          reason: "Group Timetable Busy",
          recommendation: `Choose beyond college hours slots or modify the class group timetable.`
        });
        continue;
      }

      exceptions.push({
        id: "exc_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9),
        mentorId: mentor.id,
        mentorName: mentor.name,
        subject: subjectGroup,
        stream: demand.stream,
        reason: "Timetable Clash (No common free slot)",
        recommendation: `Force schedule manually by clicking Resolve Manual or relax constraints.`
      });
    }

    return { generated, exceptions };
  };

  const handleTriggerGenerate = () => {
    if (!selectedCollegeId) {
      toast("Please select a college first", "error");
      return;
    }

    const prevSessions = [...previewSessions];
    setPreviewSessions([]);
    setExceptions([]);
    setGenerationStep("generating");
    setIsGenerating(true);
    setShowPreviewModal(true);

    setTimeout(() => {
      const { generated, exceptions } = runSchedulerEngine(prevSessions);
      setPreviewSessions(generated);
      setExceptions(exceptions);
      setGenerationStep("done");
      setIsGenerating(false);

      if (generated.length === 0 && exceptions.length === 0) {
        toast("No slots were generated. Mentors or SMEs may be fully occupied.", "warning");
      } else if (exceptions.length > 0) {
        toast(`Generated ${generated.length} sessions. Found ${exceptions.length} scheduling exceptions.`, "warning");
      } else {
        toast(`Successfully previewed ${generated.length} demo allocations.`, "success");
      }
    }, 1000);
  };

  const handleSavePreview = async () => {
    if (previewSessions.length === 0) return;
    try {
      const res = await bulkBookDemoSessions(previewSessions);
      if (res.success) {
        toast("Schedule successfully saved!", "success");
        setPreviewSessions([]);
        setShowPreviewModal(false);
        // bulkBookDemoSessions already surgically updates demoSessions state — no refreshData needed
      } else {
        toast(res.message || "Failed to save schedule.", "error");
      }
    } catch (err: any) {
      toast(err.message || "An error occurred.", "error");
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSession) return;
    try {
      const selectedSme = smes.find(s => s.id === editSession.smeId);
      const payload = {
        sessionId: editSession.id,
        dateStr: editSession.dateStr,
        timeSlot: editSession.timeSlot,
        smeId: editSession.smeId,
        smeName: selectedSme ? selectedSme.name : editSession.smeName,
        mentorId: editSession.mentorId,
        mentorName: editSession.mentorName,
        subject: editSession.subject,
        stream: editSession.stream,
        week: editSession.week
      };

      const fetchRes = await fetch("/api/demo-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", ...payload })
      });
      const data = await fetchRes.json();

      if (data.success) {
        toast("Demo session updated successfully.", "success");
        // Surgical update: reflect edits in local demoSessions state
        setDemoSessions(prev => prev.map(s => s.id === editSession.id ? { ...s, ...payload } : s));
        setEditSession(null);
      } else {
        toast(data.message || "Failed to update session details.", "error");
      }
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  // Helper to save department demo rule to database
  const saveDepartmentRule = async (subject: string, targetVal: number) => {
    try {
      const existing = demoRules?.find(r => r.subject?.toLowerCase().trim() === subject.toLowerCase().trim());
      if (existing) {
        await deleteDemoRule(existing.id);
      }
      const res = await createDemoRule(subject, 1, targetVal);
      if (res.success) {
        toast(`Rule saved: ${subject} target is now ${targetVal} demo(s)/week.`, "success");
      } else {
        toast(res.message || "Failed to update rule.", "error");
      }
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  /* ==========================================================================
     EXCEL TEMPLATE DOWNLOAD, IMPORT & EXPORT HANDLERS (SUBJECT-GROUP BASED)
     ========================================================================== */

  const handleDownloadDemoTemplate = async (targetGroupInput?: string) => {
    const targetGroup = targetGroupInput || (selectedGroupId && selectedGroupId !== "All" ? selectedGroupId : (mentorGroups[0] || "Computer Science"));

    // Filter mentors strictly relevant to this mentor group
    const directMentors = mentors.filter(m => {
      const gStr = getMentorGroup(m).toLowerCase().trim();
      const target = targetGroup.toLowerCase().trim();
      return gStr === target;
    });

    const relevantMentors = directMentors.length > 0 ? directMentors : mentors;

    // Filter SMEs relevant to this mentor group
    const directSmes = getSmesForSubjectGroup(targetGroup);
    const relevantSmes = directSmes.length > 0 ? directSmes : smes;

    const timeSlots = collegeTimeSlots.length > 0
      ? collegeTimeSlots.slice(0, 6)
      : ["08:30 AM - 09:30 AM", "09:30 AM - 10:30 AM", "10:30 AM - 11:30 AM", "11:30 AM - 12:30 PM", "01:30 PM - 02:30 PM"];

    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Zentra Timetable Engine";

    const safeGroupName = targetGroup.replace(/[^a-zA-Z0-9]/g, "_");

    // ─────────────────────────────────────────────────────────────────────────
    // SHEET 1: Timetable Grid Matrix
    // ─────────────────────────────────────────────────────────────────────────
    const wsGrid = workbook.addWorksheet("Timetable_Grid");

    const gridHeaders = ["Day / Period", ...timeSlots.map((ts, i) => `Period ${i + 1} (${ts})`)];
    const gridHeaderRow = wsGrid.addRow(gridHeaders);
    gridHeaderRow.height = 28;
    gridHeaderRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
    gridHeaderRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "D528A2" } // Signature Magenta Header
    };
    gridHeaderRow.alignment = { vertical: "middle", horizontal: "center" };

    // Set Column Widths for Timetable Grid
    wsGrid.getColumn(1).width = 16;
    for (let c = 2; c <= timeSlots.length + 1; c++) {
      wsGrid.getColumn(c).width = 28;
    }

    // Helper to parse slot time string into minutes from midnight
    const parseSlotTimeToMinutes = (t: string) => {
      const match = t.match(/^(\d+)(?:\.(\d+)|:(\d+))?\s*(AM|PM)/i);
      if (!match) return 9999;
      let hr = parseInt(match[1]);
      const min = match[2] ? parseInt(match[2]) : (match[3] ? parseInt(match[3]) : 0);
      const isPm = match[4].toUpperCase() === "PM";
      if (isPm && hr < 12) hr += 12;
      if (!isPm && hr === 12) hr = 0;
      return hr * 60 + min;
    };

    // Helper to get actual college working hours, start time, end time, and campus name
    const getCollegeTimingInfo = (collegeId?: string) => {
      const col = colleges.find(c => c.id === collegeId);
      const collegeName = col?.name || "Campus";

      const campusSlotsList = new Set<string>();

      // 1. Gather all actual slots configured for this college
      slots.filter(s => s.college_id === collegeId && s.time).forEach(s => {
        const clean = s.time.trim();
        if (clean && !clean.toLowerCase().includes("lunch") && !clean.toLowerCase().includes("break")) {
          campusSlotsList.add(clean);
        }
      });

      // 2. Gather from college shift_configs if present
      if (col?.shift_configs) {
        try {
          const parsed = JSON.parse(col.shift_configs);
          const s1 = parsed.shift_1 || [];
          const s2 = parsed.shift_2 || [];
          const gen = parsed.general || [];
          [...s1, ...s2, ...gen].forEach((t: string) => {
            const clean = t.trim();
            if (clean && !clean.toLowerCase().includes("lunch") && !clean.toLowerCase().includes("break")) {
              campusSlotsList.add(clean);
            }
          });
        } catch (_) { }
      }

      const sortedSlots = Array.from(campusSlotsList).sort((a, b) => parseSlotTimeToMinutes(a) - parseSlotTimeToMinutes(b));

      if (sortedSlots.length > 0) {
        const earliestSlot = sortedSlots[0];
        const latestSlot = sortedSlots[sortedSlots.length - 1];
        const startTime = earliestSlot.split("-")[0]?.trim() || earliestSlot;
        const endTime = latestSlot.split("-")[1]?.trim() || latestSlot;
        return {
          collegeName,
          startTime,
          endTime,
          workingHours: `${startTime} - ${endTime}`
        };
      }

      const startTime = col?.start_time || "08:30 AM";
      const endTime = "04:30 PM";
      return {
        collegeName,
        startTime,
        endTime,
        workingHours: `${startTime} - ${endTime}`
      };
    };

    // Helper to get exact time slots for a specific college
    const getCollegeSpecificSlots = (collegeId?: string) => {
      const col = colleges.find(c => c.id === collegeId);
      const campusSlotsList = new Set<string>();

      // 1. Gather actual slots recorded in slots table for this specific college
      if (collegeId) {
        slots.filter(s => s.college_id === collegeId && s.time).forEach(s => {
          const clean = s.time.trim();
          if (clean && !clean.toLowerCase().includes("lunch") && !clean.toLowerCase().includes("break")) {
            campusSlotsList.add(clean);
          }
        });
      }

      // 2. Gather from college shift_configs if present
      if (col?.shift_configs) {
        try {
          const parsed = JSON.parse(col.shift_configs);
          const s1 = parsed.shift_1 || [];
          const s2 = parsed.shift_2 || [];
          const gen = parsed.general || [];
          [...s1, ...s2, ...gen].forEach((t: string) => {
            const clean = t.trim();
            if (clean && !clean.toLowerCase().includes("lunch") && !clean.toLowerCase().includes("break")) {
              campusSlotsList.add(clean);
            }
          });
        } catch (_) { }
      }

      const sortedSlots = Array.from(campusSlotsList).sort((a, b) => parseSlotTimeToMinutes(a) - parseSlotTimeToMinutes(b));

      if (sortedSlots.length > 0) {
        return sortedSlots;
      }

      // Fallback: Use standard shift timings if unconfigured
      return [
        "08:30 AM - 09:30 AM",
        "09:30 AM - 10:30 AM",
        "10:30 AM - 11:30 AM",
        "11:30 AM - 12:30 PM",
        "01:30 PM - 02:30 PM",
        "02:30 PM - 03:30 PM"
      ];
    };

    // Helper to calculate free periods for a mentor on a specific day based solely on their own college's schedule
    const getMentorDayFreePeriods = (mentorId: string, dayName: string, collegeId?: string) => {
      const mentorSlots = getCollegeSpecificSlots(collegeId);
      const freeList: string[] = [];

      mentorSlots.forEach((slot, sIdx) => {
        const isLunchOrBreak = slot.toLowerCase().includes("lunch") || slot.toLowerCase().includes("break");
        if (isLunchOrBreak) return;

        const hasClass = slots.some(s =>
          s.mentorId === mentorId &&
          s.day?.toLowerCase().trim() === dayName.toLowerCase().trim() &&
          s.time?.trim().toLowerCase() === slot.trim().toLowerCase()
        );
        const isBlocked = leaveRequests?.some((l: any) => l.mentorId === mentorId && l.status === "approved");

        if (!hasClass && !isBlocked) {
          freeList.push(`P${sIdx + 1} (${slot})`);
        }
      });

      return freeList.length > 0 ? freeList.join(", ") : "No Free Periods (Fully Booked)";
    };

    // Helper to calculate weekly free overview across all 5 weekdays based solely on their own college's schedule
    const getMentorWeeklyFreeSummary = (mentorId: string, collegeId?: string) => {
      const mentorSlots = getCollegeSpecificSlots(collegeId);
      const parts: string[] = [];
      let totalFreeCount = 0;

      days.forEach(day => {
        const dayShort = day.slice(0, 3);
        const freePeriodNums: number[] = [];

        mentorSlots.forEach((slot, sIdx) => {
          const isLunchOrBreak = slot.toLowerCase().includes("lunch") || slot.toLowerCase().includes("break");
          if (isLunchOrBreak) return;

          const hasClass = slots.some(s =>
            s.mentorId === mentorId &&
            s.day?.toLowerCase().trim() === day.toLowerCase().trim() &&
            s.time?.trim().toLowerCase() === slot.trim().toLowerCase()
          );
          const isBlocked = leaveRequests?.some((l: any) => l.mentorId === mentorId && l.status === "approved");

          if (!hasClass && !isBlocked) {
            freePeriodNums.push(sIdx + 1);
            totalFreeCount++;
          }
        });

        if (freePeriodNums.length > 0) {
          parts.push(`${dayShort}: P${freePeriodNums.join(",")}`);
        }
      });

      return parts.length > 0 ? `${parts.join(" • ")} (${totalFreeCount} free periods/wk)` : "Fully Occupied";
    };

    // Helper function to convert 1-based column index to Excel column letters (A, B, C... Z, AA, AB...)
    const getColLetter = (colIdx: number) => {
      let temp, letter = '';
      let num = colIdx;
      while (num > 0) {
        temp = (num - 1) % 26;
        letter = String.fromCharCode(65 + temp) + letter;
        num = Math.floor((num - temp - 1) / 26);
      }
      return letter;
    };

    // ─────────────────────────────────────────────────────────────────────────
    // HIDDEN REFERENCE SHEET: Free Mentors per Period Slot (Across ALL Colleges)
    // ─────────────────────────────────────────────────────────────────────────
    const wsRef = workbook.addWorksheet("Free_Periods_Ref");
    wsRef.state = "hidden"; // Keep reference sheet hidden for clean user presentation

    let refColCounter = 1;
    const cellValidationRanges: Record<string, string> = {};

    days.forEach((day) => {
      timeSlots.forEach((slot) => {
        // Filter mentors across ALL colleges in this Mentor Group who are FREE during this specific period
        const freeMentorsForSlot = relevantMentors.filter(m => {
          const hasClass = slots.some(s => s.mentorId === m.id && s.day === day && s.time === slot);
          const isBlocked = leaveRequests?.some((l: any) => l.mentorId === m.id && l.status === "approved");
          return !hasClass && !isBlocked;
        });

        const listMentors = freeMentorsForSlot.length > 0 ? freeMentorsForSlot : relevantMentors;

        const colLetter = getColLetter(refColCounter);
        wsRef.getCell(`${colLetter}1`).value = `${day}_${slot}`;

        listMentors.forEach((m, idx) => {
          const colObj = colleges.find(c => c.id === m.college_id);
          const collegeTag = colObj ? colObj.name : (m.department || "Faculty");
          wsRef.getCell(`${colLetter}${idx + 2}`).value = `${m.name} (${collegeTag})`;
        });

        const endRow = Math.max(2, listMentors.length + 1);
        cellValidationRanges[`${day}_${slot}`] = `'Free_Periods_Ref'!$${colLetter}$2:$${colLetter}$${endRow}`;

        refColCounter++;
      });
    });

    // Build conflict-free grid matrix: Each mentor appears as many times as customTarget set in UI!
    const gridMatrix: Record<string, Record<number, string>> = {};
    days.forEach(d => { gridMatrix[d] = {}; });

    relevantMentors.forEach((m, mIdx) => {
      const customTarget = mentorTargets[m.id] !== undefined
        ? mentorTargets[m.id]
        : (demoRules?.find(r => r.subject?.toLowerCase().trim() === targetGroup.toLowerCase().trim())?.target || 1);

      for (let tCount = 0; tCount < customTarget; tCount++) {
        const assignedDay = days[(mIdx + tCount) % days.length];
        const assignedSlotIdx = (mIdx + tCount) % timeSlots.length;
        const sItem = relevantSmes[(mIdx + tCount) % Math.max(1, relevantSmes.length)];
        const smeText = sItem ? ` [SME: ${sItem.name}]` : "";

        if (!gridMatrix[assignedDay][assignedSlotIdx]) {
          gridMatrix[assignedDay][assignedSlotIdx] = `${m.name}${smeText}`;
        }
      }
    });

    // Add Timetable Grid Rows (Monday to Friday)
    days.forEach((day) => {
      const rowData: string[] = [day];
      timeSlots.forEach((_, slotIdx) => {
        const cellVal = gridMatrix[day]?.[slotIdx] || "";
        rowData.push(cellVal);
      });

      const row = wsGrid.addRow(rowData);
      row.height = 24;
      for (let c = 1; c <= timeSlots.length + 1; c++) {
        const cell = row.getCell(c);
        cell.font = { name: "Arial", size: 9.5 };
        cell.alignment = { vertical: "middle", horizontal: c === 1 ? "center" : "left" };
        cell.border = {
          top: { style: 'thin', color: { argb: 'E2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
          left: { style: 'thin', color: { argb: 'E2E8F0' } },
          right: { style: 'thin', color: { argb: 'E2E8F0' } }
        };
      }
    });

    const gridEndRow = days.length + 1; // Row 6

    // Add Slot-Specific Data Validation Dropdown Pickers (showing ONLY free mentors for that day & period!)
    for (let r = 2; r <= gridEndRow; r++) {
      const dayName = days[r - 2];
      for (let c = 2; c <= timeSlots.length + 1; c++) {
        const slotName = timeSlots[c - 2];
        const valRange = cellValidationRanges[`${dayName}_${slotName}`] || `'Eligible_Mentors'!$B$2:$B$100`;

        const cell = wsGrid.getCell(r, c);
        cell.dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [valRange]
        };
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SHEET 1 Bottom: Mentor Demo Allocation Validation Summary Table
    // ─────────────────────────────────────────────────────────────────────────
    const summaryStartRow = gridEndRow + 3; // Row 9
    const lastColLetter = String.fromCharCode(64 + timeSlots.length + 1);

    const summaryHeaderRow = wsGrid.getRow(summaryStartRow);
    summaryHeaderRow.values = ["Faculty Mentor", "Target Demos/Wk", "Scheduled Demos", "Validation Status"];
    summaryHeaderRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
    summaryHeaderRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "374151" } // Dark Slate Header
    };
    summaryHeaderRow.alignment = { vertical: "middle", horizontal: "center" };
    summaryHeaderRow.height = 24;

    const maxMentorsToSummarize = Math.max(10, relevantMentors.length);
    for (let idx = 0; idx < maxMentorsToSummarize; idx++) {
      const rNum = summaryStartRow + 1 + idx;
      const mRefRow = idx + 2;
      const row = wsGrid.getRow(rNum);
      row.height = 20;

      row.getCell(1).value = { formula: `IF('Eligible_Mentors'!B${mRefRow}="", "", 'Eligible_Mentors'!B${mRefRow})` };
      row.getCell(1).font = { name: "Arial", size: 9.5, bold: true };

      row.getCell(2).value = { formula: `IF(A${rNum}="", "", 'Eligible_Mentors'!N${mRefRow})` };
      row.getCell(2).font = { name: "Arial", size: 9.5 };
      row.getCell(2).alignment = { horizontal: "center", vertical: "middle" };

      row.getCell(3).value = { formula: `IF(A${rNum}="", "", COUNTIF($B$2:$${lastColLetter}$${gridEndRow}, "*"&A${rNum}&"*"))` };
      row.getCell(3).font = { name: "Arial", size: 9.5, bold: true };
      row.getCell(3).alignment = { horizontal: "center", vertical: "middle" };

      row.getCell(4).value = { formula: `IF(A${rNum}="", "", IF(C${rNum}=B${rNum}, "Matched", IF(C${rNum}>B${rNum}, "Over-scheduled", "Remaining: " & (B${rNum}-C${rNum}) & " demos")))` };
      row.getCell(4).font = { name: "Arial", size: 9.5, bold: true };
      row.getCell(4).alignment = { horizontal: "center", vertical: "middle" };

      for (let col = 1; col <= 4; col++) {
        row.getCell(col).border = {
          top: { style: 'thin', color: { argb: 'E2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
          left: { style: 'thin', color: { argb: 'E2E8F0' } },
          right: { style: 'thin', color: { argb: 'E2E8F0' } }
        };
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SHEET 2: Eligible Mentors with Free Periods & Availability
    // ─────────────────────────────────────────────────────────────────────────
    const wsMentors = workbook.addWorksheet("Eligible_Mentors");
    const mHeadRow = wsMentors.addRow([
      "Mentor ID",
      "Faculty Name",
      "Mentor Group / Department",
      "College Name",
      "College Start Time",
      "College End Time",
      "College Working Hours",
      "Monday Free Periods (Timings)",
      "Tuesday Free Periods (Timings)",
      "Wednesday Free Periods (Timings)",
      "Thursday Free Periods (Timings)",
      "Friday Free Periods (Timings)",
      "Weekly Free Availability Summary",
      "Weekly Quota Target"
    ]);
    mHeadRow.height = 26;
    mHeadRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
    mHeadRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "4F46E5" } };
    mHeadRow.alignment = { vertical: "middle", horizontal: "center" };

    relevantMentors.forEach((m) => {
      const customTarget = mentorTargets[m.id] !== undefined
        ? mentorTargets[m.id]
        : (demoRules?.find(r => r.subject?.toLowerCase().trim() === targetGroup.toLowerCase().trim())?.target || 1);

      const timing = getCollegeTimingInfo(m.college_id);
      const monFree = getMentorDayFreePeriods(m.id, "Monday", m.college_id);
      const tueFree = getMentorDayFreePeriods(m.id, "Tuesday", m.college_id);
      const wedFree = getMentorDayFreePeriods(m.id, "Wednesday", m.college_id);
      const thuFree = getMentorDayFreePeriods(m.id, "Thursday", m.college_id);
      const friFree = getMentorDayFreePeriods(m.id, "Friday", m.college_id);
      const weeklyFree = getMentorWeeklyFreeSummary(m.id, m.college_id);

      const row = wsMentors.addRow([
        m.id,
        m.name,
        m.mentor_group || targetGroup,
        timing.collegeName,
        timing.startTime,
        timing.endTime,
        timing.workingHours,
        monFree,
        tueFree,
        wedFree,
        thuFree,
        friFree,
        weeklyFree,
        customTarget
      ]);
      row.height = 22;
      for (let c = 1; c <= 14; c++) {
        row.getCell(c).font = { name: "Arial", size: 9 };
        row.getCell(c).border = {
          top: { style: 'thin', color: { argb: 'E2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
          left: { style: 'thin', color: { argb: 'E2E8F0' } },
          right: { style: 'thin', color: { argb: 'E2E8F0' } }
        };
        if (c === 14) {
          row.getCell(c).alignment = { horizontal: "center", vertical: "middle" };
          row.getCell(c).font = { name: "Arial", size: 9.5, bold: true };
        }
      }
    });
    [15, 26, 24, 32, 18, 18, 24, 34, 34, 34, 34, 34, 46, 20].forEach((w, i) => { wsMentors.getColumn(i + 1).width = w; });

    // ─────────────────────────────────────────────────────────────────────────
    // SHEET 3: Assigned SMEs with Demo Time & Training Time Windows
    // ─────────────────────────────────────────────────────────────────────────
    const wsSmes = workbook.addWorksheet("Assigned_SMEs");
    const sHeadRow = wsSmes.addRow([
      "SME ID",
      "SME Name",
      "Specialization & Group",
      "Dedicated Demo Evaluation Slots (Used for Timetable)",
      "Faculty Training / Workshop Slots (Excluded from Demos)",
      "Head SME Status"
    ]);
    sHeadRow.height = 24;
    sHeadRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
    sHeadRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "4F46E5" } };
    sHeadRow.alignment = { vertical: "middle", horizontal: "center" };

    relevantSmes.forEach((s: any) => {
      const windows = (smeAvailability || []).filter((a: any) => a.sme_id === s.id && a.is_active !== 0);
      let demoAvailText = "";
      let trainingAvailText = "";

      if (windows.length > 0) {
        const demoByDay: Record<string, string[]> = {};
        const trainByDay: Record<string, string[]> = {};

        windows.forEach((w: any) => {
          const d = w.day_of_week?.slice(0, 3) || "Day";
          const sType = w.slot_type || w.slotType || "demo";
          if (sType === "training") {
            if (!trainByDay[d]) trainByDay[d] = [];
            trainByDay[d].push(`${w.start_time} - ${w.end_time}`);
          } else {
            if (!demoByDay[d]) demoByDay[d] = [];
            demoByDay[d].push(`${w.start_time} - ${w.end_time}`);
          }
        });

        demoAvailText = Object.entries(demoByDay).length > 0
          ? Object.entries(demoByDay).map(([d, times]) => `${d}: ${times.join(", ")}`).join(" • ")
          : "None Configured";

        trainingAvailText = Object.entries(trainByDay).length > 0
          ? Object.entries(trainByDay).map(([d, times]) => `${d}: ${times.join(", ")}`).join(" • ")
          : "None (Full Availability for Demos)";
      } else {
        demoAvailText = `Configured Full Shift: ${timeSlots[0] || "08:30 AM"} - ${timeSlots[timeSlots.length - 1] || "04:30 PM"}`;
        trainingAvailText = "None";
      }

      const row = wsSmes.addRow([
        s.id,
        s.name,
        s.subject || "General",
        demoAvailText,
        trainingAvailText,
        s.is_head_sme ? "YES (+50 Priority Score)" : "NO"
      ]);
      row.height = 20;
      for (let c = 1; c <= 6; c++) {
        row.getCell(c).font = { name: "Arial", size: 9.5 };
        row.getCell(c).border = { top: { style: 'thin', color: { argb: 'E2E8F0' } }, bottom: { style: 'thin', color: { argb: 'E2E8F0' } }, left: { style: 'thin', color: { argb: 'E2E8F0' } }, right: { style: 'thin', color: { argb: 'E2E8F0' } } };
      }
    });
    [15, 28, 26, 46, 46, 20].forEach((w, i) => { wsSmes.getColumn(i + 1).width = w; });

    // ─────────────────────────────────────────────────────────────────────────
    // SHEET 4: System Reference Guide
    // ─────────────────────────────────────────────────────────────────────────
    const wsGuide = workbook.addWorksheet("System_Reference_Guide");
    const gHeadRow = wsGuide.addRow(["Category", "Configured System Values"]);
    gHeadRow.height = 24;
    gHeadRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
    gHeadRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "374151" } };

    const guideRows = [
      ["Target Mentor Group", targetGroup],
      ["Allowed Days of Week", days.join(", ")],
      ["Active Shift Time Slots", timeSlots.join(", ")],
      ["Eligible Faculty Count", `${relevantMentors.length} active mentors`],
      ["Assigned SMEs Count", `${relevantSmes.length} assigned SMEs`]
    ];

    guideRows.forEach(r => {
      const row = wsGuide.addRow(r);
      row.height = 20;
      row.getCell(1).font = { name: "Arial", size: 9.5, bold: true };
      row.getCell(2).font = { name: "Arial", size: 9.5 };
      row.getCell(1).border = { top: { style: 'thin', color: { argb: 'E2E8F0' } }, bottom: { style: 'thin', color: { argb: 'E2E8F0' } }, left: { style: 'thin', color: { argb: 'E2E8F0' } }, right: { style: 'thin', color: { argb: 'E2E8F0' } } };
      row.getCell(2).border = { top: { style: 'thin', color: { argb: 'E2E8F0' } }, bottom: { style: 'thin', color: { argb: 'E2E8F0' } }, left: { style: 'thin', color: { argb: 'E2E8F0' } }, right: { style: 'thin', color: { argb: 'E2E8F0' } } };
    });
    wsGuide.getColumn(1).width = 25;
    wsGuide.getColumn(2).width = 65;

    // Save File via Blob / exceljs writeBuffer
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `Demo_Schedule_Template_${safeGroupName}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(downloadUrl);

    toast(`Downloaded Excel Timetable Grid template for ${targetGroup}!`, "success");
    setShowTemplateModal(false);
  };

  const handleDemoExcelFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const XLSX = await import("xlsx");
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

        if (rawRows.length === 0) {
          toast("The uploaded spreadsheet is empty.", "warning");
          return;
        }

        const warnings: string[] = [];
        const parsedSessions: any[] = [];
        const currentTargetGroup = selectedGroupId && selectedGroupId !== "All" ? selectedGroupId : "General";

        // Day of week to dateStr mapping helper
        const dayToDateMap: Record<string, string> = {};
        currentWeekDates.forEach(w => {
          dayToDateMap[w.day.toLowerCase().trim()] = w.dateStr;
          dayToDateMap[w.day.slice(0, 3).toLowerCase().trim()] = w.dateStr;
        });

        rawRows.forEach((row, idx) => {
          const rowNum = idx + 2;

          const rawDay = String(row["Day of Week"] || row["Day"] || row["day"] || row["Date"] || row["date"] || "").trim();
          const rawTime = String(row["Time Slot"] || row["Time"] || row["time"] || row["Period"] || "").trim();
          const rawMentor = String(row["Faculty / Mentor"] || row["Faculty"] || row["Mentor"] || row["mentor"] || "").trim();
          const rawSme = String(row["Assigned SME"] || row["SME"] || row["sme"] || row["Evaluator"] || "").trim();
          const rawSubject = String(row["Subject Group"] || row["Subject"] || row["subject"] || row["Department"] || currentTargetGroup).trim();
          const rawStream = String(row["Class Cohort"] || row["Class Group"] || row["Stream"] || row["stream"] || "").trim();
          const rawWeek = parseInt(String(row["Week Number"] || row["Week"] || "1"), 10) || 1;

          if (!rawDay && !rawMentor && !rawSme) return;

          // Convert Day of Week (e.g. "Monday", "Mon") to dateStr
          let targetDateStr = "";
          const lowerDay = rawDay.toLowerCase().replace(/[^a-z]/g, "");

          if (dayToDateMap[lowerDay]) {
            targetDateStr = dayToDateMap[lowerDay];
          } else if (rawDay.match(/^\d{4}-\d{2}-\d{2}$/)) {
            targetDateStr = rawDay;
          } else {
            const matchedDateObj = currentWeekDates.find(w => w.day.toLowerCase().startsWith(lowerDay.slice(0, 3)));
            if (matchedDateObj) {
              targetDateStr = matchedDateObj.dateStr;
            } else {
              targetDateStr = currentWeekDates[0]?.dateStr || selectedDateStr;
              warnings.push(`Row ${rowNum}: Could not map day '${rawDay}' — defaulting to ${currentWeekDates[0]?.day || "Monday"}.`);
            }
          }

          // Match Mentor
          let matchedMentor = mentors.find(m =>
            m.name.toLowerCase().trim() === rawMentor.toLowerCase() ||
            m.email.toLowerCase().trim() === rawMentor.toLowerCase() ||
            m.id.toLowerCase() === rawMentor.toLowerCase()
          );

          if (!matchedMentor && rawMentor) {
            matchedMentor = mentors.find(m => m.name.toLowerCase().includes(rawMentor.toLowerCase()));
          }

          if (!matchedMentor) {
            warnings.push(`Row ${rowNum}: Mentor '${rawMentor}' not found in database.`);
          }

          // Match SME
          let matchedSme = smes.find(s =>
            s.name.toLowerCase().trim() === rawSme.toLowerCase() ||
            s.email.toLowerCase().trim() === rawSme.toLowerCase() ||
            s.id.toLowerCase() === rawSme.toLowerCase()
          );

          if (!matchedSme && rawSme) {
            matchedSme = smes.find(s => s.name.toLowerCase().includes(rawSme.toLowerCase()));
          }

          if (!matchedSme) {
            warnings.push(`Row ${rowNum}: SME '${rawSme}' not found in database.`);
          }

          // Conflict checks if mentor & SME matched
          let hasConflict = false;
          let conflictReason = "";

          if (matchedMentor && matchedSme && targetDateStr && rawTime) {
            // Check holiday
            const isHol = holidays.some(h => h.date === targetDateStr);
            if (isHol) {
              hasConflict = true;
              conflictReason = "Selected day is a college holiday.";
            }

            // Check mentor leave
            const isMentorLeave = leaveRequests?.some((l: any) => l.mentorId === matchedMentor.id && l.dateStr === targetDateStr && l.status === "approved");
            if (isMentorLeave) {
              hasConflict = true;
              conflictReason = `Mentor ${matchedMentor.name} is on approved leave.`;
            }

            // Check SME leave
            const isSmeLeave = leaveRequests?.some((l: any) => l.mentorId === matchedSme.id && l.dateStr === targetDateStr && l.status === "approved");
            if (isSmeLeave) {
              hasConflict = true;
              conflictReason = `SME ${matchedSme.name} is on approved leave.`;
            }

            // Check mentor timetable class / occupied slot
            const mentorStatus = getMentorStatusAtSlot(matchedMentor.id, targetDateStr, rawTime, parsedSessions);
            if (mentorStatus.status !== "free" && mentorStatus.status !== "preview") {
              hasConflict = true;
              conflictReason = `Mentor ${matchedMentor.name} is busy: ${mentorStatus.label || mentorStatus.details}`;
            }

            // Check SME double booking
            if (!isSmeFree(matchedSme.id, targetDateStr, rawTime, parsedSessions)) {
              hasConflict = true;
              conflictReason = `SME ${matchedSme.name} is already booked at ${rawTime}.`;
            }
          }

          if (hasConflict && conflictReason) {
            warnings.push(`Row ${rowNum}: ${conflictReason}`);
          }

          parsedSessions.push({
            rowNum,
            dayName: rawDay || "Monday",
            dateStr: targetDateStr,
            timeSlot: rawTime || "08:30 AM",
            mentorId: matchedMentor ? matchedMentor.id : "",
            mentorName: matchedMentor ? matchedMentor.name : (rawMentor || "Unknown Mentor"),
            collegeName: currentCollege?.name || "College",
            smeId: matchedSme ? matchedSme.id : "",
            smeName: matchedSme ? matchedSme.name : (rawSme || "Unknown SME"),
            subject: rawSubject || currentTargetGroup,
            stream: rawStream || "General Stream",
            week: rawWeek,
            isValid: !!matchedMentor && !!matchedSme && !hasConflict,
            conflictReason
          });
        });

        const validCount = parsedSessions.filter(p => p.isValid).length;
        setDemoImportPreview({
          parsed: parsedSessions,
          warnings,
          validCount,
          targetSubjectGroup: currentTargetGroup
        });
        setShowDemoExcelImportModal(true);
      } catch (err: any) {
        toast("Failed to parse Excel file: " + err.message, "error");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const handleConfirmDemoExcelImport = async () => {
    if (!demoImportPreview || demoImportPreview.parsed.length === 0) return;
    const validSessions = demoImportPreview.parsed.filter(p => p.isValid);
    if (validSessions.length === 0) {
      toast("No valid conflict-free rows to import.", "warning");
      return;
    }
    setIsImportingDemoExcel(true);
    try {
      const payload = validSessions.map(s => ({
        mentorId: s.mentorId,
        mentorName: s.mentorName,
        collegeName: s.collegeName,
        smeId: s.smeId,
        smeName: s.smeName,
        dateStr: s.dateStr,
        timeSlot: s.timeSlot,
        subject: s.subject,
        stream: s.stream,
        week: s.week
      }));

      const res = await bulkBookDemoSessions(payload);
      if (res.success) {
        toast(`Successfully imported ${validSessions.length} demo session allocations!`, "success");
        setShowDemoExcelImportModal(false);
        setDemoImportPreview(null);
        // bulkBookDemoSessions already surgically updates demoSessions state — no refreshData needed
      } else {
        toast(res.message || "Failed to save demo allocations.", "error");
      }
    } catch (err: any) {
      toast("Error importing demo schedule: " + err.message, "error");
    } finally {
      setIsImportingDemoExcel(false);
    }
  };

  const handleExportDemoSchedule = async () => {
    const activeCollegeName = currentCollege?.name || "All_Colleges";
    const exportRows = demoSessions
      .filter(ds => selectedCollegeId === "all" || mentors.find(m => m.id === ds.mentorId)?.college_id === selectedCollegeId)
      .map(ds => {
        const dayInfo = currentWeekDates.find(w => w.dateStr === ds.dateStr);
        return {
          "Date": ds.dateStr,
          "Day of Week": dayInfo ? dayInfo.day : "Scheduled",
          "Time Slot": ds.timeSlot,
          "Faculty Mentor": ds.mentorName,
          "Assigned SME": ds.smeName,
          "Subject Group": ds.subject,
          "Class Cohort / Stream": ds.stream,
          "Status": ds.status || "scheduled"
        };
      });

    if (exportRows.length === 0) {
      toast("No active demo allocations to export.", "warning");
      return;
    }

    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Active_Demo_Schedule");

    const safeColName = activeCollegeName.replace(/[^a-zA-Z0-9]/g, "_");
    XLSX.writeFile(wb, `Demo_Allocations_${safeColName}_${selectedDateStr}.xlsx`);
    toast(`Exported ${exportRows.length} demo allocations to Excel!`, "success");
  };


  // Calculation details for preview
  const unassignedMentors = useMemo(() => {
    if (generationStep !== "done") return [];
    return filteredMentors.filter(m =>
      !previewSessions.some(p => p.mentorId === m.id)
    );
  }, [filteredMentors, previewSessions, generationStep]);

  return (
    <div className="flex-1 flex flex-col md:flex-row bg-slate-50/50 dark:bg-slate-900/10 text-slate-800 font-sans h-full overflow-hidden">

      {/* FLOATING COLLAPSIBLE LEFT SIDEBAR NAVIGATION */}
      <aside className={`hidden md:flex shrink-0 flex-col justify-between sticky top-6 z-30 floating-sidebar transition-all duration-300 ${isCollapsed ? "w-20 p-3" : "w-64 p-5"}`}>
        <div className="flex flex-col flex-1 overflow-visible">

          {/* Sidebar Header Toggle */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200/70 dark:border-slate-800">
            {!isCollapsed && (
              <div className="flex items-center gap-2">
                <Compass className="h-5 w-5 text-indigo-600 animate-pulse" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  Allocator Portal
                </span>
              </div>
            )}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors mx-auto cursor-pointer"
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${isCollapsed ? "" : "rotate-180"}`} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <nav className="py-4 space-y-1.5">
            <button
              onClick={() => setAllocatorTab("matrix")}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${allocatorTab === "matrix"
                ? "bg-gradient-to-r from-[#D528A2] to-pink-600 text-white shadow-md shadow-[#D528A2]/25 font-black border-none"
                : "text-slate-600 hover:text-[#D528A2] hover:bg-[#D528A2]/5 dark:text-slate-400 dark:hover:bg-white/5"
                }`}
            >
              <Grid className="h-4 w-4 shrink-0" />
              {!isCollapsed && <span>Allocation Matrix</span>}
            </button>

            <button
              onClick={() => setAllocatorTab("rules")}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${allocatorTab === "rules"
                ? "bg-gradient-to-r from-[#D528A2] to-pink-600 text-white shadow-md shadow-[#D528A2]/25 font-black border-none"
                : "text-slate-600 hover:text-[#D528A2] hover:bg-[#D528A2]/5 dark:text-slate-400 dark:hover:bg-white/5"
                }`}
            >
              <Settings className="h-4 w-4 shrink-0" />
              {!isCollapsed && <span>Auto-Scheduler & Rules</span>}
            </button>

            <button
              onClick={() => setAllocatorTab("queue")}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer relative ${allocatorTab === "queue"
                ? "bg-gradient-to-r from-[#D528A2] to-pink-600 text-white shadow-md shadow-[#D528A2]/25 font-black border-none"
                : "text-slate-600 hover:text-[#D528A2] hover:bg-[#D528A2]/5 dark:text-slate-400 dark:hover:bg-white/5"
                }`}
            >
              <RefreshCw className="h-4 w-4 shrink-0" />
              {!isCollapsed && <span>Reallocation Queue</span>}
              {demoSwapRequests.filter((r: any) => r.status === "pending").length > 0 && (
                <span className="ml-auto px-2 py-0.5 bg-rose-500 text-white rounded-full text-[9px] font-black">
                  {demoSwapRequests.filter((r: any) => r.status === "pending").length}
                </span>
              )}
            </button>
          </nav>
        </div>
      </aside>

      {/* MAIN WORKSPACE AREA */}
      <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-6 max-w-[1400px] mx-auto w-full">

        {/* Page Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/60 dark:border-slate-805">
          <div className="space-y-1">
            <h1 className="text-lg font-black text-slate-905 dark:text-white tracking-tight flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#D528A2] animate-pulse" />
              Demo Scheduling Console
            </h1>
            <p className="text-[11.5px] text-slate-405 font-bold leading-none dark:text-slate-400">
              Consolidate and allocate department demo sessions for mentors and SMEs.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => { refreshData(); toast("Refreshed timetable data.", "success"); }}
              className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200 rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-2 transition-all"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>

            {/* SINGLE CLEAN EXCEL ACTIONS DROPDOWN */}
            <div className="relative">
              <button
                onClick={() => setShowExcelDropdown(!showExcelDropdown)}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-2 transition-all"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <span>Excel Actions</span>
                <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${showExcelDropdown ? "rotate-180" : ""}`} />
              </button>

              {showExcelDropdown && (
                <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 py-1.5 animate-fade-in">
                  <button
                    onClick={() => { setShowExcelDropdown(false); setShowTemplateModal(true); }}
                    className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"
                  >
                    <Download className="h-4 w-4 text-indigo-600 shrink-0" />
                    <div>
                      <span>Download Template (.xlsx)</span>
                      <span className="block text-[9.5px] font-normal text-slate-400">Day-of-Week &amp; Subject Group template</span>
                    </div>
                  </button>

                  <label
                    onClick={() => setShowExcelDropdown(false)}
                    className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"
                  >
                    <Upload className="h-4 w-4 text-emerald-600 shrink-0" />
                    <div>
                      <span>Import Excel Schedule</span>
                      <span className="block text-[9.5px] font-normal text-slate-400">Parse &amp; validate conflict-free rows</span>
                    </div>
                    <input
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      onChange={handleDemoExcelFileSelect}
                      className="hidden"
                    />
                  </label>

                  <button
                    onClick={() => { setShowExcelDropdown(false); handleExportDemoSchedule(); }}
                    className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-amber-600 shrink-0" />
                    <div>
                      <span>Export Active Schedule</span>
                      <span className="block text-[9.5px] font-normal text-slate-400">Download current allocations (.xlsx)</span>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={handleTriggerGenerate}
              className="px-4 py-2 bg-gradient-to-r from-[#D528A2] to-pink-600 text-white rounded-xl text-xs font-black shadow-md shadow-[#D528A2]/25 flex items-center gap-2 transition-all cursor-pointer hover:opacity-95"
            >
              <Sparkles className="h-3.5 w-3.5 text-white" />
              Generate Schedule
            </button>
          </div>
        </div>

        {/* 🔹 LIVE REALLOCATION & ALLOCATION PROGRESS TRACKER (Card.tsx components) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card
            label="Confirmed Demos"
            value={demoSessions.filter(d => d.status === "confirmed" || d.status === "scheduled").length}
            icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
            className="bg-white"
          />

          <Card
            label="Leave Impacted (Reallocation Req)"
            value={demoSessions.filter(d => d.status === "reallocation_required").length}
            icon={<AlertTriangle className="h-5 w-5 text-amber-600" />}
            className="bg-white"
          />

          <Card
            label="Pending Head / SME Approval"
            value={demoSwapRequests.filter((r: any) => r.status === "pending" || r.status === "pending_sme").length}
            icon={<Clock className="h-5 w-5 text-[#D528A2]" />}
            className="bg-white"
          />

          <Card
            label="Not Conducted Sessions"
            value={demoSessions.filter(d => d.status === "not_conducted").length}
            icon={<AlertCircle className="h-5 w-5 text-rose-600" />}
            className="bg-white"
          />
        </div>

        {/* TAB 1: ALLOCATION MATRIX */}
        {allocatorTab === "matrix" && (
          <div className="space-y-6">



            {/* Filters Bar */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 p-4 rounded-xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
              <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">

                {/* College Dropdown */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">College</label>
                  <div className="relative min-w-[220px]">
                    <select
                      value={selectedCollegeId}
                      onChange={(e) => {
                        setSelectedCollegeId(e.target.value);
                        setSelectedGroupId("All");
                      }}
                      className="w-full pl-3 pr-8 py-2 text-xs font-bold rounded-xl border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none cursor-pointer"
                    >
                      <option value="all">All Selected Colleges</option>
                      {colleges.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-2.5 h-3.5 w-3.5 text-slate-405 pointer-events-none" />
                  </div>
                </div>

                {/* Group (Department) Dropdown */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Department Group</label>
                  <div className="relative min-w-[200px]">
                    <select
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(e.target.value)}
                      className="w-full pl-3 pr-8 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none cursor-pointer"
                    >
                      <option value="All">All Departments</option>
                      {mentorGroups.map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-2.5 h-3.5 w-3.5 text-slate-405 pointer-events-none" />
                  </div>
                </div>


              </div>

              {/* Quick status indicators */}
              <div className="flex gap-4 items-center">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 bg-emerald-105 dark:bg-emerald-955/40 rounded border border-emerald-200 dark:border-emerald-900 shadow-xs" />
                  <span className="text-[10.5px] font-bold text-slate-455 dark:text-slate-405 uppercase tracking-wide">Free Slot</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 bg-slate-100 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-805" />
                  <span className="text-[10.5px] font-bold text-slate-455 dark:text-slate-405 uppercase tracking-wide">Busy Slot</span>
                </div>
              </div>
            </div>

            {/* 🔹 DYNAMIC TIMETABLE TABLE */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-855 rounded-xl shadow-sm overflow-auto max-h-[70vh] w-full no-scrollbar relative">
              <table className="w-full table-fixed border-collapse text-left min-w-[950px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-955 text-xs font-bold uppercase">
                    <th className="sticky top-0 left-0 z-30 p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-100/95 dark:bg-slate-950/95 backdrop-blur-xs border-r border-b border-slate-200/80 dark:border-slate-800 w-[15%]">Time Period</th>
                    {currentWeekDates.map((date, idx) => (
                      <th key={date.dateStr} className="sticky top-0 z-20 p-4 text-[10.5px] font-black text-slate-705 dark:text-slate-300 bg-slate-50/95 dark:bg-slate-955/95 backdrop-blur-xs border-b border-slate-200/80 dark:border-slate-800 uppercase w-[17%] border-l border-slate-100 dark:border-slate-800 text-center">
                        <div className="text-indigo-650 dark:text-indigo-400 font-extrabold text-[10.5px] tracking-tight">Day {idx + 1}</div>
                        <div className="text-[9px] text-slate-405 font-bold tracking-tight mt-0.5">{date.day.slice(0, 3)} ({date.formatted})</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 dark:divide-slate-800">
                  {collegeTimeSlots.length > 0 ? (
                    collegeTimeSlots.map((time, tIdx) => {
                      const isLunch = time.toLowerCase().includes("lunch") || time.toLowerCase().includes("break");
                      const firstBeyondSlot = collegeTimeSlots.find(t => {
                        const isL = t.toLowerCase().includes("lunch") || t.toLowerCase().includes("break");
                        return !standardShiftSlots.includes(t.trim().toLowerCase()) && !isL;
                      });
                      const isFirstBeyond = time === firstBeyondSlot;

                      return (
                        <React.Fragment key={time}>
                          {/* BEYOND HOURS HEADER DIVIDER */}
                          {isFirstBeyond && (
                            <tr className="bg-slate-100/60 dark:bg-slate-900 border-t border-b border-slate-200 dark:border-slate-800">
                              <td colSpan={6} className="p-3.5 text-left">
                                <div className="flex items-center gap-2 text-indigo-650 dark:text-indigo-400 font-black text-xs uppercase tracking-widest">
                                  <Moon className="h-4.5 w-4.5 text-indigo-505 animate-pulse" />
                                  Beyond College Hours
                                </div>
                              </td>
                            </tr>
                          )}

                          {isLunch ? (
                            <tr className="bg-indigo-50/15 dark:bg-indigo-950/10">
                              <td className="sticky left-0 z-10 p-3 border-r border-slate-150 dark:border-slate-800 bg-indigo-50/95 dark:bg-indigo-950/95 backdrop-blur-xs align-middle">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                  <Coffee className="h-3.5 w-3.5 text-indigo-405" />
                                  Lunch
                                </span>
                              </td>
                              <td colSpan={5} className="p-3 align-middle text-center">
                                <div className="flex items-center justify-center gap-2 text-indigo-650 dark:text-indigo-400 font-extrabold text-[10.5px] tracking-wide uppercase">
                                  <Coffee className="h-4 w-4" />
                                  {time} • LUNCH BREAK (Excluded from Scheduling)
                                </div>
                              </td>
                            </tr>
                          ) : (
                            <tr className="hover:bg-slate-50/10 transition-colors">

                              {/* Time Column */}
                              <td className="sticky left-0 z-10 p-4 border-r border-slate-150 dark:border-slate-855 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs align-middle">
                                <div className="leading-tight">
                                  <span className="text-[10.5px] font-black text-slate-705 dark:text-white">Period {tIdx + 1}</span>
                                  <div className="text-[9px] text-slate-400 font-semibold mt-0.5">{time}</div>
                                </div>
                              </td>

                              {/* Day Columns */}
                              {currentWeekDates.map((date) => {
                                return (
                                  <td
                                    key={date.dateStr}
                                    className="p-2 border-r border-slate-150 dark:border-slate-855 last:border-r-0 align-top text-center"
                                  >
                                    <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-0.5">
                                      {(() => {
                                        // Filter out mentors who are not available (free, demo, preview)
                                        const cellMentors = filteredMentors.filter(mentor => {
                                          const statusObj = getMentorStatusAtSlot(mentor.id, date.dateStr, time);
                                          return statusObj.status === "free" || statusObj.status === "demo" || statusObj.status === "preview";
                                        });
                                        const visibleMentors = cellMentors.slice(0, 2);
                                        const hiddenCount = cellMentors.length - 2;

                                        return (
                                          <>
                                            {visibleMentors.map((mentor) => {
                                              const statusObj = getMentorStatusAtSlot(mentor.id, date.dateStr, time);
                                              const isFree = statusObj.status === "free";
                                              const isDemo = statusObj.status === "demo";
                                              const isPreview = statusObj.status === "preview";
                                              const isBlocked = statusObj.status === "blocked";

                                              return (
                                                <div
                                                  key={mentor.id}
                                                  onClick={() => {
                                                    if (isFree) {
                                                      setEditSession({
                                                        id: "",
                                                        mentorId: mentor.id,
                                                        mentorName: mentor.name,
                                                        smeId: smes[0]?.id || "",
                                                        smeName: smes[0]?.name || "",
                                                        dateStr: date.dateStr,
                                                        timeSlot: time,
                                                        subject: mentor.mentor_group || "General",
                                                        stream: (slots.filter(s => s.mentorId === mentor.id && s.classGroup)[0]?.classGroup) || "General Stream",
                                                        week: 1
                                                      });
                                                    } else if (isDemo) {
                                                      setEditSession(statusObj.session);
                                                    } else if (isPreview) {
                                                      toast("This is a preview draft session. Save changes to modify.", "info");
                                                    } else if (isBlocked) {
                                                      toast(`${mentor.name} is unavailable: ${statusObj.label} (${statusObj.details})`, "info");
                                                    } else {
                                                      toast(`${mentor.name} is busy teaching: ${statusObj.label} (${statusObj.group})`, "warning");
                                                    }
                                                  }}
                                                  className={`flex flex-col p-1.5 rounded-lg border text-[9.5px] font-bold cursor-pointer transition-all hover:translate-x-0.5 text-left ${isFree
                                                    ? "bg-emerald-50/20 border-emerald-100 text-emerald-805 hover:bg-emerald-50/50"
                                                    : isDemo
                                                      ? "bg-indigo-50/30 border-indigo-205 text-indigo-850 hover:bg-indigo-50"
                                                      : isPreview
                                                        ? "bg-amber-50/20 border-amber-200 text-amber-705 hover:bg-amber-55"
                                                        : isBlocked
                                                          ? "bg-amber-50/10 border-amber-100/50 text-amber-600/80 cursor-not-allowed"
                                                          : "bg-slate-50/50 border-slate-100 text-slate-400 hover:bg-slate-105"
                                                    }`}
                                                  title={`${mentor.name}: ${statusObj.label}`}
                                                >
                                                  <div className="flex items-center justify-between gap-1">
                                                    <span className="truncate text-slate-800 dark:text-slate-100">{mentor.name}</span>
                                                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isFree
                                                      ? "bg-emerald-500"
                                                      : isDemo
                                                        ? "bg-indigo-500"
                                                        : isPreview
                                                          ? "bg-amber-500"
                                                          : isBlocked
                                                            ? "bg-amber-600"
                                                            : "bg-slate-350"
                                                      }`} />
                                                  </div>
                                                  {!isFree && (
                                                    <div className="text-[7.5px] text-slate-455 dark:text-slate-505 font-semibold truncate mt-0.5 text-left">
                                                      {statusObj.label}
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })}

                                            {hiddenCount > 0 && (
                                              <button
                                                onClick={() => {
                                                  setCellPopover({
                                                    dateStr: date.dateStr,
                                                    dateFormatted: date.formatted,
                                                    day: date.day,
                                                    timeSlot: time
                                                  });
                                                }}
                                                className="w-full py-1 text-[8.5px] font-black text-indigo-655 hover:text-indigo-700 bg-indigo-50/30 hover:bg-indigo-55 border border-dashed border-indigo-205 rounded-lg transition-colors cursor-pointer"
                                              >
                                                + {hiddenCount} More
                                              </button>
                                            )}
                                          </>
                                        );
                                      })()}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 text-xs font-bold">
                        No time slots configured for the selected College.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 🔹 BOTTOM INFRASTRUCTURE CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
              {/* Card 1: Legend */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
                <h3 className="text-xs font-black uppercase text-slate-705 dark:text-white tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">Legend</h3>
                <div className="grid grid-cols-2 gap-3 text-[10.5px] font-semibold text-slate-550 dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded bg-emerald-500 shadow-xs shrink-0" />
                    <div>
                      <span className="font-bold text-slate-805 dark:text-white block leading-none">Free Slot</span>
                      <span className="text-[8.5px] text-slate-400 block mt-0.5">Available for demo</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded bg-slate-350 shadow-xs shrink-0" />
                    <div>
                      <span className="font-bold text-slate-800 dark:text-white block leading-none">Busy Slot</span>
                      <span className="text-[8.5px] text-slate-405 block mt-0.5">Teaching / Evaluation</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded bg-indigo-500 shadow-xs shrink-0" />
                    <div>
                      <span className="font-bold text-slate-800 dark:text-white block leading-none">Demo Booked</span>
                      <span className="text-[8.5px] text-slate-400 block mt-0.5">Already scheduled</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded bg-amber-500 shadow-xs shrink-0" />
                    <div>
                      <span className="font-bold text-slate-800 dark:text-white block leading-none">Blocked</span>
                      <span className="text-[8.5px] text-slate-400 block mt-0.5">Not available</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Info */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-3">
                <h3 className="text-xs font-black uppercase text-slate-700 dark:text-white tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">Info</h3>
                <ul className="list-disc pl-4 text-[10.5px] text-slate-500 dark:text-slate-400 space-y-1.5 font-semibold">
                  <li>Time slots are in 60 min duration</li>
                  <li>Lunch break is excluded from scheduling</li>
                  <li>Beyond college hours are shown below the divider</li>
                </ul>
              </div>

              {/* Card 3: Beyond College Hours */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-3 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase text-slate-700 dark:text-white tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-1.5">
                    <Moon className="h-3.5 w-3.5 text-indigo-500" />
                    Beyond College Hours
                  </h3>
                  <div className="pt-2 text-[10.5px] font-bold text-slate-700 dark:text-slate-300 space-y-1.5">
                    <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/40 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span>Slot 1:</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">04:30 PM - 05:30 PM</span>
                    </div>
                    <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/40 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span>Slot 2:</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">05:30 PM - 06:30 PM</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: AUTO-SCHEDULER ENGINE & DEPARTMENT RULES */}
        {allocatorTab === "rules" && (
          <Panel
            title="DEPARTMENT DEMO TARGET RULES & HEAD SMES"
            subtitle="Configure target demo quotas per week for each department group and manage Head SME priority assignments."
            headerActions={
              <button
                onClick={handleTriggerGenerate}
                className="px-4 py-2 bg-gradient-to-r from-[#D528A2] to-pink-600 text-white rounded-xl text-xs font-black shadow-md shadow-[#D528A2]/25 flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Run Auto-Scheduler Engine
              </button>
            }
          >
            <div className="space-y-6">
              {/* Target Demos Config Card */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-black uppercase text-slate-800 dark:text-white">Default Weekly Demos Target per Mentor</span>
                    <p className="text-[10.5px] text-slate-400 font-medium">Global target for mentors across active departments</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={targetDemosCount}
                      onChange={(e) => setTargetDemosCount(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 text-center py-1.5 border border-slate-200 rounded-xl text-xs font-black bg-white"
                    />
                    <span className="text-xs font-bold text-slate-500">demo(s) / week</span>
                  </div>
                </div>
              </div>

              {/* Department Rules Grid */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-200 tracking-wider">Department Quotas</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {mentorGroups.map((groupName) => {
                    const existing = demoRules?.find(r => r.subject?.toLowerCase().trim() === groupName.toLowerCase().trim());
                    const dbVal = existing ? existing.target : 1;
                    const localVal = deptRuleInputs[groupName] !== undefined ? deptRuleInputs[groupName] : dbVal;
                    const isDirty = localVal !== dbVal;

                    return (
                      <div key={groupName} className="flex items-center justify-between p-4 rounded-xl bg-white border border-slate-200 dark:border-slate-800 shadow-xs">
                        <div>
                          <span className="text-xs font-black text-slate-800 dark:text-white block">{groupName}</span>
                          <span className="text-[10px] text-slate-400 font-semibold block">Target: {dbVal} demo/week</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            max={14}
                            value={localVal}
                            onChange={(e) => setDeptRuleInputs(prev => ({ ...prev, [groupName]: Math.max(1, parseInt(e.target.value) || 1) }))}
                            className="w-14 text-center p-1.5 text-xs font-bold border border-slate-200 rounded-lg bg-slate-50"
                          />
                          <button
                            onClick={async () => {
                              await saveDepartmentRule(groupName, localVal);
                              setDeptRuleInputs(prev => { const next = { ...prev }; delete next[groupName]; return next; });
                            }}
                            disabled={!isDirty}
                            className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${isDirty ? "bg-[#D528A2] text-white shadow-xs cursor-pointer" : "bg-slate-100 text-slate-400 cursor-not-allowed"
                              }`}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 🔹 MENTOR GROUP-WISE INDIVIDUAL FACULTY DEMO QUOTA CONFIGURATOR */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 font-sans mt-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <Users className="h-4 w-4 text-[#D528A2]" />
                      Individual Faculty Demo Quota Configurator (Mentor Group-wise)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                      Set custom weekly demo targets for each mentor. Timetable Excel templates generate strictly based on these individual counts.
                    </p>
                  </div>

                  {/* Group Filter Selector */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase text-slate-400">Filter Group:</span>
                    <select
                      value={rulesSelectedGroup}
                      onChange={(e) => setRulesSelectedGroup(e.target.value)}
                      className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-[#D528A2] cursor-pointer"
                    >
                      <option value="All">All Mentor Groups ({mentors.length} Mentors)</option>
                      {mentorGroups.map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Mentors Table for Selected Group */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-black uppercase text-[9.5px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                        <th className="p-3">Faculty Name</th>
                        <th className="p-3">Mentor Group</th>
                        <th className="p-3">College & Department</th>
                        <th className="p-3 text-center">Weekly Quota Target</th>
                        <th className="p-3 text-right">Set Target Stepper</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                      {mentors
                        .filter(m => {
                          if (rulesSelectedGroup === "All") return true;
                          return getMentorGroup(m).toLowerCase().trim() === rulesSelectedGroup.toLowerCase().trim();
                        })
                        .map(m => {
                          const groupName = getMentorGroup(m);
                          const defaultTarget = demoRules?.find(r => r.subject?.toLowerCase().trim() === groupName.toLowerCase().trim())?.target || 1;
                          const customTarget = mentorTargets[m.id] !== undefined ? mentorTargets[m.id] : defaultTarget;
                          const colName = colleges.find(c => c.id === m.college_id)?.name || m.department || "Faculty";

                          return (
                            <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                              <td className="p-3 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <User className="h-3.5 w-3.5 text-[#D528A2]" />
                                {m.name}
                              </td>
                              <td className="p-3">
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900">
                                  {groupName}
                                </span>
                              </td>
                              <td className="p-3 text-slate-500 dark:text-slate-400 text-[11px]">
                                {colName}
                              </td>
                              <td className="p-3 text-center">
                                <span className="px-2.5 py-1 rounded-lg bg-[#D528A2]/10 text-[#D528A2] font-black text-xs">
                                  {customTarget} Demo{customTarget !== 1 ? "s" : ""}/Wk
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                                  <button
                                    type="button"
                                    onClick={() => handleSetMentorTarget(m.id, customTarget - 1)}
                                    className="w-6 h-6 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-black flex items-center justify-center cursor-pointer shadow-xs transition-colors"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min={0}
                                    max={10}
                                    value={customTarget}
                                    onChange={(e) => handleSetMentorTarget(m.id, parseInt(e.target.value) || 0)}
                                    className="w-10 text-center text-xs font-black bg-transparent border-none focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSetMentorTarget(m.id, customTarget + 1)}
                                    className="w-6 h-6 rounded-lg bg-[#D528A2] hover:opacity-90 text-white font-black flex items-center justify-center cursor-pointer shadow-xs transition-colors"
                                  >
                                    +
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Panel>
        )}

        {/* TAB 3: REALLOCATION QUEUE & DIAGNOSTICS */}
        {allocatorTab === "queue" && (
          <Panel
            title="REALLOCATION QUEUE & SCHEDULING DIAGNOSTICS"
            subtitle="Review pending SME & mentor swap proposals and inspect automated scheduling exceptions."
          >
            <div className="space-y-6">
              {/* Swap Requests Table */}
              <div className="space-y-3">
                <div className="flex border-b border-slate-200">
                  <button
                    type="button"
                    onClick={() => setSwapRequestsTab("pending")}
                    className={`pb-2 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${swapRequestsTab === "pending" ? "border-[#D528A2] text-[#D528A2]" : "border-transparent text-slate-400"
                      }`}
                  >
                    Pending Review ({demoSwapRequests.filter((r: any) => r.status === "pending").length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSwapRequestsTab("resolved")}
                    className={`pb-2 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${swapRequestsTab === "resolved" ? "border-[#D528A2] text-[#D528A2]" : "border-transparent text-slate-400"
                      }`}
                  >
                    Resolution Logs ({demoSwapRequests.filter((r: any) => r.status !== "pending").length})
                  </button>
                </div>

                <div className="space-y-3">
                  {swapRequestsTab === "pending" ? (
                    demoSwapRequests.filter((r: any) => r.status === "pending").length > 0 ? (
                      demoSwapRequests.filter((r: any) => r.status === "pending").map((req: any) => (
                        <div key={req.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-slate-900">{req.smeName}</span>
                              <span className="px-2 py-0.5 bg-[#D528A2]/10 text-[#D528A2] rounded-md text-[9px] font-extrabold uppercase">
                                {req.swapType === "mentor" ? "Mentor Swap" : "Time Slot Swap"}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 font-semibold mt-1">
                              Original: {req.mentorName} ({req.dateStr} • {req.timeSlot})
                            </p>
                            <p className="text-xs font-bold text-[#D528A2] mt-0.5">
                              Proposed: {req.swapType === "mentor" ? req.proposedMentorName : `${req.proposedDateStr} • ${req.proposedTimeSlot}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={async () => {
                                const res = await resolveDemoSwap(req.id, "rejected");
                                if (res.success) toast("Swap request rejected.", "info");
                              }}
                              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                              Reject
                            </button>
                            <button
                              onClick={async () => {
                                const res = await resolveDemoSwap(req.id, "approved");
                                if (res.success) toast("Swap approved and schedule updated!", "success");
                              }}
                              className="px-4 py-1.5 bg-gradient-to-r from-[#D528A2] to-pink-600 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer"
                            >
                              Approve Swap
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-10 text-slate-400 font-bold text-xs">
                        No pending swap requests found. All requests are up to date!
                      </div>
                    )
                  ) : (
                    <div className="text-center py-10 text-slate-400 font-bold text-xs">
                      {demoSwapRequests.filter((r: any) => r.status !== "pending").length} resolved swap log records.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Panel>
        )}

        {/* 🔹 AUTOMATED GENERATION PREVIEW MODAL */}
        {showPreviewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-xl p-6 w-full max-w-2xl shadow-2xl relative animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

              <button
                onClick={() => { if (!isGenerating) setShowPreviewModal(false); }}
                disabled={isGenerating}
                className="absolute right-4 top-4 p-1.5 hover:bg-slate-105 dark:hover:bg-slate-805 rounded-xl text-slate-400 hover:text-slate-805 transition-colors cursor-pointer disabled:opacity-40"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Modal Title */}
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 shrink-0">
                <Sparkles className="h-5 w-5 text-indigo-605 animate-pulse" />
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-850 dark:text-white tracking-wider">
                    AI Schedule Generation Deck
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                    Target: {selectedCollegeId === "all" ? "All Colleges" : currentCollege?.name} • {selectedGroupId === "All" ? "All Subject Groups" : selectedGroupId}
                  </p>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto py-4 space-y-4 my-1">

                {generationStep === "generating" ? (
                  /* LOADING GENERATION STATE */
                  <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="relative h-14 w-14">
                      <Loader2 className="h-14 w-14 text-indigo-600 animate-spin" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-black text-slate-850">Computing Allocation Metrics...</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Analyzing slots, specialized SMEs, and leaves</p>
                    </div>

                    {/* Visual checklist indicators */}
                    <div className="w-full max-w-xs bg-slate-50 dark:bg-slate-855 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-505 dark:text-slate-405 space-y-2 text-left">
                      <div className="flex items-center gap-2 text-emerald-600">
                        <CheckCircle className="h-3.5 w-3.5" /> Checked college shift timings
                      </div>
                      <div className="flex items-center gap-2 text-emerald-600 animate-pulse">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Matching mentors with subject expert SMEs
                      </div>
                      <div className="flex items-center gap-2 text-slate-350">
                        <div className="h-3.5 w-3.5 rounded-full border-2 border-slate-200" /> Allocating clash-free dates
                      </div>
                    </div>
                  </div>
                ) : (
                  /* RESULTS COMPLETED STATE */
                  <div className="space-y-4">
                    {/* Scanned Metrics Grid */}
                    <div className="grid grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-850/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
                      <div className="p-1">
                        <span className="text-[8.5px] font-black uppercase text-slate-400 tracking-wider block">Available Mentors</span>
                        <span className="text-base font-black text-slate-850 block">{filteredMentors.length}</span>
                      </div>
                      <div className="p-1 border-x border-slate-150">
                        <span className="text-[8.5px] font-black uppercase text-slate-400 tracking-wider block">Total Free Slots</span>
                        <span className="text-base font-black text-emerald-605 block">{totalFreeSlotsCount}</span>
                      </div>
                      <div className="p-1">
                        <span className="text-[8.5px] font-black uppercase text-slate-400 tracking-wider block">Generated Demos</span>
                        <span className="text-base font-black text-indigo-605 block">{previewSessions.length}</span>
                      </div>
                    </div>

                    {/* Allocation summary alert cards */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2.5 p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl text-[10.5px] font-bold text-emerald-805">
                        <CheckCircle className="h-4.5 w-4.5 text-emerald-650" />
                        <span>Successfully planned {previewSessions.length} demo sessions with zero cohort-clashes.</span>
                      </div>

                      {unassignedMentors.length > 0 && (
                        <div className="flex items-start gap-2.5 p-3 bg-amber-50/50 border border-amber-205 rounded-xl text-[10.5px] font-bold text-amber-805">
                          <AlertTriangle className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <span>Unassigned Mentors ({unassignedMentors.length}):</span>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {unassignedMentors.map(m => (
                                <span key={m.id} className="px-1.5 py-0.5 rounded bg-white border border-amber-200 text-[8.5px] font-black text-amber-705">
                                  {m.name}
                                </span>
                              ))}
                            </div>
                            <span className="text-[8.5px] text-slate-405 font-bold block mt-1.5">These mentors either have no eligible matching SMEs or are fully occupied during free periods.</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Unresolved Exceptions Panel */}
                    {exceptions.length > 0 && (
                      <div className="space-y-2.5">
                        <h4 className="text-[10px] font-black uppercase text-rose-500 tracking-wider flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Scheduling Exceptions ({exceptions.length})
                        </h4>
                        <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                          {exceptions.map(exc => (
                            <div key={exc.id} className="p-3 bg-rose-50/20 dark:bg-rose-950/10 border border-rose-150/40 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                              <div className="text-[10.5px]">
                                <p className="font-bold text-slate-800 dark:text-slate-200">
                                  {exc.mentorName} • <span className="text-slate-400 font-semibold">{exc.subject}</span>
                                </p>
                                <p className="text-[9.5px] text-rose-605 dark:text-rose-400 font-bold mt-0.5">
                                  Clash: {exc.reason}
                                </p>
                                <p className="text-[9px] text-indigo-650 dark:text-indigo-400 mt-1 italic">
                                  Suggestion: {exc.recommendation}
                                </p>
                              </div>
                              <button
                                onClick={() => {
                                  setEditSession({
                                    mentorId: exc.mentorId,
                                    mentorName: exc.mentorName,
                                    smeId: "",
                                    smeName: "",
                                    dateStr: currentWeekDates[0]?.dateStr || "",
                                    timeSlot: collegeTimeSlots[0] || "",
                                    subject: exc.subject,
                                    stream: exc.stream,
                                    week: 1
                                  });
                                  setShowPreviewModal(false);
                                }}
                                className="px-2.5 py-1 bg-white hover:bg-slate-105 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[9px] font-bold rounded-lg border border-slate-200 dark:border-slate-750 transition-colors shadow-xs shrink-0 cursor-pointer"
                              >
                                Resolve Manual
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Generated sessions preview ledger list */}
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Generated Sessions Ledger Preview</h4>
                      <div className="border border-slate-150 rounded-xl overflow-hidden max-h-[200px] overflow-y-auto">
                        <table className="w-full text-left border-collapse text-[10.5px]">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-155 text-slate-405 font-bold uppercase text-[9px]">
                              <th className="p-2.5">Faculty Mentor</th>
                              <th className="p-2.5">Subject</th>
                              <th className="p-2.5">Date / Time</th>
                              <th className="p-2.5">Assigned SME</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {previewSessions.map((s, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/20">
                                <td className="p-2.5 font-bold text-slate-800">
                                  <div>{s.mentorName}</div>
                                  <div className="text-[8.5px] text-indigo-500 font-black uppercase tracking-wider mt-0.5">
                                    {s.collegeName || colleges.find(c => c.id === mentors.find(m => m.id === s.mentorId)?.college_id)?.name || ""}
                                  </div>
                                </td>
                                <td className="p-2.5 text-slate-505">{s.subject}</td>
                                <td className="p-2.5 text-slate-505">
                                  <div>{s.dateStr}</div>
                                  <div className="text-[8.5px] text-slate-405 mt-0.5">{s.timeSlot}</div>
                                </td>
                                <td className="p-2.5 font-bold text-slate-750">{s.smeName}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Modal Actions */}
              {generationStep === "done" && (
                <div className="flex gap-3 border-t border-slate-100 dark:border-slate-800 pt-3 shrink-0">
                  <button
                    onClick={handleSavePreview}
                    className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs shadow-sm cursor-pointer transition-colors"
                  >
                    Confirm &amp; Save
                  </button>
                  <button
                    onClick={handleTriggerGenerate}
                    className="flex-1 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs transition-colors cursor-pointer border border-indigo-200"
                  >
                    Regenerate
                  </button>
                  <button
                    onClick={() => setShowPreviewModal(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-555 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 🔹 DEPARTMENT RULES SETTINGS MODAL */}
        {showSettingsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl relative animate-in zoom-in-95 duration-200 space-y-4 flex flex-col max-h-[85vh]">

              <button
                onClick={() => setShowSettingsModal(false)}
                className="absolute right-4 top-4 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 shrink-0">
                <Settings className="h-5 w-5 text-indigo-500" />
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-850 dark:text-white tracking-wider">
                    Department Rules Settings
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                    Set the number of demos per week for each department
                  </p>
                </div>
              </div>

              {/* Column headers */}
              <div className="grid grid-cols-[1fr_80px_56px] gap-3 px-1 text-[9px] font-black uppercase text-slate-400 tracking-widest shrink-0">
                <span>Department</span>
                <span className="text-center">Demos / Week</span>
                <span className="text-center">Action</span>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 py-1">
                {mentorGroups.map((groupName) => {
                  const existing = demoRules?.find(r => r.subject?.toLowerCase().trim() === groupName.toLowerCase().trim());
                  const dbVal = existing ? existing.target : 1;
                  const localVal = deptRuleInputs[groupName] !== undefined ? deptRuleInputs[groupName] : dbVal;
                  const isDirty = localVal !== dbVal;

                  return (
                    <div key={groupName} className="grid grid-cols-[1fr_80px_56px] gap-3 items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-150 dark:border-slate-800">
                      <div className="space-y-0.5 min-w-0">
                        <span className="text-xs font-black text-slate-800 dark:text-slate-100 block truncate">{groupName}</span>
                        <span className="text-[8.5px] text-slate-400 font-semibold block">
                          Saved: {dbVal} demo{dbVal !== 1 ? "s" : ""}/wk
                        </span>
                      </div>

                      <input
                        type="number"
                        min={1}
                        max={14}
                        value={localVal}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value) || 1);
                          setDeptRuleInputs(prev => ({ ...prev, [groupName]: val }));
                        }}
                        className={`w-full text-center px-2 py-2 text-sm font-black border rounded-xl bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 transition-all ${isDirty
                          ? "border-indigo-400 text-indigo-700 focus:ring-indigo-200"
                          : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:ring-slate-200"
                          }`}
                      />

                      <button
                        onClick={async () => {
                          await saveDepartmentRule(groupName, localVal);
                          setDeptRuleInputs(prev => {
                            const next = { ...prev };
                            delete next[groupName];
                            return next;
                          });
                        }}
                        disabled={!isDirty}
                        className={`w-full py-2 rounded-xl text-[10px] font-black transition-all ${isDirty
                          ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm cursor-pointer"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-350 cursor-not-allowed"
                          }`}
                      >
                        Save
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 shrink-0">
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-550 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Close Settings
                </button>
              </div>

            </div>
          </div>
        )}


        {/* MANUAL OVERRIDE / CREATE MODAL */}
        {editSession !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl relative animate-in zoom-in-95 duration-200 space-y-5">

              <button
                onClick={setEditSession.bind(null, null)}
                className="absolute right-4 top-4 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-450 hover:text-slate-805 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-2 border-b border-slate-105 dark:border-slate-800 pb-3">
                <Settings className="h-5 w-5 text-indigo-500" />
                <h3 className="text-sm font-black uppercase text-slate-850 dark:text-white tracking-wider">
                  {editSession.id ? "Manual Override Demo Session" : "Schedule New Demo Session"}
                </h3>
              </div>

              <form onSubmit={editSession.id ? handleSaveEdit : async (e) => {
                e.preventDefault();
                try {
                  const selectedSme = smes.find(s => s.id === editSession.smeId);
                  const res = await bookDemoSession(
                    editSession.mentorId,
                    editSession.mentorName,
                    editSession.smeId,
                    selectedSme ? selectedSme.name : editSession.smeName,
                    editSession.dateStr,
                    editSession.timeSlot,
                    editSession.subject,
                    editSession.stream,
                    editSession.week
                  );
                  if (res.success) {
                    toast("Demo session scheduled successfully!", "success");
                    setEditSession(null);
                    // bookDemoSession already surgically updates demoSessions state — no refreshData needed
                  } else {
                    toast(res.message, "error");
                  }
                } catch (err: any) {
                  toast(err.message, "error");
                }
              }} className="space-y-4">

                {/* Mentor Info */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-405 tracking-wider">Faculty Mentor</label>
                  <input
                    type="text"
                    value={editSession.mentorName}
                    disabled
                    className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-955 border border-slate-205 dark:border-slate-800 rounded-xl text-slate-500"
                  />
                </div>

                {/* Cohort Stream */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-405 tracking-wider">Class Group / Cohort</label>
                  <select
                    value={editSession.stream}
                    onChange={(e) => setEditSession({ ...editSession, stream: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-bold border border-slate-205 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 text-slate-700 focus:outline-indigo-500 cursor-pointer"
                  >
                    {classGroups.map(cg => (
                      <option key={cg} value={cg}>{cg}</option>
                    ))}
                    <option value="General Stream">General Stream</option>
                  </select>
                </div>

                {/* Mentor Group Area */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-405 tracking-wider">Mentor Group</label>
                  <input
                    type="text"
                    value={editSession.subject}
                    onChange={(e) => setEditSession({ ...editSession, subject: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-bold border border-slate-205 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 text-slate-700 focus:outline-indigo-500"
                  />
                </div>

                {/* Assigned SME */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-405 tracking-wider">Subject Matter Expert (SME)</label>
                  <select
                    value={editSession.smeId}
                    onChange={(e) => setEditSession({ ...editSession, smeId: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-bold border border-slate-205 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 text-slate-700 focus:outline-indigo-500 cursor-pointer"
                  >
                    {smes.map(sme => (
                      <option key={sme.id} value={sme.id}>{sme.name} ({sme.subject || "General"})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Date */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-405 tracking-wider">Date</label>
                    <input
                      type="date"
                      value={editSession.dateStr}
                      onChange={(e) => setEditSession({ ...editSession, dateStr: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs font-bold border border-slate-250 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 text-slate-700 focus:outline-indigo-500 cursor-pointer"
                    />
                  </div>

                  {/* Timeslot */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-405 tracking-wider">Time Period</label>
                    <select
                      value={editSession.timeSlot}
                      onChange={(e) => setEditSession({ ...editSession, timeSlot: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-bold border border-slate-205 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 text-slate-700 focus:outline-indigo-500 cursor-pointer"
                    >
                      {collegeTimeSlots.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {editSession.id && (
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Are you sure you want to cancel this demo session?")) {
                          deleteDemoSession(editSession.id);
                          setEditSession(null);
                        }
                      }}
                      className="text-xs font-black text-rose-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Cancel Demo Session
                    </button>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm cursor-pointer"
                  >
                    {editSession.id ? "Save Changes" : "Create Schedule"}
                  </button>
                  <button
                    type="button"
                    onClick={setEditSession.bind(null, null)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-555 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

              </form>

            </div>
          </div>
        )}

        {/* 🔹 CELL DETAILS POPUP / VIEW MENTORS DRAWER */}
        {cellPopover !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl relative animate-in zoom-in-95 duration-200 space-y-4">

              <button
                onClick={setCellPopover.bind(null, null)}
                className="absolute right-4 top-4 p-1.5 hover:bg-slate-105 dark:hover:bg-slate-855 rounded-xl text-slate-405 hover:text-slate-805 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <Calendar className="h-5 w-5 text-indigo-505" />
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-850 dark:text-white tracking-wider">
                    {cellPopover.day} ({cellPopover.dateFormatted})
                  </h3>
                  <p className="text-[10px] text-slate-405 font-bold">{cellPopover.timeSlot}</p>
                </div>
              </div>

              <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                {(() => {
                  // Filter out mentors who are not available (free, demo, preview)
                  const popoverMentors = filteredMentors.filter(mentor => {
                    const statusObj = getMentorStatusAtSlot(mentor.id, cellPopover.dateStr, cellPopover.timeSlot);
                    return statusObj.status === "free" || statusObj.status === "demo" || statusObj.status === "preview";
                  });

                  if (popoverMentors.length === 0) {
                    return (
                      <div className="text-center py-6 text-slate-400 font-bold text-xs">
                        No available or scheduled mentors in this period.
                      </div>
                    );
                  }

                  return popoverMentors.map((mentor) => {
                    const statusObj = getMentorStatusAtSlot(mentor.id, cellPopover.dateStr, cellPopover.timeSlot);
                    const isFree = statusObj.status === "free";
                    const isDemo = statusObj.status === "demo";
                    const isPreview = statusObj.status === "preview";
                    const isBlocked = statusObj.status === "blocked";

                    return (
                      <div
                        key={mentor.id}
                        onClick={() => {
                          setCellPopover(null); // close popover
                          if (isFree) {
                            setEditSession({
                              id: "",
                              mentorId: mentor.id,
                              mentorName: mentor.name,
                              smeId: smes[0]?.id || "",
                              smeName: smes[0]?.name || "",
                              dateStr: cellPopover.dateStr,
                              timeSlot: cellPopover.timeSlot,
                              subject: mentor.mentor_group || "General",
                              stream: (slots.filter(s => s.mentorId === mentor.id && s.classGroup)[0]?.classGroup) || "General Stream",
                              week: 1
                            });
                          } else if (isDemo) {
                            setEditSession(statusObj.session);
                          } else if (isPreview) {
                            toast("This is a preview draft session. Save changes to modify.", "info");
                          } else if (isBlocked) {
                            toast(`${mentor.name} is unavailable: ${statusObj.label} (${statusObj.details})`, "info");
                          } else {
                            toast(`${mentor.name} is busy teaching: ${statusObj.label} (${statusObj.group})`, "warning");
                          }
                        }}
                        className={`flex items-center justify-between p-3 rounded-xl border text-xs font-bold cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-805 ${isFree
                          ? "bg-emerald-50/20 border-emerald-100 text-emerald-800"
                          : isDemo
                            ? "bg-indigo-50/30 border-indigo-200 text-indigo-855"
                            : isPreview
                              ? "bg-amber-50/20 border-amber-200 text-amber-750"
                              : isBlocked
                                ? "bg-amber-50/10 border-amber-100/50 text-amber-600/80 cursor-not-allowed"
                                : "bg-slate-50/50 border-slate-100 text-slate-400"
                          }`}
                      >
                        <div className="space-y-0.5 text-left">
                          <span className="text-slate-850 dark:text-slate-100 block">{mentor.name}</span>
                          {!isFree && (
                            <span className="text-[9px] text-slate-455 dark:text-slate-505 font-semibold block">
                              {statusObj.label}
                            </span>
                          )}
                        </div>
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase shrink-0 ${isFree
                          ? "bg-emerald-105 text-emerald-700"
                          : isDemo
                            ? "bg-indigo-100 text-indigo-700"
                            : isPreview
                              ? "bg-amber-100 text-amber-700"
                              : isBlocked
                                ? "bg-amber-105/65 text-amber-600"
                                : "bg-slate-100 text-slate-405"
                          }`}>
                          {isFree ? "Free" : isDemo ? "Demo" : isPreview ? "Draft" : isBlocked ? "Blocked" : "Busy"}
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>

            </div>
          </div>
        )}

        {/* 🔹 SWAP REQUESTS RESOLUTION MODAL */}
        {showSwapRequestsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 w-full max-w-2xl shadow-2xl relative animate-in zoom-in-95 duration-200 space-y-5 flex flex-col max-h-[85vh]">

              <button
                onClick={() => setShowSwapRequestsModal(false)}
                className="absolute right-4 top-4 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-2 border-b border-slate-105 dark:border-slate-850 pb-3 shrink-0">
                <RefreshCw className="h-5 w-5 text-indigo-500 animate-spin-slow" />
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-855 dark:text-white tracking-wider">
                    SME Swap Requests Queue
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                    Review, pre-validate, and approve alternative demo matches
                  </p>
                </div>
              </div>

              {/* TAB SELECTOR */}
              <div className="flex border-b border-slate-100 dark:border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setSwapRequestsTab("pending")}
                  className={`flex-1 pb-2.5 text-xs font-black uppercase tracking-wider text-center border-b-2 transition-all ${swapRequestsTab === "pending" ? "border-indigo-500 text-indigo-650" : "border-transparent text-slate-400"}`}
                >
                  Pending Review ({demoSwapRequests.filter((r: any) => r.status === "pending").length})
                </button>
                <button
                  type="button"
                  onClick={() => setSwapRequestsTab("resolved")}
                  className={`flex-1 pb-2.5 text-xs font-black uppercase tracking-wider text-center border-b-2 transition-all ${swapRequestsTab === "resolved" ? "border-indigo-500 text-indigo-655" : "border-transparent text-slate-400"}`}
                >
                  Resolution Logs ({demoSwapRequests.filter((r: any) => r.status !== "pending").length})
                </button>
              </div>

              {/* CONTENT BODY */}
              <div className="flex-grow overflow-y-auto pr-1 space-y-4 py-1">
                {swapRequestsTab === "pending" ? (
                  demoSwapRequests.filter((r: any) => r.status === "pending").length > 0 ? (
                    demoSwapRequests.filter((r: any) => r.status === "pending").map((req: any) => {
                      const validation = validateProposedSwap(req);
                      return (
                        <div
                          key={req.id}
                          className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-150 dark:border-slate-800 space-y-3.5"
                        >
                          <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-2">
                            <div>
                              <span className="text-[9px] font-black uppercase text-slate-400 block">Requester SME</span>
                              <span className="text-xs font-bold text-slate-800 dark:text-white">{req.smeName}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[9px] font-black uppercase text-slate-400 block">Proposed Action</span>
                              <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-pink-450 rounded-lg text-[9px] font-black uppercase">
                                {req.swapType === "mentor" ? "Change Mentor" : "Change Slot"}
                              </span>
                            </div>
                          </div>

                          {/* Details Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div className="p-3 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-xl space-y-1">
                              <span className="text-[8.5px] font-black uppercase text-slate-400 block mb-1">Original Session</span>
                              <p className="font-bold text-slate-700 dark:text-slate-200">{req.mentorName}</p>
                              <p className="text-[10px] text-slate-500">{req.dateStr} • {req.timeSlot}</p>
                              <p className="text-[9px] text-slate-400">{req.subject} • {req.stream}</p>
                            </div>

                            <div className="p-3 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-xl space-y-1">
                              <span className="text-[8.5px] font-black uppercase text-indigo-500 block mb-1">Proposed Match</span>
                              {req.swapType === "mentor" ? (
                                <>
                                  <p className="font-bold text-indigo-650 dark:text-indigo-400">{req.proposedMentorName}</p>
                                  <p className="text-[10px] text-slate-500">{req.dateStr} • {req.timeSlot}</p>
                                  <p className="text-[9px] text-slate-450">Replacing candidate faculty</p>
                                </>
                              ) : (
                                <>
                                  <p className="font-bold text-indigo-650 dark:text-indigo-400">{req.mentorName}</p>
                                  <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">{req.proposedDateStr} • {req.proposedTimeSlot}</p>
                                  <p className="text-[9px] text-slate-450">Rescheduling date/time</p>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Reason / Remarks */}
                          <div className="bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-slate-105 dark:border-slate-800 text-xs">
                            <p className="text-[9.5px] text-slate-500"><strong>Reason:</strong> {req.reason}</p>
                            {req.remarks && (
                              <p className="text-[9.5px] text-slate-450 italic mt-1 font-medium">"{req.remarks}"</p>
                            )}
                          </div>

                          {/* Pre-validation & Resolve Actions */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                            <div className="flex items-center gap-1.5">
                              {validation.valid ? (
                                <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900 rounded-lg text-[10px] font-black uppercase flex items-center gap-1">
                                  <Check className="h-3 w-3" />
                                  Validated (No Conflicts)
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 bg-rose-50 dark:bg-rose-955/20 text-rose-700 dark:text-rose-455 border border-rose-100 dark:border-rose-900 rounded-lg text-[10px] font-black uppercase flex items-center gap-1">
                                  Clash: {validation.message}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={async () => {
                                  const res = await resolveDemoSwap(req.id, "rejected");
                                  if (res.success) {
                                    toast("Swap request rejected.", "success");
                                  } else {
                                    toast(res.message, "error");
                                  }
                                }}
                                className="px-3.5 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-150 dark:hover:bg-slate-800 text-slate-655 rounded-xl text-xs font-black transition-all cursor-pointer"
                              >
                                Reject Swap
                              </button>
                              <button
                                onClick={async () => {
                                  const res = await resolveDemoSwap(req.id, "approved");
                                  if (res.success) {
                                    toast("Swap approved and schedule updated!", "success");
                                  } else {
                                    toast(res.message, "error");
                                  }
                                }}
                                className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-xs cursor-pointer"
                              >
                                Approve Swap
                              </button>
                            </div>
                          </div>

                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-16 text-slate-400 space-y-2">
                      <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto animate-bounce" />
                      <p className="text-xs font-black uppercase tracking-wider">No pending swap requests found</p>
                      <p className="text-[10px] text-slate-405">All submitted SME requests have been processed.</p>
                    </div>
                  )
                ) : (
                  demoSwapRequests.filter((r: any) => r.status !== "pending").length > 0 ? (
                    <div className="border border-slate-150 dark:border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-850 text-slate-405 font-black uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                            <th className="p-3">SME</th>
                            <th className="p-3">Original Session</th>
                            <th className="p-3">Proposed Action</th>
                            <th className="p-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-305">
                          {demoSwapRequests.filter((r: any) => r.status !== "pending").map((req: any) => (
                            <tr key={req.id} className="hover:bg-slate-50/55 dark:hover:bg-slate-800/10">
                              <td className="p-3 font-bold">{req.smeName}</td>
                              <td className="p-3">
                                <div>{req.mentorName}</div>
                                <div className="text-[9.5px] text-slate-400">{req.dateStr} • {req.timeSlot}</div>
                              </td>
                              <td className="p-3">
                                {req.swapType === "mentor" ? (
                                  <span className="font-medium text-slate-800 dark:text-slate-200">
                                    Mentor Swap: {req.proposedMentorName}
                                  </span>
                                ) : (
                                  <span className="font-medium text-indigo-605 dark:text-indigo-400">
                                    Time Swap: {req.proposedDateStr} • {req.proposedTimeSlot}
                                  </span>
                                )}
                              </td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${req.status === "approved"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-rose-100 text-rose-700"
                                  }`}>
                                  {req.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-16 font-bold">No resolved requests logged yet.</p>
                  )
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 shrink-0">
                <button
                  onClick={() => setShowSwapRequestsModal(false)}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-550 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Close Requests
                </button>
              </div>

            </div>
          </div>
        )}



        {/* 🔹 DEMO SCHEDULE EXCEL IMPORT PREVIEW MODAL */}
        {showDemoExcelImportModal && demoImportPreview && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden font-sans animate-fade-in">

              {/* Modal Header */}
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                      Demo Schedule Excel Import Preview
                    </h3>
                    <p className="text-[11px] text-slate-500 font-semibold">
                      Target Subject Group: <strong className="text-indigo-600 dark:text-indigo-400">{demoImportPreview?.targetSubjectGroup}</strong>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDemoExcelImportModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 overflow-y-auto space-y-4 flex-1">

                {/* Metric Summary Cards */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <span className="text-[10px] font-black uppercase text-slate-400 block">Total Rows Parsed</span>
                    <span className="text-lg font-black text-slate-800 dark:text-white">{demoImportPreview?.parsed.length || 0}</span>
                  </div>

                  <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-xl">
                    <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 block">Ready to Import</span>
                    <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">{demoImportPreview?.validCount || 0}</span>
                  </div>

                  <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl">
                    <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 block">Warnings / Clashes</span>
                    <span className="text-lg font-black text-amber-700 dark:text-amber-300">{demoImportPreview?.warnings.length || 0}</span>
                  </div>
                </div>

                {/* Warning Alerts List */}
                {demoImportPreview?.warnings && demoImportPreview.warnings.length > 0 && (
                  <div className="p-3.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-xl space-y-1.5">
                    <span className="text-xs font-black text-rose-700 dark:text-rose-400 flex items-center gap-1.5 uppercase">
                      <AlertTriangle className="h-4 w-4" /> Validation Warnings ({demoImportPreview.warnings.length})
                    </span>
                    <div className="max-h-24 overflow-y-auto space-y-1 text-[11px] font-medium text-rose-600 dark:text-rose-300 pr-1">
                      {demoImportPreview.warnings.map((w, i) => (
                        <div key={i} className="flex items-start gap-1.5">
                          <span className="shrink-0 font-bold">•</span>
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Parsed Sessions Table */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <span className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                      Parsed Schedule Matrix
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      Day-of-Week mapped to active calendar week
                    </span>
                  </div>

                  <div className="overflow-x-auto max-h-60 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="p-2.5">Row</th>
                          <th className="p-2.5">Day / Date</th>
                          <th className="p-2.5">Time Slot</th>
                          <th className="p-2.5">Faculty Mentor</th>
                          <th className="p-2.5">Assigned SME</th>
                          <th className="p-2.5">Subject Group</th>
                          <th className="p-2.5">Cohort / Stream</th>
                          <th className="p-2.5 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                        {demoImportPreview?.parsed.map((item, idx) => (
                          <tr key={idx} className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors ${!item.isValid ? "bg-rose-50/30 dark:bg-rose-950/10" : ""}`}>
                            <td className="p-2.5 font-bold text-slate-400">#{item.rowNum}</td>
                            <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">
                              {item.dayName}
                              <span className="block text-[9.5px] font-medium text-slate-400">{item.dateStr}</span>
                            </td>
                            <td className="p-2.5 font-semibold text-indigo-600 dark:text-indigo-400">{item.timeSlot}</td>
                            <td className="p-2.5 font-semibold text-slate-800 dark:text-slate-200">{item.mentorName}</td>
                            <td className="p-2.5 font-semibold text-slate-800 dark:text-slate-200">{item.smeName}</td>
                            <td className="p-2.5 text-slate-600 dark:text-slate-300 font-medium">{item.subject}</td>
                            <td className="p-2.5 text-slate-500 font-medium">{item.stream}</td>
                            <td className="p-2.5 text-right">
                              {item.isValid ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-extrabold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                  <FileCheck className="h-3 w-3" /> Ready
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-extrabold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" title={item.conflictReason}>
                                  <AlertTriangle className="h-3 w-3" /> Conflict
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowDemoExcelImportModal(false)}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs border border-slate-200 cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDemoExcelImport}
                  disabled={isImportingDemoExcel || !demoImportPreview || demoImportPreview.validCount === 0}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold rounded-xl text-xs shadow-sm flex items-center gap-2 transition-all cursor-pointer"
                >
                  {isImportingDemoExcel ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Saving Allocations...
                    </>
                  ) : (
                    <>
                      <FileCheck className="h-3.5 w-3.5" />
                      Confirm &amp; Import ({demoImportPreview?.validCount || 0} Sessions)
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
        )}

        {/* 🔹 SELECT MENTOR GROUP TEMPLATE CHOOSER MODAL */}
        {showTemplateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200 font-sans">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative space-y-5">

              <button
                onClick={() => setShowTemplateModal(false)}
                className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="p-2.5 bg-[#D528A2]/10 text-[#D528A2] rounded-xl">
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                    Select Mentor Group Excel Template
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Generate Mentor Group template with real faculty mentors, SMEs, and auto-calculation formulas.
                  </p>
                </div>
              </div>

              {/* Mentor Group Selector Dropdown */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Choose Mentor Group / Department:
                </label>
                <select
                  value={templateMentorGroup || (mentorGroups[0] || "")}
                  onChange={(e) => setTemplateMentorGroup(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:ring-2 focus:ring-[#D528A2] cursor-pointer"
                >
                  {mentorGroups.map(group => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </select>
              </div>

              {/* Real-time Group Metrics Preview */}
              {(() => {
                const activeGroup = templateMentorGroup || (mentorGroups[0] || "");
                const groupIdx = Math.max(0, mentorGroups.findIndex(g => g.toLowerCase().trim() === activeGroup.toLowerCase().trim()));

                // 1. Direct count check for mentors
                const displayMentors = mentors.filter(m => {
                  if (!m) return false;
                  const target = activeGroup.toLowerCase().trim();
                  const mGroup = getMentorGroup(m).toLowerCase().trim();
                  return mGroup === target;
                });

                // 2. Direct count check for SMEs
                const displaySmes = getSmesForSubjectGroup(activeGroup);
                const leadSmeNameFromGroup = subjectGroups.find(g => g.name?.toLowerCase().trim() === activeGroup.toLowerCase().trim())?.lead_sme_name;
                const headSme = displaySmes.find((s: any) => s.is_head_sme);

                return (
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                    <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
                      {activeGroup || "Mentor Group"} Database Snapshot
                    </span>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-150 space-y-1">
                        <span className="text-[9px] font-black uppercase text-slate-400 block">Eligible Mentors</span>
                        <span className="text-sm font-black text-slate-800 dark:text-white">
                          {displayMentors.length} Faculty Mentors
                        </span>
                        <p className="text-[9.5px] text-slate-400 font-medium truncate">
                          {displayMentors.map(m => m.name).slice(0, 3).join(", ") || "Active Mentors"}
                        </p>
                      </div>

                      <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-150 space-y-1">
                        <span className="text-[9px] font-black uppercase text-slate-400 block">Assigned SMEs</span>
                        <span className="text-sm font-black text-[#D528A2]">
                          {displaySmes.length > 0 ? `${displaySmes.length} Expert SME${displaySmes.length !== 1 ? "s" : ""}` : (leadSmeNameFromGroup ? `1 Lead SME` : `0 Expert SMEs`)}
                        </span>
                        <p className="text-[9.5px] text-slate-400 font-medium truncate">
                          {displaySmes.length > 0 
                            ? (headSme ? `Head: ${headSme.name}` : displaySmes.map((s: any) => s.name).join(", "))
                            : (leadSmeNameFromGroup ? `Lead: ${leadSmeNameFromGroup}` : "Unassigned")}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Modal Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadDemoTemplate(templateMentorGroup || mentorGroups[0])}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#D528A2] to-pink-600 text-white font-extrabold rounded-xl text-xs shadow-md shadow-[#D528A2]/25 flex items-center gap-2 transition-all cursor-pointer hover:opacity-95"
                >
                  <Download className="h-4 w-4" />
                  Generate &amp; Download Template (.xlsx)
                </button>
              </div>

            </div>
          </div>
        )}


      </div>
    </div>
  );
}

