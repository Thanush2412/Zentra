"use client";

import React, { useState, useEffect, useRef } from "react";
import { useApp } from "../context/AppContext";
import { useToast } from "../context/ToastContext";
import { gsap } from "gsap";
import {
  Building2, Users, ClipboardList, ShieldAlert, CheckCircle2,
  PlusCircle, Trash2, RefreshCw, Plus, Compass, ChevronsLeft, ChevronsRight, User,
  ArrowRightLeft, TrendingUp, Scale, Clock, XCircle, ChevronRight, Settings
} from "lucide-react";
import { Button } from "./Button";
import { Card } from "./Card";
import { Panel } from "./Panel";
import { Input } from "./Input";
import { Select } from "./Select";

// Persistent global flag to prevent sidebar animating on every re-mount during navigation
let isFirstSidebarAnimationDone = false;

export interface KAMDashboardProps {
  activeTab?: "colleges" | "tasks" | "escalations" | "swap_tracker" | "profile";
  onTabChange?: (tab: "colleges" | "tasks" | "escalations" | "swap_tracker" | "profile") => void;
}

export const KAMDashboard: React.FC<KAMDashboardProps> = ({
  activeTab: propActiveTab,
  onTabChange
}) => {
  const {
    currentKAM,
    colleges,
    mentors,
    students,
    slots,
    requests,
    approvedHandovers,
    refreshData,
    kamTasks: tasks,
    campusIssues: escalations,
    saveKamTask,
    deleteKamTask,
    updateCampusIssueStatus
  } = useApp();
  const { toast } = useToast();

  const activeColleges = colleges.filter(c => !currentKAM || c.kam_id === currentKAM.id);

  const [localActiveTab, setLocalActiveTab] = useState<"colleges" | "tasks" | "escalations" | "swap_tracker" | "profile">("colleges");
  const activeTab = propActiveTab || localActiveTab;
  const setActiveTab = onTabChange || setLocalActiveTab;

  // GSAP animation references & states
  const containerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);

  // GSAP Tab Change entrance animation
  useEffect(() => {
    if (typeof window !== "undefined" && containerRef.current) {
      const cardElements = Array.from(
        containerRef.current.querySelectorAll(
          ".rounded-3xl, .rounded-2xl, .rounded-xl, .bg-white, .bg-pastel-cream, .bg-pastel-blue, .bg-pastel-purple, .bg-pastel-green, .animate-gsap-card"
        )
      ).filter(el => {
        if (el.closest(".floating-sidebar") || el.closest("header") || el.tagName === "ASIDE") {
          return false;
        }
        const parentCard = el.parentElement?.closest(
          ".rounded-3xl, .rounded-2xl, .rounded-xl, .bg-white, .bg-pastel-cream, .bg-pastel-blue, .bg-pastel-purple, .bg-pastel-green"
        );
        return !parentCard;
      });

      if (cardElements.length > 0) {
        gsap.killTweensOf(cardElements);
        gsap.fromTo(
          cardElements,
          { opacity: 0, y: 15, scale: 0.97 },
          { 
            opacity: 1, 
            y: 0, 
            scale: 1,
            duration: 0.5, 
            stagger: 0.04, 
            ease: "back.out(0.8)" 
          }
        );
      }
    }
  }, [activeTab]);

  // GSAP Sidebar load animations on mount
  useEffect(() => {
    if (typeof window !== "undefined" && sidebarRef.current && !isFirstSidebarAnimationDone) {
      const parentButtons = sidebarRef.current.querySelectorAll(".sidebar-group-btn");
      if (parentButtons.length > 0) {
        isFirstSidebarAnimationDone = true; // Set flag so it never runs again on re-mount
        gsap.fromTo(
          parentButtons,
          { opacity: 0, x: -20, scale: 0.9 },
          { 
            opacity: 1, 
            x: 0, 
            scale: 1,
            duration: 0.55, 
            stagger: 0.05, 
            ease: "back.out(1.3)",
            delay: 0.05
          }
        );
      }
    }
  }, []);

  // GSAP Stagger sub-menu item entrances on category hover
  useEffect(() => {
    if (typeof window !== "undefined" && hoveredGroupId && sidebarRef.current) {
      const subButtons = sidebarRef.current.querySelectorAll(
        `.submenu-${hoveredGroupId} .submenu-button`
      );
      if (subButtons.length > 0) {
        gsap.killTweensOf(subButtons);
        gsap.fromTo(
          subButtons,
          { opacity: 0, x: -12, scale: 0.93 },
          { 
            opacity: 1, 
            x: 0, 
            scale: 1,
            duration: 0.28, 
            stagger: 0.03, 
            ease: "back.out(1.1)" 
          }
        );
      }
    }
  }, [hoveredGroupId]);

  const [isCollapsed, setIsCollapsed] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("fp_sidebar_collapsed") === "true";
      setIsCollapsed(stored);
    }
  }, []);

  // Task form inputs
  const [taskTitle, setTaskTitle] = useState("");
  const [taskCollegeId, setTaskCollegeId] = useState("");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [taskDueDate, setTaskDueDate] = useState("");

  useEffect(() => {
    if (activeColleges.length > 0) {
      setTaskCollegeId(activeColleges[0].id);
    }
  }, [activeColleges]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !taskDueDate) return;

    const newTask = {
      title: taskTitle,
      collegeId: taskCollegeId,
      priority: taskPriority,
      status: "pending",
      dueDate: taskDueDate
    };

    const res = await saveKamTask(newTask);
    if (res.success) {
      setTaskTitle("");
      setTaskDueDate("");
      toast("Task assigned successfully.", "success");
    } else {
      toast(res.message || "Failed to create task", "error");
    }
  };

  const handleDeleteTask = async (id: string) => {
    const res = await deleteKamTask(id);
    if (res.success) {
      toast("Task deleted successfully.", "success");
    } else {
      toast(res.message || "Failed to delete task", "error");
    }
  };

  const handleResolveEscalation = async (id: string) => {
    const res = await updateCampusIssueStatus(id, "resolved", new Date().toLocaleDateString());
    if (res.success) {
      toast("Escalated issue resolved.", "success");
    } else {
      toast(res.message || "Failed to resolve escalation", "error");
    }
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row bg-warm-canvas text-slate-805 font-sans h-full overflow-hidden dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-950 dark:to-indigo-950 dark:text-slate-100">
      {(() => {
        const getNotificationCount = (tabId: string) => {
          if (tabId === "tasks") return tasks.filter(t => t.status === "pending").length;
          if (tabId === "escalations") return escalations.filter(e => e.status === "pending").length;
          return 0;
        };

        return (
          <aside ref={sidebarRef} className={`hidden md:flex shrink-0 flex-col justify-between sticky top-6 z-30 floating-sidebar transition-all duration-300 ${isCollapsed ? "w-20 p-3" : "w-64 p-5"}`}>
            <div className="flex flex-col flex-1 overflow-visible">
              {/* Sidebar Link items */}
              <nav className={`py-2 space-y-2 ${isCollapsed ? "px-1" : "px-4"}`}>
                {[
                  {
                    id: "portfolio",
                    title: "Campuses",
                    icon: Building2,
                    items: [
                      { id: "colleges", label: "Assigned Campuses", icon: Building2 },
                      { id: "swap_tracker", label: "Swap Ledger", icon: ArrowRightLeft }
                    ]
                  },
                  {
                    id: "actions",
                    title: "Directives",
                    icon: ClipboardList,
                    items: [
                      { id: "tasks", label: "Assign Task", icon: ClipboardList },
                      { id: "escalations", label: "Escalated Issues", icon: ShieldAlert }
                    ]
                  },
                  {
                    id: "settings",
                    title: "Settings",
                    icon: User,
                    items: [
                      { id: "profile", label: "My Profile", icon: User }
                    ]
                  }
                ].map((group) => {
                  const Icon = group.icon;
                  const isAnyChildActive = group.items.some(item => activeTab === item.id);
                  const totalPendingInGroup = group.items.reduce((sum, item) => sum + getNotificationCount(item.id), 0);

                  return (
                    <div 
                      key={group.id} 
                      className="relative py-0.5"
                      onMouseEnter={() => setHoveredGroupId(group.id)}
                      onMouseLeave={() => setHoveredGroupId(null)}
                    >
                      <button
                        type="button"
                        className={`sidebar-group-btn w-full flex items-center rounded-2xl transition-all duration-200 cursor-pointer ${
                          isCollapsed ? "justify-center px-0 py-3.5" : "justify-between px-4 py-3.5 text-left"
                        } ${
                          isAnyChildActive
                            ? "bg-[#D528A2]/5 text-[#D528A2] border border-[#D528A2]/20 dark:bg-[#D528A2]/10 dark:text-[#F4A863] dark:border-[#F4A863]/25"
                            : "text-slate-500 hover:text-slate-805 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon className={`h-4.5 w-4.5 shrink-0 ${isAnyChildActive ? "text-[#D528A2]" : "text-slate-400 dark:text-slate-500"}`} />
                          {!isCollapsed && <span className="text-xs font-bold truncate">{group.title}</span>}
                        </div>
                        {!isCollapsed && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            {totalPendingInGroup > 0 && (
                              <span className="bg-rose-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">
                                {totalPendingInGroup}
                              </span>
                            )}
                            <ChevronRight className={`h-3 w-3 transition-transform ${isAnyChildActive ? "text-[#D528A2]" : "text-slate-400"}`} />
                          </div>
                        )}
                      </button>

                      {/* Outside Hover Sub-Menu Popover Container (Invisible hover bridge) */}
                      <div className={`absolute left-full top-0 pl-2 w-56 z-50 submenu-${group.id} ${hoveredGroupId === group.id ? "block" : "hidden"}`}>
                        {/* The actual styled card */}
                        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-[#D528A2]/20 dark:border-slate-800 shadow-xl rounded-2xl p-2.5 animate-fadeIn">
                          <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest border-b border-slate-105 dark:border-slate-800 mb-1.5 text-[#D528A2] dark:text-[#F4A863]">
                            {group.title}
                          </div>
                          <div className="space-y-0.5">
                            {group.items.map(child => {
                              const ChildIcon = child.icon;
                              const isChildActive = activeTab === child.id;
                              const count = getNotificationCount(child.id);
                              return (
                                <button
                                  key={child.id}
                                  type="button"
                                  onClick={() => {
                                    setActiveTab(child.id as any);
                                    setHoveredGroupId(null);
                                  }}
                                  className={`submenu-button w-full flex items-center justify-start gap-3 px-2.5 py-2 text-left rounded-xl text-[11px] font-bold tracking-tight transition-all duration-150 cursor-pointer ${
                                    isChildActive
                                      ? "sidebar-active-item shadow-sm"
                                      : "text-slate-600 hover:text-[#D528A2] hover:bg-[#D528A2]/5 dark:text-slate-450 dark:hover:text-[#F4A863] dark:hover:bg-white/5"
                                  }`}
                                >
                                  <ChildIcon className={`h-3.5 w-3.5 shrink-0 ${isChildActive ? "text-white" : "text-slate-400"}`} />
                                  <span className="flex-1 truncate">{child.label}</span>
                                  {count > 0 && (
                                    <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isChildActive ? "bg-white text-[#D528A2]" : "bg-rose-500 text-white"}`}>
                                      {count}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </nav>
            </div>

            {/* User profile card & collapse button at bottom */}
            <div className="border-t border-slate-100/85 dark:border-white/10 pt-4 space-y-3 shrink-0">
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={() => setIsCollapsed((prev) => {
                    const next = !prev;
                    localStorage.setItem("fp_sidebar_collapsed", String(next));
                    return next;
                  })}
                  className="h-8.5 w-8.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs transition-all cursor-pointer"
                  title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                  {isCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </aside>
        );
      })()}

      {/* Mobile Bottom Navigation — visible only on small screens */}
      <nav className="flex md:hidden fixed bottom-0 inset-x-0 z-50 mobile-bottom-nav">
        <div className="flex w-full justify-around items-center py-2 px-1">
          {[
            { id: "colleges", label: "Campuses", icon: Building2 },
            { id: "tasks", label: "Tasks", icon: ClipboardList },
            { id: "escalations", label: "Escalations", icon: ShieldAlert },
            { id: "swap_tracker", label: "Swaps", icon: ArrowRightLeft },
            { id: "profile", label: "Profile", icon: User },
          ].map(t => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            const count = t.id === "tasks" ? tasks.filter(x => x.status === "pending").length
              : t.id === "escalations" ? escalations.filter(e => e.status === "pending").length : 0;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-xl transition-all cursor-pointer ${
                  isActive ? "text-indigo-600" : "text-slate-400"
                }`}
              >
                <div className="relative">
                  <Icon className={`h-5 w-5 transition-transform ${isActive ? "scale-110" : ""}`} />
                  {count > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 bg-rose-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                      {count}
                    </span>
                  )}
                </div>
                <span className={`text-[9px] font-semibold tracking-wide leading-none ${isActive ? "text-indigo-600" : "text-slate-400"}`}>
                  {t.label}
                </span>
                {isActive && <span className="absolute top-0 inset-x-2 h-0.5 bg-indigo-500 rounded-full" />}
              </button>
            );
          })}
        </div>
      </nav>

      {/*  Main Scrollable Content Area */}
      <main ref={containerRef} className="flex-grow overflow-x-hidden overflow-y-auto h-full p-4 md:p-6 space-y-6 pb-20 md:pb-16 relative scroll-touch">
        {/* Decorative Blur Orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-7xl mx-auto w-full space-y-6 relative z-10 animate-fadeIn">
          {/* Floating Glassmorphic Header */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-3xl p-5 md:p-8 shadow-sm dark:shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/20 text-indigo-650 dark:text-indigo-300 text-[10px] font-black uppercase tracking-widest border border-indigo-100 dark:border-indigo-500/30 shadow-inner">
                  Key Account Manager (KAM) Dashboard
                </span>
              </div>
              <h1 className="text-lg md:text-2xl font-black tracking-tight text-slate-800 dark:text-white">
                Welcome back, {currentKAM?.name || "Portfolio Manager"}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-bold">Managing {activeColleges.length} campus networks across region.</p>
            </div>

            <Button
              variant="primary"
              size="md"
              icon={<RefreshCw className="h-4 w-4 hover-spin-icon" />}
              onClick={() => { refreshData(); toast("Data synced from server.", "info"); }}
              className="shrink-0 self-start sm:self-center"
            >
              Refresh Data
            </Button>
          </div>

          {/* Tab 1: Campuses Directory */}
          {activeTab === "colleges" && (
            <div className="space-y-6">
              {/* KPI metrics cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <Card
                  label="Colleges Managed"
                  value={`${activeColleges.length} Campuses`}
                  icon={<Building2 className="h-5 w-5" />}
                  success={true}
                  className="bg-pastel-blue"
                />
                <Card
                  label="Open Escalations"
                  value={`${escalations.filter(e => e.status === "pending").length} Alerts`}
                  icon={<ShieldAlert className="h-5 w-5 animate-pulse" />}
                  success={escalations.filter(e => e.status === "pending").length === 0}
                  className="bg-pastel-cream"
                />
                <Card
                  label="Tasks Dispatched"
                  value={`${tasks.length} Assigned`}
                  icon={<ClipboardList className="h-5 w-5" />}
                  success={true}
                  className="bg-pastel-purple"
                />
              </div>

              {/* Assigned Campuses Grid */}
              <Panel
                title="Assigned Portfolio Colleges"
                subtitle="Review colleges currently linked to your KAM assignment"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
                  {activeColleges.map(c => {
                    const mentorsCount = mentors.filter(m => m.college_id === c.id).length;
                    const studentsCount = students.filter(s => s.college_id === c.id).length;
                    const slotsCount = slots.filter(s => (s.college_id || mentors.find(m => m.id === s.mentorId)?.college_id) === c.id).length;

                    return (
                      <div key={c.id} className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 flex flex-col justify-between gap-4 hover:border-indigo-500/20 dark:hover:border-indigo-500/40 transition-all">
                        <div>
                          <h4 className="text-xs font-black text-slate-800 dark:text-white">{c.name}</h4>
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Location: {c.address || "Coimbatore, TN"}</span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
                          <div className="bg-white dark:bg-slate-950 p-2 rounded-xl border border-slate-100 dark:border-slate-850">
                            <span className="text-slate-500 dark:text-slate-455 block">Students</span>
                            <span className="text-xs font-black text-slate-855 dark:text-white block mt-0.5">{studentsCount}</span>
                          </div>
                          <div className="bg-white dark:bg-slate-950 p-2 rounded-xl border border-slate-100 dark:border-slate-850">
                            <span className="text-slate-500 dark:text-slate-455 block">Faculty</span>
                            <span className="text-xs font-black text-slate-855 dark:text-white block mt-0.5">{mentorsCount}</span>
                          </div>
                          <div className="bg-white dark:bg-slate-950 p-2 rounded-xl border border-slate-100 dark:border-slate-850">
                            <span className="text-slate-500 dark:text-slate-455 block">Schedules</span>
                            <span className="text-xs font-black text-indigo-650 dark:text-indigo-300 block mt-0.5">{slotsCount} slots</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            </div>
          )}

          {/* Tab 2: Assign Task */}
          {activeTab === "tasks" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">              {/* Assign Task Form */}
              <Panel
                title="Assign Task to CAM"
                subtitle="Direct task items to campus academic managers"
              >
                <form onSubmit={handleCreateTask} className="space-y-4 text-xs font-semibold">
                  <Select
                    label="Target College"
                    value={taskCollegeId}
                    onChange={e => setTaskCollegeId(e.target.value)}
                    options={activeColleges.map(c => ({ value: c.id, label: c.name }))}
                    required
                  />

                  <Input
                    label="Task Directive"
                    type="text"
                    placeholder="e.g. Verify missing mark entries"
                    value={taskTitle}
                    onChange={e => setTaskTitle(e.target.value)}
                    required
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <Select
                      label="Priority"
                      value={taskPriority}
                      onChange={e => setTaskPriority(e.target.value)}
                      options={[
                        { value: "high", label: "High" },
                        { value: "medium", label: "Medium" },
                        { value: "low", label: "Low" }
                      ]}
                    />

                    <Input
                      label="Due Date"
                      type="date"
                      value={taskDueDate}
                      onChange={e => setTaskDueDate(e.target.value)}
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="gradient"
                    size="md"
                    icon={<PlusCircle className="h-4.5 w-4.5" />}
                    className="w-full mt-2"
                  >
                    Assign Task
                  </Button>
                </form>
              </Panel>

              {/* Assigned Task ledger list */}
              <Panel
                title="Tasks Logs"
                subtitle="Review status of active assignments"
              >
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {tasks.map(t => {
                    const college = colleges.find(c => c.id === t.collegeId);
                    return (
                      <div key={t.id} className="p-3.5 rounded-xl border border-slate-105 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 flex items-center justify-between gap-4 hover:border-indigo-500/25 dark:hover:border-indigo-500/40 transition-all">
                        <div className="space-y-1 text-[11px] font-semibold">
                          <div className="flex items-center gap-1.5 text-[9px] uppercase font-black">
                            <span className={`px-1.5 py-0.5 rounded ${t.priority === "high" ? "bg-red-500/10 text-red-650 dark:text-red-400 border border-red-550/20" : "bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-550/20"
                              }`}>{t.priority}</span>
                            <span className="text-slate-505 dark:text-slate-450">{college ? college.name : "Campus"}</span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-800 dark:text-white">{t.title}</h4>
                          <p className="text-[10px] text-slate-505 dark:text-slate-400">
                            Status: <strong className={t.status === "completed" ? "text-emerald-650 dark:text-emerald-450" : "text-amber-600 dark:text-amber-400"}>{t.status}</strong>
                          </p>
                        </div>

                        <button onClick={() => handleDeleteTask(t.id)} className="p-1.5 text-red-550 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                  {tasks.length === 0 && <p className="text-xs text-slate-500 italic text-center py-6">No tasks assigned.</p>}
                </div>
              </Panel>
            </div>
          )}

          {/* Tab 3: Escalated Issues */}
          {activeTab === "escalations" && (
            <div className="max-w-3xl mx-auto w-full">              {/* Escalated Issues list */}
              <Panel
                title="Escalated Campus Issues"
                subtitle="Review and resolve items forwarded by CAMs"
              >
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {escalations.map(esc => (
                    <div key={esc.id} className="p-3.5 rounded-xl border border-slate-105 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 flex flex-col justify-between gap-3 hover:border-indigo-500/20 dark:hover:border-indigo-500/40 transition-all">
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[9px] uppercase font-black">
                          <span className="text-indigo-650 dark:text-indigo-455 font-bold">{esc.collegeName}</span>
                          <span className="text-slate-500 dark:text-slate-450 font-semibold">{esc.escalatedAt || "Today"}</span>
                        </div>
                        <h4 className="text-xs font-black text-slate-800 dark:text-white">{esc.title}</h4>
                        <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed italic">"{esc.desc}"</p>
                      </div>

                      {esc.status === "pending" ? (
                        <Button
                          variant="secondary"
                          size="xs"
                          onClick={() => handleResolveEscalation(esc.id)}
                          className="w-full"
                        >
                          Mark Resolved
                        </Button>
                      ) : (
                        <span className="w-full py-1.5 bg-emerald-500/10 text-emerald-650 dark:text-emerald-450 font-black border border-emerald-500/20 text-[10px] rounded text-center block">
                          Resolved
                        </span>
                      )}
                    </div>
                  ))}
                  {escalations.length === 0 && (
                    <p className="text-xs text-slate-500 italic text-center py-6">All campuses fully SLA compliant.</p>
                  )}
                </div>
              </Panel>
            </div>
          )}

          {/* Tab: Swap Ledger */}
          {activeTab === "swap_tracker" && (() => {
            // Collect swap requests across all KAM's portfolio colleges
            const portfolioMentorIds = new Set(
              mentors.filter(m => activeColleges.some(c => c.id === m.college_id)).map(m => m.id)
            );
            const allSwapRequests = requests.filter(
              r => r.request_type === "swap_compensate" && portfolioMentorIds.has(r.requestorId)
            );
            const pendingSwaps = allSwapRequests.filter(r => r.status === "pending" || r.status === "pending_cam");
            const settledSwaps = allSwapRequests.filter(r => r.status === "approved");
            const declinedSwaps = allSwapRequests.filter(r => r.status === "rejected");

            // Per-campus breakdown
            const campusBreakdown = activeColleges.map(college => {
              const collegeMentorIds = new Set(mentors.filter(m => m.college_id === college.id).map(m => m.id));
              const campusSwaps = allSwapRequests.filter(r => collegeMentorIds.has(r.requestorId));
              return {
                college,
                swaps: campusSwaps,
                pending: campusSwaps.filter(r => r.status === "pending" || r.status === "pending_cam").length,
                settled: campusSwaps.filter(r => r.status === "approved").length
              };
            }).filter(c => c.swaps.length > 0 || true); // show all

            // Build workload balance ledger across all campuses
            interface WorkloadRow {
              mentorId: string;
              mentorName: string;
              department: string;
              collegeName: string;
              given: number;
              received: number;
              swapsPending: number;
              swapsSettled: number;
            }
            const ledgerMap = new Map<string, WorkloadRow>();
            approvedHandovers.forEach(h => {
              const mentor = mentors.find(m => m.id === h.originalMentorId);
              if (!mentor) return;
              if (!portfolioMentorIds.has(mentor.id)) return;
              const college = activeColleges.find(c => c.id === mentor.college_id);
              if (!ledgerMap.has(mentor.id)) {
                ledgerMap.set(mentor.id, {
                  mentorId: mentor.id, mentorName: mentor.name,
                  department: mentor.department || "—",
                  collegeName: college?.name || "—",
                  given: 0, received: 0, swapsPending: 0, swapsSettled: 0
                });
              }
              ledgerMap.get(mentor.id)!.given++;
            });
            approvedHandovers.forEach(h => {
              const mentor = mentors.find(m => m.id === h.coverStaffId);
              if (!mentor) return;
              if (!portfolioMentorIds.has(mentor.id)) return;
              const college = activeColleges.find(c => c.id === mentor.college_id);
              if (!ledgerMap.has(mentor.id)) {
                ledgerMap.set(mentor.id, {
                  mentorId: mentor.id, mentorName: mentor.name,
                  department: mentor.department || "—",
                  collegeName: college?.name || "—",
                  given: 0, received: 0, swapsPending: 0, swapsSettled: 0
                });
              }
              ledgerMap.get(mentor.id)!.received++;
            });
            // Overlay swap stats
            allSwapRequests.forEach(r => {
              const row = ledgerMap.get(r.requestorId);
              if (row) {
                if (r.status === "pending" || r.status === "pending_cam") row.swapsPending++;
                if (r.status === "approved") row.swapsSettled++;
              }
            });
            const ledgerList = Array.from(ledgerMap.values())
              .map(row => ({ ...row, balance: row.given - row.received }))
              .filter(row => row.balance !== 0 || row.swapsPending > 0 || row.swapsSettled > 0)
              .sort((a, b) => b.balance - a.balance);

            return (
              <div className="space-y-6">
                {/* Header + KPI Tiles */}
                <Panel
                  title="Cross-Campus Swap & Compensation Ledger"
                  subtitle="Portfolio-wide view of faculty hour debts and swap resolution progress"
                >
                  {/* KPI Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2">
                    <Card
                      label="Total Swap Requests"
                      value={allSwapRequests.length}
                      icon={<ArrowRightLeft className="h-4.5 w-4.5 text-indigo-650" />}
                      className="bg-pastel-blue"
                    />
                    <Card
                      label="Pending Resolution"
                      value={pendingSwaps.length}
                      icon={<Clock className="h-4.5 w-4.5 text-amber-600" />}
                      success={pendingSwaps.length === 0}
                      className="bg-pastel-cream"
                    />
                    <Card
                      label="Debts Settled"
                      value={settledSwaps.length}
                      icon={<CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" />}
                      success={true}
                      className="bg-pastel-green"
                    />
                    <Card
                      label="Declined Offers"
                      value={declinedSwaps.length}
                      icon={<XCircle className="h-4.5 w-4.5 text-rose-600" />}
                      success={true}
                      className="bg-pastel-purple"
                    />
                  </div>
                </Panel>

                {/* Per-Campus Swap Breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {campusBreakdown.map(cb => (
                    <div key={cb.college.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-855 p-4 rounded-2xl shadow-sm flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-800 dark:text-white">{cb.college.name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase border ${
                          cb.pending > 0 ? "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" :
                          "bg-teal-50 border-teal-200 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300"
                        }`}>
                          {cb.pending > 0 ? `${cb.pending} pending` : "All settled"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-center text-[10px] font-bold">
                        <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl py-2 border border-amber-100 dark:border-amber-500/20">
                          <div className="text-lg font-black text-amber-700 dark:text-amber-300">{cb.pending}</div>
                          <div className="text-amber-600 dark:text-amber-400 text-[8px] uppercase font-black">Pending</div>
                        </div>
                        <div className="bg-teal-50 dark:bg-teal-500/10 rounded-xl py-2 border border-teal-100 dark:border-teal-500/20">
                          <div className="text-lg font-black text-teal-700 dark:text-teal-300">{cb.settled}</div>
                          <div className="text-teal-600 dark:text-teal-400 text-[8px] uppercase font-black">Settled</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Full Swap Request Log */}
                <Panel
                  title="All Swap Requests Across Portfolio"
                  subtitle="Chronological log of all swap-to-compensate offers from your portfolio campuses"
                >
                  {allSwapRequests.length === 0 ? (
                    <div className="text-center py-10 border border-dashed border-slate-205 dark:border-slate-800 rounded-2xl">
                      <p className="text-3xl mb-2">↔</p>
                      <p className="text-xs text-slate-400 italic font-semibold">No swap compensation requests across portfolio yet.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs mt-2">
                      <table className="w-full border-collapse text-left text-xs font-semibold min-w-[580px]">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold uppercase text-[9px] tracking-widest">
                            <th className="p-3">Campus</th>
                            <th className="p-3">Debtor (Owes)</th>
                            <th className="p-3">Creditor (Owed)</th>
                            <th className="p-3">Class Offered</th>
                            <th className="p-3">Date</th>
                            <th className="p-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200">
                          {allSwapRequests.slice().sort((a, b) => b.timestamp.localeCompare(a.timestamp)).map(req => {
                            const debtorMentor = mentors.find(m => m.id === req.requestorId);
                            const creditorMentor = mentors.find(m => m.id === req.targetStaffId);
                            const campus = debtorMentor ? activeColleges.find(c => c.id === debtorMentor.college_id) : null;
                            const isPending = req.status === "pending" || req.status === "pending_cam";
                            const isApproved = req.status === "approved";
                            return (
                              <tr key={req.id} className="hover:bg-indigo-50/20 dark:hover:bg-indigo-500/5 transition-colors">
                                <td className="p-3">
                                  <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-[8.5px] font-black uppercase">
                                    {campus?.name || "—"}
                                  </span>
                                </td>
                                <td className="p-3">
                                  <div className="font-black text-rose-700 dark:text-rose-400">{debtorMentor?.name || req.requestorName}</div>
                                  <div className="text-[9px] text-slate-400">{debtorMentor?.department || ""}</div>
                                </td>
                                <td className="p-3">
                                  <div className="font-black text-emerald-700 dark:text-emerald-400">{creditorMentor?.name || req.targetStaffName}</div>
                                  <div className="text-[9px] text-slate-400">{creditorMentor?.department || ""}</div>
                                </td>
                                <td className="p-3">
                                  <div className="font-bold text-slate-800 dark:text-white max-w-[150px] truncate" title={req.course}>{req.course}</div>
                                  <div className="text-[9px] text-slate-400">{req.dateFormatted}</div>
                                </td>
                                <td className="p-3 text-slate-505 font-medium whitespace-nowrap">{req.dateStr}</td>
                                <td className="p-3 text-center">
                                  {isApproved ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-100 dark:bg-teal-500/20 border border-teal-200 dark:border-teal-500/30 text-teal-800 dark:text-teal-300 text-[8.5px] font-black uppercase">Yes Settled</span>
                                  ) : isPending ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 text-[8.5px] font-black uppercase">⏳ Awaiting</span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-500/20 border border-red-200 dark:border-red-500/30 text-red-800 dark:text-red-300 text-[8.5px] font-black uppercase">No Declined</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Panel>

                {/* Faculty Workload Balance Summary */}
                {ledgerList.length > 0 && (
                  <Panel
                    title="Faculty Workload Balance Overview"
                    subtitle="Mentors with outstanding hour debts across your portfolio. Positive balance = owes hours."
                  >
                    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs mt-2">
                      <table className="w-full border-collapse text-left text-xs font-semibold min-w-[620px]">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold uppercase text-[9px] tracking-widest">
                            <th className="p-3">Faculty</th>
                            <th className="p-3">Campus</th>
                            <th className="p-3 text-center">Given (−)</th>
                            <th className="p-3 text-center">Received (+)</th>
                            <th className="p-3 text-center">Balance</th>
                            <th className="p-3 text-center">Swaps Pending</th>
                            <th className="p-3 text-center">Swaps Settled</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                          {ledgerList.map(row => (
                            <tr key={row.mentorId} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors ${
                              row.balance > 0 && row.swapsPending === 0 ? "bg-rose-50/30 dark:bg-rose-500/5" : ""
                            }`}>
                              <td className="p-3">
                                <div className="font-black text-slate-800 dark:text-white">{row.mentorName}</div>
                                <div className="text-[9px] text-slate-400">{row.department}</div>
                              </td>
                              <td className="p-3">
                                <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-[8.5px] font-black uppercase">
                                  {row.collegeName}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                {row.given > 0 ? (
                                  <span className="px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-300 font-black">−{row.given}</span>
                                ) : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="p-3 text-center">
                                {row.received > 0 ? (
                                  <span className="px-2 py-0.5 rounded bg-teal-50 border border-teal-200 text-teal-700 dark:bg-teal-500/10 dark:border-teal-500/30 dark:text-teal-300 font-black">+{row.received}</span>
                                ) : <span className="text-slate-300">—</span>}
                              </td>
                              <td className={`p-3 text-center font-black text-sm ${
                                row.balance > 0 ? "text-rose-600 dark:text-rose-400" :
                                row.balance < 0 ? "text-emerald-600 dark:text-emerald-400" :
                                "text-slate-400"
                              }`}>
                                {row.balance > 0 ? `+${row.balance}` : row.balance}
                              </td>
                              <td className="p-3 text-center">
                                {row.swapsPending > 0 ? (
                                  <span className="px-2 py-0.5 rounded-full bg-amber-100 border border-amber-200 text-amber-800 dark:bg-amber-500/20 dark:border-amber-500/30 dark:text-amber-300 text-[8.5px] font-black">
                                    {row.swapsPending} pending
                                  </span>
                                ) : <span className="text-slate-300 text-[9px]">—</span>}
                              </td>
                              <td className="p-3 text-center">
                                {row.swapsSettled > 0 ? (
                                  <span className="px-2 py-0.5 rounded-full bg-teal-100 border border-teal-200 text-teal-800 dark:bg-teal-500/20 dark:border-teal-500/30 dark:text-teal-300 text-[8.5px] font-black">
                                    {row.swapsSettled} settled
                                  </span>
                                ) : <span className="text-slate-300 text-[9px]">—</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Panel>
                )}
              </div>
            );
          })()}

          {/* Tab 4: My Profile */}
          {activeTab === "profile" && currentKAM && (
            <div className="space-y-6 max-w-4xl mx-auto w-full text-slate-800 dark:text-slate-200 font-sans">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Profile Summary Card */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-7 rounded-3xl shadow-sm dark:shadow-xl flex flex-col items-center justify-between text-center min-h-[300px]">
                  <div className="flex flex-col items-center space-y-4 w-full">
                    <div className="h-20 w-20 rounded-full bg-indigo-600 border-4 border-white text-white flex items-center justify-center text-3xl font-black shadow-lg uppercase">
                      {currentKAM.name.substring(0, 2)}
                    </div>
                    <div>
                      <h2 className="text-lg font-extrabold text-slate-800 dark:text-white leading-tight">{currentKAM.name}</h2>
                      <p className="text-[10px] text-indigo-605 dark:text-indigo-400 font-bold uppercase tracking-wider mt-1">Key Account Manager (KAM)</p>
                    </div>
                  </div>

                  <div className="w-full border-t border-slate-100 dark:border-white/10 pt-4 mt-4 text-left space-y-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    <div className="flex justify-between">
                      <span>Manager ID</span>
                      <span className="text-slate-800 dark:text-white font-mono">{currentKAM.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Primary Email</span>
                      <span className="text-slate-805 dark:text-white truncate max-w-[170px]" title={currentKAM.email}>{currentKAM.email}</span>
                    </div>
                  </div>
                </div>

                {/* Operations & Jurisdiction */}
                <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-7 rounded-3xl shadow-sm dark:shadow-xl space-y-6 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-300 uppercase tracking-widest mb-4">Operations & Jurisdiction</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block">Role Type</span>
                        <span className="text-sm font-extrabold text-slate-800 dark:text-white block">Key Account Manager (KAM)</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Regional Operations Coordinator</span>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block">Scope of Authority</span>
                        <span className="text-sm font-extrabold text-slate-800 dark:text-white block">Multi-Campus Portfolios</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Aided & Self-Financed Campuses</span>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block">College Allocations</span>
                        <span className="text-sm font-extrabold text-slate-800 dark:text-white block">{activeColleges.length} Campuses</span>
                        <span className="text-[10px] text-slate-505 dark:text-slate-400 block">SDNB Vaishnav Group</span>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block">Security Level</span>
                        <span className="text-sm font-extrabold text-slate-800 dark:text-white block">Level 3 Regional Head</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Policy Oversight & Audits</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-indigo-50/30 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 p-4 rounded-2xl flex items-center gap-3">
                    <Compass className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <div className="text-[11px] text-indigo-700 dark:text-indigo-200 font-semibold leading-normal">
                      Your KAM authority covers regional resource planning, campus-level SLA verification, escalations audit, and overall academic policy enforcement across all portfolio campuses.
                    </div>
                  </div>
                </div>
              </div>

              {/* Performance / Operations Statistics */}
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-7 rounded-3xl shadow-sm dark:shadow-xl space-y-6">
                <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-300 uppercase tracking-widest">Regional Network Metrics</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center text-xs">
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850">
                    <span className="text-3xl font-extrabold text-slate-800 dark:text-white">{activeColleges.length}</span>
                    <span className="text-[9px] text-slate-500 dark:text-slate-455 font-extrabold uppercase tracking-wider block mt-1">Colleges</span>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850">
                    <span className="text-3xl font-extrabold text-slate-800 dark:text-white">
                      {mentors.filter(m => activeColleges.some(c => c.id === m.college_id)).length}
                    </span>
                    <span className="text-[9px] text-slate-500 dark:text-slate-455 font-extrabold uppercase tracking-wider block mt-1">Managed Mentors</span>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850">
                    <span className="text-3xl font-extrabold text-slate-800 dark:text-white">{escalations.length}</span>
                    <span className="text-[9px] text-slate-500 dark:text-slate-455 font-extrabold uppercase tracking-wider block mt-1">Total Escalations</span>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850">
                    <span className="text-3xl font-extrabold text-slate-800 dark:text-white">{tasks.length}</span>
                    <span className="text-[9px] text-slate-500 dark:text-slate-455 font-extrabold uppercase tracking-wider block mt-1">Assigned Tasks</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
