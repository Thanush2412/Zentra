"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";

const STORAGE_KEY = "fp_admin_scope_college_id";

/**
 * Campus scope for admin tabs that read one campus at a time. The choice is
 * shared across those tabs and survives a refresh, so switching between
 * reports does not silently change which campus is on screen.
 */
export function useAdminCampusScope() {
  const { colleges } = useApp();
  const [collegeId, setCollegeId] = useState("");

  useEffect(() => {
    if (colleges.length === 0) return;
    setCollegeId((prev) => {
      if (prev && colleges.some((c) => c.id === prev)) return prev;
      const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (stored && colleges.some((c) => c.id === stored)) return stored;
      return colleges[0].id;
    });
  }, [colleges]);

  const selectCollege = (id: string) => {
    setCollegeId(id);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, id);
  };

  return { colleges, collegeId, selectCollege };
}
