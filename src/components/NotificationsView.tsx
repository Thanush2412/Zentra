"use client";

import React, { useState, useEffect } from "react";
import { useToast } from "@/context/ToastContext";
import { Bell, CheckCircle2, Circle } from "lucide-react";

export function NotificationsView({ userId, portalType }: { userId?: string, portalType: string }) {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) fetchNotifications();
  }, [userId]);

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`/api/notifications?userId=${userId}`);
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications || []);
      }
    } catch (e) {
      toast("Failed to fetch notifications", "error");
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: 1 } : n));
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
        setNotifications(notifications.map(n => ({ ...n, is_read: 1 })));
        toast("All marked as read", "success");
      }
    } catch (e) {
      toast("Failed to update status", "error");
    }
  };

  if (!userId) return null;
  if (loading) return <div className="p-8 text-center text-gray-500">Loading notifications...</div>;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <h1 className="text-2xl font-bold flex items-center gap-3 text-gray-800">
          <div className="p-2 bg-indigo-50 rounded-lg">
            <Bell className="w-6 h-6 text-indigo-600" />
          </div>
          Notifications
        </h1>
        {notifications.some(n => !n.is_read) && (
          <button 
            className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
            onClick={markAllAsRead}
          >
            Mark All as Read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
          <Bell className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p>You have no notifications yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map(n => (
            <div key={n.id} className={`p-5 rounded-xl border transition-all flex justify-between gap-4 ${n.is_read ? 'bg-white border-gray-100' : 'bg-indigo-50/40 border-indigo-100'}`}>
              <div className="flex-1">
                <h3 className={`font-semibold text-lg ${n.is_read ? 'text-gray-700' : 'text-indigo-900'}`}>{n.title}</h3>
                <p className="text-gray-600 mt-1">{n.message}</p>
                <span className="text-xs text-gray-400 mt-3 block">{new Date(n.created_at).toLocaleString()}</span>
              </div>
              {!n.is_read ? (
                <button onClick={() => markAsRead(n.id)} className="text-indigo-600 hover:text-indigo-700 flex items-center justify-center shrink-0 h-10 w-10 rounded-full hover:bg-indigo-100 transition-colors" title="Mark as read">
                  <Circle className="w-6 h-6" />
                </button>
              ) : (
                <div className="text-gray-300 flex items-center justify-center shrink-0 h-10 w-10" title="Read">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
