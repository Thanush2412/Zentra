"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp, Role } from "@/context/AppContext";
import {
  LogOut,
  Sun,
  Moon,
  ChevronDown,
  KeyRound,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

interface DashboardLayoutProps {
  children: React.ReactNode;
  requiredRole: Role;
}

export function DashboardLayout({ children, requiredRole }: DashboardLayoutProps) {
  const router = useRouter();
  const {
    currentRole,
    currentMentor,
    currentHR,
    currentCAM,
    currentKAM,
    currentAdmin,
    currentStudent,
    currentSME,
    isLoading,
  } = useApp();

  const isLoggedInClient = typeof window !== "undefined" && localStorage.getItem("fp_logged_in") === "true";
  const isAuthorized = !isLoading && isLoggedInClient && currentRole === requiredRole;

  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Change Password Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [isSavingPass, setIsSavingPass] = useState(false);
  const [passError, setPassError] = useState("");
  const [passSuccess, setPassSuccess] = useState("");

  const currentUserEmail =
    (currentRole === "mentor" && currentMentor?.email) ||
    (currentRole === "hr" && currentHR?.email) ||
    (currentRole === "cam" && currentCAM?.email) ||
    (currentRole === "kam" && currentKAM?.email) ||
    (currentRole === "admin" && currentAdmin?.email) ||
    (currentRole === "student" && currentStudent?.email) ||
    (currentRole === "fee_manager" && "tharani.rajan@faceprep.in") ||
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

  // Sync dark mode on mount
  useEffect(() => {
    const isDark = localStorage.getItem("fp_dark_mode") === "true";
    setDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  // Handle route protection
  useEffect(() => {
    if (isLoading) return;

    const isLoggedIn = localStorage.getItem("fp_logged_in") === "true";
    if (!isLoggedIn) {
      router.replace("/");
      return;
    }

    if (currentRole && currentRole !== requiredRole) {
      const targetPath = "/" + (currentRole === "fee_manager" ? "fee-manager" : currentRole);
      router.replace(targetPath);
    }
  }, [isLoading, currentRole, requiredRole, router]);

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const nextVal = !prev;
      localStorage.setItem("fp_dark_mode", String(nextVal));
      if (nextVal) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      return nextVal;
    });
  };

  const handleLogout = () => {
    localStorage.removeItem("fp_logged_in");
    localStorage.removeItem("fp_current_role");
    localStorage.removeItem("fp_mentor_id");
    localStorage.removeItem("fp_header_id");
    localStorage.removeItem("fp_cam_id");
    localStorage.removeItem("fp_kam_id");
    localStorage.removeItem("fp_admin_id");
    localStorage.removeItem("fp_student_id");
    
    // Clear other role identifiers
    localStorage.removeItem("fp_current_shift");

    // Fresh redirect to login page
    window.location.href = "/";
  };

  // Render global loading screen if app is initializing or not authorized yet
  if (isLoading || !isAuthorized) {
    return <ProfessionalLoader message="Loading your workspace..." />;
  }

  return (
    <div className={`h-screen flex flex-col font-sans bg-warm-canvas text-gray-800 transition-colors duration-200 overflow-hidden ${darkMode ? "dark" : ""}`}>
      {/* Compact 75% Width Global Header */}
      <header className="floating-header w-[92%] sm:w-[85%] md:w-[80%] lg:w-[75%] max-w-[1200px] mx-auto self-center mt-3 md:mt-4 px-3 sm:px-6 py-3 md:py-4 flex items-center justify-between z-30 transition-all rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-md bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
        {/* Left: Brand */}
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Zentra Logo" className="h-12 md:h-14 w-auto object-contain shrink-0 max-h-14" />
          <div>
            <span className="text-[13px] font-bold tracking-tight text-gray-900 dark:text-white leading-none block">
              Zentra
            </span>
            <span className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider block mt-0.5 truncate max-w-[85px] sm:max-w-none">
              {currentRole === "mentor" && "Faculty Workspace"}
              {currentRole === "hr" && "HR Audit Portal"}
              {currentRole === "cam" && "Campus Manager"}
              {currentRole === "kam" && "Key Account Manager"}
              {currentRole === "admin" && "Super Admin Console"}
              {currentRole === "student" && "Student Portal"}
              {currentRole === "fee_manager" && "Fee Collections"}
              {currentRole === "sme" && "SME Evaluation Hub"}
              {currentRole === "allocator" && "Demo Scheduler Portal"}
            </span>
          </div>
        </div>

        {/* Right: Theme toggle + Profile trigger + Logout */}
        <div className="flex items-center gap-3">
          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleDarkMode}
            className="p-2 rounded-lg bg-gray-55 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-700 transition-all cursor-pointer"
            title={darkMode ? "Light Mode" : "Dark Mode"}
          >
            {darkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>

          {/* Profile Dropdown trigger */}
          <div className="relative">
            <button
              onClick={() => setShowProfileDropdown((p) => !p)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-gray-55 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all cursor-pointer"
            >
              <div className="h-7 w-7 rounded-full btn-gradient flex items-center justify-center font-extrabold text-white text-[10px] shadow-sm shrink-0">
                {currentRole === "mentor" && (currentMentor?.avatar || "M")}
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
                  {currentRole === "fee_manager" && "Tharani Rajan"}
                  {currentRole === "sme" && (currentSME?.name || "SME Evaluator")}
                  {currentRole === "allocator" && "Mrs. Janaki Dev"}
                </span>
                <span className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider block mt-0.5">
                  {currentRole}
                </span>
              </div>
              <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform duration-200 ${showProfileDropdown ? "rotate-180" : ""}`} />
            </button>
 
            {/* Dropdown panel */}
            {showProfileDropdown && (
              <div className="absolute right-0 mt-2.5 w-60 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl shadow-xl z-50 overflow-hidden">
                {/* User info */}
                <div className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                  <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                    {currentRole === "mentor" && (currentMentor?.name || "Faculty Mentor")}
                    {currentRole === "hr" && (currentHR?.name || "HR Manager")}
                    {currentRole === "cam" && (currentCAM?.name || "Campus Manager")}
                    {currentRole === "kam" && (currentKAM?.name || "Key Account Manager")}
                    {currentRole === "admin" && (currentAdmin?.name || "System Admin")}
                    {currentRole === "student" && (currentStudent?.name || "Student")}
                    {currentRole === "fee_manager" && "Tharani Rajan"}
                    {currentRole === "sme" && (currentSME?.name || "SME Evaluator")}
                    {currentRole === "allocator" && "Mrs. Janaki Dev"}
                  </p>
                  <p className="text-[10px] text-gray-400 font-mono truncate mt-0.5">
                    {currentRole === "mentor" && (currentMentor?.email || "mentor@university.edu")}
                    {currentRole === "hr" && (currentHR?.email || "hr@university.edu")}
                    {currentRole === "cam" && (currentCAM?.email || "cam@university.edu")}
                    {currentRole === "kam" && (currentKAM?.email || "kam@university.edu")}
                    {currentRole === "admin" && (currentAdmin?.email || "admin@university.edu")}
                    {currentRole === "student" && (currentStudent?.email || "student@university.edu")}
                    {currentRole === "fee_manager" && "tharani.rajan@faceprep.in"}
                    {currentRole === "sme" && (currentSME?.email || "sme@zentra.edu")}
                    {currentRole === "allocator" && "allocator@zentra.edu"}
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
                    onClick={() => { toggleDarkMode(); setShowProfileDropdown(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all cursor-pointer"
                  >
                    {darkMode ? <Sun className="h-3.5 w-3.5 text-gray-400" /> : <Moon className="h-3.5 w-3.5 text-gray-400" />}
                    {darkMode ? "Light Theme" : "Dark Theme"}
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
      </main>

      {/* Change Password Glassmorphic Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-7 overflow-hidden">
            {/* Ambient Top Glow */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                    Change Password
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Update your account login security credentials
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Notifications */}
            {passError && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 flex items-start gap-2.5 text-xs text-rose-600 dark:text-rose-400">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{passError}</span>
              </div>
            )}

            {passSuccess && (
              <div className="mb-4 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 flex items-start gap-2.5 text-xs text-emerald-600 dark:text-emerald-400">
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
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Cancel
                </button>
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
    </div>
  );
}

export function ProfessionalLoader({ message = "Loading your workspace..." }: { message?: string }) {
  return (
    <div className="flex-1 flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300 relative overflow-hidden">
      {/* Soft glowing background orbs */}
      <div className="absolute top-[30%] left-[30%] h-[300px] w-[300px] rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none animate-pulse-gentle" />
      <div className="absolute bottom-[30%] right-[30%] h-[300px] w-[300px] rounded-full bg-[#D528A2]/5 blur-[100px] pointer-events-none animate-float-slow" />

      {/* Glassmorphic Loader Container */}
      <div className="relative z-10 flex flex-col items-center p-8 rounded-3xl border border-white/20 dark:border-slate-800/40 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md shadow-xl max-w-sm w-full mx-4 text-center animate-in fade-in zoom-in-95 duration-300">
        {/* Custom Premium Spinner */}
        <div className="relative h-16 w-16 mb-6">
          {/* Outer Ring */}
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-500 border-b-indigo-500 animate-spin duration-1000" />
          {/* Middle Ring */}
          <div className="absolute inset-1.5 rounded-full border-2 border-transparent border-l-[#D528A2] border-r-[#D528A2] animate-spin-reverse duration-700" />
          {/* Inner Glowing Center */}
          <div className="absolute inset-4 rounded-full bg-indigo-600/20 dark:bg-indigo-400/20 flex items-center justify-center animate-pulse">
            <div className="h-2 w-2 rounded-full bg-indigo-500 dark:bg-indigo-455 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
          </div>
        </div>

        {/* Text */}
        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 block">
          Zentra by FPC
        </span>
        <h3 className="text-sm font-extrabold text-slate-850 dark:text-slate-200 tracking-tight animate-pulse">
          {message}
        </h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-450 mt-1">
          Please wait while we secure your session.
        </p>
      </div>
    </div>
  );
}
