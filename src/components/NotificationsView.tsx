"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/context/ToastContext";
import {
  Bell,
  CheckCircle2,
  Circle,
  ExternalLink,
  ArrowRight,
  Calendar,
  ClipboardList,
  Video,
  Award,
  BookOpen,
  IndianRupee,
  User,
  Clock,
  Check,
  CheckCheck
} from "lucide-react";

export function NotificationsView({ userId, portalType }: { userId?: string; portalType: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/notifications?userId=${encodeURIComponent(userId)}&limit=50`);
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications || []);
      }
    } catch (e) {
      toast("Failed to fetch notifications", "error");
    } finally {
      setLoading(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    if (userId) fetchNotifications();
  }, [userId, fetchNotifications]);

  const markAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
      }
    } catch (e) {
      toast("Failed to update status", "error");
    }
  };

  const markAllAsRead = async () => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, markAll: true })
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
        toast("All marked as read", "success");
      }
    } catch (e) {
      toast("Failed to update status", "error");
    }
  };

  const resolveTarget = (n: any) => {
    if (!n) return null;
    const rawLink = n.link?.trim();
    if (rawLink && (rawLink.startsWith("http://") || rawLink.startsWith("https://"))) {
      return { url: rawLink, isExternal: true, actionLabel: "Open Link", icon: ExternalLink };
    }

    const title = (n.title || "").toLowerCase();
    const message = (n.message || "").toLowerCase();
    const fullText = `${title} ${message}`;

    // Extract any YYYY-MM-DD date mentioned
    const dateMatch = `${n.title || ""} ${n.message || ""}`.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    const targetDate = dateMatch ? dateMatch[1] : null;

    const role = portalType || "student";
    const roleBase = `/${role === "fee_manager" ? "fee-manager" : role}`;

    if (rawLink) {
      let cleanLink = rawLink.startsWith("/") ? rawLink : `${roleBase}/${rawLink}`;
      if (cleanLink.startsWith("/cm") && role === "student") {
        cleanLink = cleanLink.replace(/^\/cm/, "/student");
      } else if (cleanLink.startsWith("/cm") && role === "mentor") {
        cleanLink = cleanLink.replace(/^\/cm/, "/mentor");
      }
      return { url: cleanLink, isExternal: false, targetDate, actionLabel: "View Details", icon: ArrowRight };
    }

    if (fullText.includes("schedule") || fullText.includes("calendar") || fullText.includes("timetable") || fullText.includes("day order") || fullText.includes("holiday") || fullText.includes("class session") || fullText.includes("campus schedule")) {
      if (role === "student") return { url: `/student/schedule${targetDate ? `?date=${targetDate}` : ""}`, isExternal: false, targetDate, actionLabel: "Open Class Schedule", icon: Calendar };
      if (role === "mentor") return { url: `/mentor/schedule${targetDate ? `?date=${targetDate}` : ""}`, isExternal: false, targetDate, actionLabel: "Open Timetable", icon: Calendar };
      if (role === "cm") return { url: `/cm/schedule${targetDate ? `?date=${targetDate}` : ""}`, isExternal: false, targetDate, actionLabel: "Open Schedule", icon: Calendar };
      if (role === "kam") return { url: `/kam/attendance${targetDate ? `?date=${targetDate}` : ""}`, isExternal: false, targetDate, actionLabel: "Open Attendance", icon: Calendar };
      if (role === "admin") return { url: `/admin/schedule${targetDate ? `?date=${targetDate}` : ""}`, isExternal: false, targetDate, actionLabel: "Open Schedule", icon: Calendar };
    }

    if (fullText.includes("interview") || fullText.includes("mock") || fullText.includes("gmeet") || fullText.includes("evaluat") || fullText.includes("split")) {
      if (role === "student") return { url: `/student/interviews`, isExternal: false, targetDate, actionLabel: "View Mock Interview", icon: Video };
      if (role === "mentor") return { url: `/mentor/interviews`, isExternal: false, targetDate, actionLabel: "View Interviews", icon: Video };
      if (role === "cm") return { url: `/cm/interviews`, isExternal: false, targetDate, actionLabel: "Open Interview Hub", icon: Video };
      if (role === "kam") return { url: `/kam/analytics`, isExternal: false, targetDate, actionLabel: "View Analytics", icon: Video };
      if (role === "admin") return { url: `/admin/interviews`, isExternal: false, targetDate, actionLabel: "View Interviews", icon: Video };
    }

    if (fullText.includes("leave") || fullText.includes("on-duty") || fullText.includes("on duty") || fullText.includes(" od ") || fullText.includes("handover") || fullText.includes("permission") || fullText.includes("approval")) {
      if (role === "student") return { url: `/student/dashboard`, isExternal: false, targetDate, actionLabel: "View Dashboard", icon: ClipboardList };
      if (role === "mentor") return { url: `/mentor/leaves`, isExternal: false, targetDate, actionLabel: "Review Leaves", icon: ClipboardList };
      if (role === "cm") return { url: `/cm/leave-approvals`, isExternal: false, targetDate, actionLabel: "Review Approvals", icon: ClipboardList };
      if (role === "admin") return { url: `/admin/approvals`, isExternal: false, targetDate, actionLabel: "View Approvals", icon: ClipboardList };
      if (role === "hr") return { url: `/hr`, isExternal: false, targetDate, actionLabel: "View HR Portal", icon: ClipboardList };
    }

    if (fullText.includes("exam") || fullText.includes("test") || fullText.includes("assessment") || fullText.includes("cia")) {
      if (role === "student") return { url: `/student/exams`, isExternal: false, targetDate, actionLabel: "View Exam Marks", icon: Award };
      if (role === "mentor") return { url: `/mentor/exams`, isExternal: false, targetDate, actionLabel: "Open Exam Manager", icon: Award };
      if (role === "cm") return { url: `/cm/exams`, isExternal: false, targetDate, actionLabel: "Open Exam Studio", icon: Award };
      if (role === "admin") return { url: `/admin/exams`, isExternal: false, targetDate, actionLabel: "View Exams", icon: Award };
    }

    if (fullText.includes("mark") || fullText.includes("grade") || fullText.includes("score")) {
      if (role === "student") return { url: `/student/exams`, isExternal: false, targetDate, actionLabel: "View Test Marks", icon: Award };
      if (role === "mentor") return { url: `/mentor/marks`, isExternal: false, targetDate, actionLabel: "Open Mark Entry", icon: Award };
    }

    if (fullText.includes("task") || fullText.includes("tracker") || fullText.includes("practical") || fullText.includes("submission") || fullText.includes("assignment")) {
      if (role === "student") return { url: `/student/tracker`, isExternal: false, targetDate, actionLabel: "Open Task Tracker", icon: BookOpen };
      if (role === "mentor") return { url: `/mentor/submissions`, isExternal: false, targetDate, actionLabel: "View Submissions", icon: BookOpen };
    }

    if (fullText.includes("fee") || fullText.includes("due") || fullText.includes("payment") || fullText.includes("tuition") || fullText.includes("invoice")) {
      if (role === "student") return { url: `/student/fees`, isExternal: false, targetDate, actionLabel: "Pay / View Fees", icon: IndianRupee };
      if (role === "fee_manager" || role === "admin") return { url: `/fee-manager`, isExternal: false, targetDate, actionLabel: "Open Fee Manager", icon: IndianRupee };
    }

    if (fullText.includes("library") || fullText.includes("book") || fullText.includes("opac")) {
      if (role === "student") return { url: `/student/library`, isExternal: false, targetDate, actionLabel: "Open Library OPAC", icon: BookOpen };
    }

    if (fullText.includes("profile") || fullText.includes("password") || fullText.includes("account")) {
      if (role === "student") return { url: `/student/profile`, isExternal: false, targetDate, actionLabel: "View Profile", icon: User };
      if (role === "mentor") return { url: `/mentor/profile`, isExternal: false, targetDate, actionLabel: "View Profile", icon: User };
    }

    return { url: `${roleBase}/dashboard`, isExternal: false, targetDate, actionLabel: "Open Workspace", icon: ArrowRight };
  };

  const handleNotificationAction = (n: any) => {
    const target = resolveTarget(n);
    if (!n.is_read) {
      markAsRead(n.id);
    }

    if (!target) return;

    if (target.isExternal) {
      if (typeof window !== "undefined") {
        window.open(target.url, "_blank", "noopener,noreferrer");
      }
      return;
    }

    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("fp_notif_target", JSON.stringify({
          url: target.url,
          date: target.targetDate,
          title: n.title,
          message: n.message,
          timestamp: Date.now()
        }));
      } catch (_) {}

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

  if (!userId) return null;
  if (loading) return <div className="p-12 text-center text-xs text-slate-400 font-bold">Loading notification activity…</div>;

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600 shadow-2xs">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              Notification Activity Feed
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                  {unreadCount} Unread
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Real-time alerts, class schedule changes, approvals, and system notifications.
            </p>
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl transition-all text-xs font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            onClick={markAllAsRead}
          >
            <CheckCheck className="w-3.5 h-3.5 text-indigo-600" />
            Mark All as Read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-16 text-center space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto text-slate-300">
            <Bell className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-700">No Notifications</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            You&apos;re completely up to date. Activity alerts and schedule updates will show up here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map(n => {
            const target = resolveTarget(n);
            const ActionIcon = target?.icon || ArrowRight;

            return (
              <div
                key={n.id}
                onClick={() => handleNotificationAction(n)}
                className={`p-4 md:p-5 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer group hover:shadow-md ${
                  n.is_read
                    ? "bg-white border-slate-200/80 hover:border-indigo-300"
                    : "bg-indigo-50/40 border-indigo-200/80 hover:border-indigo-400"
                }`}
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    {!n.is_read && (
                      <span className="h-2 w-2 rounded-full bg-indigo-600 shrink-0" />
                    )}
                    <h3 className={`text-sm font-black tracking-tight ${n.is_read ? "text-slate-800" : "text-indigo-950"}`}>
                      {n.title}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    {n.message}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold pt-1">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(n.created_at).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                  {target && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNotificationAction(n);
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white group-hover:bg-indigo-600 group-hover:text-white border border-slate-200 group-hover:border-indigo-600 text-slate-700 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <span>{target.actionLabel}</span>
                      <ActionIcon className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {!n.is_read ? (
                    <button
                      type="button"
                      onClick={(e) => markAsRead(n.id, e)}
                      className="text-slate-400 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-white/80 transition-colors"
                      title="Mark as read"
                    >
                      <Circle className="w-4 h-4" />
                    </button>
                  ) : (
                    <div className="text-emerald-500 p-1.5" title="Read">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
