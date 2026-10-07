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
import { formatTimeLabel, getWeekDates, isTimeSlotMatch, mapDayOrderToDayName } from "../lib/utils";
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
    facultyLeaves,
    holidays,
    demoSwapRequests,
    resolveDemoSwap
  } = useApp();

  const { toast } = useToast();      // ── Leave-driven Demo Reallocation queue (L & D review) ──
  const [demoReallocations, setDemoReallocations] = useState<any[]>([]);
  const [loadingReallocations, setLoadingReallocations] = useState(false);
  const [decidingReallocId, setDecidingReallocId] = useState<string | null>(null);
  const [reallocNotesMap, setReallocNotesMap] = useState<Record<string, string>>({});

  const fetchDemoReallocations = useCallback(async () => {
    setLoadingReallocations(true);
    try {
      const res = await fetch("/api/demo-reallocations?status=all");
      const json = await res.json();
      if (json.success) setDemoReallocations(json.requests || []);
    } catch (_) {
      setDemoReallocations([]);
    } finally {
      setLoadingReallocations(false);
    }
  }, []);

  React.useEffect(() => {
    fetchDemoReallocations();
  }, [fetchDemoReallocations]);

  const decideDemoReallocation = async (requestId: string, decision: "approved" | "rejected") => {
    setDecidingReallocId(requestId);
    const notes = (reallocNotesMap[requestId] || "").trim();
    try {
      const res = await fetch("/api/demo-reallocations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resolve",
          requestId,
          decision,
          decidedBy: "L & D",
          decisionNotes: notes || undefined
        })
      });
      const json = await res.json();
      if (json.success) {
        toast(json.message || `Reallocation ${decision}.`, "success");
        setReallocNotesMap(prev => {
          const next = { ...prev };
          delete next[requestId];
          return next;
        });
        await fetchDemoReallocations();
        // Targeted refetch of demo sessions if endpoint exists, otherwise update local state
        try {
          const dsRes = await fetch("/api/demo-sessions");
          const dsJson = await dsRes.json();
          if (dsJson.success && dsJson.sessions) {
            setDemoSessions(dsJson.sessions);
          }
        } catch (_) {}
      } else {
        toast(json.message || `Failed to ${decision} reallocation`, "error");
      }
    } catch (e: any) {
      toast("Error: " + e.message, "error");
    } finally {
      setDecidingReallocId(null);
    }
  };

  // Helper to calculate semester week number from date
  const calculateWeekNumber = (dateStr: string): number => {
    try {
      const d = new Date(dateStr + "T00:00:00");
      if (isNaN(d.getTime())) return 1;
      const startOfYear = new Date(d.getFullYear(), 0, 1);
      const pastDays = (d.getTime() - startOfYear.getTime()) / 86400000;
      return Math.max(1, Math.ceil((pastDays + startOfYear.getDay() + 1) / 7));
    } catch {
      return 1;
    }
  };

  // Filters State
  const [selectedCollegeId, setSelectedCollegeId] = useState<string>("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("All");

  // Date selection - defaults dynamically to current date
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => new Date().toISOString().slice(0, 10));

  // Dynamic Week Number Selection
  const [selectedWeek, setSelectedWeek] = useState<number>(() => calculateWeekNumber(new Date().toISOString().slice(0, 10)));

  // Derived: List of 5 consecutive dates of the week containing selectedDateStr
  const currentWeekDates = useMemo(() => {
    return getWeekDates(0, selectedDateStr);
  }, [selectedDateStr]);

  // Scheduling generation states
  const [targetDemosCount, setTargetDemosCount] = useState<number>(1);
  const [previewSessions, setPreviewSessions] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<"idle" | "generating" | "done">("idle");
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showSwapRequestsModal, setShowSwapRequestsModal] = useState(false);
  const [swapRequestsTab, setSwapRequestsTab] = useState<"pending" | "resolved">("pending");

  // Excel Timetable & Allocation Import/Export States
  const [showDemoExcelImportModal, setShowDemoExcelImportModal] = useState(false);
  const [demoImportPreview, setDemoImportPreview] = useState<{ parsed: any[]; warnings: string[]; validCount: number; targetSubjectGroup: string } | null>(null);
  const [isImportingDemoExcel, setIsImportingDemoExcel] = useState(false);
  const [showExcelDropdown, setShowExcelDropdown] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateMentorGroup, setTemplateMentorGroup] = useState<string>("");
  const [templateCollegeId, setTemplateCollegeId] = useState<string>("");

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

  // Dept rules input state — local editable values before saving
  const [deptRuleInputs, setDeptRuleInputs] = useState<Record<string, number>>({});

  // Daily Configs Map (Day Orders, Holidays, Events configured by CAM)
  const [dailyConfigsMap, setDailyConfigsMap] = useState<Map<string, any>>(new Map());

  const fetchDailyConfigs = useCallback(async () => {
    try {
      const cIds = colleges.map(c => c.id).filter(Boolean);

      if (cIds.length === 0) return;

      const map = new Map<string, any>();
      await Promise.all(
        cIds.map(async (cId) => {
          try {
            const res = await fetch(`/api/daily-configs?college_id=${encodeURIComponent(cId)}&limit=500`);
            const json = await res.json();
            if (json.success && Array.isArray(json.configs)) {
              json.configs.forEach((c: any) => {
                const dStr = c.dateStr || c.datestr;
                if (dStr) {
                  const item = {
                    ...c,
                    college_id: cId,
                    dateStr: dStr,
                    day_order: c.day_order || c.dayorder || "None",
                    day_type: c.day_type || c.daytype || "working"
                  };
                  map.set(`${cId}_${dStr}`, item);
                  if (selectedCollegeId === cId || !map.has(dStr) || item.day_order !== "None") {
                    map.set(dStr, item);
                  }
                }
              });
            }
          } catch (_) {}
        })
      );
      setDailyConfigsMap(map);
    } catch (_) {}
  }, [selectedCollegeId, colleges]);

  React.useEffect(() => {
    fetchDailyConfigs();
  }, [fetchDailyConfigs]);

  // Helper to resolve detailed Day Order info for a given dateStr, weekday & college
  const getEffectiveDayOrderInfo = useCallback((dateStr: string, weekdayName: string, dayIndex: number, collegeId?: string) => {
    const collegeCfg = collegeId ? dailyConfigsMap.get(`${collegeId}_${dateStr}`) : null;
    const cfg = collegeCfg || dailyConfigsMap.get(dateStr);
    
    // Check if genuinely configured in CAM
    const isConfiguredInCam = Boolean(
      (collegeCfg && collegeCfg.day_order && collegeCfg.day_order !== "None" && collegeCfg.day_order !== "none") ||
      (!collegeId && cfg && cfg.day_order && cfg.day_order !== "None" && cfg.day_order !== "none")
    );

    const isHoliday = Boolean(
      (collegeCfg && (collegeCfg.day_type === "holiday" || collegeCfg.day_type === "event")) ||
      (!collegeId && cfg && (cfg.day_type === "holiday" || cfg.day_type === "event")) ||
      holidays.some(h => h.date === dateStr && (!h.college_id || !collegeId || h.college_id === collegeId))
    );

    let dayOrder = collegeCfg?.day_order || cfg?.day_order || cfg?.dayorder;
    const dayType = collegeCfg?.day_type || cfg?.day_type || (isHoliday ? "holiday" : "working");

    if (isHoliday) {
      dayOrder = "Holiday";
    } else if (!dayOrder || dayOrder === "None" || dayOrder === "none") {
      dayOrder = isConfiguredInCam ? dayOrder : `Day ${dayIndex + 1}`;
    }

    const effectiveTimetableDay = isHoliday ? "Holiday" : mapDayOrderToDayName(dayOrder, weekdayName);

    return {
      dayOrder,
      effectiveTimetableDay,
      weekdayName,
      dateStr,
      isHoliday,
      isConfiguredInCam,
      dayType,
      rowLabel: `${dayOrder} - ${weekdayName} (${dateStr})`,
      key: `${dayOrder}_${dateStr}`
    };
  }, [dailyConfigsMap, holidays]);

  // Helper to check Day Order configuration status for a specific college across active week dates
  const getCollegeDayOrderConfigStatus = useCallback((collegeId: string) => {
    const dates = currentWeekDates;
    const missingDates: { dateStr: string; day: string; formatted: string }[] = [];
    let configuredCount = 0;

    dates.forEach((w, idx) => {
      const info = getEffectiveDayOrderInfo(w.dateStr, w.day, idx, collegeId);
      if (info.isHoliday || info.isConfiguredInCam) {
        configuredCount++;
      } else {
        missingDates.push({ dateStr: w.dateStr, day: w.day, formatted: w.formatted || w.day });
      }
    });

    const isFullyConfigured = missingDates.length === 0;
    return {
      isFullyConfigured,
      configuredCount,
      totalDates: dates.length,
      missingDates
    };
  }, [currentWeekDates, getEffectiveDayOrderInfo]);

  // Derived: Global check if ALL applicable colleges have Day Orders configured by CM for the active week
  const allCollegesDayOrderStatus = useMemo(() => {
    const applicableColleges = colleges.filter(c => c && c.id);
    const unconfiguredColleges: { college: any; missingDates: string[] }[] = [];

    applicableColleges.forEach(c => {
      const status = getCollegeDayOrderConfigStatus(c.id);
      if (!status.isFullyConfigured) {
        unconfiguredColleges.push({
          college: c,
          missingDates: status.missingDates.map(d => `${d.day.slice(0, 3)} (${d.formatted || d.dateStr})`)
        });
      }
    });

    const isAllConfigured = applicableColleges.length > 0 && unconfiguredColleges.length === 0;

    return {
      isAllConfigured,
      applicableColleges,
      unconfiguredColleges
    };
  }, [colleges, getCollegeDayOrderConfigStatus]);

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

  // Helper: check if a faculty member (mentor/SME) is on approved faculty leave on a date
  const isFacultyOnLeave = useCallback((facultyId: string, dateStr: string) => {
    return facultyLeaves?.some(
      (fl: any) =>
        (fl.mentor_id === facultyId || fl.mentorId === facultyId) &&
        fl.status === "approved" &&
        dateStr >= fl.start_date &&
        dateStr <= fl.end_date
    );
  }, [facultyLeaves]);

  // Helper: check if an SME is free on a given date/time (checks DB collisions + dynamic configured availability windows)
  const isSmeFree = useCallback((smeId: string, dateStr: string, time: string, newlyScheduled: any[] = []) => {
    const dayName = currentWeekDates.find(w => w.dateStr === dateStr)?.day || "";

    // 1. Check if SME is on faculty leave
    if (isFacultyOnLeave(smeId, dateStr)) return false;

    // 2. Check if SME has configured custom availability windows for this weekday
    const smeWindows = (smeAvailability || []).filter(
      (a: any) => {
        if (a.sme_id !== smeId || a.is_active === 0) return false;
        const aDay = (a.day_of_week || "").toLowerCase().trim();
        const targetDay = dayName.toLowerCase().trim();
        const mappedDay = (mapDayOrderToDayName(a.day_of_week, "") || "").toLowerCase().trim();
        return aDay === targetDay || mappedDay === targetDay || aDay.startsWith(targetDay.slice(0, 3));
      }
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

    // 3. Check collision with existing confirmed demo sessions
    const databaseBusy = demoSessions.some(ds => {
      if (ds.smeId !== smeId || ds.dateStr !== dateStr) return false;
      if (ds.status === "cancelled" || ds.status === "not_conducted") return false;
      return isTimeSlotMatch(ds.timeSlot, time);
    });
    if (databaseBusy) return false;

    // 4. Check collision with preview newly scheduled sessions
    const previewBusy = newlyScheduled.some(p => {
      if (p.smeId !== smeId || p.dateStr !== dateStr) return false;
      return isTimeSlotMatch(p.timeSlot, time);
    });
    return !previewBusy;
  }, [currentWeekDates, isFacultyOnLeave, smeAvailability, demoSessions]);

  // ── Unified Participant Availability & Allocation Engine ──
  // Evaluates real availability across College Timetable, CAM Day Order, Mentor Free Time, Leave, SME Windows, and Bookings.
  const evaluateMentorSlotAvailability = useCallback((
    mentorId: string,
    dateStr: string,
    timeSlot: string,
    customCollegeId?: string,
    currentPreviews: any[] = []
  ) => {
    const mentor = mentors.find(m => m.id === mentorId);
    if (!mentor) {
      return {
        status: "unavailable",
        isAllocatable: false,
        label: "Mentor Not Found",
        details: "",
        availableSmes: []
      };
    }

    const collegeId = customCollegeId || mentor.college_id;
    const colObj = colleges.find(c => c.id === collegeId);

    // 1. Day Order & Holiday resolution from CAM dailyConfigsMap
    const dayObj = currentWeekDates.find(w => w.dateStr === dateStr);
    const weekdayName = dayObj?.day || "";
    const dayIndex = Math.max(0, currentWeekDates.findIndex(w => w.dateStr === dateStr));
    const dayInfo = getEffectiveDayOrderInfo(dateStr, weekdayName, dayIndex, collegeId);

    if (dayInfo.isHoliday) {
      return {
        status: "blocked",
        isAllocatable: false,
        label: "Campus Holiday",
        details: `${colObj?.name || "Campus"} Holiday (Closed)`,
        availableSmes: []
      };
    }

    if (!dayInfo.isConfiguredInCam) {
      return {
        status: "blocked",
        isAllocatable: false,
        label: "Day Order Unset",
        details: "Day Order not configured by CM in daily configs",
        availableSmes: []
      };
    }

    // 2. Mentor Faculty Leave check
    if (isFacultyOnLeave(mentorId, dateStr)) {
      return {
        status: "blocked",
        isAllocatable: false,
        label: "On Leave",
        details: "Faculty Leave Approved",
        availableSmes: []
      };
    }

    // 3. Existing Demo Session in database check
    const existingDemo = demoSessions.find(ds => {
      if (ds.mentorId !== mentorId || ds.dateStr !== dateStr) return false;
      if (ds.status === "cancelled" || ds.status === "not_conducted") return false;
      return isTimeSlotMatch(ds.timeSlot, timeSlot);
    });
    if (existingDemo) {
      return {
        status: "demo",
        isAllocatable: false,
        label: `Demo: ${existingDemo.subject}`,
        details: `SME: ${existingDemo.smeName}`,
        session: existingDemo,
        availableSmes: []
      };
    }

    // 4. Preview draft session check
    const previewDemo = currentPreviews.find(p => {
      if (p.mentorId !== mentorId || p.dateStr !== dateStr) return false;
      return isTimeSlotMatch(p.timeSlot, timeSlot);
    });
    if (previewDemo) {
      return {
        status: "preview",
        isAllocatable: false,
        label: `Preview: ${previewDemo.subject}`,
        details: `SME: ${previewDemo.smeName}`,
        session: previewDemo,
        availableSmes: []
      };
    }

    // 5. College Timetable Teaching Class check
    const effectiveDay = dayInfo.effectiveTimetableDay.toLowerCase().trim();
    const dayOrderStr = (dayInfo.dayOrder || "").toLowerCase().trim();

    const teachSlot = slots.find(s => {
      if (s.mentorId !== mentorId) return false;
      const sDay = (s.day || "").toLowerCase().trim();
      const mappedSlotDay = (mapDayOrderToDayName(s.day, "") || "").toLowerCase().trim();

      const dayMatches =
        (dayOrderStr && sDay === dayOrderStr) ||
        (effectiveDay && sDay === effectiveDay) ||
        (mappedSlotDay && effectiveDay && mappedSlotDay === effectiveDay) ||
        (effectiveDay && sDay.startsWith(effectiveDay.slice(0, 3)));

      if (!dayMatches) return false;
      return isTimeSlotMatch(s.time, timeSlot);
    });

    if (teachSlot) {
      return {
        status: "occupied",
        isAllocatable: false,
        label: teachSlot.course,
        group: teachSlot.classGroup,
        details: `Class in ${teachSlot.location || "Room"}`,
        availableSmes: []
      };
    }

    // 6. Mentor is timetable-free. Now check qualified SME availability for mentor's subject group
    const mentorGroup = getMentorGroup(mentor);
    const eligibleSmes = getSmesForSubjectGroup(mentorGroup);
    const availableSmes = eligibleSmes.filter(sme => isSmeFree(sme.id, dateStr, timeSlot, currentPreviews));

    if (availableSmes.length === 0) {
      return {
        status: "sme_unavailable",
        isAllocatable: false,
        label: "No SME Available",
        details: eligibleSmes.length === 0
          ? `No SME registered for ${mentorGroup}`
          : `All ${eligibleSmes.length} SME(s) busy/outside availability window`,
        availableSmes: [],
        mentorGroup
      };
    }

    return {
      status: "free",
      isAllocatable: true,
      label: "Available",
      details: `${availableSmes.length} SME(s) free`,
      availableSmes,
      mentorGroup
    };
  }, [mentors, colleges, currentWeekDates, getEffectiveDayOrderInfo, isFacultyOnLeave, demoSessions, slots, getMentorGroup, getSmesForSubjectGroup, isSmeFree]);

  // Backwards-compatible alias for existing callers
  const getMentorStatusAtSlot = useCallback((mentorId: string, dateStr: string, dbTimeSlot: string, currentPreviews: any[] = []) => {
    return evaluateMentorSlotAvailability(mentorId, dateStr, dbTimeSlot, undefined, currentPreviews);
  }, [evaluateMentorSlotAvailability]);

  // Helper: check if a class group (stream) is free on a given date/time
  const isGroupFree = (groupName: string, dateStr: string, time: string) => {
    const dayName = currentWeekDates.find(w => w.dateStr === dateStr)?.day || "";
    const hasClass = slots.some(s => s.classGroup === groupName && s.day === dayName && s.time === time);
    if (hasClass) return false;

    const hasDemo = demoSessions.some(ds => ds.stream === groupName && ds.dateStr === dateStr && ds.timeSlot === time);
    return !hasDemo;
  };

  // Derived: Total available free slots for the filtered mentors over the selected dates (excluding holidays)
  const totalFreeSlotsCount = useMemo(() => {
    let count = 0;
    currentWeekDates.forEach(date => {
      if (holidays.some(h => h.date === date.dateStr)) return;
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
  }, [filteredMentors, currentWeekDates, collegeTimeSlots, holidays]);

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

    const isMentorSwap = req.swapType === "mentor" || req.swapType === "internal";
    const isTimeSwap = req.swapType === "time" || req.swapType === "reallocation";

    if (isMentorSwap) {
      const targetMentorId = req.proposedMentorId || req.mentorId;
      const targetMentorName = req.proposedMentorName || req.mentorName;
      const mentorStatus = getMentorStatusAtSlot(targetMentorId, req.dateStr, req.timeSlot);
      if (mentorStatus.status !== "free") {
        return { valid: false, message: `Mentor ${targetMentorName} is busy: ${mentorStatus.label || mentorStatus.details}` };
      }

      const dailyLoad = demoSessions.filter(ds => ds.mentorId === targetMentorId && ds.dateStr === req.dateStr).length;
      if (dailyLoad >= 2) {
        return { valid: false, message: `Mentor ${targetMentorName} daily load exceeds limit (2/day).` };
      }

      if (checkConsecutiveHardClash(targetMentorId, false, req.dateStr, req.timeSlot)) {
        return { valid: false, message: `Mentor ${targetMentorName} consecutive limit exceeded.` };
      }

      return { valid: true, message: "Conflict-Free Match" };

    } else if (isTimeSwap) {
      const targetDate = req.proposedDateStr || req.dateStr;
      const targetTime = req.proposedTimeSlot || req.timeSlot;
      const targetSmeId = req.proposedSmeId || req.smeId;

      const isHoliday = holidays.some(h => h.date === targetDate);
      if (isHoliday) return { valid: false, message: `Proposed date is a holiday.` };

      const mentorStatus = getMentorStatusAtSlot(req.mentorId, targetDate, targetTime);
      if (mentorStatus.status !== "free") {
        return { valid: false, message: `Mentor ${req.mentorName} is busy: ${mentorStatus.label || mentorStatus.details}` };
      }

      if (!isSmeFree(targetSmeId, targetDate, targetTime)) {
        return { valid: false, message: `SME ${req.smeName} is busy.` };
      }

      if (!isGroupFree(req.stream, targetDate, targetTime)) {
        return { valid: false, message: `Group stream ${req.stream} is busy.` };
      }

      const mentorDailyLoad = demoSessions.filter(ds => ds.mentorId === req.mentorId && ds.dateStr === targetDate).length;
      if (mentorDailyLoad >= 2) {
        return { valid: false, message: `Mentor ${req.mentorName} daily load exceeds limit (2/day).` };
      }

      const smeDailyLoad = demoSessions.filter(ds => ds.smeId === targetSmeId && ds.dateStr === targetDate).length;
      if (smeDailyLoad >= 2) {
        return { valid: false, message: `SME ${req.smeName} daily load exceeds limit (2/day).` };
      }

      if (checkConsecutiveHardClash(req.mentorId, false, targetDate, targetTime)) {
        return { valid: false, message: `Mentor ${req.mentorName} consecutive limit exceeded.` };
      }
      if (checkConsecutiveHardClash(targetSmeId, true, targetDate, targetTime)) {
        return { valid: false, message: `SME ${req.smeName} consecutive limit exceeded.` };
      }

      return { valid: true, message: "Conflict-Free Match" };
    }

    return { valid: false, message: "Unsupported swap type." };
  };

  // ── Excel Timetable Slot SME Auto-Assigner (Rule Engine) ──
  // Takes uploaded timetable slots (or target mentor slots) and automatically
  // assigns qualified, conflict-free SMEs as per configured department rules.
  const autoAssignSmesToSlots = useCallback((targetSlots: any[], previousAllocations: any[] = []) => {
    const generated: any[] = [];
    const exceptions: any[] = [];

    if (!targetSlots || targetSlots.length === 0) {
      return { generated, exceptions };
    }

    targetSlots.forEach((slotInput, idx) => {
      const mentorId = slotInput.mentorId;
      const mentorName = slotInput.mentorName || mentors.find(m => m.id === mentorId)?.name || "Mentor";
      const dateStr = slotInput.dateStr;
      const timeSlot = slotInput.timeSlot;
      const subjectGroup = (slotInput.subject || getMentorGroup(mentors.find(m => m.id === mentorId)) || "General").trim();
      const stream = slotInput.stream || "General Stream";
      const week = slotInput.week || selectedWeek || 1;
      const preAssignedSmeId = slotInput.smeId;
      const preAssignedSmeName = slotInput.smeName;

      // 1. Check if date is a holiday
      const isHol = holidays.some(h => h.date === dateStr);
      if (isHol) {
        exceptions.push({
          id: "exc_hol_" + idx + "_" + Date.now(),
          mentorId,
          mentorName,
          subject: subjectGroup,
          stream,
          reason: "Holiday Conflict",
          recommendation: `Date ${dateStr} is a college holiday. Upload timetable slots on working days.`
        });
        return;
      }

      // 2. Check if mentor is on approved leave or teaching a class
      if (isFacultyOnLeave(mentorId, dateStr)) {
        exceptions.push({
          id: "exc_mleave_" + idx + "_" + Date.now(),
          mentorId,
          mentorName,
          subject: subjectGroup,
          stream,
          reason: "Mentor Leave Conflict",
          recommendation: `Mentor ${mentorName} is on approved faculty leave on ${dateStr}.`
        });
        return;
      }

      const mentorStatus = getMentorStatusAtSlot(mentorId, dateStr, timeSlot, [...generated, ...previousAllocations]);
      if (mentorStatus.status !== "free" && mentorStatus.status !== "preview") {
        exceptions.push({
          id: "exc_mbusy_" + idx + "_" + Date.now(),
          mentorId,
          mentorName,
          subject: subjectGroup,
          stream,
          reason: "Mentor Timetable Conflict",
          recommendation: `Mentor ${mentorName} is occupied: ${mentorStatus.label || mentorStatus.details} at ${timeSlot} on ${dateStr}.`
        });
        return;
      }

      // 3. If pre-assigned SME is provided in Excel, validate them first
      if (preAssignedSmeId) {
        const smeObj = smes.find(s => s.id === preAssignedSmeId || s.name.toLowerCase() === (preAssignedSmeName || "").toLowerCase());
        if (smeObj) {
          const isSmeLeave = isFacultyOnLeave(smeObj.id, dateStr);
          const isFree = isSmeFree(smeObj.id, dateStr, timeSlot, [...generated, ...previousAllocations]);

          if (!isSmeLeave && isFree) {
            generated.push({
              mentorId,
              mentorName,
              collegeName: slotInput.collegeName || currentCollege?.name || "College",
              smeId: smeObj.id,
              smeName: smeObj.name,
              dateStr,
              timeSlot,
              subject: subjectGroup,
              stream,
              week
            });
            return;
          }
        }
      }

      // 4. Rule-Based Auto-Assignment: Find qualified SME for this subject & slot
      const eligibleSmes = getSmesForSubjectGroup(subjectGroup);

      if (eligibleSmes.length === 0) {
        exceptions.push({
          id: "exc_nosme_" + idx + "_" + Date.now(),
          mentorId,
          mentorName,
          subject: subjectGroup,
          stream,
          reason: "No Qualified SME",
          recommendation: `No SME registered with subject expertise for '${subjectGroup}'. Register an SME or update subject mapping.`
        });
        return;
      }

      // Score candidates based on rules
      interface SmeCandidate {
        sme: any;
        score: number;
      }
      const candidates: SmeCandidate[] = [];

      eligibleSmes.forEach(sme => {
        // Must not be on faculty leave
        if (isFacultyOnLeave(sme.id, dateStr)) return;

        // Must be free at slot time
        if (!isSmeFree(sme.id, dateStr, timeSlot, [...generated, ...previousAllocations])) return;

        // Daily cap check (max 2/day)
        const existingSmeDemos = [
          ...demoSessions.filter(ds => ds.smeId === sme.id && ds.dateStr === dateStr && ds.status !== "not_conducted" && ds.status !== "cancelled"),
          ...previousAllocations.filter(pa => pa.smeId === sme.id && pa.dateStr === dateStr),
          ...generated.filter(g => g.smeId === sme.id && g.dateStr === dateStr)
        ].length;
        if (existingSmeDemos >= 2) return;

        // Consecutive hard clash (3 consecutive)
        if (checkConsecutiveHardClash(sme.id, true, dateStr, timeSlot, [...generated, ...previousAllocations])) return;

        let score = 0;
        const isHeadSme = sme.is_head_sme === 1 || sme.head_subject_group === subjectGroup;
        if (isHeadSme) score += 50; // Priority boost for Head SME

        if (sme.subject?.toLowerCase().trim() === subjectGroup.toLowerCase().trim()) score += 30; // Direct subject match

        const smeWeeklyLoad = generated.filter(g => g.smeId === sme.id).length;
        score += Math.max(0, 20 - (smeWeeklyLoad * 4)); // Load balancing

        // Soft consecutive check penalty
        const hasConsecutive = checkHasSingleConsecutive(sme.id, true, dateStr, timeSlot, [...generated, ...previousAllocations]);
        if (hasConsecutive) score -= 15;

        score += Math.random() * 0.01;

        candidates.push({ sme, score });
      });

      if (candidates.length > 0) {
        candidates.sort((a, b) => b.score - a.score);
        const best = candidates[0].sme;

        generated.push({
          mentorId,
          mentorName,
          collegeName: slotInput.collegeName || currentCollege?.name || "College",
          smeId: best.id,
          smeName: best.name,
          dateStr,
          timeSlot,
          subject: subjectGroup,
          stream,
          week
        });
      } else {
        exceptions.push({
          id: "exc_clash_" + idx + "_" + Date.now(),
          mentorId,
          mentorName,
          subject: subjectGroup,
          stream,
          reason: "SME Availability / Capacity Conflict",
          recommendation: `All SMEs for '${subjectGroup}' are occupied or on leave at ${timeSlot} on ${dateStr}. Adjust slot or assign manually.`
        });
      }
    });

    return { generated, exceptions };
  }, [mentors, smes, demoSessions, holidays, facultyLeaves, selectedWeek, currentCollege, isFacultyOnLeave, isSmeFree, checkConsecutiveHardClash, checkHasSingleConsecutive, getSmesForSubjectGroup, getMentorGroup]);

  const handleTriggerGenerate = () => {
    if (!selectedCollegeId) {
      toast("Please select a college first", "error");
      return;
    }

    // Build target slots from mentors' free availability windows or imported slots
    const targetSlots: any[] = [];
    const datesToSchedule = currentWeekDates
      .map(w => w.dateStr)
      .filter(dateStr => !holidays.some(h => h.date === dateStr));

    filteredMentors.forEach(mentor => {
      const subjectGroup = getMentorGroup(mentor);
      const mentorClasses = slots.filter(s => s.mentorId === mentor.id && s.classGroup);
      const stream = (mentorClasses.length > 0 ? mentorClasses[0].classGroup : null) || "General Stream";

      datesToSchedule.forEach(dateStr => {
        collegeTimeSlots.forEach(timeSlot => {
          if (timeSlot.toLowerCase().includes("lunch") || timeSlot.toLowerCase().includes("break")) return;
          const status = getMentorStatusAtSlot(mentor.id, dateStr, timeSlot);
          if (status.status === "free") {
            targetSlots.push({
              mentorId: mentor.id,
              mentorName: mentor.name,
              collegeName: currentCollege?.name || "College",
              dateStr,
              timeSlot,
              subject: subjectGroup,
              stream,
              week: selectedWeek
            });
          }
        });
      });
    });

    if (targetSlots.length === 0) {
      toast("No free timetable slots found to auto-assign SMEs.", "warning");
      return;
    }

    const prevSessions = [...previewSessions];
    setPreviewSessions([]);
    setExceptions([]);
    setGenerationStep("generating");
    setIsGenerating(true);
    setShowPreviewModal(true);

    setTimeout(() => {
      const { generated, exceptions } = autoAssignSmesToSlots(targetSlots, prevSessions);
      setPreviewSessions(generated);
      setExceptions(exceptions);
      setGenerationStep("done");
      setIsGenerating(false);

      if (generated.length === 0 && exceptions.length === 0) {
        toast("No SME assignments could be made. SMEs may be fully occupied.", "warning");
      } else if (exceptions.length > 0) {
        toast(`Auto-assigned SMEs for ${generated.length} slots. ${exceptions.length} unassigned due to rules/conflicts.`, "warning");
      } else {
        toast(`Successfully auto-assigned SMEs for ${generated.length} timetable slots as per rules!`, "success");
      }
    }, 800);
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

  const handleOpenTemplateModal = () => {
    fetchDailyConfigs();
    setShowTemplateModal(true);
  };

  const handleDownloadDemoTemplate = async (targetGroupInput?: string) => {
    // 1. Strict Day Order Configuration Gate for All Applicable Colleges
    if (!allCollegesDayOrderStatus.isAllConfigured) {
      const unconfiguredNames = allCollegesDayOrderStatus.unconfiguredColleges
        .map(u => `${u.college.name} (missing: ${u.missingDates.join(", ")})`)
        .join("; ");
      toast(`Template download blocked: Day Order has not been configured by Campus Managers for: ${unconfiguredNames}. Please configure Day Orders first in CAM Console.`, "error");
      return;
    }

    const targetGroup = targetGroupInput || (selectedGroupId && selectedGroupId !== "All" ? selectedGroupId : "All");

    const applicableColleges = colleges.filter(c => c && c.id);
    if (applicableColleges.length === 0) {
      toast("No colleges configured in database.", "warning");
      return;
    }

    // Filter mentors: if specific group selected, filter by that group, otherwise include all mentors across all colleges
    const relevantMentors = targetGroup !== "All"
      ? mentors.filter(m => getMentorGroup(m).toLowerCase().trim() === targetGroup.toLowerCase().trim())
      : mentors;

    // Filter SMEs: if specific group selected, filter by that group, otherwise include all SMEs
    const relevantSmes = targetGroup !== "All"
      ? getSmesForSubjectGroup(targetGroup)
      : smes;

    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Zentra Timetable Engine - L & D";

    // Helper to get actual college working hours, start time, end time, and campus name
    const getCollegeTimingInfo = (collegeId?: string) => {
      const col = colleges.find(c => c.id === collegeId);
      const collegeName = col?.name || "Campus";
      const campusSlotsList = new Set<string>();

      slots.filter(s => s.college_id === collegeId && s.time).forEach(s => {
        const clean = s.time.trim();
        if (clean && !clean.toLowerCase().includes("lunch") && !clean.toLowerCase().includes("break")) {
          campusSlotsList.add(clean);
        }
      });

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
        return { collegeName, startTime, endTime, workingHours: `${startTime} - ${endTime}` };
      }

      const startTime = col?.start_time || "08:30 AM";
      const endTime = "04:30 PM";
      return { collegeName, startTime, endTime, workingHours: `${startTime} - ${endTime}` };
    };

    // Helper to get exact time slots for a specific college
    const getCollegeSpecificSlots = (collegeId?: string) => {
      const col = colleges.find(c => c.id === collegeId);
      const campusSlotsList = new Set<string>();

      if (collegeId) {
        slots.filter(s => s.college_id === collegeId && s.time).forEach(s => {
          const clean = s.time.trim();
          if (clean && !clean.toLowerCase().includes("lunch") && !clean.toLowerCase().includes("break")) {
            campusSlotsList.add(clean);
          }
        });
      }

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
      if (sortedSlots.length > 0) return sortedSlots;

      return [
        "08:30 AM - 09:30 AM",
        "09:30 AM - 10:30 AM",
        "10:30 AM - 11:30 AM",
        "11:30 AM - 12:30 PM",
        "01:30 PM - 02:30 PM",
        "02:30 PM - 03:30 PM"
      ];
    };

    // Helper to calculate free periods for a mentor on a specific Day Order & date based solely on their timetable & college Day Order
    const getMentorDayFreePeriods = (mentorId: string, collegeId?: string, targetDateStr?: string, weekdayName?: string, dayIndex?: number) => {
      const mDayInfo = getEffectiveDayOrderInfo(targetDateStr || "", weekdayName || "", dayIndex || 0, collegeId);
      if (mDayInfo.isHoliday) {
        return "Campus Holiday (Closed)";
      }
      const mentorSlots = getCollegeSpecificSlots(collegeId);
      const freeList: string[] = [];
      const targetDate = targetDateStr;

      mentorSlots.forEach((slot, sIdx) => {
        const isLunchOrBreak = slot.toLowerCase().includes("lunch") || slot.toLowerCase().includes("break");
        if (isLunchOrBreak) return;

        const hasClass = slots.some(s => {
          if (s.mentorId !== mentorId) return false;
          const sDay = (s.day || "").toLowerCase().trim();
          const targetEffDay = mDayInfo.effectiveTimetableDay.toLowerCase().trim();
          const targetDayOrder = (mDayInfo.dayOrder || "").toLowerCase().trim();
          const mappedSlotDay = (mapDayOrderToDayName(s.day, "") || "").toLowerCase().trim();
          const mappedTargetDayOrder = (mapDayOrderToDayName(mDayInfo.dayOrder, "") || "").toLowerCase().trim();

          const dayMatches = 
            (targetDayOrder && sDay === targetDayOrder) ||
            (targetEffDay && sDay === targetEffDay) ||
            (mappedSlotDay && targetEffDay && mappedSlotDay === targetEffDay) ||
            (mappedTargetDayOrder && sDay === mappedTargetDayOrder) ||
            (targetEffDay && sDay.startsWith(targetEffDay.slice(0, 3)));

          if (!dayMatches) return false;
          return isTimeSlotMatch(s.time, slot);
        });
        const isBlocked = targetDate ? isFacultyOnLeave(mentorId, targetDate) : facultyLeaves?.some((fl: any) => (fl.mentor_id === mentorId || fl.mentorId === mentorId) && fl.status === "approved");

        if (!hasClass && !isBlocked) {
          freeList.push(`P${sIdx + 1} (${slot})`);
        }
      });

      return freeList.length > 0 ? freeList.join(", ") : "No Free Periods (Fully Booked)";
    };

    // Helper to calculate weekly free overview across all week days based on each mentor's college Day Orders
    const getMentorWeeklyFreeSummary = (mentorId: string, collegeId?: string) => {
      const mentorSlots = getCollegeSpecificSlots(collegeId);
      const parts: string[] = [];
      let totalFreeCount = 0;

      currentWeekDates.forEach((w, idx) => {
        const mDayInfo = getEffectiveDayOrderInfo(w.dateStr, w.day, idx, collegeId);
        if (mDayInfo.isHoliday) {
          parts.push(`${w.day.slice(0, 3)}: Holiday`);
          return;
        }
        const freePeriodNums: number[] = [];
        const targetDate = mDayInfo.dateStr;

        mentorSlots.forEach((slot, sIdx) => {
          const isLunchOrBreak = slot.toLowerCase().includes("lunch") || slot.toLowerCase().includes("break");
          if (isLunchOrBreak) return;

          const hasClass = slots.some(s => {
            if (s.mentorId !== mentorId) return false;
            const sDay = (s.day || "").toLowerCase().trim();
            const targetEffDay = mDayInfo.effectiveTimetableDay.toLowerCase().trim();
            const targetDayOrder = mDayInfo.dayOrder.toLowerCase().trim();
            const mappedSlotDay = (mapDayOrderToDayName(s.day, "") || "").toLowerCase().trim();
            const mappedTargetDayOrder = (mapDayOrderToDayName(mDayInfo.dayOrder, "") || "").toLowerCase().trim();

            const dayMatches = 
              (targetDayOrder && sDay === targetDayOrder) ||
              (targetEffDay && sDay === targetEffDay) ||
              (mappedSlotDay && targetEffDay && mappedSlotDay === targetEffDay) ||
              (mappedTargetDayOrder && sDay === mappedTargetDayOrder) ||
              (targetEffDay && sDay.startsWith(targetEffDay.slice(0, 3)));

            if (!dayMatches) return false;
            return isTimeSlotMatch(s.time, slot);
          });
          const isBlocked = targetDate ? isFacultyOnLeave(mentorId, targetDate) : facultyLeaves?.some((fl: any) => (fl.mentor_id === mentorId || fl.mentorId === mentorId) && fl.status === "approved");

          if (!hasClass && !isBlocked) {
            freePeriodNums.push(sIdx + 1);
            totalFreeCount++;
          }
        });

        if (freePeriodNums.length > 0) {
          parts.push(`${mDayInfo.dayOrder} (${mDayInfo.weekdayName.slice(0, 3)}): P${freePeriodNums.join(",")}`);
        } else {
          parts.push(`${mDayInfo.dayOrder} (${mDayInfo.weekdayName.slice(0, 3)}): Busy`);
        }
      });

      return parts.length > 0 ? `${parts.join(" • ")} (${totalFreeCount} free periods/wk)` : "Fully Occupied";
    };

    // Helper function to convert 1-based column index to Excel column letters
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
    // HIDDEN REFERENCE SHEET: Free Mentors per College, Day Order & Period Slot
    // ─────────────────────────────────────────────────────────────────────────
    const wsRef = workbook.addWorksheet("Free_Periods_Ref");
    wsRef.state = "hidden";

    let refColCounter = 1;
    const cellValidationRanges: Record<string, string> = {};

    applicableColleges.forEach(colObj => {
      const collegeMentors = relevantMentors.filter(m => m.college_id === colObj.id);
      const collegeSlots = getCollegeSpecificSlots(colObj.id);

      currentWeekDates.forEach((w, dayIdx) => {
        const dayInfo = getEffectiveDayOrderInfo(w.dateStr, w.day, dayIdx, colObj.id);
        const targetDate = dayInfo.dateStr;

        collegeSlots.forEach((slot) => {
          const freeMentorsForSlot = collegeMentors.filter(m => {
            if (dayInfo.isHoliday) return false;
            const hasClass = slots.some(s => {
              if (s.mentorId !== m.id) return false;
              const sDay = (s.day || "").toLowerCase().trim();
              const targetEffDay = dayInfo.effectiveTimetableDay.toLowerCase().trim();
              const targetDayOrder = dayInfo.dayOrder.toLowerCase().trim();
              const mappedSlotDay = (mapDayOrderToDayName(s.day, "") || "").toLowerCase().trim();
              const mappedTargetDayOrder = (mapDayOrderToDayName(dayInfo.dayOrder, "") || "").toLowerCase().trim();

              const dayMatches = 
                (targetDayOrder && sDay === targetDayOrder) ||
                (targetEffDay && sDay === targetEffDay) ||
                (mappedSlotDay && targetEffDay && mappedSlotDay === targetEffDay) ||
                (mappedTargetDayOrder && sDay === mappedTargetDayOrder) ||
                (targetEffDay && sDay.startsWith(targetEffDay.slice(0, 3)));

              if (!dayMatches) return false;
              return isTimeSlotMatch(s.time, slot);
            });
            const isBlocked = targetDate ? isFacultyOnLeave(m.id, targetDate) : facultyLeaves?.some((fl: any) => (fl.mentor_id === m.id || fl.mentorId === m.id) && fl.status === "approved");
            return !hasClass && !isBlocked;
          });

          const colLetter = getColLetter(refColCounter);
          const valKey = `${colObj.id}_${dayInfo.key}_${slot}`;
          wsRef.getCell(`${colLetter}1`).value = valKey;

          if (freeMentorsForSlot.length > 0) {
            freeMentorsForSlot.forEach((m, idx) => {
              wsRef.getCell(`${colLetter}${idx + 2}`).value = `${m.name} (${m.mentor_group || "General"})`;
            });
            const endRow = freeMentorsForSlot.length + 1;
            cellValidationRanges[valKey] = `'Free_Periods_Ref'!$${colLetter}$2:$${colLetter}$${endRow}`;
          } else {
            wsRef.getCell(`${colLetter}2`).value = "(No Mentors Free at this slot)";
            cellValidationRanges[valKey] = `'Free_Periods_Ref'!$${colLetter}$2:$${colLetter}$2`;
          }

          refColCounter++;
        });
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // SHEET 1: Master Demo Schedule (Bulk Multi-College Entry Table)
    // ─────────────────────────────────────────────────────────────────────────
    const wsMaster = workbook.addWorksheet("Master_Demo_Schedule");
    const masterHeaders = [
      "College / Campus",
      "Faculty / Mentor",
      "Department / Subject Group",
      "Day / Date",
      "Time Slot / Period",
      "Assigned SME (Optional)",
      "Class Cohort / Stream",
      "Week Number"
    ];
    const masterHeadRow = wsMaster.addRow(masterHeaders);
    masterHeadRow.height = 28;
    masterHeadRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
    masterHeadRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "D528A2" } }; // Signature Magenta
    masterHeadRow.alignment = { vertical: "middle", horizontal: "center" };

    // Pre-populate sample rows across all applicable colleges
    applicableColleges.forEach(colObj => {
      const colMentors = relevantMentors.filter(m => m.college_id === colObj.id);
      const colSlots = getCollegeSpecificSlots(colObj.id);
      const sampleMentors = colMentors.slice(0, 2);

      sampleMentors.forEach((m, mIdx) => {
        const wIdx = mIdx % currentWeekDates.length;
        const w = currentWeekDates[wIdx];
        const dayInfo = getEffectiveDayOrderInfo(w.dateStr, w.day, wIdx, colObj.id);
        const slot = colSlots[mIdx % colSlots.length] || "08:30 AM - 09:30 AM";
        const mGroup = getMentorGroup(m);
        const eligibleSme = getSmesForSubjectGroup(mGroup)[0];

        const row = wsMaster.addRow([
          colObj.name,
          m.name,
          mGroup,
          `${dayInfo.dayOrder} - ${w.day} (${w.dateStr})`,
          slot,
          eligibleSme ? eligibleSme.name : "",
          "General Stream",
          selectedWeek || 1
        ]);
        row.height = 22;
        for (let c = 1; c <= 8; c++) {
          row.getCell(c).font = { name: "Arial", size: 9.5 };
          row.getCell(c).border = {
            top: { style: 'thin', color: { argb: 'E2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
            left: { style: 'thin', color: { argb: 'E2E8F0' } },
            right: { style: 'thin', color: { argb: 'E2E8F0' } }
          };
        }
      });
    });

    [30, 26, 24, 30, 24, 24, 20, 14].forEach((w, i) => { wsMaster.getColumn(i + 1).width = w; });

    // ─────────────────────────────────────────────────────────────────────────
    // PER-COLLEGE GRID SHEETS: Dynamic Timetable Matrix for each College
    // ─────────────────────────────────────────────────────────────────────────
    applicableColleges.forEach(colObj => {
      const colMentors = relevantMentors.filter(m => m.college_id === colObj.id);
      const colSlots = getCollegeSpecificSlots(colObj.id);
      const colDaysWithOrder = currentWeekDates.map((w, idx) => getEffectiveDayOrderInfo(w.dateStr, w.day, idx, colObj.id));

      const safeSheetName = `Grid_${colObj.name.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 25)}`;
      const wsGrid = workbook.addWorksheet(safeSheetName);

      const gridHeaders = ["Day Order / Period", ...colSlots.map((ts, i) => `Period ${i + 1} (${ts})`)];
      const gridHeaderRow = wsGrid.addRow(gridHeaders);
      gridHeaderRow.height = 28;
      gridHeaderRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
      gridHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "4F46E5" } }; // Indigo Header
      gridHeaderRow.alignment = { vertical: "middle", horizontal: "center" };

      wsGrid.getColumn(1).width = 32;
      for (let c = 2; c <= colSlots.length + 1; c++) {
        wsGrid.getColumn(c).width = 28;
      }

      colDaysWithOrder.forEach((dayInfo) => {
        const rowData: string[] = [dayInfo.rowLabel];
        colSlots.forEach(() => {
          rowData.push(dayInfo.isHoliday ? "Campus Holiday (Closed)" : "");
        });

        const row = wsGrid.addRow(rowData);
        row.height = 24;
        for (let c = 1; c <= colSlots.length + 1; c++) {
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

      const gridEndRow = colDaysWithOrder.length + 1;

      // Add Data Validation dropdowns to Grid cells
      for (let r = 2; r <= gridEndRow; r++) {
        const dayInfo = colDaysWithOrder[r - 2];
        if (dayInfo.isHoliday) continue;

        for (let c = 2; c <= colSlots.length + 1; c++) {
          const slotName = colSlots[c - 2];
          const valKey = `${colObj.id}_${dayInfo.key}_${slotName}`;
          const valRange = cellValidationRanges[valKey] || `'Eligible_Mentors'!$B$2:$B$100`;

          const cell = wsGrid.getCell(r, c);
          cell.dataValidation = {
            type: "list",
            allowBlank: true,
            formulae: [valRange]
          };
        }
      }

      // Add Summary Table at bottom of college grid
      const summaryStartRow = gridEndRow + 3;
      const lastColLetter = String.fromCharCode(64 + colSlots.length + 1);

      const summaryHeaderRow = wsGrid.getRow(summaryStartRow);
      summaryHeaderRow.values = ["Faculty Mentor", "Target Demos/Wk", "Scheduled Demos", "Validation Status"];
      summaryHeaderRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
      summaryHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "374151" } };
      summaryHeaderRow.alignment = { vertical: "middle", horizontal: "center" };
      summaryHeaderRow.height = 24;

      const maxMentorsToSummarize = Math.max(5, colMentors.length);
      for (let idx = 0; idx < maxMentorsToSummarize; idx++) {
        const m = colMentors[idx];
        const rNum = summaryStartRow + 1 + idx;
        const row = wsGrid.getRow(rNum);
        row.height = 20;

        if (m) {
          const customTarget = mentorTargets[m.id] !== undefined
            ? mentorTargets[m.id]
            : (demoRules?.find(r => r.subject?.toLowerCase().trim() === getMentorGroup(m).toLowerCase().trim())?.target || 1);

          row.getCell(1).value = m.name;
          row.getCell(1).font = { name: "Arial", size: 9.5, bold: true };

          row.getCell(2).value = customTarget;
          row.getCell(2).font = { name: "Arial", size: 9.5 };
          row.getCell(2).alignment = { horizontal: "center", vertical: "middle" };

          row.getCell(3).value = { formula: `COUNTIF($B$2:$${lastColLetter}$${gridEndRow}, "*"&A${rNum}&"*")` };
          row.getCell(3).font = { name: "Arial", size: 9.5, bold: true };
          row.getCell(3).alignment = { horizontal: "center", vertical: "middle" };

          row.getCell(4).value = { formula: `IF(C${rNum}=B${rNum}, "Matched", IF(C${rNum}>B${rNum}, "Over-scheduled", "Remaining: " & (B${rNum}-C${rNum}) & " demos"))` };
          row.getCell(4).font = { name: "Arial", size: 9.5, bold: true };
          row.getCell(4).alignment = { horizontal: "center", vertical: "middle" };
        }

        for (let col = 1; col <= 4; col++) {
          row.getCell(col).border = {
            top: { style: 'thin', color: { argb: 'E2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
            left: { style: 'thin', color: { argb: 'E2E8F0' } },
            right: { style: 'thin', color: { argb: 'E2E8F0' } }
          };
        }
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // SHEET: Eligible Mentors across ALL applicable colleges
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
      ...currentWeekDates.map(d => `${d.day} Free Periods (Timings)`),
      "Weekly Free Availability Summary",
      "Weekly Quota Target"
    ]);
    mHeadRow.height = 26;
    mHeadRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
    mHeadRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "4F46E5" } };
    mHeadRow.alignment = { vertical: "middle", horizontal: "center" };

    const totalMentorCols = 9 + currentWeekDates.length;

    relevantMentors.forEach((m) => {
      const mGroup = getMentorGroup(m);
      const customTarget = mentorTargets[m.id] !== undefined
        ? mentorTargets[m.id]
        : (demoRules?.find(r => r.subject?.toLowerCase().trim() === mGroup.toLowerCase().trim())?.target || 1);

      const timing = getCollegeTimingInfo(m.college_id);
      const dayFreeCols = currentWeekDates.map((w, idx) =>
        getMentorDayFreePeriods(m.id, m.college_id, w.dateStr, w.day, idx)
      );
      const weeklyFree = getMentorWeeklyFreeSummary(m.id, m.college_id);

      const row = wsMentors.addRow([
        m.id,
        m.name,
        mGroup,
        timing.collegeName,
        timing.startTime,
        timing.endTime,
        timing.workingHours,
        ...dayFreeCols,
        weeklyFree,
        customTarget
      ]);
      row.height = 22;
      for (let c = 1; c <= totalMentorCols; c++) {
        row.getCell(c).font = { name: "Arial", size: 9 };
        row.getCell(c).border = {
          top: { style: 'thin', color: { argb: 'E2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
          left: { style: 'thin', color: { argb: 'E2E8F0' } },
          right: { style: 'thin', color: { argb: 'E2E8F0' } }
        };
        if (c === totalMentorCols) {
          row.getCell(c).alignment = { horizontal: "center", vertical: "middle" };
          row.getCell(c).font = { name: "Arial", size: 9.5, bold: true };
        }
      }
    });

    const colWidths = [15, 26, 24, 32, 18, 18, 24, ...currentWeekDates.map(() => 34), 46, 20];
    colWidths.forEach((w, i) => { wsMentors.getColumn(i + 1).width = w; });

    // ─────────────────────────────────────────────────────────────────────────
    // SHEET: Assigned SMEs with Demo Time & Training Time Windows
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
        demoAvailText = "Configured Full Shift: 08:30 AM - 04:30 PM";
        trainingAvailText = "None";
      }

      const row = wsSmes.addRow([
        s.id,
        s.name,
        s.subject || s.head_subject_group || "General",
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
    // SHEET: Campus Day Orders across All Colleges
    // ─────────────────────────────────────────────────────────────────────────
    const wsDayOrders = workbook.addWorksheet("Campus_Day_Orders");
    const dHeadRow = wsDayOrders.addRow([
      "College / Campus Name",
      ...currentWeekDates.map(w => `${w.day} (${w.formatted || w.dateStr})`),
      "Configuration Status"
    ]);
    dHeadRow.height = 24;
    dHeadRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
    dHeadRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "374151" } };
    dHeadRow.alignment = { vertical: "middle", horizontal: "center" };

    applicableColleges.forEach(colObj => {
      const cStatus = getCollegeDayOrderConfigStatus(colObj.id);
      const dayOrderCols = currentWeekDates.map((w, idx) => {
        const info = getEffectiveDayOrderInfo(w.dateStr, w.day, idx, colObj.id);
        return info.isHoliday ? "Holiday" : info.dayOrder;
      });

      const row = wsDayOrders.addRow([
        colObj.name,
        ...dayOrderCols,
        cStatus.isFullyConfigured ? "Fully Configured" : "Incomplete"
      ]);
      row.height = 20;
      for (let c = 1; c <= 2 + currentWeekDates.length; c++) {
        row.getCell(c).font = { name: "Arial", size: 9.5 };
        row.getCell(c).border = { top: { style: 'thin', color: { argb: 'E2E8F0' } }, bottom: { style: 'thin', color: { argb: 'E2E8F0' } }, left: { style: 'thin', color: { argb: 'E2E8F0' } }, right: { style: 'thin', color: { argb: 'E2E8F0' } } };
      }
    });
    [32, ...currentWeekDates.map(() => 22), 24].forEach((w, i) => { wsDayOrders.getColumn(i + 1).width = w; });

    // ─────────────────────────────────────────────────────────────────────────
    // SHEET: System Reference Guide
    // ─────────────────────────────────────────────────────────────────────────
    const wsGuide = workbook.addWorksheet("System_Reference_Guide");
    const gHeadRow = wsGuide.addRow(["Category", "Configured System Values"]);
    gHeadRow.height = 24;
    gHeadRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
    gHeadRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "374151" } };

    const campusDayOrderSummary = applicableColleges.map(c => {
      const cOrders = currentWeekDates.map((w, idx) => {
        const d = getEffectiveDayOrderInfo(w.dateStr, w.day, idx, c.id);
        return `${w.day.slice(0, 3)}: ${d.isHoliday ? 'Holiday' : d.dayOrder}`;
      }).join(", ");
      return `${c.name}: [${cOrders}]`;
    }).join(" | ");

    const guideRows = [
      ["Scope", "All Applicable Colleges & Campuses"],
      ["Target Mentor Group", targetGroup],
      ["Active Week Date Range", `${currentWeekDates[0]?.dateStr || "Start"} to ${currentWeekDates[currentWeekDates.length - 1]?.dateStr || "End"}`],
      ["CAM Configured Campus Day Orders", campusDayOrderSummary],
      ["Total Colleges Included", `${applicableColleges.length} colleges (${applicableColleges.map(c => c.name).join(", ")})`],
      ["Eligible Faculty Count", `${relevantMentors.length} active mentors`],
      ["Assigned SMEs Count", `${relevantSmes.length} assigned SMEs`],
      ["Allocation Engine Rules", "Demo sessions require: (1) Mentor is free from teaching and leave, (2) SME is free and within demo evaluation window, (3) College is open (not a holiday), (4) CAM Day Order is configured."],
      ["Sheet Usage", "Fill out 'Master_Demo_Schedule' for bulk multi-college uploads, or use individual 'Grid_[College]' tabs for visual timetable matrix entry with built-in free faculty dropdowns."]
    ];

    guideRows.forEach(r => {
      const row = wsGuide.addRow(r);
      row.height = 20;
      row.getCell(1).font = { name: "Arial", size: 9.5, bold: true };
      row.getCell(2).font = { name: "Arial", size: 9.5 };
      row.getCell(1).border = { top: { style: 'thin', color: { argb: 'E2E8F0' } }, bottom: { style: 'thin', color: { argb: 'E2E8F0' } }, left: { style: 'thin', color: { argb: 'E2E8F0' } }, right: { style: 'thin', color: { argb: 'E2E8F0' } } };
      row.getCell(2).border = { top: { style: 'thin', color: { argb: 'E2E8F0' } }, bottom: { style: 'thin', color: { argb: 'E2E8F0' } }, left: { style: 'thin', color: { argb: 'E2E8F0' } }, right: { style: 'thin', color: { argb: 'E2E8F0' } } };
    });
    wsGuide.getColumn(1).width = 30;
    wsGuide.getColumn(2).width = 85;

    // Write buffer & trigger download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `Demo_Schedule_Template_All_Colleges_${selectedDateStr}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(downloadUrl);

    toast(`Downloaded Excel Demo Timetable template for all ${applicableColleges.length} colleges!`, "success");
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

        const warnings: string[] = [];
        const parsedSessions: any[] = [];
        const currentTargetGroup = selectedGroupId && selectedGroupId !== "All" ? selectedGroupId : "General";

        // Day of week / Day Order to dateStr mapping helper
        const dayToDateMap: Record<string, string> = {};
        currentWeekDates.forEach((w, wIdx) => {
          const dLower = w.day.toLowerCase().trim();
          dayToDateMap[dLower] = w.dateStr;
          dayToDateMap[dLower.slice(0, 3)] = w.dateStr;
          dayToDateMap[`day ${wIdx + 1}`] = w.dateStr;
          dayToDateMap[`day${wIdx + 1}`] = w.dateStr;
          dayToDateMap[`day_${wIdx + 1}`] = w.dateStr;
        });

        const normalizedRows: any[] = [];

        // Parse across all sheets in workbook (supporting Master_Demo_Schedule, Grid_* sheets, or standalone sheets)
        wb.SheetNames.forEach(sheetName => {
          if (sheetName === "Eligible_Mentors" || sheetName === "Assigned_SMEs" || sheetName === "Campus_Day_Orders" || sheetName === "System_Reference_Guide" || sheetName === "Free_Periods_Ref") {
            return;
          }

          const ws = wb.Sheets[sheetName];
          const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
          if (rawRows.length === 0) return;

          let sheetCollegeName = "";
          if (sheetName.startsWith("Grid_")) {
            sheetCollegeName = sheetName.replace("Grid_", "").replace(/_/g, " ");
          }

          rawRows.forEach((row, rIdx) => {
            const matrixDay = String(row["Day Order / Period"] || row["Day / Period"] || row["Day/Period"] || row["Day Order"] || "").trim();
            const isMatrix = Boolean(matrixDay) && Object.keys(row).some(k => k.toLowerCase().includes("period") || k.includes("AM") || k.includes("PM") || k.includes("-"));

            if (isMatrix) {
              Object.entries(row).forEach(([colKey, cellVal]) => {
                if (colKey === "Day Order / Period" || colKey === "Day / Period" || colKey === "Day/Period" || colKey === "Day Order" || colKey === "Day") return;
                const valStr = String(cellVal || "").trim();
                if (!valStr || valStr.toLowerCase().includes("holiday") || valStr.toLowerCase().includes("no mentors")) return;

                let parsedMentorName = valStr;
                let parsedSmeName = "";

                const smeMatch = valStr.match(/\[(?:SME:\s*)?([^\]]+)\]/i);
                if (smeMatch) {
                  parsedSmeName = smeMatch[1].trim();
                  parsedMentorName = valStr.replace(smeMatch[0], "").trim();
                }

                parsedMentorName = parsedMentorName.replace(/\s*\([^)]+\)$/, "").trim();

                let cleanSlot = colKey.trim();
                const periodTimeMatch = colKey.match(/\(([^)]+)\)/);
                if (periodTimeMatch) {
                  cleanSlot = periodTimeMatch[1].trim();
                }

                normalizedRows.push({
                  rawCollege: sheetCollegeName,
                  rawDay: matrixDay,
                  rawTime: cleanSlot,
                  rawMentor: parsedMentorName,
                  rawSme: parsedSmeName,
                  rawSubject: currentTargetGroup,
                  rawStream: "General Stream",
                  rawWeek: selectedWeek || 1,
                  sheetName,
                  rowNum: rIdx + 2
                });
              });
            } else {
              const rawCollege = String(row["College / Campus"] || row["College"] || row["college"] || row["Campus"] || sheetCollegeName || "").trim();
              const rawDay = String(row["Day / Date"] || row["Day of Week"] || row["Day"] || row["day"] || row["Day Order"] || row["Date"] || row["date"] || "").trim();
              const rawTime = String(row["Time Slot / Period"] || row["Time Slot"] || row["Time"] || row["time"] || row["Period"] || "").trim();
              const rawMentor = String(row["Faculty / Mentor"] || row["Faculty"] || row["Mentor"] || row["mentor"] || "").trim();
              const rawSme = String(row["Assigned SME (Optional)"] || row["Assigned SME"] || row["SME"] || row["sme"] || row["Evaluator"] || "").trim();
              const rawSubject = String(row["Department / Subject Group"] || row["Department / Group"] || row["Subject Group"] || row["Subject"] || row["subject"] || row["Department"] || currentTargetGroup).trim();
              const rawStream = String(row["Class Cohort / Stream"] || row["Class Cohort"] || row["Class Group"] || row["Stream"] || row["stream"] || "").trim();
              const rawWeek = parseInt(String(row["Week Number"] || row["Week"] || selectedWeek || "1"), 10) || selectedWeek || 1;

              if (rawDay || rawMentor || rawSme) {
                normalizedRows.push({
                  rawCollege,
                  rawDay,
                  rawTime,
                  rawMentor,
                  rawSme,
                  rawSubject,
                  rawStream,
                  rawWeek,
                  sheetName,
                  rowNum: rIdx + 2
                });
              }
            }
          });
        });

        if (normalizedRows.length === 0) {
          toast("The uploaded spreadsheet contains no valid allocation rows.", "warning");
          return;
        }

        normalizedRows.forEach((item) => {
          const { rawCollege, rawDay, rawTime, rawMentor, rawSme, rawSubject, rawStream, rawWeek, sheetName, rowNum } = item;

          if (!rawDay && !rawMentor && !rawSme) return;

          // Convert Day of Week / Day Order to dateStr
          let targetDateStr = "";
          const dateMatch = rawDay.match(/\b(\d{4}-\d{2}-\d{2})\b/);

          if (dateMatch) {
            targetDateStr = dateMatch[1];
          } else {
            const lowerDay = rawDay.toLowerCase().trim();
            const resolvedDay = (mapDayOrderToDayName(rawDay, "") || "").toLowerCase().trim();

            if (dayToDateMap[lowerDay]) {
              targetDateStr = dayToDateMap[lowerDay];
            } else if (resolvedDay && dayToDateMap[resolvedDay]) {
              targetDateStr = dayToDateMap[resolvedDay];
            } else {
              const cleanKey = resolvedDay || lowerDay;
              const matchedDateObj = currentWeekDates.find(w => w.day.toLowerCase().startsWith(cleanKey.slice(0, 3)));
              if (matchedDateObj) {
                targetDateStr = matchedDateObj.dateStr;
              } else {
                targetDateStr = currentWeekDates[0]?.dateStr || selectedDateStr;
                warnings.push(`[${sheetName}] Row ${rowNum}: Could not map day '${rawDay}' — defaulting to ${currentWeekDates[0]?.day || "Monday"}.`);
              }
            }
          }

          // Match Mentor (checking college match if rawCollege is present)
          let matchedMentor = mentors.find(m => {
            const nameMatch = m.name.toLowerCase().trim() === rawMentor.toLowerCase() ||
              m.email.toLowerCase().trim() === rawMentor.toLowerCase() ||
              m.id.toLowerCase() === rawMentor.toLowerCase();
            if (!nameMatch) return false;
            if (rawCollege) {
              const col = colleges.find(c => c.id === m.college_id);
              return !col || col.name.toLowerCase().includes(rawCollege.toLowerCase()) || rawCollege.toLowerCase().includes(col.name.toLowerCase());
            }
            return true;
          });

          if (!matchedMentor && rawMentor) {
            matchedMentor = mentors.find(m => m.name.toLowerCase().includes(rawMentor.toLowerCase()));
          }

          if (!matchedMentor) {
            warnings.push(`[${sheetName}] Row ${rowNum}: Mentor '${rawMentor}' not found in database.`);
          }

          const mentorCollege = matchedMentor ? colleges.find(c => c.id === matchedMentor.college_id) : null;
          const collegeName = mentorCollege?.name || rawCollege || currentCollege?.name || "College";

          // Match SME
          let matchedSme = rawSme ? smes.find(s =>
            s.name.toLowerCase().trim() === rawSme.toLowerCase() ||
            s.email.toLowerCase().trim() === rawSme.toLowerCase() ||
            s.id.toLowerCase() === rawSme.toLowerCase()
          ) : undefined;

          if (!matchedSme && rawSme) {
            matchedSme = smes.find(s => s.name.toLowerCase().includes(rawSme.toLowerCase()));
          }

          // If SME is not specified in Excel, run Auto-Scheduler Rule Engine for this slot
          if (!matchedSme && matchedMentor && targetDateStr && rawTime) {
            const singleSlotRuleCheck = autoAssignSmesToSlots([{
              mentorId: matchedMentor.id,
              mentorName: matchedMentor.name,
              collegeName,
              dateStr: targetDateStr,
              timeSlot: rawTime,
              subject: rawSubject || currentTargetGroup,
              stream: rawStream || "General Stream",
              week: rawWeek
            }], parsedSessions);

            if (singleSlotRuleCheck.generated.length > 0) {
              const assigned = singleSlotRuleCheck.generated[0];
              matchedSme = smes.find(s => s.id === assigned.smeId);
            }
          }

          if (!matchedSme) {
            warnings.push(`[${sheetName}] Row ${rowNum}: Could not auto-assign SME for '${rawSubject || currentTargetGroup}' at ${rawTime} on ${targetDateStr}.`);
          }

          // Strict validation via evaluateMentorSlotAvailability engine
          const conflictReasons: string[] = [];

          if (matchedMentor && targetDateStr && rawTime) {
            const slotEval = evaluateMentorSlotAvailability(
              matchedMentor.id,
              targetDateStr,
              rawTime,
              matchedMentor.college_id,
              parsedSessions
            );

            if (slotEval.status === "blocked") {
              conflictReasons.push(`${matchedMentor.name}: ${slotEval.label} (${slotEval.details})`);
            } else if (slotEval.status === "occupied") {
              conflictReasons.push(`Mentor ${matchedMentor.name} is teaching: ${slotEval.label} (${slotEval.details})`);
            } else if (slotEval.status === "demo") {
              conflictReasons.push(`Mentor ${matchedMentor.name} already has demo: ${slotEval.label}`);
            }

            if (matchedSme) {
              if (isFacultyOnLeave(matchedSme.id, targetDateStr)) {
                conflictReasons.push(`SME ${matchedSme.name} is on approved faculty leave.`);
              }
              if (!isSmeFree(matchedSme.id, targetDateStr, rawTime, parsedSessions)) {
                conflictReasons.push(`SME ${matchedSme.name} is not available at ${rawTime}.`);
              }
            }
          }

          const hasConflict = conflictReasons.length > 0;
          const conflictReason = conflictReasons.join(" | ");

          if (hasConflict) {
            warnings.push(`[${sheetName}] Row ${rowNum}: ${conflictReason}`);
          }

          parsedSessions.push({
            rowNum,
            dayName: rawDay || "Monday",
            dateStr: targetDateStr,
            timeSlot: rawTime || "08:30 AM",
            mentorId: matchedMentor ? matchedMentor.id : "",
            mentorName: matchedMentor ? matchedMentor.name : (rawMentor || "Unknown Mentor"),
            collegeName,
            smeId: matchedSme ? matchedSme.id : "",
            smeName: matchedSme ? matchedSme.name : "Unassigned SME",
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
      .filter(ds => {
        const matchesCollege = selectedCollegeId === "all" || mentors.find(m => m.id === ds.mentorId)?.college_id === selectedCollegeId;
        const matchesWeek = currentWeekDates.some(w => w.dateStr === ds.dateStr);
        const isActive = ds.status !== "cancelled" && ds.status !== "not_conducted";
        return matchesCollege && matchesWeek && isActive;
      })
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
    <div className="flex-1 flex flex-col md:flex-row bg-warm-canvas text-slate-800 dark:text-slate-200 font-sans h-full overflow-hidden">

      {/* FLOATING COLLAPSIBLE LEFT SIDEBAR NAVIGATION */}
      <aside className={`hidden md:flex shrink-0 flex-col justify-between sticky top-6 z-30 floating-sidebar transition-all duration-300 ${isCollapsed ? "w-20 p-3" : "w-64 p-5"}`}>
        <div className="flex flex-col flex-1 overflow-visible">

          {/* Sidebar Header Toggle */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200/70 dark:border-slate-800">
            {!isCollapsed && (
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-[#D528A2]/10 text-[#D528A2]">
                  <Compass className="h-4.5 w-4.5" />
                </div>
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white block leading-tight">
                    Learning &amp; Dev
                  </span>
                  <span className="text-[9.5px] font-bold text-slate-400 block">L&amp;D Portal</span>
                </div>
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
                ? "sidebar-active-item font-black border-none"
                : "text-slate-600 hover:text-[#D528A2] hover:bg-[#D528A2]/5 dark:text-slate-400 dark:hover:bg-white/5"
                }`}
            >
              <Grid className="h-4 w-4 shrink-0" />
              {!isCollapsed && <span>Allocation Matrix</span>}
            </button>

            <button
              onClick={() => setAllocatorTab("rules")}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${allocatorTab === "rules"
                ? "sidebar-active-item font-black border-none"
                : "text-slate-600 hover:text-[#D528A2] hover:bg-[#D528A2]/5 dark:text-slate-400 dark:hover:bg-white/5"
                }`}
            >
              <Settings className="h-4 w-4 shrink-0" />
              {!isCollapsed && <span>Excel Rules &amp; Targets</span>}
            </button>

            <button
              onClick={() => setAllocatorTab("queue")}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer relative ${allocatorTab === "queue"
                ? "sidebar-active-item font-black border-none"
                : "text-slate-600 hover:text-[#D528A2] hover:bg-[#D528A2]/5 dark:text-slate-400 dark:hover:bg-white/5"
                }`}
            >
              <RefreshCw className="h-4 w-4 shrink-0" />
              {!isCollapsed && <span>Reallocation Queue</span>}
              {((demoSwapRequests?.filter((r: any) => r.status === "pending").length || 0) + (demoReallocations?.filter((r: any) => r.status === "pending").length || 0)) > 0 && (
                <span className="ml-auto px-2 py-0.5 bg-rose-500 text-white rounded-full text-[9px] font-black">
                  {(demoSwapRequests?.filter((r: any) => r.status === "pending").length || 0) + (demoReallocations?.filter((r: any) => r.status === "pending").length || 0)}
                </span>
              )}
            </button>
          </nav>
        </div>
      </aside>

      {/* MAIN WORKSPACE AREA */}
      <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-6 max-w-[1400px] mx-auto w-full">

        {/* Page Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
          <div className="space-y-1">
            <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#D528A2] animate-pulse" />
              L&amp;D Console
            </h1>
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400 font-bold leading-none">
              Consolidate and allocate multi-campus department demo sessions for mentors and SMEs.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => { refreshData(); toast("Refreshed timetable data.", "success"); }}
              className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-2 transition-all"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>

            {/* Direct Download Excel Template Button */}
            <button
              onClick={handleOpenTemplateModal}
              className="px-3.5 py-2 bg-[#D528A2]/10 hover:bg-[#D528A2]/15 text-[#D528A2] dark:text-[#f45fc6] border border-[#D528A2]/25 rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-2 transition-all"
            >
              <Download className="h-4 w-4 text-[#D528A2]" />
              <span>Download Template (.xlsx)</span>
            </button>

            {/* Direct Import Excel Schedule Button */}
            <label className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 cursor-pointer flex items-center gap-2 transition-all">
              <Upload className="h-4 w-4 text-white" />
              <span>Import Excel Schedule</span>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleDemoExcelFileSelect}
                className="hidden"
              />
            </label>

            {/* Direct Export Active Schedule Button */}
            <button
              onClick={handleExportDemoSchedule}
              className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-2 transition-all"
            >
              <FileSpreadsheet className="h-4 w-4 text-[#F4A863]" />
              <span>Export Active (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* 🔹 LIVE REALLOCATION & ALLOCATION PROGRESS TRACKER (Card.tsx components) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card
            label="Confirmed Demos"
            value={demoSessions.filter(d => d.status === "confirmed" || d.status === "scheduled").length}
            icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
            className="bg-white/80 dark:bg-[#131317]/80"
          />

          <Card
            label="Leave Impacted (Reallocation Req)"
            value={demoSessions.filter(d => d.status === "reallocation_required").length}
            icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
            className="bg-white/80 dark:bg-[#131317]/80"
          />

          <Card
            label="Pending Head / SME Approval"
            value={demoSwapRequests.filter((r: any) => r.status === "pending" || r.status === "pending_sme").length}
            icon={<Clock className="h-5 w-5 text-[#D528A2]" />}
            className="bg-white/80 dark:bg-[#131317]/80"
          />

          <Card
            label="Not Conducted Sessions"
            value={demoSessions.filter(d => d.status === "not_conducted").length}
            icon={<AlertCircle className="h-5 w-5 text-rose-500" />}
            className="bg-white/80 dark:bg-[#131317]/80"
          />
        </div>

        {/* TAB 1: ALLOCATION MATRIX */}
        {allocatorTab === "matrix" && (
          <div className="space-y-6">



            {/* Filters Bar */}
            <div className="bg-white/90 dark:bg-[#131317]/90 border border-slate-200/80 dark:border-slate-800/80 p-4 rounded-xl shadow-xs backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
              <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">

                {/* College Dropdown */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">College Campus</label>
                  <div className="relative min-w-[220px]">
                    <select
                      value={selectedCollegeId}
                      onChange={(e) => {
                        setSelectedCollegeId(e.target.value);
                        setSelectedGroupId("All");
                      }}
                      className="w-full pl-3 pr-8 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#D528A2]/30 focus:border-[#D528A2] appearance-none cursor-pointer"
                    >
                      <option value="all">All Applicable Colleges</option>
                      {colleges.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Group (Department) Dropdown */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Department Group</label>
                  <div className="relative min-w-[200px]">
                    <select
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(e.target.value)}
                      className="w-full pl-3 pr-8 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#D528A2]/30 focus:border-[#D528A2] appearance-none cursor-pointer"
                    >
                      <option value="All">All Departments</option>
                      {mentorGroups.map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>

              </div>

              {/* Quick status indicators */}
              <div className="flex gap-4 items-center flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="h-3.5 w-3.5 bg-emerald-500 rounded border border-emerald-600 shadow-xs" />
                  <span className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Free Slot</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3.5 w-3.5 bg-[#D528A2] rounded border border-[#c02090] shadow-xs" />
                  <span className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Demo Booked</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3.5 w-3.5 bg-slate-300 dark:bg-slate-700 rounded border border-slate-400 dark:border-slate-600" />
                  <span className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Busy Slot</span>
                </div>
              </div>
            </div>

            {/* 🔹 DYNAMIC TIMETABLE TABLE */}
            <div className="bg-white/90 dark:bg-[#131317]/90 border border-slate-200/80 dark:border-slate-800/80 rounded-xl shadow-xs overflow-auto max-h-[70vh] w-full no-scrollbar relative backdrop-blur-md">
              <table className="w-full table-fixed border-collapse text-left min-w-[950px]">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-900/80 text-xs font-bold uppercase">
                    <th className="sticky top-0 left-0 z-30 p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-100/95 dark:bg-slate-950/95 backdrop-blur-xs border-r border-b border-slate-200/80 dark:border-slate-800 w-[15%]">Time Period</th>
                    {currentWeekDates.map((date, idx) => {
                      const dayInfo = getEffectiveDayOrderInfo(date.dateStr, date.day, idx, selectedCollegeId !== "all" ? selectedCollegeId : undefined);
                      return (
                        <th key={date.dateStr} className="sticky top-0 z-20 p-4 text-[10.5px] font-black text-slate-700 dark:text-slate-300 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200/80 dark:border-slate-800 uppercase w-[17%] border-l border-slate-100 dark:border-slate-800 text-center">
                          <div className={`font-black text-[11px] tracking-tight ${dayInfo.isHoliday ? "text-rose-600 dark:text-rose-400" : "text-[#D528A2] dark:text-[#f45fc6]"}`}>
                            {dayInfo.isHoliday ? "Holiday" : dayInfo.dayOrder}
                          </div>
                          <div className="text-[9px] text-slate-400 font-bold tracking-tight mt-0.5">{date.day.slice(0, 3)} ({date.formatted})</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
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
                            <tr className="bg-slate-100/70 dark:bg-slate-900/70 border-t border-b border-slate-200 dark:border-slate-800">
                              <td colSpan={6} className="p-3.5 text-left">
                                <div className="flex items-center gap-2 text-[#D528A2] dark:text-[#f45fc6] font-black text-xs uppercase tracking-widest">
                                  <Moon className="h-4.5 w-4.5 text-[#D528A2] animate-pulse" />
                                  Beyond College Hours
                                </div>
                              </td>
                            </tr>
                          )}

                          {isLunch ? (
                            <tr className="bg-amber-50/20 dark:bg-amber-950/10">
                              <td className="sticky left-0 z-10 p-3 border-r border-slate-100 dark:border-slate-800 bg-amber-50/95 dark:bg-slate-900/95 backdrop-blur-xs align-middle">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                  <Coffee className="h-3.5 w-3.5 text-[#F4A863]" />
                                  Lunch
                                </span>
                              </td>
                              <td colSpan={5} className="p-3 align-middle text-center">
                                <div className="flex items-center justify-center gap-2 text-amber-700 dark:text-amber-400 font-extrabold text-[10.5px] tracking-wide uppercase">
                                  <Coffee className="h-4 w-4" />
                                  {time} • LUNCH BREAK (Excluded from Scheduling)
                                </div>
                              </td>
                            </tr>
                          ) : (
                            <tr className="hover:bg-slate-50/30 dark:hover:bg-slate-800/20 transition-colors">

                              {/* Time Column */}
                              <td className="sticky left-0 z-10 p-4 border-r border-slate-100 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs align-middle">
                                <div className="leading-tight">
                                  <span className="text-[10.5px] font-black text-slate-700 dark:text-white">Period {tIdx + 1}</span>
                                  <div className="text-[9px] text-slate-400 font-semibold mt-0.5">{time}</div>
                                </div>
                              </td>

                              {/* Day Columns */}
                              {currentWeekDates.map((date) => {
                                return (
                                  <td
                                    key={date.dateStr}
                                    className="p-2 border-r border-slate-100 dark:border-slate-800 last:border-r-0 align-top text-center"
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
                                                      const mentorGroup = getMentorGroup(mentor);
                                                      const matchingSme = getSmesForSubjectGroup(mentorGroup)[0] || smes[0];
                                                      setEditSession({
                                                        id: "",
                                                        mentorId: mentor.id,
                                                        mentorName: mentor.name,
                                                        smeId: matchingSme?.id || "",
                                                        smeName: matchingSme?.name || "",
                                                        dateStr: date.dateStr,
                                                        timeSlot: time,
                                                        subject: mentorGroup,
                                                        stream: (slots.filter(s => s.mentorId === mentor.id && s.classGroup)[0]?.classGroup) || "General Stream",
                                                        week: selectedWeek
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
                                                    ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                                                    : isDemo
                                                      ? "bg-[#D528A2]/10 dark:bg-[#D528A2]/20 border-[#D528A2]/30 text-[#D528A2] dark:text-[#f45fc6] hover:bg-[#D528A2]/15"
                                                      : isPreview
                                                        ? "bg-amber-50/30 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-50"
                                                        : isBlocked
                                                          ? "bg-amber-50/10 border-amber-100/50 text-amber-600/80 cursor-not-allowed"
                                                          : "bg-slate-50/50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 text-slate-400 hover:bg-slate-100"
                                                    }`}
                                                  title={`${mentor.name}: ${statusObj.label}`}
                                                >
                                                  <div className="flex items-center justify-between gap-1">
                                                    <span className="truncate text-slate-800 dark:text-slate-100">{mentor.name}</span>
                                                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isFree
                                                      ? "bg-emerald-500"
                                                      : isDemo
                                                        ? "bg-[#D528A2]"
                                                        : isPreview
                                                          ? "bg-amber-500"
                                                          : isBlocked
                                                            ? "bg-amber-600"
                                                            : "bg-slate-300 dark:bg-slate-600"
                                                      }`} />
                                                  </div>
                                                  {!isFree && (
                                                    <div className="text-[7.5px] text-slate-500 dark:text-slate-400 font-semibold truncate mt-0.5 text-left">
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
                                                className="w-full py-1 text-[8.5px] font-black text-[#D528A2] hover:text-[#c02090] bg-[#D528A2]/5 hover:bg-[#D528A2]/10 border border-dashed border-[#D528A2]/30 rounded-lg transition-colors cursor-pointer"
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
              <div className="bg-white/80 dark:bg-[#131317]/80 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4 backdrop-blur-md">
                <h3 className="text-xs font-black uppercase text-slate-700 dark:text-white tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">Legend</h3>
                <div className="grid grid-cols-2 gap-3 text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded bg-emerald-500 shadow-xs shrink-0" />
                    <div>
                      <span className="font-bold text-slate-800 dark:text-white block leading-none">Free Slot</span>
                      <span className="text-[8.5px] text-slate-400 block mt-0.5">Available for demo</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded bg-slate-300 dark:bg-slate-700 shadow-xs shrink-0" />
                    <div>
                      <span className="font-bold text-slate-800 dark:text-white block leading-none">Busy Slot</span>
                      <span className="text-[8.5px] text-slate-400 block mt-0.5">Teaching / Evaluation</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded bg-[#D528A2] shadow-xs shrink-0" />
                    <div>
                      <span className="font-bold text-slate-800 dark:text-white block leading-none">Demo Booked</span>
                      <span className="text-[8.5px] text-slate-400 block mt-0.5">Already scheduled</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded bg-[#F4A863] shadow-xs shrink-0" />
                    <div>
                      <span className="font-bold text-slate-800 dark:text-white block leading-none">Draft Preview</span>
                      <span className="text-[8.5px] text-slate-400 block mt-0.5">Not yet confirmed</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Info */}
              <div className="bg-white/80 dark:bg-[#131317]/80 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-3 backdrop-blur-md">
                <h3 className="text-xs font-black uppercase text-slate-700 dark:text-white tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">Guidelines</h3>
                <ul className="list-disc pl-4 text-[10.5px] text-slate-500 dark:text-slate-400 space-y-1.5 font-semibold">
                  <li>Time slots are configured in 60-minute duration blocks</li>
                  <li>Campus lunch breaks are automatically excluded from allocations</li>
                  <li>Beyond regular college hours slots appear below the evening divider</li>
                </ul>
              </div>

              {/* Card 3: Beyond College Hours */}
              <div className="bg-white/80 dark:bg-[#131317]/80 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-3 flex flex-col justify-between backdrop-blur-md">
                <div>
                  <h3 className="text-xs font-black uppercase text-slate-700 dark:text-white tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-1.5">
                    <Moon className="h-3.5 w-3.5 text-[#D528A2]" />
                    Beyond College Hours
                  </h3>
                  <div className="pt-2 text-[10.5px] font-bold text-slate-700 dark:text-slate-300 space-y-1.5">
                    <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/40 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span>Slot 1:</span>
                      <span className="text-[#D528A2] dark:text-[#f45fc6] font-extrabold">04:30 PM - 05:30 PM</span>
                    </div>
                    <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/40 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span>Slot 2:</span>
                      <span className="text-[#D528A2] dark:text-[#f45fc6] font-extrabold">05:30 PM - 06:30 PM</span>
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
            subtitle="Configure target demo quotas per week for each department group and manage Head SME priority assignments for the Excel Engine."
            headerActions={
              <button
                onClick={handleOpenTemplateModal}
                className="btn-gradient px-4 py-2 text-white rounded-xl text-xs font-black shadow-md shadow-[#D528A2]/25 flex items-center gap-2 cursor-pointer hover:opacity-95"
              >
                <Download className="h-3.5 w-3.5" />
                Download Excel Template
              </button>
            }
          >
            <div className="space-y-6">
              {/* Target Demos Config Card */}
              <div className="bg-slate-50/80 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
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
                      className="w-16 text-center py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#D528A2]/30"
                    />
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">demo(s) / week</span>
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
                      <div key={groupName} className="flex items-center justify-between p-4 rounded-xl bg-white/80 dark:bg-[#131317]/80 border border-slate-200/80 dark:border-slate-800 shadow-xs">
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
                            className="w-14 text-center p-1.5 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#D528A2]/30"
                          />
                          <button
                            onClick={async () => {
                              await saveDepartmentRule(groupName, localVal);
                              setDeptRuleInputs(prev => { const next = { ...prev }; delete next[groupName]; return next; });
                            }}
                            disabled={!isDirty}
                            className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${isDirty ? "bg-[#D528A2] hover:bg-[#c02090] text-white shadow-xs cursor-pointer" : "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
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
              <div className="bg-white/80 dark:bg-[#131317]/80 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4 font-sans mt-6 backdrop-blur-md">
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
                      className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-[#D528A2]/30 cursor-pointer"
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
                      <tr className="bg-slate-50/80 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-black uppercase text-[9.5px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                        <th className="p-3">Faculty Name</th>
                        <th className="p-3">Mentor Group</th>
                        <th className="p-3">College &amp; Department</th>
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
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#D528A2]/10 text-[#D528A2] dark:text-[#f45fc6] border border-[#D528A2]/20">
                                  {groupName}
                                </span>
                              </td>
                              <td className="p-3 text-slate-500 dark:text-slate-400 text-[11px]">
                                {colName}
                              </td>
                              <td className="p-3 text-center">
                                <span className="px-2.5 py-1 rounded-lg bg-[#D528A2]/10 text-[#D528A2] dark:text-[#f45fc6] font-black text-xs">
                                  {customTarget} Demo{customTarget !== 1 ? "s" : ""}/Wk
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                                  <button
                                    type="button"
                                    onClick={() => handleSetMentorTarget(m.id, customTarget - 1)}
                                    className="w-6 h-6 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-black flex items-center justify-center cursor-pointer shadow-xs transition-colors"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min={0}
                                    max={10}
                                    value={customTarget}
                                    onChange={(e) => handleSetMentorTarget(m.id, parseInt(e.target.value) || 0)}
                                    className="w-10 text-center text-xs font-black bg-transparent border-none focus:outline-none text-slate-800 dark:text-white"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSetMentorTarget(m.id, customTarget + 1)}
                                    className="w-6 h-6 rounded-lg bg-[#D528A2] hover:bg-[#c02090] text-white font-black flex items-center justify-center cursor-pointer shadow-xs transition-colors"
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
              {/* ── Leave-Driven Demo Reallocation Requests (L & D Approval) ── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Leave Demo Reallocations</h3>
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[9.5px] font-black uppercase border border-amber-200 dark:border-amber-800">
                      {demoReallocations.filter(r => r.status === "pending").length} Pending Approval
                    </span>
                  </div>
                  <button
                    onClick={fetchDemoReallocations}
                    className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-[#D528A2] hover:border-[#D528A2]/40 transition-all cursor-pointer"
                    title="Refresh"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingReallocations ? "animate-spin" : ""}`} />
                  </button>
                </div>

                {demoReallocations.filter(r => r.status === "pending").length === 0 ? (
                  <div className="text-center py-6 text-slate-400 font-bold text-xs border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                    No pending demo reallocation requests. All clear!
                  </div>
                ) : (
                  demoReallocations.filter(r => r.status === "pending").map(req => (
                    <div key={req.id} className="p-4 rounded-xl bg-white/80 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-slate-900 dark:text-white">{req.subject}</span>
                            <span className="px-1.5 py-0.5 rounded bg-[#D528A2]/10 border border-[#D528A2]/20 text-[#D528A2] dark:text-[#f45fc6] text-[9px] font-black uppercase">
                              Week {req.week ?? "—"}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded border text-[9px] font-black uppercase ${req.request_kind === "reschedule"
                              ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 text-indigo-700 dark:text-indigo-300"
                              : "bg-amber-100 dark:bg-amber-950/40 border border-amber-200 text-amber-800 dark:text-amber-300"
                              }`}>
                              {req.request_kind === "reschedule" ? "Mentor Reschedule Request" : req.request_kind === "sme_swap" ? "SME Reallocation" : "Mentor Leave Reallocation"}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                            <div>Applying Mentor: <span className="font-bold text-slate-800 dark:text-white">{req.mentor_name}</span></div>
                            <div>SME Evaluator: <span className="font-bold text-slate-800 dark:text-white">{req.sme_name}</span></div>
                            <div className="text-rose-600 dark:text-rose-400">
                              Original slot: <span className="font-bold">{req.original_date_str} • {req.original_time_slot}</span>
                            </div>
                            <div className="text-emerald-600 dark:text-emerald-400">
                              Proposed slot: <span className="font-bold">{req.proposed_date_str} • {req.proposed_time_slot}</span>
                            </div>
                          </div>
                          {req.reason && (
                            <p className="text-[10.5px] text-slate-500 italic">Reason: {req.reason}</p>
                          )}
                          <p className="text-[10px] text-slate-400">
                            Proposed by {req.proposed_by || req.mentor_name} • Target period is reserved (blocked for other bookings) until you decide.
                          </p>
                        </div>

                        <div className="shrink-0 flex flex-col gap-2 w-full md:w-64">
                          <input
                            type="text"
                            placeholder="Decision notes (optional)"
                            value={reallocNotesMap[req.id] || ""}
                            onChange={e => setReallocNotesMap(prev => ({ ...prev, [req.id]: e.target.value }))}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-medium text-slate-800 dark:text-white focus:outline-none focus:border-[#D528A2]"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={decidingReallocId === req.id}
                              onClick={() => decideDemoReallocation(req.id, "rejected")}
                              className="flex-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                            >
                              Reject
                            </button>
                            <button
                              type="button"
                              disabled={decidingReallocId === req.id}
                              onClick={() => decideDemoReallocation(req.id, "approved")}
                              className="btn-gradient flex-1 px-3.5 py-1.5 text-white rounded-xl text-xs font-extrabold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                            >
                              {decidingReallocId === req.id ? "Working…" : "Approve Move"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {/* Resolved log */}
                {demoReallocations.filter(r => r.status !== "pending").length > 0 && (
                  <details className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
                    <summary className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer">
                      Resolution Log ({demoReallocations.filter(r => r.status !== "pending").length})
                    </summary>
                    <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
                      {demoReallocations.filter(r => r.status !== "pending").slice(0, 20).map(req => (
                        <div key={req.id} className="py-2 flex items-center justify-between gap-3 text-[11px]">
                          <span className="font-bold text-slate-700 dark:text-slate-200">{req.subject} — {req.mentor_name}</span>
                          <span className="text-slate-500 dark:text-slate-400">{req.original_date_str} → {req.proposed_date_str} • {req.proposed_time_slot}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${req.status === "approved" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"}`}>
                            {req.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>

              {/* Swap Requests Table */}
              <div className="space-y-3">
                <div className="flex border-b border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setSwapRequestsTab("pending")}
                    className={`pb-2 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${swapRequestsTab === "pending" ? "border-[#D528A2] text-[#D528A2]" : "border-transparent text-slate-400"
                      }`}
                  >
                    Pending Review ({demoSwapRequests.filter((r: any) => r.status === "pending").length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSwapRequestsTab("resolved")}
                    className={`pb-2 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${swapRequestsTab === "resolved" ? "border-[#D528A2] text-[#D528A2]" : "border-transparent text-slate-400"
                      }`}
                  >
                    Resolution Logs ({demoSwapRequests.filter((r: any) => r.status !== "pending").length})
                  </button>
                </div>

                <div className="space-y-3">
                  {swapRequestsTab === "pending" ? (
                    demoSwapRequests.filter((r: any) => r.status === "pending").length > 0 ? (
                      demoSwapRequests.filter((r: any) => r.status === "pending").map((req: any) => (
                        <div key={req.id} className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-slate-900 dark:text-white">{req.smeName}</span>
                              <span className="px-2 py-0.5 bg-[#D528A2]/10 text-[#D528A2] rounded-md text-[9px] font-extrabold uppercase">
                                {(req.swapType === "mentor" || req.swapType === "internal") ? "Mentor Swap" : "Time Slot Swap"}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold mt-1">
                              Original: {req.mentorName} ({req.dateStr} • {req.timeSlot})
                            </p>
                            <p className="text-xs font-bold text-[#D528A2] mt-0.5">
                              Proposed: {(req.swapType === "mentor" || req.swapType === "internal") ? (req.proposedMentorName || req.targetMentorName) : `${req.proposedDateStr} • ${req.proposedTimeSlot}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={async () => {
                                const res = await resolveDemoSwap(req.id, "rejected");
                                if (res.success) toast("Swap request rejected.", "info");
                              }}
                              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                              Reject
                            </button>
                            <button
                              onClick={async () => {
                                const res = await resolveDemoSwap(req.id, "approved");
                                if (res.success) toast("Swap approved and schedule updated!", "success");
                              }}
                              className="btn-gradient px-4 py-1.5 text-white rounded-xl text-xs font-extrabold shadow-xs transition-all cursor-pointer"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 w-full max-w-2xl shadow-2xl relative animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

              <button
                onClick={() => { if (!isGenerating) setShowPreviewModal(false); }}
                disabled={isGenerating}
                className="absolute right-4 top-4 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer disabled:opacity-40"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Modal Title */}
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 shrink-0">
                <div className="p-2 rounded-xl bg-[#D528A2]/10 text-[#D528A2]">
                  <Sparkles className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-wider">
                    AI Schedule Generation Deck
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                    Target: {selectedCollegeId === "all" ? "All Applicable Colleges" : currentCollege?.name} • {selectedGroupId === "All" ? "All Subject Groups" : selectedGroupId}
                  </p>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto py-4 space-y-4 my-1">

                {generationStep === "generating" ? (
                  /* LOADING GENERATION STATE */
                  <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="relative h-14 w-14">
                      <Loader2 className="h-14 w-14 text-[#D528A2] animate-spin" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-black text-slate-900 dark:text-white">Computing Allocation Metrics...</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Analyzing slots, specialized SMEs, and leaves</p>
                    </div>

                    {/* Visual checklist indicators */}
                    <div className="w-full max-w-xs bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 space-y-2 text-left">
                      <div className="flex items-center gap-2 text-emerald-600">
                        <CheckCircle className="h-3.5 w-3.5" /> Checked college shift timings
                      </div>
                      <div className="flex items-center gap-2 text-[#D528A2] animate-pulse">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Matching mentors with subject expert SMEs
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <div className="h-3.5 w-3.5 rounded-full border-2 border-slate-200 dark:border-slate-700" /> Allocating clash-free dates
                      </div>
                    </div>
                  </div>
                ) : (
                  /* RESULTS COMPLETED STATE */
                  <div className="space-y-4">
                    {/* Scanned Metrics Grid */}
                    <div className="grid grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
                      <div className="p-1">
                        <span className="text-[8.5px] font-black uppercase text-slate-400 tracking-wider block">Available Mentors</span>
                        <span className="text-base font-black text-slate-800 dark:text-white block">{filteredMentors.length}</span>
                      </div>
                      <div className="p-1 border-x border-slate-200 dark:border-slate-700">
                        <span className="text-[8.5px] font-black uppercase text-slate-400 tracking-wider block">Total Free Slots</span>
                        <span className="text-base font-black text-emerald-600 block">{totalFreeSlotsCount}</span>
                      </div>
                      <div className="p-1">
                        <span className="text-[8.5px] font-black uppercase text-slate-400 tracking-wider block">Generated Demos</span>
                        <span className="text-base font-black text-[#D528A2] block">{previewSessions.length}</span>
                      </div>
                    </div>

                    {/* Allocation summary alert cards */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2.5 p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 rounded-xl text-[10.5px] font-bold text-emerald-800 dark:text-emerald-300">
                        <CheckCircle className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
                        <span>Successfully planned {previewSessions.length} demo sessions with zero cohort-clashes.</span>
                      </div>

                      {unassignedMentors.length > 0 && (
                        <div className="flex items-start gap-2.5 p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl text-[10.5px] font-bold text-amber-800 dark:text-amber-300">
                          <AlertTriangle className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <span>Unassigned Mentors ({unassignedMentors.length}):</span>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {unassignedMentors.map(m => (
                                <span key={m.id} className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800 text-[8.5px] font-black text-amber-700 dark:text-amber-300">
                                  {m.name}
                                </span>
                              ))}
                            </div>
                            <span className="text-[8.5px] text-slate-400 font-bold block mt-1.5">These mentors either have no eligible matching SMEs or are fully occupied during free periods.</span>
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
                            <div key={exc.id} className="p-3 bg-rose-50/20 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                              <div className="text-[10.5px]">
                                <p className="font-bold text-slate-800 dark:text-slate-200">
                                  {exc.mentorName} • <span className="text-slate-400 font-semibold">{exc.subject}</span>
                                </p>
                                <p className="text-[9.5px] text-rose-600 dark:text-rose-400 font-bold mt-0.5">
                                  Clash: {exc.reason}
                                </p>
                                <p className="text-[9px] text-[#D528A2] dark:text-[#f45fc6] mt-1 italic">
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
                                className="px-2.5 py-1 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[9px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 transition-colors shadow-xs shrink-0 cursor-pointer"
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
                      <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-[200px] overflow-y-auto">
                        <table className="w-full text-left border-collapse text-[10.5px]">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-[9px]">
                              <th className="p-2.5">Faculty Mentor</th>
                              <th className="p-2.5">Subject</th>
                              <th className="p-2.5">Date / Time</th>
                              <th className="p-2.5">Assigned SME</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                            {previewSessions.map((s, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                <td className="p-2.5 font-bold text-slate-800 dark:text-white">
                                  <div>{s.mentorName}</div>
                                  <div className="text-[8.5px] text-[#D528A2] font-black uppercase tracking-wider mt-0.5">
                                    {s.collegeName || colleges.find(c => c.id === mentors.find(m => m.id === s.mentorId)?.college_id)?.name || ""}
                                  </div>
                                </td>
                                <td className="p-2.5 text-slate-500 dark:text-slate-400">{s.subject}</td>
                                <td className="p-2.5 text-slate-500 dark:text-slate-400">
                                  <div>{s.dateStr}</div>
                                  <div className="text-[8.5px] text-slate-400 mt-0.5">{s.timeSlot}</div>
                                </td>
                                <td className="p-2.5 font-bold text-slate-700 dark:text-slate-200">{s.smeName}</td>
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
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-sm cursor-pointer transition-colors"
                  >
                    Confirm &amp; Save
                  </button>
                  <button
                    onClick={handleTriggerGenerate}
                    className="flex-1 py-2.5 bg-[#D528A2]/10 hover:bg-[#D528A2]/15 text-[#D528A2] font-bold rounded-xl text-xs transition-colors cursor-pointer border border-[#D528A2]/25"
                  >
                    Regenerate
                  </button>
                  <button
                    onClick={() => setShowPreviewModal(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MANUAL OVERRIDE / CREATE MODAL */}
        {editSession !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl relative animate-in zoom-in-95 duration-200 space-y-5">

              <button
                onClick={setEditSession.bind(null, null)}
                className="absolute right-4 top-4 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="p-1.5 rounded-lg bg-[#D528A2]/10 text-[#D528A2]">
                  <Settings className="h-4.5 w-4.5" />
                </div>
                <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-wider">
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
                  } else {
                    toast(res.message, "error");
                  }
                } catch (err: any) {
                  toast(err.message, "error");
                }
              }} className="space-y-4">

                {/* Mentor Info */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Faculty Mentor</label>
                  <input
                    type="text"
                    value={editSession.mentorName}
                    disabled
                    className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400"
                  />
                </div>

                {/* Cohort Stream */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Class Group / Cohort</label>
                  <select
                    value={editSession.stream}
                    onChange={(e) => setEditSession({ ...editSession, stream: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#D528A2]/30 focus:border-[#D528A2] cursor-pointer"
                  >
                    {classGroups.map(cg => (
                      <option key={cg} value={cg}>{cg}</option>
                    ))}
                    <option value="General Stream">General Stream</option>
                  </select>
                </div>

                {/* Mentor Group Area */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Mentor Group</label>
                  <input
                    type="text"
                    value={editSession.subject}
                    onChange={(e) => setEditSession({ ...editSession, subject: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#D528A2]/30 focus:border-[#D528A2]"
                  />
                </div>

                {/* Assigned SME */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Subject Matter Expert (SME)</label>
                  <select
                    value={editSession.smeId}
                    onChange={(e) => setEditSession({ ...editSession, smeId: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#D528A2]/30 focus:border-[#D528A2] cursor-pointer"
                  >
                    {smes.map(sme => (
                      <option key={sme.id} value={sme.id}>{sme.name} ({sme.subject || "General"})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Date */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Date</label>
                    <input
                      type="date"
                      value={editSession.dateStr}
                      onChange={(e) => setEditSession({ ...editSession, dateStr: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#D528A2]/30 focus:border-[#D528A2] cursor-pointer"
                    />
                  </div>

                  {/* Timeslot */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Time Period</label>
                    <select
                      value={editSession.timeSlot}
                      onChange={(e) => setEditSession({ ...editSession, timeSlot: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#D528A2]/30 focus:border-[#D528A2] cursor-pointer"
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
                    className="btn-gradient flex-1 py-2.5 text-white font-bold rounded-xl text-xs shadow-sm cursor-pointer"
                  >
                    {editSession.id ? "Save Changes" : "Create Schedule"}
                  </button>
                  <button
                    type="button"
                    onClick={setEditSession.bind(null, null)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer transition-colors"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl relative animate-in zoom-in-95 duration-200 space-y-4">

              <button
                onClick={setCellPopover.bind(null, null)}
                className="absolute right-4 top-4 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="p-1.5 rounded-lg bg-[#D528A2]/10 text-[#D528A2]">
                  <Calendar className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-wider">
                    {cellPopover.day} ({cellPopover.dateFormatted})
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold">{cellPopover.timeSlot}</p>
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
                            const mentorGroup = getMentorGroup(mentor);
                            const matchingSme = getSmesForSubjectGroup(mentorGroup)[0] || smes[0];
                            setEditSession({
                              id: "",
                              mentorId: mentor.id,
                              mentorName: mentor.name,
                              smeId: matchingSme?.id || "",
                              smeName: matchingSme?.name || "",
                              dateStr: cellPopover.dateStr,
                              timeSlot: cellPopover.timeSlot,
                              subject: mentorGroup,
                              stream: (slots.filter(s => s.mentorId === mentor.id && s.classGroup)[0]?.classGroup) || "General Stream",
                              week: selectedWeek
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
                        className={`flex items-center justify-between p-3 rounded-xl border text-xs font-bold cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-800 ${isFree
                          ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                          : isDemo
                            ? "bg-[#D528A2]/10 dark:bg-[#D528A2]/20 border-[#D528A2]/30 text-[#D528A2] dark:text-[#f45fc6]"
                            : isPreview
                              ? "bg-amber-50/30 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300"
                              : isBlocked
                                ? "bg-amber-50/10 border-amber-100/50 text-amber-600/80 cursor-not-allowed"
                                : "bg-slate-50/50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 text-slate-400"
                          }`}
                      >
                        <div className="space-y-0.5 text-left">
                          <span className="text-slate-800 dark:text-slate-100 block">{mentor.name}</span>
                          {!isFree && (
                            <span className="text-[9px] text-slate-400 font-semibold block">
                              {statusObj.label}
                            </span>
                          )}
                        </div>
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase shrink-0 ${isFree
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : isDemo
                            ? "bg-[#D528A2]/20 text-[#D528A2] dark:text-[#f45fc6]"
                            : isPreview
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                              : isBlocked
                                ? "bg-amber-100 text-amber-600"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-400"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 w-full max-w-2xl shadow-2xl relative animate-in zoom-in-95 duration-200 space-y-5 flex flex-col max-h-[85vh]">

              <button
                onClick={() => setShowSwapRequestsModal(false)}
                className="absolute right-4 top-4 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 shrink-0">
                <div className="p-1.5 rounded-lg bg-[#D528A2]/10 text-[#D528A2]">
                  <RefreshCw className="h-4.5 w-4.5 animate-spin-slow" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-wider">
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
                  className={`flex-1 pb-2.5 text-xs font-black uppercase tracking-wider text-center border-b-2 transition-all cursor-pointer ${swapRequestsTab === "pending" ? "border-[#D528A2] text-[#D528A2]" : "border-transparent text-slate-400"}`}
                >
                  Pending Review ({demoSwapRequests.filter((r: any) => r.status === "pending").length})
                </button>
                <button
                  type="button"
                  onClick={() => setSwapRequestsTab("resolved")}
                  className={`flex-1 pb-2.5 text-xs font-black uppercase tracking-wider text-center border-b-2 transition-all cursor-pointer ${swapRequestsTab === "resolved" ? "border-[#D528A2] text-[#D528A2]" : "border-transparent text-slate-400"}`}
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
                          className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3.5"
                        >
                          <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-2">
                            <div>
                              <span className="text-[9px] font-black uppercase text-slate-400 block">Requester SME</span>
                              <span className="text-xs font-bold text-slate-800 dark:text-white">{req.smeName}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[9px] font-black uppercase text-slate-400 block">Proposed Action</span>
                              <span className="px-2 py-0.5 bg-[#D528A2]/10 text-[#D528A2] dark:text-[#f45fc6] rounded-lg text-[9px] font-black uppercase">
                                {(req.swapType === "mentor" || req.swapType === "internal") ? "Change Mentor" : "Change Slot"}
                              </span>
                            </div>
                          </div>

                          {/* Details Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1">
                              <span className="text-[8.5px] font-black uppercase text-slate-400 block mb-1">Original Session</span>
                              <p className="font-bold text-slate-700 dark:text-slate-200">{req.mentorName}</p>
                              <p className="text-[10px] text-slate-500">{req.dateStr} • {req.timeSlot}</p>
                              <p className="text-[9px] text-slate-400">{req.subject} • {req.stream}</p>
                            </div>

                            <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1">
                              <span className="text-[8.5px] font-black uppercase text-[#D528A2] block mb-1">Proposed Match</span>
                              {(req.swapType === "mentor" || req.swapType === "internal") ? (
                                <>
                                  <p className="font-bold text-[#D528A2] dark:text-[#f45fc6]">{req.proposedMentorName || req.targetMentorName}</p>
                                  <p className="text-[10px] text-slate-500">{req.dateStr} • {req.timeSlot}</p>
                                  <p className="text-[9px] text-slate-400">Replacing candidate faculty</p>
                                </>
                              ) : (
                                <>
                                  <p className="font-bold text-[#D528A2] dark:text-[#f45fc6]">{req.mentorName}</p>
                                  <p className="text-[10px] text-[#D528A2] dark:text-[#f45fc6] font-bold">{req.proposedDateStr} • {req.proposedTimeSlot}</p>
                                  <p className="text-[9px] text-slate-400">Rescheduling date/time</p>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Reason / Remarks */}
                          <div className="bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                            <p className="text-[9.5px] text-slate-500 dark:text-slate-400"><strong>Reason:</strong> {req.reason}</p>
                            {req.remarks && (
                              <p className="text-[9.5px] text-slate-400 italic mt-1 font-medium">"{req.remarks}"</p>
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
                                <span className="px-2.5 py-1 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-900 rounded-lg text-[10px] font-black uppercase flex items-center gap-1">
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
                                className="px-3.5 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-black transition-all cursor-pointer"
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
                                className="btn-gradient px-4 py-2 text-white rounded-xl text-xs font-black transition-all shadow-xs cursor-pointer"
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
                      <p className="text-[10px] text-slate-400">All submitted SME requests have been processed.</p>
                    </div>
                  )
                ) : (
                  demoSwapRequests.filter((r: any) => r.status !== "pending").length > 0 ? (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-black uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                            <th className="p-3">SME</th>
                            <th className="p-3">Original Session</th>
                            <th className="p-3">Proposed Action</th>
                            <th className="p-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                          {demoSwapRequests.filter((r: any) => r.status !== "pending").map((req: any) => (
                            <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
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
                                  <span className="font-medium text-[#D528A2] dark:text-[#f45fc6]">
                                    Time Swap: {req.proposedDateStr} • {req.proposedTimeSlot}
                                  </span>
                                )}
                              </td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${req.status === "approved"
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                  : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
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
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Close Requests
                </button>
              </div>

            </div>
          </div>
        )}



        {/* 🔹 DEMO SCHEDULE EXCEL IMPORT PREVIEW MODAL */}
        {showDemoExcelImportModal && demoImportPreview && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 font-sans animate-fade-in">
            <div className="bg-white dark:bg-[#131317] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">

              {/* Modal Header */}
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/70 dark:bg-slate-900/60 backdrop-blur-xs">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/20">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                      Demo Schedule Excel Import Preview
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                      Target Subject Group: <strong className="text-[#D528A2] dark:text-[#f45fc6]">{demoImportPreview?.targetSubjectGroup}</strong>
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

                  <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/60 rounded-xl">
                    <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 block">Ready to Import</span>
                    <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">{demoImportPreview?.validCount || 0}</span>
                  </div>

                  <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 rounded-xl">
                    <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 block">Warnings / Clashes</span>
                    <span className="text-lg font-black text-amber-700 dark:text-amber-300">{demoImportPreview?.warnings.length || 0}</span>
                  </div>
                </div>

                {/* Warning Alerts List */}
                {demoImportPreview?.warnings && demoImportPreview.warnings.length > 0 && (
                  <div className="p-3.5 bg-rose-50/80 dark:bg-rose-950/25 border border-rose-200 dark:border-rose-900/60 rounded-xl space-y-1.5">
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
                            <td className="p-2.5 font-bold text-[#D528A2] dark:text-[#f45fc6]">{item.timeSlot}</td>
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
                  className="px-4 py-2 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs border border-slate-200 dark:border-slate-700 cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDemoExcelImport}
                  disabled={isImportingDemoExcel || !demoImportPreview || demoImportPreview.validCount === 0}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 disabled:opacity-50 text-white font-extrabold rounded-xl text-xs shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all cursor-pointer"
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

        {/* 🔹 SELECT MENTOR GROUP TEMPLATE CHOOSER MODAL (MULTI-CAMPUS & DAY-ORDER GATED) */}
        {showTemplateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200 font-sans">
            <div className="bg-white dark:bg-[#131317] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-xl shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">

              {/* Close Button */}
              <button
                onClick={() => setShowTemplateModal(false)}
                className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Header */}
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
                <div className="p-2.5 bg-[#D528A2]/10 text-[#D528A2] rounded-xl shrink-0 border border-[#D528A2]/20">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Download Multi-Campus Timetable Template
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Includes all {colleges.length} applicable colleges, CAM Day Orders &amp; live mentor availability.
                  </p>
                </div>
              </div>

              {/* ⚠️ DAY ORDER PREREQUISITE GATE ALERT */}
              {!allCollegesDayOrderStatus.isAllConfigured ? (
                <div className="p-4 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-extrabold text-xs">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>Day Order Configuration Required by Campus Managers</span>
                  </div>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
                    Template download is currently <strong>locked</strong>. Campus Academic Managers (CM) must configure the Day Order for all colleges for the active week ({currentWeekDates[0]?.formatted} – {currentWeekDates[currentWeekDates.length - 1]?.formatted}) before the template can be generated.
                  </p>
                  <div className="pt-1.5 border-t border-amber-200/60 dark:border-amber-900/60 space-y-1">
                    <span className="text-[10px] font-black uppercase text-amber-900 dark:text-amber-300 block">
                      Unconfigured Campuses ({allCollegesDayOrderStatus.unconfiguredColleges.length}):
                    </span>
                    <div className="max-h-24 overflow-y-auto space-y-1 text-[10.5px] font-semibold text-amber-800 dark:text-amber-300">
                      {allCollegesDayOrderStatus.unconfiguredColleges.map((u, i) => (
                        <div key={i} className="flex items-start gap-1.5">
                          <span className="text-amber-600 font-bold">•</span>
                          <span><strong>{u.college.name}:</strong> Missing Day Order on [{u.missingDates.join(", ")}]</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-xl flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    Day Orders configured for all {allCollegesDayOrderStatus.applicableColleges.length} colleges. Ready for template generation.
                  </span>
                </div>
              )}

              {/* Department / Scope Selector */}
              {(() => {
                const activeGroup = templateMentorGroup || "All";
                const isAllGroups = activeGroup === "All";
                const groupMentors = isAllGroups
                  ? mentors
                  : mentors.filter(m => m && getMentorGroup(m).toLowerCase().trim() === activeGroup.toLowerCase().trim());
                const groupSmes = isAllGroups
                  ? smes
                  : getSmesForSubjectGroup(activeGroup);

                return (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-1.5">
                        Department / Mentor Group Scope
                      </label>
                      <select
                        value={activeGroup}
                        onChange={(e) => setTemplateMentorGroup(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-slate-800 dark:text-white focus:ring-2 focus:ring-[#D528A2] cursor-pointer"
                      >
                        <option value="All">All Departments (Comprehensive Multi-College Roster)</option>
                        {mentorGroups.map(group => (
                          <option key={group} value={group}>{group}</option>
                        ))}
                      </select>
                    </div>

                    {/* Scope Micro-Pills */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-150 dark:border-slate-800/80 text-center">
                        <span className="text-[9px] font-black uppercase text-slate-400 block">Colleges Included</span>
                        <span className="text-xs font-black text-[#D528A2] dark:text-[#f45fc6]">{allCollegesDayOrderStatus.applicableColleges.length} Campuses</span>
                      </div>
                      <div className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-150 dark:border-slate-800/80 text-center">
                        <span className="text-[9px] font-black uppercase text-slate-400 block">Faculty Mentors</span>
                        <span className="text-xs font-black text-slate-800 dark:text-white">{groupMentors.length}</span>
                      </div>
                      <div className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-150 dark:border-slate-800/80 text-center">
                        <span className="text-[9px] font-black uppercase text-slate-400 block">Assigned SMEs</span>
                        <span className="text-xs font-black text-[#D528A2] dark:text-[#f45fc6]">{groupSmes.length}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Campus Day Order Status Overview (Live from CAM Daily Configs) */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Campus Day Orders Check
                    </span>
                    {colleges.length > 1 && (
                      <select
                        value={templateCollegeId || (selectedCollegeId !== "all" ? selectedCollegeId : (colleges[0]?.id || ""))}
                        onChange={(e) => setTemplateCollegeId(e.target.value)}
                        className="px-2 py-0.5 text-[10px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white cursor-pointer"
                      >
                        {colleges.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      fetchDailyConfigs();
                      toast("Refreshed latest Day Orders from CAM database.", "success");
                    }}
                    className="p-1 text-slate-400 hover:text-[#D528A2] dark:hover:text-[#f45fc6] rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-[10px]"
                    title="Refresh Day Orders from CAM Console"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span className="text-[9.5px] font-bold">Sync CAM</span>
                  </button>
                </div>

                {/* Day Order Strip for selected preview college */}
                {(() => {
                  const targetCId = templateCollegeId || (selectedCollegeId !== "all" ? selectedCollegeId : (colleges[0]?.id || ""));
                  const daysData = currentWeekDates.map((w, idx) => {
                    const info = getEffectiveDayOrderInfo(w.dateStr, w.day, idx, targetCId);
                    return { ...w, ...info };
                  });

                  return (
                    <div className="grid grid-cols-5 gap-1.5">
                      {daysData.map((d) => (
                        <div
                          key={d.dateStr}
                          className={`p-1.5 rounded-lg border text-center transition-all ${
                            d.isHoliday
                              ? "bg-rose-50/80 border-rose-200 text-rose-700 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-300"
                              : d.isConfiguredInCam
                              ? "bg-emerald-50/80 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-300"
                              : "bg-amber-50/80 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-300"
                          }`}
                        >
                          <span className="block text-[8.5px] font-bold text-slate-400 uppercase tracking-tight">
                            {d.day.slice(0, 3)}
                          </span>
                          <span className={`block text-[10.5px] font-black mt-0.5 tracking-tight ${
                            d.isHoliday ? "text-rose-600 dark:text-rose-400" : d.isConfiguredInCam ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"
                          }`}>
                            {d.dayOrder}
                          </span>
                          <span className={`block text-[7.5px] font-bold uppercase tracking-tight ${d.isHoliday ? "text-rose-600" : d.isConfiguredInCam ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600"}`}>
                            {d.isHoliday ? "Holiday" : d.isConfiguredInCam ? "CAM Set" : "Unset in CAM"}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Template Package Overview Card */}
              <div className="px-3.5 py-2.5 bg-[#D528A2]/5 dark:bg-[#D528A2]/10 rounded-xl border border-[#D528A2]/20 dark:border-[#D528A2]/30 text-[10.5px] text-slate-600 dark:text-slate-300 space-y-1">
                <div className="font-extrabold text-[#D528A2] dark:text-[#f45fc6] flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span>Bulk Multi-Campus Workbook Package:</span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed pl-5">
                  Generates <strong>Sheet 1 Master_Demo_Schedule</strong> (all colleges combined), individual <strong>Grid tabs for each college</strong> with drop-down menus limited to genuine free faculty, <strong>Eligible_Mentors</strong>, and <strong>Assigned_SMEs</strong>.
                </p>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadDemoTemplate(templateMentorGroup || "All")}
                  disabled={!allCollegesDayOrderStatus.isAllConfigured}
                  className={`px-5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all shadow-md ${
                    allCollegesDayOrderStatus.isAllConfigured
                      ? "bg-gradient-to-r from-[#D528A2] to-[#F4A863] hover:opacity-95 text-white shadow-[#D528A2]/25 cursor-pointer"
                      : "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-300 dark:border-slate-700 shadow-none"
                  }`}
                  title={!allCollegesDayOrderStatus.isAllConfigured ? "Day Order must be configured in CAM before template can be downloaded" : "Download Multi-Campus Excel Template"}
                >
                  <Download className="h-4 w-4" />
                  {allCollegesDayOrderStatus.isAllConfigured ? "Download Multi-Campus Template (.xlsx)" : "Day Order Required to Download"}
                </button>
              </div>

            </div>
          </div>
        )}


      </div>
    </div>
  );
}

