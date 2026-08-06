"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp, Role } from "@/context/AppContext";
import {
  LogOut,
  ChevronDown,
  KeyRound,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Building2,
  GraduationCap,
  Layers,
  User,
  ClipboardList,
  IndianRupee,
  Award,
  Calendar,
  Globe,
  Check
} from "lucide-react";

interface DashboardLayoutProps {
  children: React.ReactNode;
  requiredRole: Role;
}

export function DashboardLayout({ children, requiredRole }: DashboardLayoutProps) {
  const router = useRouter();
  const {
    currentRole,
    setRole,
    currentMentor,
    currentHR,
    currentCAM,
    currentKAM,
    currentAdmin,
    currentStudent,
    currentSME,
    colleges,
    isLoading,
    isDataLoading,
  } = useApp();

  const storedUserEmail = typeof window !== "undefined" ? (localStorage.getItem("fp_user_email") || "") : "";
  const isSuperAdminEmail = storedUserEmail.toLowerCase().trim() === "thanush@faceprep.in";

  const [selectedCampusScope, setSelectedCampusScope] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("fp_superadmin_campus_scope") || "all";
    }
    return "all";
  });
  const [showCampusDropdown, setShowCampusDropdown] = useState(false);

  const handleSelectCampusScope = (scopeId: string) => {
    setSelectedCampusScope(scopeId);
    localStorage.setItem("fp_superadmin_campus_scope", scopeId);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("storage"));
      window.location.reload();
    }
  };

  const isLoggedInClient = typeof window !== "undefined" && localStorage.getItem("fp_logged_in") === "true";
  const storedRoleClient = typeof window !== "undefined" ? localStorage.getItem("fp_current_role") : null;
  const isAuthorized = isLoggedInClient && (isSuperAdminEmail || currentRole === requiredRole || storedRoleClient === requiredRole);

  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showDashboardSwitch, setShowDashboardSwitch] = useState(false);

  const isFirstLoginRequired = typeof window !== "undefined" && localStorage.getItem("fp_must_change_pass") === "true";

  // Change Password Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(() => {
    return typeof window !== "undefined" && localStorage.getItem("fp_must_change_pass") === "true";
  });
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [isSavingPass, setIsSavingPass] = useState(false);
  const [passError, setPassError] = useState("");
  const [passSuccess, setPassSuccess] = useState("");
  const [refreshedAtTime, setRefreshedAtTime] = useState<string>("");

  useEffect(() => {
    setRefreshedAtTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  }, []);

  const currentUserEmail =
    storedUserEmail ||
    (currentRole === "mentor" && currentMentor?.email) ||
    (currentRole === "hr" && currentHR?.email) ||
    (currentRole === "cam" && currentCAM?.email) ||
    (currentRole === "kam" && currentKAM?.email) ||
    (currentRole === "admin" && currentAdmin?.email) ||
    (currentRole === "student" && currentStudent?.email) ||
    (currentRole === "fee_manager" && "fee.manager@zentra.edu") ||
    (currentRole === "sme" && currentSME?.email) ||
    (currentRole === "allocator" && "allocator@zentra.edu") ||
    "";

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError("");
    setPassSuccess("");

    if (!currentPassword) {
      setPassError("Please enter your current password.");
      return;
    }
    if (!newPassword || newPassword.trim().length < 6) {
      setPassError("New password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError("New password and confirm password do not match.");
      return;
    }
    if (currentPassword === newPassword) {
      setPassError("New password must be different from current password.");
      return;
    }

    try {
      setIsSavingPass(true);
      const res = await fetch("/api/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: currentUserEmail,
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setPassError(data.message || "Failed to update password.");
      } else {
        setPassSuccess("Password updated successfully!");
        localStorage.removeItem("fp_must_change_pass");
        setTimeout(() => {
          setShowPasswordModal(false);
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
          setPassSuccess("");
        }, 1500);
      }
    } catch (err: any) {
      setPassError(err.message || "An unexpected error occurred.");
    } finally {
      setIsSavingPass(false);
    }
  };

  // Ensure dark mode class is removed on mount
  useEffect(() => {
    if (localStorage.getItem("fp_must_change_pass") === "true") {
      setShowPasswordModal(true);
    }
    localStorage.removeItem("fp_dark_mode");
    if (typeof document !== "undefined") {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  // Handle route protection cleanly without premature logouts
  useEffect(() => {
    if (isLoading || isDataLoading) return;

    const isLoggedIn =
      (typeof window !== "undefined" && localStorage.getItem("fp_logged_in") === "true") ||
      (typeof window !== "undefined" && sessionStorage.getItem("fp_logged_in") === "true");

    if (!isLoggedIn) {
      router.replace("/");
      return;
    }

    const storedRole = typeof window !== "undefined" ? (localStorage.getItem("fp_current_role") || sessionStorage.getItem("fp_current_role")) : null;
    const activeRole = currentRole || storedRole;

    if (!isSuperAdminEmail && activeRole && activeRole !== requiredRole && !isLoading && !isDataLoading) {
      const targetPath = "/" + (activeRole === "fee_manager" ? "fee-manager" : activeRole);
      router.replace(targetPath);
    }
  }, [isLoading, isDataLoading, currentRole, requiredRole, router, isSuperAdminEmail]);

  const handleLogout = async () => {
    try {
      const currentUid = localStorage.getItem("fp_user_id") || localStorage.getItem("fp_header_id");
      await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout", userId: currentUid })
      });
    } catch (_) {}

    localStorage.removeItem("fp_logged_in");
    localStorage.removeItem("fp_must_change_pass");
    localStorage.removeItem("fp_current_role");
    localStorage.removeItem("fp_user_id");
    localStorage.removeItem("fp_user_email");
    localStorage.removeItem("fp_user_name");
    localStorage.removeItem("fp_user_snapshot");
    localStorage.removeItem("fp_mentor_id");
    localStorage.removeItem("fp_header_id");
    localStorage.removeItem("fp_cam_id");
    localStorage.removeItem("fp_kam_id");
    localStorage.removeItem("fp_admin_id");
    localStorage.removeItem("fp_student_id");
    localStorage.removeItem("fp_current_shift");

    // Fresh redirect to login page
    window.location.href = "/";
  };

  // Render global loading screen if app is initializing or not authorized yet
  if (isLoading || !isAuthorized) {
    return <ProfessionalLoader message="Connecting to live database & loading workspace..." />;
  }

  return (
    <div className="h-screen flex flex-col font-sans bg-warm-canvas text-gray-800 transition-colors duration-200 overflow-hidden">
      {/* Compact 75% Width Global Header */}
      <header className="floating-header w-[95%] sm:w-[85%] md:w-[80%] lg:w-[75%] max-w-[1200px] mx-auto self-center mt-2.5 md:mt-4 px-3 sm:px-6 py-2.5 md:py-4 flex items-center justify-between z-30 transition-all rounded-xl border border-slate-200/80 shadow-md bg-white/80 backdrop-blur-md">
        {/* Left: Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <img src="/E-Campus.png" alt="FACE Prep E-Campus Logo" className="h-7 sm:h-9 md:h-10 w-auto object-contain shrink-0 max-h-10" />
          <div className="hidden sm:block border-l border-slate-200 pl-3">
            <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider block truncate">
              {currentRole === "mentor" && "Faculty Workspace"}
              {currentRole === "hr" && "HR Audit Portal"}
              {currentRole === "cam" && "CM Dashboard"}
              {currentRole === "kam" && "Key Account Manager"}
              {currentRole === "admin" && "Super Admin Console"}
              {currentRole === "student" && "Student Portal"}
              {currentRole === "fee_manager" && "Fee Collections"}
              {currentRole === "sme" && "SME Evaluation Hub"}
              {currentRole === "allocator" && "Demo Scheduler Portal"}
            </span>
          </div>
        </div>

        {/* Right: Profile trigger + Logout */}
        <div className="flex items-center gap-3">

          {/* Profile Dropdown trigger */}
          {/* Last Refreshed Badge */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Refreshed at {refreshedAtTime || "Just now"}</span>
          </div>

          {/* Master Multi-Role Switcher (Restricted to thanush@faceprep.in) */}
          {isSuperAdminEmail && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowDashboardSwitch(prev => !prev)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 via-purple-600 to-[#D528A2] text-white font-extrabold text-xs shadow-sm hover:shadow-md transition-all cursor-pointer"
                title="Switch Workspace (Thanush Master Access)"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-300 animate-pulse" />
                <span className="hidden sm:inline">Switch Workspace</span>
                <ChevronDown className={`h-3.5 w-3.5 opacity-80 transition-transform ${showDashboardSwitch ? "rotate-180" : ""}`} />
              </button>

              {showDashboardSwitch && (
                <div className="absolute right-0 mt-2.5 w-64 bg-white border border-slate-200 rounded-xl shadow-2xl p-2 z-50 animate-fadeIn space-y-1">
                  <div className="px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wider text-indigo-600 border-b border-slate-100 flex items-center justify-between">
                    <span>Master Role Launcher</span>
                    <span className="text-[8px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-bold">Thanush</span>
                  </div>
                  {[
                    { id: "admin", label: "Super Admin Console", path: "/admin", icon: ShieldCheck, color: "text-[#D528A2]" },
                    { id: "cam", label: "CM Operations Hub", path: "/cam", icon: Building2, color: "text-indigo-600" },
                    { id: "mentor", label: "Faculty Workspace", path: "/mentor", icon: GraduationCap, color: "text-emerald-600" },
                    { id: "kam", label: "Key Account Manager", path: "/kam", icon: Layers, color: "text-purple-600" },
                    { id: "student", label: "Student Portal", path: "/student", icon: User, color: "text-blue-600" },
                    { id: "hr", label: "HR Audit Portal", path: "/hr", icon: ClipboardList, color: "text-orange-600" },
                    { id: "fee_manager", label: "Fee Collections", path: "/fee-manager", icon: IndianRupee, color: "text-teal-600" },
                    { id: "sme", label: "SME Evaluation Hub", path: "/sme", icon: Award, color: "text-rose-600" },
                    { id: "allocator", label: "Demo Scheduler Portal", path: "/allocator", icon: Calendar, color: "text-amber-600" },
                  ].map(item => {
                    const Icon = item.icon;
                    const isCurrent = currentRole === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setShowDashboardSwitch(false);
                          localStorage.setItem("fp_current_role", item.id);
                          localStorage.setItem("fp_logged_in", "true");
                          localStorage.setItem("fp_user_email", "thanush@faceprep.in");

                          if (item.id === "mentor") {
                            localStorage.setItem("fp_superadmin_campus_scope", "college_sdnb");
                            setSelectedCampusScope("college_sdnb");
                            setRole("mentor", "mentor_thanush");
                          } else if (item.id === "admin") {
                            localStorage.setItem("fp_superadmin_campus_scope", "all");
                            setSelectedCampusScope("all");
                            setRole("admin", "admin_thanush");
                          } else {
                            localStorage.setItem("fp_superadmin_campus_scope", "all");
                            setSelectedCampusScope("all");
                            setRole(item.id as any);
                          }

                          router.push(item.path);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-left ${
                          isCurrent
                            ? "bg-indigo-50 text-indigo-700 font-extrabold border border-indigo-200 shadow-xs"
                            : "text-slate-700 hover:bg-slate-50 hover:text-indigo-600"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className={`h-4 w-4 ${item.color}`} />
                          <span>{item.label}</span>
                        </div>
                        {isCurrent && <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Master Global Region / Campus Scope Switcher (Restricted to thanush@faceprep.in) */}
          {isSuperAdminEmail && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowCampusDropdown(prev => !prev)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-800 font-extrabold text-xs shadow-xs hover:border-indigo-500 hover:text-indigo-600 transition-all cursor-pointer"
                title="Filter Real-Time Data Region / Campus"
              >
                <Globe className="h-3.5 w-3.5 text-indigo-600 animate-pulse" />
                <span className="hidden sm:inline">
                  {selectedCampusScope === "all"
                    ? "All Regions (Global)"
                    : colleges.find(c => c.id === selectedCampusScope)?.name || "Selected Campus"}
                </span>
                <ChevronDown className={`h-3.5 w-3.5 opacity-80 transition-transform ${showCampusDropdown ? "rotate-180" : ""}`} />
              </button>

              {showCampusDropdown && (
                <div className="absolute right-0 mt-2.5 w-72 bg-white border border-slate-200 rounded-xl shadow-2xl p-2 z-50 animate-fadeIn space-y-1 max-h-80 overflow-y-auto">
                  <div className="px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wider text-indigo-600 border-b border-slate-100 flex items-center justify-between">
                    <span>Global Data Scope</span>
                    <span className="text-[8px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold">Thanush</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowCampusDropdown(false);
                      handleSelectCampusScope("all");
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-left ${
                      selectedCampusScope === "all"
                        ? "bg-indigo-50 text-indigo-700 font-extrabold border border-indigo-200 shadow-xs"
                        : "text-slate-700 hover:bg-slate-50 hover:text-indigo-600"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Globe className="h-4 w-4 text-indigo-600 shrink-0" />
                      <div>
                        <span className="block font-black">All Regions & Campuses</span>
                        <span className="text-[9px] text-slate-400 font-medium block">Aggregated real-time data</span>
                      </div>
                    </div>
                    {selectedCampusScope === "all" && <Check className="h-4 w-4 text-indigo-600 shrink-0" />}
                  </button>

                  <div className="border-t border-slate-100 my-1 pt-1">
                    <span className="px-2.5 py-1 text-[9px] font-extrabold uppercase text-slate-400 block">Individual Campuses</span>
                    {colleges.map(c => {
                      const isSelected = selectedCampusScope === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setShowCampusDropdown(false);
                            handleSelectCampusScope(c.id);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-left ${
                            isSelected
                              ? "bg-indigo-50 text-indigo-700 font-extrabold border border-indigo-200 shadow-xs"
                              : "text-slate-700 hover:bg-slate-50 hover:text-indigo-600"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Building2 className="h-4 w-4 text-purple-600 shrink-0" />
                            <span className="truncate">{c.name}</span>
                          </div>
                          {isSelected && <Check className="h-4 w-4 text-indigo-600 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="relative">
            <button
              onClick={() => setShowProfileDropdown((p) => !p)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-gray-55 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all cursor-pointer"
            >
              <div className="h-7 w-7 rounded-full btn-gradient flex items-center justify-center font-extrabold text-white text-[10px] shadow-sm shrink-0 overflow-hidden">
                {currentRole === "mentor" ? (
                  currentMentor?.avatar && currentMentor.avatar.startsWith("http") ? (
                    <img src={currentMentor.avatar} alt="Mentor Avatar" className="h-full w-full object-cover" />
                  ) : (
                    (currentMentor?.name || "Faculty").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
                  )
                ) : null}
                {currentRole === "hr" && "HR"}
                {currentRole === "cam" && (currentCAM?.name || "Campus Manager").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                {currentRole === "kam" && (currentKAM?.name || "KAM Owner").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                {currentRole === "admin" && (currentAdmin?.name || "System Admin").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                {currentRole === "student" && (currentStudent?.name || "Student").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                {currentRole === "fee_manager" && "FM"}
                {currentRole === "sme" && (currentSME?.name || "SME").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                {currentRole === "allocator" && "DA"}
              </div>
              <div className="text-left leading-none hidden sm:block">
                <span className="text-xs font-bold text-gray-900 dark:text-white block leading-tight">
                  {currentRole === "mentor" && (currentMentor?.name || "Faculty Mentor")}
                  {currentRole === "hr" && (currentHR?.name || "HR Manager")}
                  {currentRole === "cam" && (currentCAM?.name || "Campus Manager")}
                  {currentRole === "kam" && (currentKAM?.name || "Key Account Manager")}
                  {currentRole === "admin" && (currentAdmin?.name || "System Admin")}
                  {currentRole === "student" && (currentStudent?.name || "Student")}
                  {currentRole === "fee_manager" && ((typeof window !== "undefined" && localStorage.getItem("fp_user_name")) || "Fee Operations Manager")}
                  {currentRole === "sme" && (currentSME?.name || "SME Evaluator")}
                  {currentRole === "allocator" && ((typeof window !== "undefined" && localStorage.getItem("fp_user_name")) || "Demo Allocator Head")}
                </span>
                <span className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider block mt-0.5">
                  {currentRole === "cam" ? "CM" : currentRole}
                </span>
              </div>
              <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform duration-200 ${showProfileDropdown ? "rotate-180" : ""}`} />
            </button>
 
            {/* Dropdown panel */}
            {showProfileDropdown && (
              <div className="absolute right-0 mt-2.5 w-60 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                {/* User info */}
                <div className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                  <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                    {currentRole === "mentor" && (currentMentor?.name || "Faculty Mentor")}
                    {currentRole === "hr" && (currentHR?.name || "HR Manager")}
                    {currentRole === "cam" && (currentCAM?.name || "Campus Manager")}
                    {currentRole === "kam" && (currentKAM?.name || "Key Account Manager")}
                    {currentRole === "admin" && (currentAdmin?.name || "System Admin")}
                    {currentRole === "student" && (currentStudent?.name || "Student")}
                    {currentRole === "fee_manager" && ((typeof window !== "undefined" && localStorage.getItem("fp_user_name")) || "Fee Operations Manager")}
                    {currentRole === "sme" && (currentSME?.name || "SME Evaluator")}
                    {currentRole === "allocator" && ((typeof window !== "undefined" && localStorage.getItem("fp_user_name")) || "Demo Allocator Head")}
                  </p>
                  <p className="text-[10px] text-gray-400 font-mono truncate mt-0.5">
                    {currentRole === "mentor" && (currentMentor?.email || "mentor@university.edu")}
                    {currentRole === "hr" && (currentHR?.email || "hr@university.edu")}
                    {currentRole === "cam" && (currentCAM?.email || "cam@university.edu")}
                    {currentRole === "kam" && (currentKAM?.email || "kam@university.edu")}
                    {currentRole === "admin" && (currentAdmin?.email || "admin@university.edu")}
                    {currentRole === "student" && (currentStudent?.email || "student@university.edu")}
                    {currentRole === "fee_manager" && (currentUserEmail || "fee.manager@zentra.edu")}
                    {currentRole === "sme" && (currentSME?.email || "sme@zentra.edu")}
                    {currentRole === "allocator" && (currentUserEmail || "allocator@zentra.edu")}
                  </p>
                  <span className="mt-2 inline-block text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-slate-700 text-indigo-650 dark:text-indigo-400 border border-indigo-100/50 dark:border-slate-600">
                    {currentRole}
                  </span>
                </div>
                {/* Actions */}
                <div className="p-1.5 space-y-0.5">
                  <button
                    onClick={() => {
                      setShowProfileDropdown(false);
                      setPassError("");
                      setPassSuccess("");
                      setCurrentPassword("");
                      setNewPassword("");
                      setConfirmPassword("");
                      setShowPasswordModal(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all cursor-pointer"
                  >
                    <KeyRound className="h-3.5 w-3.5 text-indigo-500" />
                    Change Password
                  </button>
                  <button
                    id="logout-btn"
                    onClick={() => { setShowProfileDropdown(false); handleLogout(); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-50/50 dark:hover:bg-rose-950/20 transition-all cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Log out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace Dashboard Content */}
      <main className="flex-grow flex flex-col relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000002_1px,transparent_1px),linear-gradient(to_bottom,#00000002_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />
        {children}

        {/* Global Floating Feedback Button */}
        <div className="fixed bottom-4 right-4 z-40">
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById("global-feedback-modal");
              if (el) el.classList.remove("hidden");
            }}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-slate-900 dark:bg-indigo-600 text-white font-bold text-xs shadow-lg hover:shadow-xl hover:scale-105 transition-all cursor-pointer border border-slate-700/50"
            title="Report an Issue or Feedback"
          >
            <AlertCircle className="h-4 w-4 text-indigo-400 dark:text-white" />
            <span className="hidden sm:inline">Report Issue / Feedback</span>
          </button>
        </div>
      </main>

      {/* Change Password Glassmorphic Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-2xl p-6 sm:p-7 overflow-hidden">
            {/* Ambient Top Glow */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                    {isFirstLoginRequired ? "Password Change Required" : "Change Password"}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {isFirstLoginRequired ? "First login security requirement" : "Update your account login security credentials"}
                  </p>
                </div>
              </div>
              {!isFirstLoginRequired && (
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Mandatory First Login Notice */}
            {isFirstLoginRequired && (
              <div className="mb-4 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 flex items-start gap-3 text-xs text-amber-800 dark:text-amber-300">
                <Lock className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="font-bold">First Login Security Requirement</p>
                  <p className="text-[11px] opacity-90 mt-0.5 leading-relaxed">
                    Because this is your initial sign-in (or your password was reset), security policy requires you to set a new password before continuing.
                  </p>
                </div>
              </div>
            )}

            {/* Notifications */}
            {passError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 flex items-start gap-2.5 text-xs text-rose-600 dark:text-rose-400">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{passError}</span>
              </div>
            )}

            {passSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 flex items-start gap-2.5 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{passSuccess}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              {/* Account Email (Read-only badge) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Account Email
                </label>
                <input
                  type="text"
                  readOnly
                  value={currentUserEmail}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-xs font-mono font-semibold text-slate-600 dark:text-slate-300 cursor-not-allowed"
                />
              </div>

              {/* Current Password */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Current Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-3.5 w-3.5" />
                  </div>
                  <input
                    type={showCurrentPass ? "text" : "password"}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass((p) => !p)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  >
                    {showCurrentPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="h-3.5 w-3.5" />
                  </div>
                  <input
                    type={showNewPass ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min. 6 chars)"
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass((p) => !p)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  >
                    {showNewPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="h-3.5 w-3.5" />
                  </div>
                  <input
                    type={showConfirmPass ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass((p) => !p)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  >
                    {showConfirmPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex items-center gap-3">
                {isFirstLoginRequired ? (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex-1 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/50 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Log out
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSavingPass}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-xs font-bold text-white shadow-md shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSavingPass ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Password"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Feedback & Issue Modal */}
      <div id="global-feedback-modal" className="hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
        <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-6 overflow-hidden">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Report Issue / Feedback</h3>
                <p className="text-[11px] text-slate-400 font-medium">Send feedback directly to the administration</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById("global-feedback-modal");
                if (el) el.classList.add("hidden");
              }}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const type = (form.elements.namedItem("type") as HTMLSelectElement).value;
              const title = (form.elements.namedItem("title") as HTMLInputElement).value;
              const description = (form.elements.namedItem("description") as HTMLTextAreaElement).value;
              try {
                const res = await fetch("/api/feedback", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    userId: currentUserEmail,
                    userRole: currentRole,
                    type,
                    title,
                    description
                  })
                });
                const data = await res.json();
                if (data.success) {
                  alert("Thank you! Your feedback has been submitted to the system administrator.");
                  form.reset();
                  const el = document.getElementById("global-feedback-modal");
                  if (el) el.classList.add("hidden");
                } else {
                  alert(data.message || "Failed to submit feedback.");
                }
              } catch (err: any) {
                alert("Failed to submit feedback: " + err.message);
              }
            }}
            className="mt-4 space-y-4 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Issue Category</label>
              <select name="type" className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold focus:outline-none focus:border-indigo-500">
                <option value="bug">Bug / Error Report</option>
                <option value="feature">Feature Request</option>
                <option value="suggestion">General Suggestion</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Title / Summary</label>
              <input required name="title" type="text" placeholder="e.g. Schedule button non-responsive on mobile" className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs outline-none focus:border-indigo-500 font-bold" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Detailed Description</label>
              <textarea required name="description" rows={4} placeholder="Describe what happened and how to reproduce it..." className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs outline-none focus:border-indigo-500 font-medium resize-none" />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById("global-feedback-modal");
                  if (el) el.classList.add("hidden");
                }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-xs shadow-md transition-all cursor-pointer hover:opacity-90"
              >
                Submit Feedback
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export function ProfessionalLoader({ message = "Loading your workspace..." }: { message?: string }) {
  return (
    <div className="flex-1 flex items-center justify-center min-h-screen bg-slate-50 relative overflow-hidden">
      {/* Background Soft Orbs */}
      <div className="absolute top-[35%] left-[35%] h-[320px] w-[320px] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-[35%] right-[35%] h-[320px] w-[320px] rounded-full bg-[#D528A2]/10 blur-[120px] pointer-events-none animate-pulse" />

      {/* Glassmorphic Card */}
      <div className="relative z-10 flex flex-col items-center p-8 sm:p-10 rounded-xl border border-slate-200/90 bg-white/95 backdrop-blur-xl shadow-2xl max-w-sm w-full mx-4 text-center animate-in fade-in zoom-in-95 duration-300">
        
        {/* FACE Prep E-Campus Logo Header */}
        <div className="relative mb-6 flex items-center justify-center">
          <div className="absolute -inset-3 rounded-xl bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-[#D528A2]/20 blur-md animate-pulse" />
          <div className="relative flex items-center justify-center px-6 py-3.5 rounded-xl bg-white border border-slate-200 shadow-md">
            <img src="/E-Campus.png" alt="FACE Prep E-Campus Logo" className="h-10 w-auto object-contain" />
          </div>
        </div>

        {/* 4-Dot Bouncing Wave Animation with Vibrant Glowing Brand Colors */}
        <div className="flex items-center justify-center gap-3 my-5">
          <div 
            className="h-4 w-4 rounded-full bg-indigo-600 shadow-[0_0_12px_rgba(79,70,229,0.7)] animate-bounce" 
            style={{ animationDelay: "0s", animationDuration: "0.9s" }} 
          />
          <div 
            className="h-4 w-4 rounded-full bg-purple-600 shadow-[0_0_12px_rgba(147,51,234,0.7)] animate-bounce" 
            style={{ animationDelay: "0.15s", animationDuration: "0.9s" }} 
          />
          <div 
            className="h-4 w-4 rounded-full bg-[#D528A2] shadow-[0_0_12px_rgba(213,40,162,0.7)] animate-bounce" 
            style={{ animationDelay: "0.30s", animationDuration: "0.9s" }} 
          />
          <div 
            className="h-4 w-4 rounded-full bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.7)] animate-bounce" 
            style={{ animationDelay: "0.45s", animationDuration: "0.9s" }} 
          />
        </div>

        {/* Loading Message */}
        <h3 className="text-base font-black text-slate-900 dark:text-slate-100 tracking-tight mt-3 mb-1">
          {message}
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-300 font-bold">
          Please wait while your environment is loaded...
        </p>
      </div>
    </div>
  );
}
