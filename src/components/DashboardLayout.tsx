"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { isSuperAdminSession, SUPER_ADMIN_FLAG_KEY } from "@/lib/superadmin";
import { useApp, Role } from "@/context/AppContext";
import { useToast } from "@/context/ToastContext";
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
  Check,
  RefreshCw,
  AlertTriangle,
  CalendarCheck2,
  Bell,
  ExternalLink,
  Inbox,
  MessageSquare,
  ArrowUpRight,
  Clock,
  Send,
  Tag
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
    dataLoadError,
    retryDataLoad,
    refreshData,
    logout
  } = useApp();
  // ROLE_UI_AUDIT C3: toasts replace the old blocking alert() calls.
  const { toast: showToast } = useToast();

  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const storedUserEmail = typeof window !== "undefined" ? (localStorage.getItem("fp_user_email") || "") : "";
  const storedUserName = typeof window !== "undefined" ? (localStorage.getItem("fp_user_name") || "") : "";
  // Server-issued super-admin session flag (users.role === "admin") — no hardcoded identity
  const isSuperAdmin = isSuperAdminSession();

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
  const isAuthorized = isLoggedInClient && (isSuperAdmin || currentRole === requiredRole || storedRoleClient === requiredRole);

  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  /* ─── Notifications Bell ─── */
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [activeNotificationId, setActiveNotificationId] = useState<string | null>(null);
  const notificationsDropRef = useRef<HTMLDivElement | null>(null);
  const [notifRefreshKey, setNotifRefreshKey] = useState(0);
  const [bellShake, setBellShake] = useState(false);

  const resolveCurrentUserId = () => {
    if (typeof window === "undefined") return null;
    const stored =
      localStorage.getItem("fp_user_id") || localStorage.getItem("fp_header_id");
    if (stored) return stored;
    switch (currentRole) {
      case "mentor":
        return currentMentor?.id || null;
      case "hr":
        return currentHR?.id || null;
      case "cam":
        return currentCAM?.id || null;
      case "kam":
        return currentKAM?.id || null;
      case "admin":
        return currentAdmin?.id || null;
      case "student":
        return currentStudent?.id || null;
      case "sme":
        return currentSME?.id || null;
      default:
        return null;
    }
  };

  /* ─── Global Feedback Modal State & Reporter Resolution ─── */
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackModalTab, setFeedbackModalTab] = useState<"submit" | "history">("submit");
  const [myFeedbackList, setMyFeedbackList] = useState<any[]>([]);
  const [myFeedbackLoading, setMyFeedbackLoading] = useState(false);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const getReporterDetails = () => {
    let name = storedUserName || "";
    let email = storedUserEmail || "";
    let collegeId = "";
    let collegeName = "";
    let department = "";
    let registerNumber = "";
    let contactInfo = "";

    if (currentRole === "student" && currentStudent) {
      name = currentStudent.name || name;
      email = currentStudent.email || email;
      collegeId = currentStudent.college_id || "";
      department = currentStudent.department || "";
      registerNumber = currentStudent.register_number || (currentStudent as any).roll_no || "";
      contactInfo = (currentStudent as any).contact_number || (currentStudent as any).phone || "";
    } else if (currentRole === "mentor" && currentMentor) {
      name = currentMentor.name || name;
      email = currentMentor.email || email;
      collegeId = currentMentor.college_id || "";
      department = currentMentor.department || "";
      registerNumber = (currentMentor as any).employee_id || currentMentor.id || "";
      contactInfo = (currentMentor as any).phone || "";
    } else if (currentRole === "cam" && currentCAM) {
      name = currentCAM.name || name;
      email = currentCAM.email || email;
      collegeId = currentCAM.college_id || "";
    } else if (currentRole === "admin" && currentAdmin) {
      name = currentAdmin.name || name;
      email = currentAdmin.email || email;
    } else if (currentRole === "hr" && currentHR) {
      name = currentHR.name || name;
      email = currentHR.email || email;
    } else if (currentRole === "kam" && currentKAM) {
      name = currentKAM.name || name;
      email = currentKAM.email || email;
      collegeId = (currentKAM as any).college_id || "";
    } else if (currentRole === "sme" && currentSME) {
      name = currentSME.name || name;
      email = currentSME.email || email;
    }

    if (!email && typeof window !== "undefined") {
      email = localStorage.getItem("fp_user_email") || "";
    }
    if (!name && typeof window !== "undefined") {
      name = localStorage.getItem("fp_user_name") || "";
    }

    if (collegeId && colleges?.length) {
      const c = colleges.find((col: any) => col.id === collegeId);
      if (c) collegeName = c.name;
    }

    return {
      userId: email || resolveCurrentUserId() || "anonymous",
      userName: name,
      userRole: currentRole || "user",
      collegeId,
      collegeName,
      department,
      registerNumber,
      contactInfo
    };
  };

  const fetchMyFeedback = async () => {
    const reporter = getReporterDetails();
    const uid = reporter.userId;
    if (!uid) return;
    setMyFeedbackLoading(true);
    try {
      const res = await fetch(`/api/feedback?userId=${encodeURIComponent(uid)}`);
      const data = await res.json();
      if (data?.success && Array.isArray(data.reports)) {
        setMyFeedbackList(data.reports);
      }
    } catch (_) {
    } finally {
      setMyFeedbackLoading(false);
    }
  };

  useEffect(() => {
    if (showFeedbackModal && feedbackModalTab === "history") {
      fetchMyFeedback();
    }
  }, [showFeedbackModal, feedbackModalTab]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const hasUnread = unreadCount > 0;

  const fetchNotifications = async (silent = false) => {
    const uid = resolveCurrentUserId();
    if (!uid) {
      setNotifications([]);
      return;
    }
    if (!silent) setNotificationsLoading(true);
    fetch(`/api/notifications?user_id=${encodeURIComponent(uid)}&limit=25`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.success && Array.isArray(data.notifications)) {
          setNotifications(data.notifications);
          if (!silent && hasUnread !== (data.notifications.filter((n: any) => !n.is_read).length > 0)) {
            setBellShake(true);
            setTimeout(() => setBellShake(false), 600);
          }
        } else {
          setNotifications([]);
        }
      })
      .catch(() => setNotifications([]))
      .finally(() => setNotificationsLoading(false));
  };

  const resolveNotificationTarget = (n: any) => {
    if (!n) return null;
    const rawLink = n.link?.trim();
    if (rawLink && (rawLink.startsWith("http://") || rawLink.startsWith("https://"))) {
      return { url: rawLink, isExternal: true, actionLabel: "Open Link" };
    }

    const title = (n.title || "").toLowerCase();
    const message = (n.message || "").toLowerCase();
    const fullText = `${title} ${message}`;

    // Extract any YYYY-MM-DD date mentioned
    const dateMatch = `${n.title || ""} ${n.message || ""}`.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    const targetDate = dateMatch ? dateMatch[1] : null;

    // Resolve base prefix for current role
    const role = currentRole || "student";
    const roleBase = `/${role === "fee_manager" ? "fee-manager" : role}`;

    // If explicit relative link exists
    if (rawLink) {
      let cleanLink = rawLink.startsWith("/") ? rawLink : `${roleBase}/${rawLink}`;
      // Adapt cross-role links if needed
      if (cleanLink.startsWith("/cam") && role === "student") {
        cleanLink = cleanLink.replace(/^\/cam/, "/student");
      } else if (cleanLink.startsWith("/cam") && role === "mentor") {
        cleanLink = cleanLink.replace(/^\/cam/, "/mentor");
      }
      return { url: cleanLink, isExternal: false, targetDate, actionLabel: "View Details" };
    }

    // Smart semantic categorization based on text
    if (fullText.includes("schedule") || fullText.includes("calendar") || fullText.includes("timetable") || fullText.includes("day order") || fullText.includes("holiday") || fullText.includes("class session") || fullText.includes("campus schedule")) {
      if (role === "student") return { url: `/student/schedule${targetDate ? `?date=${targetDate}` : ""}`, isExternal: false, targetDate, actionLabel: "Open Class Schedule" };
      if (role === "mentor") return { url: `/mentor/schedule${targetDate ? `?date=${targetDate}` : ""}`, isExternal: false, targetDate, actionLabel: "Open Timetable" };
      if (role === "cam") return { url: `/cam/schedule${targetDate ? `?date=${targetDate}` : ""}`, isExternal: false, targetDate, actionLabel: "Open Schedule" };
      if (role === "kam") return { url: `/kam/attendance${targetDate ? `?date=${targetDate}` : ""}`, isExternal: false, targetDate, actionLabel: "Open Attendance" };
      if (role === "admin") return { url: `/admin/schedule${targetDate ? `?date=${targetDate}` : ""}`, isExternal: false, targetDate, actionLabel: "Open Schedule" };
    }

    if (fullText.includes("interview") || fullText.includes("mock") || fullText.includes("gmeet") || fullText.includes("evaluat") || fullText.includes("split")) {
      if (role === "student") return { url: `/student/interviews`, isExternal: false, targetDate, actionLabel: "View Interview" };
      if (role === "mentor") return { url: `/mentor/interviews`, isExternal: false, targetDate, actionLabel: "View Interviews" };
      if (role === "cam") return { url: `/cam/interviews`, isExternal: false, targetDate, actionLabel: "Open Interviews" };
      if (role === "kam") return { url: `/kam/analytics`, isExternal: false, targetDate, actionLabel: "View Analytics" };
      if (role === "admin") return { url: `/admin/interviews`, isExternal: false, targetDate, actionLabel: "View Interviews" };
    }

    if (fullText.includes("leave") || fullText.includes("on-duty") || fullText.includes("on duty") || fullText.includes(" od ") || fullText.includes("handover") || fullText.includes("permission") || fullText.includes("approval")) {
      if (role === "student") return { url: `/student/dashboard`, isExternal: false, targetDate, actionLabel: "View Dashboard" };
      if (role === "mentor") return { url: `/mentor/leaves`, isExternal: false, targetDate, actionLabel: "View Leaves" };
      if (role === "cam") return { url: `/cam/leave-approvals`, isExternal: false, targetDate, actionLabel: "Review Approvals" };
      if (role === "admin") return { url: `/admin/approvals`, isExternal: false, targetDate, actionLabel: "View Approvals" };
      if (role === "hr") return { url: `/hr`, isExternal: false, targetDate, actionLabel: "View HR Portal" };
    }

    if (fullText.includes("exam") || fullText.includes("test") || fullText.includes("assessment")) {
      if (role === "student") return { url: `/student/exams`, isExternal: false, targetDate, actionLabel: "View Test Marks" };
      if (role === "mentor") return { url: `/mentor/exams`, isExternal: false, targetDate, actionLabel: "View Exams" };
      if (role === "cam") return { url: `/cam/exams`, isExternal: false, targetDate, actionLabel: "View Exams" };
      if (role === "admin") return { url: `/admin/exams`, isExternal: false, targetDate, actionLabel: "View Exams" };
    }

    if (fullText.includes("mark") || fullText.includes("cia") || fullText.includes("grade") || fullText.includes("score")) {
      if (role === "student") return { url: `/student/exams`, isExternal: false, targetDate, actionLabel: "View Test Marks" };
      if (role === "mentor") return { url: `/mentor/marks`, isExternal: false, targetDate, actionLabel: "View Marks" };
    }

    if (fullText.includes("task") || fullText.includes("tracker") || fullText.includes("practical") || fullText.includes("submission") || fullText.includes("assignment")) {
      if (role === "student") return { url: `/student/tracker`, isExternal: false, targetDate, actionLabel: "Open Tracker" };
      if (role === "mentor") return { url: `/mentor/submissions`, isExternal: false, targetDate, actionLabel: "View Submissions" };
    }

    if (fullText.includes("fee") || fullText.includes("due") || fullText.includes("payment") || fullText.includes("tuition") || fullText.includes("invoice")) {
      if (role === "student") return { url: `/student/fees`, isExternal: false, targetDate, actionLabel: "View Fees" };
      if (role === "fee_manager" || role === "admin") return { url: `/fee-manager`, isExternal: false, targetDate, actionLabel: "View Fee Manager" };
    }

    if (fullText.includes("library") || fullText.includes("book") || fullText.includes("opac")) {
      if (role === "student") return { url: `/student/library`, isExternal: false, targetDate, actionLabel: "Open Library" };
    }

    if (fullText.includes("profile") || fullText.includes("password") || fullText.includes("account")) {
      if (role === "student") return { url: `/student/profile`, isExternal: false, targetDate, actionLabel: "View Profile" };
      if (role === "mentor") return { url: `/mentor/profile`, isExternal: false, targetDate, actionLabel: "View Profile" };
    }

    // Default fallback to role dashboard
    return { url: `${roleBase}/dashboard`, isExternal: false, targetDate, actionLabel: "View Details" };
  };

  const handleNotificationClick = (n: any) => {
    if (!n) return;
    const target = resolveNotificationTarget(n);

    // Mark as read immediately
    if (!n.is_read) {
      markNotifRead(n.id);
    }
    setShowNotifications(false);

    if (!target) return;

    if (target.isExternal) {
      if (typeof window !== "undefined") {
        window.open(target.url, "_blank", "noopener,noreferrer");
      }
      return;
    }

    if (typeof window !== "undefined") {
      // Store intent so client tabbed components can immediately consume on navigation
      try {
        sessionStorage.setItem("fp_notif_target", JSON.stringify({
          url: target.url,
          date: target.targetDate,
          title: n.title,
          message: n.message,
          timestamp: Date.now()
        }));
      } catch (_) {}

      // Dispatch global window event for instant responsive tab changes
      window.dispatchEvent(new CustomEvent("fp_navigate_target", {
        detail: {
          url: target.url,
          date: target.targetDate,
          title: n.title,
          message: n.message
        }
      }));

      router.push(target.url);
    }
  };

  const markNotifRead = async (id: string, navigateTo?: string | null) => {
    setActiveNotificationId(id);
    fetch(`/api/notifications`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notification_id: id, action: "mark_read" }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.success) {
          setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n))
          );
        }
        if (navigateTo && typeof window !== "undefined") {
          if (navigateTo.startsWith("http")) {
            window.open(navigateTo, "_blank", "noopener");
          } else {
            router.push(navigateTo);
          }
        }
      })
      .finally(() => setActiveNotificationId(null));
  };

  const clearAllNotifs = () => {
    const uid = resolveCurrentUserId();
    if (!uid) return;
    fetch(`/api/notifications`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: uid, action: "mark_all_read" }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.success) {
          setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
        }
      });
  };

  /* auto-refresh notifications on mount + when opened + every 30s / 15s if unread exists */
  useEffect(() => {
    let isMounted = true;
    fetchNotifications(true);
    const interval = window.setInterval(() => {
      if (isMounted) fetchNotifications(true);
    }, hasUnread ? 15000 : 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRole, notifRefreshKey, currentMentor?.id, currentCAM?.id, currentHR?.id, currentAdmin?.id, currentStudent?.id, currentSME?.id]);

  /* Close dropdowns when clicking outside */
  useEffect(() => {
    const onClickOut = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (notificationsDropRef.current && !notificationsDropRef.current.contains(el)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", onClickOut);
    return () => document.removeEventListener("mousedown", onClickOut);
  }, []);

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

  // DATA_FLOW_AUDIT D4: listen for data-change broadcasts (in-page CustomEvents and
  // cross-tab "storage" events) and refresh the affected data so all open tabs and
  // roles stay in sync without a manual reload.
  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (debounce) clearTimeout(debounce);
      // Debounce bursts of mutations (imports, bulk ops) into a single refresh.
      debounce = setTimeout(() => { refreshData(true); }, 800);
    };
    window.addEventListener("fp_data_changed", scheduleRefresh);
    const onStorage = (e: StorageEvent) => {
      if (e.key === "fp_data_changed" && e.newValue) scheduleRefresh();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      if (debounce) clearTimeout(debounce);
      window.removeEventListener("fp_data_changed", scheduleRefresh);
      window.removeEventListener("storage", onStorage);
    };
  }, [refreshData]);

  // Handle route protection cleanly without premature logouts
  const hasCompletedInitialLoad = useRef(false);
  const routeProtectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isLoading && !isDataLoading) {
      hasCompletedInitialLoad.current = true;
    }
  }, [isLoading, isDataLoading]);

  useEffect(() => {
    // Clear any existing timeout
    if (routeProtectionTimeoutRef.current) {
      clearTimeout(routeProtectionTimeoutRef.current);
    }

    // Debounce route protection to avoid race conditions during data load
    routeProtectionTimeoutRef.current = setTimeout(() => {
      // Only run protection after initial load is complete
      if (!hasCompletedInitialLoad.current) return;
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

      if (!isSuperAdmin && activeRole && activeRole !== requiredRole && !isLoading && !isDataLoading) {
        const targetPath = "/" + (activeRole === "fee_manager" ? "fee-manager" : activeRole);
        router.replace(targetPath);
      }
    }, 300); // Wait 300ms before running protection to avoid race conditions

    return () => {
      if (routeProtectionTimeoutRef.current) {
        clearTimeout(routeProtectionTimeoutRef.current);
      }
    };
  }, [isLoading, isDataLoading, requiredRole, router, isSuperAdmin]);

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const handleLogout = () => {
    if (isLoggingOut) return; // prevent double-fire
    setIsLoggingOut(true);
    logout();
    router.replace("/");
  };

  // Render global loading screen if app is initializing or not authorized yet
  if (isLoading || !isAuthorized) {
    return <ProfessionalLoader message="Connecting to live database & loading workspace..." />;
  }

  return (
    <div className="h-screen flex flex-col font-sans bg-warm-canvas text-gray-800 transition-colors duration-200 overflow-hidden relative">
      {/* Data-load failure retry banner — replaces the old silent empty-dashboard behavior */}
      {dataLoadError && (
        <div className="sticky top-0 z-[60] w-full bg-rose-50 border-b border-rose-200 px-4 py-2 flex items-center justify-center gap-3">
          <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
          <span className="text-xs font-bold text-rose-700">Couldn&apos;t reach the database — showing possibly stale data.</span>
          <button
            type="button"
            onClick={() => retryDataLoad()}
            disabled={isDataLoading}
            className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-[11px] font-black transition-all cursor-pointer flex items-center gap-1.5"
          >
            {isDataLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            {isDataLoading ? "Retrying…" : "Retry"}
          </button>
        </div>
      )}

      {/* Top indeterminate sync progress line */}
      {isDataLoading && (
        <div className="absolute top-0 left-0 right-0 h-0.5 z-50 overflow-hidden bg-indigo-100">
          <div className="h-full bg-gradient-to-r from-indigo-500 via-[#D528A2] to-indigo-500 animate-pulse w-full" />
        </div>
      )}

      {/* Balanced Centered Global Header + Compact Right Floating Team Attendance Pill */}
      <div className="relative w-[92%] sm:w-[82%] md:w-[74%] lg:w-[66%] max-w-[1040px] mx-auto self-center mt-2.5 md:mt-4 z-30 shrink-0">
        <header className="floating-header w-full px-3 sm:px-6 py-2.5 md:py-4 flex items-center justify-between transition-all rounded-xl border border-slate-200/80 shadow-md bg-white/80 backdrop-blur-md">
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
        <div className="flex items-center gap-2 sm:gap-3">

          {/* Profile Dropdown trigger */}
          {/* Interactive Refresh Loader Button */}
          <button
            type="button"
            onClick={async () => {
              setIsManualRefreshing(true);
              try {
                await refreshData();
              } catch (_) {}
              finally {
                setIsManualRefreshing(false);
              }
            }}
            disabled={isManualRefreshing || isDataLoading}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-indigo-600 transition-all cursor-pointer shadow-xs disabled:opacity-70"
            title="Click to reload latest data from server"
          >
            {isManualRefreshing || isDataLoading ? (
              <RefreshCw className="h-3 w-3 text-indigo-600 animate-spin" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            )}
            <span className="truncate max-w-[140px] sm:max-w-none">
              {isManualRefreshing || isDataLoading ? "Syncing..." : `Synced: ${refreshedAtTime || "Just now"}`}
            </span>
          </button>



          {/* Master Global Region / Campus Scope Switcher (super-admin sessions only) */}
          {isSuperAdmin && (
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
                    <span className="text-[8px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold">{storedUserName || "Super Admin"}</span>
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

          {/* Notifications Bell */}
          <div className="relative" ref={notificationsDropRef}>
            <button
              type="button"
              onClick={() => {
                setShowNotifications((p) => !p);
                setShowProfileDropdown(false);
                setShowCampusDropdown && setShowCampusDropdown(false);
                if (!showNotifications) {
                  fetchNotifications(true);
                  setNotifRefreshKey((k) => k + 1);
                }
              }}
              className={`relative flex items-center justify-center h-9 w-9 rounded-lg bg-gray-55 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all cursor-pointer ${
                hasUnread ? "ring-1 ring-amber-400/60 ring-offset-1 dark:ring-offset-slate-900 bg-amber-50 dark:bg-amber-950/30" : ""
              } ${bellShake ? "animate-[wiggle_0.5s_ease-in-out]" : ""}`}
              title="Notifications"
            >
              <Bell className={`h-4 w-4 ${hasUnread ? "text-amber-600 dark:text-amber-400" : "text-gray-600 dark:text-slate-300"} ${hasUnread ? "animate-pulse" : ""}`} />
              {hasUnread && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-[0_0_0_1px_rgba(244,63,94,0.3)]">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {/* Dropdown Panel */}
            {showNotifications && (
              <div className="absolute right-0 mt-2.5 w-[380px] sm:w-[420px] max-w-[92vw] max-h-[70vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-[60] overflow-hidden flex flex-col animate-fadeIn">
              {/* Header */}
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-indigo-50 to-slate-50 dark:from-indigo-950/40 dark:to-slate-900 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-indigo-600 flex items-center justify-center shadow-xs">
                    <MessageSquare className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-slate-800 dark:text-white tracking-tight">
                      Notifications
                    </p>
                    <p className="text-[9px] text-slate-400 font-medium">
                      {hasUnread
                        ? `${unreadCount} unread · ${notifications.length} total`
                        : `${notifications.length} notifications`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      fetchNotifications(false);
                      setNotifRefreshKey((k) => k + 1);
                    }}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 text-slate-500 dark:text-slate-400 ${notificationsLoading ? "animate-spin" : ""}`} />
                  </button>
                  {hasUnread && (
                    <button
                      type="button"
                      onClick={clearAllNotifs}
                      className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-indigo-650 dark:text-indigo-300 text-[9px] font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
              </div>

              {/* List */}
              <div className="overflow-y-auto flex-1 max-h-[58vh]">
                {notificationsLoading && notifications.length === 0 ? (
                  <div className="px-4 py-10 flex flex-col items-center justify-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mb-2 text-indigo-500" />
                    <p className="text-[11px] font-semibold">Loading notifications…</p>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="px-4 py-12 flex flex-col items-center justify-center">
                    <div className="h-14 w-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                      <Inbox className="h-6 w-6 text-slate-400" />
                    </div>
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      All caught up
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5 text-center max-w-[240px]">
                      You don't have any notifications yet. Reminders and activity will show here.
                    </p>
                  </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {notifications.map((n) => {
                        const isRead = !!n.is_read;
                        const isActive = activeNotificationId === n.id;
                        const t = n.type || "info";
                        const accent =
                          t === "reminder"
                            ? "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/60"
                            : t === "success"
                            ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/60"
                            : t === "warning" || t === "alert"
                            ? "bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/60"
                            : "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/60";
                        const target = resolveNotificationTarget(n);
                        const Icon =
                          t === "reminder" ? Bell : t === "success" ? CheckCircle2 : t === "warning" ? AlertCircle : MessageSquare;

                        return (
                          <div
                            key={n.id}
                            onClick={() => handleNotificationClick(n)}
                            className={`group relative px-3.5 py-3 transition-all cursor-pointer ${
                              isRead
                                ? "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                                : "bg-indigo-50/40 dark:bg-indigo-950/10 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/20"
                            } ${isActive ? "opacity-60" : ""}`}
                          >
                            {!isRead && (
                              <span className="absolute left-0 top-3.5 h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_0_3px_rgba(244,63,94,0.12)]" />
                            )}
                            <div className="pl-5 flex items-start gap-3">
                              <div className={`shrink-0 mt-0.5 h-8 w-8 rounded-xl border flex items-center justify-center ${accent}`}>
                                <Icon className="h-3.5 w-3.5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <p className={`text-[11px] font-black text-slate-800 dark:text-slate-100 leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors ${!isRead ? "text-slate-900 dark:text-white" : ""}`}>
                                    {n.title || "Notification"}
                                  </p>
                                  <span className="shrink-0 text-[9px] font-mono font-semibold text-slate-400">
                                    {(() => {
                                      try {
                                        const d = new Date(n.created_at);
                                        const now = new Date();
                                        const diffMs = now.getTime() - d.getTime();
                                        const mins = Math.floor(diffMs / 60000);
                                        if (mins < 1) return "now";
                                        if (mins < 60) return `${mins}m`;
                                        const hrs = Math.floor(mins / 60);
                                        if (hrs < 24) return `${hrs}h`;
                                        const days = Math.floor(hrs / 24);
                                        if (days < 7) return `${days}d`;
                                        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
                                      } catch {
                                        return "";
                                      }
                                    })()}
                                  </span>
                                </div>
                                <p className="mt-0.5 text-[10.5px] leading-snug text-slate-600 dark:text-slate-400 font-medium line-clamp-3">
                                  {n.message}
                                </p>
                                <div className="mt-2.5 flex items-center justify-between gap-2 flex-wrap">
                                  {target && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 group-hover:bg-indigo-700 active:bg-indigo-800 text-white text-[9.5px] font-bold shadow-xs transition-all">
                                      {target.isExternal ? <ExternalLink className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                                      <span>{target.actionLabel}</span>
                                    </span>
                                  )}
                                  {!isRead && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        markNotifRead(n.id);
                                      }}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[9px] font-bold transition-colors ml-auto"
                                      title="Mark as read without opening"
                                    >
                                      <Check className="h-3 w-3 text-emerald-600" />
                                      <span>Mark read</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
                <p className="text-[9px] text-slate-400 font-medium">
                  Auto-refreshes every {hasUnread ? "15s" : "30s"}
                </p>
                <button
                  type="button"
                  onClick={() => setShowNotifications(false)}
                  className="text-[9.5px] font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 px-2 py-1 rounded-md hover:bg-white dark:hover:bg-slate-800 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
          </div>

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
                    disabled={isLoggingOut}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-50/50 dark:hover:bg-rose-950/20 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                  >
                    {isLoggingOut
                      ? <span className="h-3.5 w-3.5 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
                      : <LogOut className="h-3.5 w-3.5" />}
                    {isLoggingOut ? "Logging out…" : "Log out"}
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </header>

      {/* Compact Separate Floating Pill Card placed to the right of the main header */}
      {currentRole === "cam" && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2.5 flex items-center">
          <div className="floating-header px-2 py-1 flex items-center justify-center transition-all rounded-xl border border-slate-200/80 shadow-sm bg-white/90 backdrop-blur-md animate-fadeIn">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("fp_navigate_tab", { detail: "mentor_attendance" }));
                }
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#D528A2] via-pink-600 to-rose-500 text-white font-extrabold text-[11px] tracking-tight shadow-xs hover:shadow-md hover:scale-102 active:scale-98 transition-all cursor-pointer whitespace-nowrap shrink-0"
              title="Team Attendance Management"
            >
              <CalendarCheck2 className="h-3.5 w-3.5 text-white shrink-0" />
              <span className="font-extrabold">Team Attendance</span>
            </button>
          </div>
        </div>
      )}
    </div>

      {/* Main Workspace Dashboard Content */}
      <main className="flex-grow flex flex-col relative overflow-hidden">
        {/* Modern Dot Grid Background Pattern Overlay */}
        <div className="absolute inset-0 bg-dotted-grid pointer-events-none opacity-75 dark:opacity-40 z-0" />
        {children}

        {/* Global Floating Feedback Button */}
        <div className="fixed bottom-4 right-4 z-40">
          <button
            type="button"
            onClick={() => {
              setShowFeedbackModal(true);
              setFeedbackModalTab("submit");
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
                    disabled={isLoggingOut}
                    className="flex-1 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/50 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-wait"
                  >
                    {isLoggingOut
                      ? <span className="h-3.5 w-3.5 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
                      : <LogOut className="h-3.5 w-3.5" />}
                    {isLoggingOut ? "Logging out…" : "Log out"}
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
      {(showFeedbackModal || true) && (
        <div
          id="global-feedback-modal"
          className={`${showFeedbackModal ? "flex" : "hidden"} fixed inset-0 z-50 items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200`}
        >
          <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-150 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-50 to-indigo-50/40 dark:from-slate-900 dark:to-indigo-950/30">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm font-bold">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">Support & Feedback Center</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Report issues or track live status of your submitted tickets</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowFeedbackModal(false);
                  const el = document.getElementById("global-feedback-modal");
                  if (el) el.classList.add("hidden");
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-150 dark:border-slate-800 px-6 pt-2 bg-slate-50/50 dark:bg-slate-900/50">
              <button
                type="button"
                onClick={() => setFeedbackModalTab("submit")}
                className={`flex items-center gap-2 py-2.5 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  feedbackModalTab === "submit"
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <Send className="h-3.5 w-3.5" />
                <span>Submit New Issue</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFeedbackModalTab("history");
                  fetchMyFeedback();
                }}
                className={`flex items-center gap-2 py-2.5 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  feedbackModalTab === "history"
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <ClipboardList className="h-3.5 w-3.5" />
                <span>My Submitted Issues</span>
                {myFeedbackList.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                    {myFeedbackList.length}
                  </span>
                )}
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)] space-y-4">
              {feedbackModalTab === "submit" ? (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.target as HTMLFormElement;
                    const type = (form.elements.namedItem("type") as HTMLSelectElement).value;
                    const title = (form.elements.namedItem("title") as HTMLInputElement).value;
                    const description = (form.elements.namedItem("description") as HTMLTextAreaElement).value;
                    const contactPhone = (form.elements.namedItem("contactPhone") as HTMLInputElement)?.value || "";

                    const reporter = getReporterDetails();
                    setIsSubmittingFeedback(true);

                    try {
                      const res = await fetch("/api/feedback", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          userId: reporter.userId,
                          userName: reporter.userName,
                          userRole: reporter.userRole,
                          collegeId: reporter.collegeId,
                          collegeName: reporter.collegeName,
                          department: reporter.department,
                          registerNumber: reporter.registerNumber,
                          contactInfo: contactPhone.trim() || reporter.contactInfo,
                          type,
                          title,
                          description
                        })
                      });
                      const data = await res.json();
                      if (data.success) {
                        showToast("Feedback submitted successfully! Our administration team will review it.", "success");
                        form.reset();
                        fetchMyFeedback();
                        setFeedbackModalTab("history");
                      } else {
                        showToast(data.message || "Failed to submit feedback.", "error");
                      }
                    } catch (err: any) {
                      showToast("Failed to submit feedback: " + err.message, "error");
                    } finally {
                      setIsSubmittingFeedback(false);
                    }
                  }}
                  className="space-y-4 text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  {/* Reporter context banner */}
                  {(() => {
                    const rep = getReporterDetails();
                    return (
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3 text-[11px] flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-indigo-500" />
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            Submitting as: <span className="text-indigo-600 dark:text-indigo-400">{rep.userName || rep.userId}</span>
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-[10px] font-black uppercase text-slate-600 dark:text-slate-300">
                            {rep.userRole}
                          </span>
                        </div>
                        {(rep.collegeName || rep.department) && (
                          <div className="text-[10px] text-slate-400 font-medium truncate">
                            {rep.collegeName} {rep.department ? `(${rep.department})` : ""}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Issue Category</label>
                      <select
                        name="type"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold focus:outline-none focus:border-indigo-500"
                      >
                        <option value="bug">🐞 Bug / Error Report</option>
                        <option value="feature">✨ Feature Request</option>
                        <option value="suggestion">💡 General Suggestion</option>
                        <option value="other">📝 Other / Help</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Contact Phone (Optional)</label>
                      <input
                        name="contactPhone"
                        type="text"
                        defaultValue={getReporterDetails().contactInfo}
                        placeholder="e.g. +91 9876543210"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs outline-none focus:border-indigo-500 font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Title / Summary</label>
                    <input
                      required
                      name="title"
                      type="text"
                      placeholder="e.g. Date of birth is incorrect in my profile"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs outline-none focus:border-indigo-500 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Detailed Description</label>
                    <textarea
                      required
                      name="description"
                      rows={4}
                      placeholder="Describe what happened, what needs correction, and any error message you encountered..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs outline-none focus:border-indigo-500 font-medium resize-none"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowFeedbackModal(false);
                        const el = document.getElementById("global-feedback-modal");
                        if (el) el.classList.add("hidden");
                      }}
                      className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingFeedback}
                      className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {isSubmittingFeedback ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5" />
                          <span>Submit Ticket</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                /* History Tab: Track status of submitted issues */
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1">
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      Your Reported Issues ({myFeedbackList.length})
                    </p>
                    <button
                      type="button"
                      onClick={fetchMyFeedback}
                      className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 transition-colors cursor-pointer"
                    >
                      <RefreshCw className={`h-3 w-3 ${myFeedbackLoading ? "animate-spin" : ""}`} />
                      <span>Refresh</span>
                    </button>
                  </div>

                  {myFeedbackLoading ? (
                    <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                      <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mb-2" />
                      <p className="text-xs font-semibold">Loading your issues...</p>
                    </div>
                  ) : myFeedbackList.length === 0 ? (
                    <div className="py-12 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
                      <MessageSquare className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200">No issues submitted yet</p>
                      <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                        If you encounter bugs, broken features, or data discrepancies, report them using the form.
                      </p>
                      <button
                        type="button"
                        onClick={() => setFeedbackModalTab("submit")}
                        className="mt-3 px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-all cursor-pointer"
                      >
                        Create New Report
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {myFeedbackList.map((item: any) => {
                        const isPending = (item.status || "pending") === "pending";
                        const isResolved = item.status === "resolved";

                        return (
                          <div
                            key={item.id}
                            className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-2.5 shadow-xs"
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                                    item.type === "bug"
                                      ? "bg-rose-50 text-rose-700 border-rose-200"
                                      : item.type === "feature"
                                      ? "bg-purple-50 text-purple-700 border-purple-200"
                                      : "bg-indigo-50 text-indigo-700 border-indigo-200"
                                  }`}
                                >
                                  {item.type || "issue"}
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                                    isPending
                                      ? "bg-amber-50 text-amber-700 border-amber-300"
                                      : isResolved
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                      : "bg-slate-100 text-slate-600 border-slate-300"
                                  }`}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${
                                      isPending ? "bg-amber-500 animate-pulse" : isResolved ? "bg-emerald-500" : "bg-slate-400"
                                    }`}
                                  />
                                  {isPending ? "Pending Review" : item.status}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {item.created_at ? new Date(item.created_at).toLocaleString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: true
                                }) : ""}
                              </span>
                            </div>

                            <div>
                              <h4 className="text-xs font-black text-slate-900 dark:text-white">{item.title}</h4>
                              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-wrap font-medium">
                                {item.description}
                              </p>
                            </div>

                            {/* Admin Resolution Remarks */}
                            {(item.admin_notes || item.resolved_by) && (
                              <div className="rounded-lg bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 p-2.5 space-y-1">
                                <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                                  <span className="inline-flex items-center gap-1.5">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                    Admin Response
                                  </span>
                                  {item.resolved_at && (
                                    <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400">
                                      {new Date(item.resolved_at).toLocaleDateString("en-IN", {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric"
                                      })}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-emerald-950 dark:text-emerald-100 font-medium whitespace-pre-wrap pl-5">
                                  {item.admin_notes || "Resolved by administration."}
                                </p>
                                {item.resolved_by && (
                                  <p className="text-[9px] text-emerald-700 dark:text-emerald-400 pl-5">
                                    Handled by: <span className="font-semibold">{item.resolved_by}</span>
                                  </p>
                                )}
                              </div>
                            )}

                            {isPending && (
                              <p className="text-[10px] text-slate-400 italic">
                                ⏳ Queued for administrator review. You will receive an in-app notification once addressed.
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ProfessionalLoader({ message = "Loading your workspace..." }: { message?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-warm-canvas">
      <div className="flex flex-col items-center gap-3">
        <img src="/E-Campus.png" alt="FACE Prep E-Campus" className="h-9 w-auto object-contain" />
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 text-indigo-600 animate-spin-smooth" />
          <span className="text-xs font-bold text-slate-500">{message}</span>
        </div>
      </div>
    </div>
  );
}
