"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { ProfessionalLoader } from "@/components/DashboardLayout";

import {
  User,
  ShieldCheck,
  Sparkles,
  Lock,
  Mail,
  AlertCircle,
  Loader2,
  Building2,
  Users,
  ArrowRight,
  Eye,
  EyeOff
} from "lucide-react";



export default function Home() {
  const router = useRouter();
  const {
    setRole,
    isLoading: appLoading,
    mentors,
    students,
    colleges,
    submitSignupRequest
  } = useApp();

  const [sessionLoading, setSessionLoading] = useState(true);

  // Login Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [showDemoDropdown, setShowDemoDropdown] = useState(false);

  // Signup Mode States
  const [isSignupMode, setIsSignupMode] = useState(false);
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [signupSuccess, setSignupSuccess] = useState("");

  // Dark Mode State
  const [darkMode, setDarkMode] = useState(false);

  // Check login state and theme from localStorage on mount
  useEffect(() => {
    const loggedIn = localStorage.getItem("fp_logged_in") === "true";
    if (loggedIn) {
      const role = localStorage.getItem("fp_current_role");
      if (role) {
        const target = "/" + (role === "fee_manager" ? "fee-manager" : role);
        router.replace(target);
        return;
      }
    }
    
    setSessionLoading(false);

    const isDark = localStorage.getItem("fp_dark_mode") === "true";
    setDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [router]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    if (!email.trim() || !password.trim()) {
      setLoginError("Please enter both email and password.");
      return;
    }

    setLoginLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (data.success) {
        setRole(data.role, data.userId);
        localStorage.setItem("fp_logged_in", "true");
        
        // Redirect based on role
        const target = "/" + (data.role === "fee_manager" ? "fee-manager" : data.role);
        router.push(target);
      } else {
        setLoginError(data.message || "Login failed. Please check your credentials.");
      }
    } catch {
      setLoginError("Network error. Could not connect to the server.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError("");
    setSignupSuccess("");

    if (!signupName.trim() || !signupEmail.trim() || !signupPassword.trim() || !signupConfirmPassword.trim()) {
      setSignupError("Please fill out all required fields.");
      return;
    }

    if (signupPassword !== signupConfirmPassword) {
      setSignupError("Passwords do not match.");
      return;
    }

    setSignupLoading(true);
    try {
      const res = await submitSignupRequest({
        name: signupName.trim(),
        email: signupEmail.trim(),
        password: signupPassword,
        requested_role: "pending",
        college_id: null,
        notes: null
      });

      if (res.success) {
        setSignupSuccess(res.message || "Signup request submitted successfully!");
        setSignupName("");
        setSignupEmail("");
        setSignupPassword("");
        setSignupConfirmPassword("");
      } else {
        setSignupError(res.message || "Failed to submit request.");
      }
    } catch {
      setSignupError("Network error. Could not connect to the server.");
    } finally {
      setSignupLoading(false);
    }
  };

  const prefill = (emailVal: string) => {
    setEmail(emailVal);
    setPassword("password123");
    setLoginError("");
  };

  /* ── Loading Splash ─────────────────────── */
  if (sessionLoading || appLoading) {
    return <ProfessionalLoader message="Connecting to database…" />;
  }



  return (
    <div className="min-h-screen flex font-sans overflow-hidden bg-white relative">
      {/* ── LEFT HERO PANEL (LIGHT UI) ── */}
      <div className="hidden lg:flex lg:w-[50%] xl:w-[54%] flex-col relative overflow-hidden bg-slate-50 border-r border-slate-200">
        {/* Shifting dynamic glowing orb backdrops (extremely soft for Light Mode) */}
        <div className="absolute top-[-10%] left-[-10%] h-[50%] w-[50%] rounded-full bg-slate-200/20 blur-[120px] pointer-events-none animate-float-slow" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[50%] w-[50%] rounded-full bg-slate-300/10 blur-[120px] pointer-events-none animate-float-reverse" />
        <div className="absolute top-[35%] left-[35%] h-[30%] w-[30%] rounded-full bg-indigo-500/5 blur-[100px] pointer-events-none animate-pulse-gentle" />

        {/* Semi-transparent grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.02]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,0,0,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.15) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Left panel main wrapper */}
        <div className="relative z-10 flex flex-col h-full px-12 xl:px-16 py-12 justify-between">
          {/* Header Logo */}
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="Zentra Logo" className="h-20 md:h-24 lg:h-28 w-auto object-contain max-w-[280px]" />
            <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
              v2.0
            </span>
          </div>

          {/* Central content: Slogan */}
          <div className="space-y-6 my-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-[10px] font-bold text-slate-600 uppercase tracking-wider shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
              University Operations
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl xl:text-5xl font-extrabold text-slate-900 leading-[1.2] tracking-tight">
                Campus Operations &amp; <br />
                <span className="text-gradient font-black">Class Schedules,</span>
                <br />
                Simplified.
              </h1>
              <p className="text-sm text-slate-700 leading-relaxed max-w-md">
                An integrated platform to coordinate university timetables, track student academic tasks, manage fee collections, and streamline cover slot handovers.
              </p>
            </div>
          </div>

          {/* Bottom Brand Footer */}
          <div className="pt-6 border-t border-slate-200/80 flex items-center">
            <p className="text-[10px] text-slate-500 font-bold tracking-wide">
              © 2026 Zentra by FPC · All rights reserved.
            </p>
          </div>
        </div>
      </div>

      {/* ── RIGHT LOGIN PANEL ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50 relative justify-center">
        {/* Decorative soft glowing dots for right side */}
        <div className="absolute top-[20%] right-[-10%] h-[30%] w-[30%] rounded-full bg-slate-200/20 blur-[80px] pointer-events-none" />
        <div className="absolute bottom-[10%] left-[-15%] h-[35%] w-[35%] rounded-full bg-slate-300/10 blur-[90px] pointer-events-none" />

        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white/80 backdrop-blur-md z-20">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Zentra Logo" className="h-9 w-auto object-contain" />
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[9px] font-bold text-slate-550 uppercase tracking-widest flex items-center gap-1">
            <Sparkles className="h-2.5 w-2.5 text-amber-500" /> Live Database
          </span>
        </div>

        {/* Scrollable login form wrapper */}
        <div className="flex-1 overflow-y-auto flex items-center justify-center p-6 md:p-12 z-10">
          <div className="w-full max-w-md space-y-6">

            {/* Welcome text */}
            <div className="space-y-1.5 text-center lg:text-left">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                {isSignupMode ? "Request Access" : "Welcome back"}
              </h2>
              <p className="text-sm text-slate-600 font-medium">
                {isSignupMode
                  ? "Submit a registration request for administrator review."
                  : "Please log in to your university workspace."}
              </p>
            </div>

            {/* Form Card */}
            <div className="bg-white border border-slate-200/80 rounded-3xl shadow-[0_15px_30px_rgba(0,0,0,0.02)] p-8 space-y-6">
              {isSignupMode ? (
                // --- SIGNUP FORM ---
                <form onSubmit={handleSignupSubmit} className="space-y-4">
                  {signupError && (
                    <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-2xl text-xs text-rose-600 flex items-start gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span className="font-semibold leading-relaxed">{signupError}</span>
                    </div>
                  )}

                  {signupSuccess && (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-2xl text-xs text-emerald-600 flex items-start gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                      <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
                      <span className="font-semibold leading-relaxed">{signupSuccess}</span>
                    </div>
                  )}

                  {/* Name Input */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="John Doe"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      className="w-full bg-slate-50/70 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-800/10 focus:border-slate-800 focus:bg-white transition-all shadow-sm"
                      disabled={signupLoading}
                    />
                  </div>

                  {/* Email Input */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
                      Email address
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="john.doe@university.edu"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      className="w-full bg-slate-50/70 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-800/10 focus:border-slate-800 focus:bg-white transition-all shadow-sm"
                      disabled={signupLoading}
                    />
                  </div>

                  {/* Password Input */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      className="w-full bg-slate-50/70 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-800/10 focus:border-slate-800 focus:bg-white transition-all shadow-sm"
                      disabled={signupLoading}
                    />
                  </div>

                  {/* Re-enter Password Input */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
                      Re-enter Password
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={signupConfirmPassword}
                      onChange={(e) => setSignupConfirmPassword(e.target.value)}
                      className="w-full bg-slate-50/70 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-800/10 focus:border-slate-800 focus:bg-white transition-all shadow-sm"
                      disabled={signupLoading}
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={signupLoading}
                    className="w-full btn-gradient font-bold py-3 rounded-2xl text-sm transition-all shadow-md mt-2 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {signupLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Submitting request…
                      </>
                    ) : (
                      <>
                        Submit Access Request
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsSignupMode(false);
                      setSignupError("");
                      setSignupSuccess("");
                    }}
                    className="w-full text-center text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors mt-4 cursor-pointer block"
                  >
                    Already have an account? Sign in
                  </button>
                </form>
              ) : (
                // --- LOGIN FORM ---
                <>
                  {loginError && (
                    <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-2xl text-xs text-rose-600 flex items-start gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span className="font-semibold leading-relaxed">{loginError}</span>
                    </div>
                  )}

                  <form onSubmit={handleLoginSubmit} className="space-y-5">
                    {/* Email Input */}
                    <div className="space-y-1.5">
                      <label htmlFor="login-email" className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
                        Email address or Roll number
                      </label>
                      <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-slate-800 transition-colors pointer-events-none" />
                        <input
                          id="login-email"
                          type="text"
                          placeholder="your.name@university.edu"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full bg-slate-50/70 border border-slate-200 rounded-2xl pl-11 pr-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-800/10 focus:border-slate-800 focus:bg-white transition-all duration-200 shadow-sm"
                          disabled={loginLoading}
                          autoComplete="email"
                        />
                      </div>
                    </div>

                    {/* Password Input */}
                    <div className="space-y-1.5">
                      <label htmlFor="login-password" className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
                        Password
                      </label>
                      <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-450 group-focus-within:text-slate-800 transition-colors pointer-events-none" />
                        <input
                          id="login-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full bg-slate-50/70 border border-slate-200 rounded-2xl pl-11 pr-11 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-800/10 focus:border-slate-800 focus:bg-white transition-all duration-200 shadow-sm"
                          disabled={loginLoading}
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Sign In Button */}
                    <button
                      id="login-submit-btn"
                      type="submit"
                      disabled={loginLoading}
                      className="w-full btn-gradient font-bold py-3.5 rounded-2xl text-sm transition-all shadow-md mt-2 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                      {loginLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Verifying credentials…
                        </>
                      ) : (
                        <>
                          Sign in to Dashboard
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsSignupMode(true);
                        setLoginError("");
                      }}
                      className="w-full text-center text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors mt-4 cursor-pointer block"
                    >
                      Don't have an account? Request access
                    </button>
                  </form>
                </>
              )}
            </div>

            {/* Footer */}
            <p className="text-center text-[10px] text-slate-500 font-semibold tracking-wide">
              © 2026 Zentra by FPC · Enterprise Scheduling Platform
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
