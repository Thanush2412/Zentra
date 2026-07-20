"use client";

import React, { useState, useMemo } from "react";
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
  Loader2
} from "lucide-react";
import { formatTimeLabel, getWeekDates } from "../lib/utils";

export function DemoAllocationDashboard() {
  const {
    colleges,
    mentors,
    slots,
    smes,
    demoSessions,
    demoRules,
    refreshData,
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
  
  // Date selection - defaults to current date (e.g. 2026-07-15)
  const [selectedDateStr, setSelectedDateStr] = useState<string>("2026-07-15");

  // Scheduling generation states
  const [targetDemosCount, setTargetDemosCount] = useState<number>(1);
  const [previewSessions, setPreviewSessions] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<"idle" | "generating" | "done">("idle");
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSwapRequestsModal, setShowSwapRequestsModal] = useState(false);
  const [swapRequestsTab, setSwapRequestsTab] = useState<"pending" | "resolved">("pending");

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

  const mentorGroups = useMemo(() => {
    if (!selectedCollegeId) return [];
    const groups = new Set<string>();
    mentors.forEach(m => {
      if (selectedCollegeId === "all" || m.college_id === selectedCollegeId) {
        if (m.department) {
          groups.add(m.department.trim());
        }
        if (m.subject_group) {
          groups.add(m.subject_group.trim());
        }
      }
    });
    return Array.from(groups);
  }, [mentors, selectedCollegeId]);

  // Derived: List of 5 consecutive dates of the week containing selectedDateStr
  const currentWeekDates = useMemo(() => {
    return getWeekDates(0, selectedDateStr);
  }, [selectedDateStr]);

  // Derived: Filtered list of mentors (used by scheduler and grid)
  const filteredMentors = useMemo(() => {
    if (!selectedCollegeId) return [];
    return mentors.filter(m => {
      const matchCollege = selectedCollegeId === "all" || m.college_id === selectedCollegeId;
      
      let matchGroup = true;
      if (selectedGroupId !== "All") {
        matchGroup = m.department === selectedGroupId || 
                     m.subject_group?.toLowerCase().trim() === selectedGroupId.toLowerCase().trim();
      }
      
      return matchCollege && matchGroup;
    });
  }, [mentors, selectedCollegeId, selectedGroupId]);

  // Derived: Timetable slots for the selected college
  const collegeTimeSlots = useMemo(() => {
    if (!selectedCollegeId) return [];
    const uniqueSlots = new Set<string>();
    
    slots.forEach(s => {
      if ((selectedCollegeId === "all" || s.college_id === selectedCollegeId) && s.time) {
        uniqueSlots.add(s.time.trim());
      }
    });

    colleges.forEach(c => {
      if ((selectedCollegeId === "all" || c.id === selectedCollegeId) && c.shift_configs) {
        try {
          const parsed = JSON.parse(c.shift_configs);
          const s1 = parsed.shift_1 || [];
          const s2 = parsed.shift_2 || [];
          const gen = parsed.general || [];
          s1.forEach((t: string) => uniqueSlots.add(t.trim()));
          s2.forEach((t: string) => uniqueSlots.add(t.trim()));
          gen.forEach((t: string) => uniqueSlots.add(t.trim()));
        } catch (_) {}
      }
    });

    if (uniqueSlots.size === 0) {
      return [];
    }

    const parseTimeToMinutes = (t: string) => {
      const match = t.match(/^(\d+)(?:\.(\d+))?\s*(AM|PM)/i);
      if (!match) return 9999;
      let hr = parseInt(match[1]);
      const min = match[2] ? parseInt(match[2]) : 0;
      const isPm = match[3].toUpperCase() === "PM";
      if (isPm && hr < 12) hr += 12;
      if (!isPm && hr === 12) hr = 0;
      return hr * 60 + min;
    };

    return Array.from(uniqueSlots).sort((a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b));
  }, [slots, selectedCollegeId, colleges]);

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
        } catch (_) {}
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

  // Helper: check if an SME is free on a given date/time
  const isSmeFree = (smeId: string, dateStr: string, time: string, newlyScheduled: any[] = []) => {
    const databaseBusy = demoSessions.some(ds => ds.smeId === smeId && ds.dateStr === dateStr && ds.timeSlot === time);
    if (databaseBusy) return false;

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
      const subjectGroup = mentor.subject_group || "General";
      const mentorClasses = slots.filter(s => s.mentorId === mentor.id && s.classGroup);
      const stream = (mentorClasses.length > 0 ? mentorClasses[0].classGroup : null) || "General Stream";

      for (let targetIdx = 0; targetIdx < targetDemosCount; targetIdx++) {
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
        let eligibleSmes = smes.filter(sme =>
          sme.subject?.toLowerCase().trim() === demand.subjectGroup.toLowerCase().trim()
        );
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

              // Compute Score
              let score = 0;
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
        refreshData();
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
        setEditSession(null);
        refreshData();
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

  // Calculation details for preview
  const unassignedMentors = useMemo(() => {
    if (generationStep !== "done") return [];
    return filteredMentors.filter(m => 
      !previewSessions.some(p => p.mentorId === m.id)
    );
  }, [filteredMentors, previewSessions, generationStep]);

  return (
    <div className="flex-grow overflow-y-auto bg-slate-50/50 dark:bg-slate-900/10 p-3 md:p-6 pb-20 md:pb-6 space-y-6 w-full max-w-[1400px] mx-auto font-sans scroll-touch">
      
      {/* Page Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/60 dark:border-slate-805">
        <div className="space-y-1">
          <h1 className="text-lg font-black text-slate-905 dark:text-white tracking-tight flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-655 animate-pulse" />
            Demo Scheduling Dashboard
          </h1>
          <p className="text-[11.5px] text-slate-405 font-bold leading-none dark:text-slate-400">
            Consolidate and allocate department demo sessions for mentors and SMEs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => { refreshData(); toast("Refreshed timetable data.", "success"); }}
            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200 rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-2 transition-all"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          
          <button
            onClick={() => setShowSettingsModal(true)}
            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-755 border border-slate-200 rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-2 transition-all"
          >
            <Settings className="h-3.5 w-3.5 text-indigo-500" />
            Department Rules
          </button>

          <button
            onClick={() => setShowSwapRequestsModal(true)}
            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-755 border border-slate-200 rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-2 transition-all relative"
          >
            <RefreshCw className="h-3.5 w-3.5 text-indigo-500 animate-spin-slow" />
            Swap Requests
            {demoSwapRequests.filter((r: any) => r.status === "pending").length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-rose-500 text-white rounded-full text-[9px] font-black flex items-center justify-center animate-pulse">
                {demoSwapRequests.filter((r: any) => r.status === "pending").length}
              </span>
            )}
          </button>

          <button
            onClick={handleTriggerGenerate}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 transition-all cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5 text-white" />
            Generate Schedule
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-855 rounded-3xl shadow-sm overflow-auto max-h-[70vh] w-full no-scrollbar relative">
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
                                                  subject: mentor.subject_group || "General",
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
                                            className={`flex flex-col p-1.5 rounded-lg border text-[9.5px] font-bold cursor-pointer transition-all hover:translate-x-0.5 text-left ${
                                              isFree
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
                                              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                                                isFree
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
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
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
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
          <h3 className="text-xs font-black uppercase text-slate-705 dark:text-white tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">Info</h3>
          <ul className="list-disc pl-4 text-[10.5px] text-slate-505 dark:text-slate-400 space-y-1.5 font-semibold">
            <li>Time slots are in 60 min duration</li>
            <li>Lunch break is excluded from scheduling</li>
            <li>Beyond college hours are shown below the divider</li>
          </ul>
        </div>

        {/* Card 3: Beyond College Hours */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-805 rounded-2xl p-5 shadow-xs space-y-3 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-black uppercase text-slate-705 dark:text-white tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-1.5">
              <Moon className="h-3.5 w-3.5 text-indigo-505" />
              Beyond College Hours
            </h3>
            <div className="pt-2 text-[10.5px] font-bold text-slate-700 dark:text-slate-305 space-y-1.5">
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-805/40 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                <span>Slot 1:</span>
                <span className="text-indigo-650 dark:text-indigo-400 font-extrabold">04:30 PM - 05:30 PM</span>
              </div>
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-805/40 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                <span>Slot 2:</span>
                <span className="text-indigo-650 dark:text-indigo-400 font-extrabold">05:30 PM - 06:30 PM</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 🔹 AUTOMATED GENERATION PREVIEW MODAL */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-3xl p-6 w-full max-w-2xl shadow-2xl relative animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            
            <button
              onClick={() => { if(!isGenerating) setShowPreviewModal(false); }}
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
                  <div className="w-full max-w-xs bg-slate-50 dark:bg-slate-855 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-505 dark:text-slate-405 space-y-2 text-left">
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
                  <div className="grid grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-850/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 text-center">
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
                          <div key={exc.id} className="p-3 bg-rose-50/20 dark:bg-rose-950/10 border border-rose-150/40 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
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
                    <div className="border border-slate-150 rounded-2xl overflow-hidden max-h-[200px] overflow-y-auto">
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative animate-in zoom-in-95 duration-200 space-y-4 flex flex-col max-h-[85vh]">

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
                  <div key={groupName} className="grid grid-cols-[1fr_80px_56px] gap-3 items-center p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-150 dark:border-slate-800">
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
                      className={`w-full text-center px-2 py-2 text-sm font-black border rounded-xl bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 transition-all ${
                        isDirty
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
                      className={`w-full py-2 rounded-xl text-[10px] font-black transition-all ${
                        isDirty
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
          <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative animate-in zoom-in-95 duration-200 space-y-5">
            
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
                  refreshData();
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

              {/* Subject Area */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-405 tracking-wider">Subject Group</label>
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative animate-in zoom-in-95 duration-200 space-y-4">
            
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
                            subject: mentor.subject_group || "General",
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
                      className={`flex items-center justify-between p-3 rounded-xl border text-xs font-bold cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-805 ${
                        isFree
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
                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase shrink-0 ${
                        isFree
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-2xl shadow-2xl relative animate-in zoom-in-95 duration-200 space-y-5 flex flex-col max-h-[85vh]">

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
                        className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-150 dark:border-slate-800 space-y-3.5"
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
                                ⚠ Clash: {validation.message}
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
                  <div className="border border-slate-150 dark:border-slate-800 rounded-2xl overflow-hidden">
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
                              <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${
                                req.status === "approved"
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

    </div>
  );
}
