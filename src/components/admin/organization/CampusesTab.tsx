"use client";

import React, { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { useApp, College } from "@/context/AppContext";
import { useToast } from "@/context/ToastContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody } from "@/components/ui/sheet";
import { apiFetch } from "@/lib/apiFetch";
import { qk } from "@/lib/queryKeys";
import { normalizeRoleValue } from "@/lib/utils";
import {
  Building2,
  Plus,
  MapPin,
  Edit,
  Trash2,
  Sparkles
} from "lucide-react";
import { CampusWizardDialog } from "@/components/admin/dialogs/CampusWizardDialog";

const CAMDashboard = dynamic(() => import("@/components/CAMDashboard").then(m => m.CAMDashboard), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center p-16 text-slate-400 font-bold text-sm">
      <div className="flex items-center gap-2">
        <span className="h-4 w-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
        <span>Loading Campus Console…</span>
      </div>
    </div>
  )
});

export const CampusesTab: React.FC = () => {
  const {
    colleges,
    mentors,
    slots,
    deleteCollege,
    refreshData
  } = useApp();
  const { toast, confirm: showConfirm } = useToast();

  const [drillDownCollegeId, setDrillDownCollegeId] = useState<string | null>(null);
  const [showCampusModal, setShowCampusModal] = useState(false);
  const [editingCampus, setEditingCampus] = useState<College | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const setAction = (key: string, val: boolean) => {
    setActionLoading(prev => ({ ...prev, [key]: val }));
  };

  // Fetch users & KAMs for ownership mapping
  const usersQuery = useQuery({
    queryKey: qk.adminUsers("all"),
    queryFn: async () => {
      const data = await apiFetch("/api/users?limit=5000");
      return (data?.users || []) as any[];
    }
  });
  const usersList = usersQuery.data || [];

  const kamQuery = useQuery({
    queryKey: qk.adminKams(),
    queryFn: async () => {
      const data = await apiFetch("/api/kam?all=1");
      return (data?.kamUsers || []) as any[];
    }
  });
  const kamList = kamQuery.data || [];

  const camList = useMemo(() => {
    return usersList
      .filter((u: any) => normalizeRoleValue(u.role) === "cm")
      .map((u: any) => {
        const colProfile = (colleges as any[]).find((c: any) => c.cam_id === u.reference_id);
        return {
          ...u,
          name: colProfile?.cam_name || u.name || (u.email && typeof u.email === "string" ? u.email.split("@")[0] : u.reference_id) || "—",
          college_id: colProfile?.id || u.college_id || "",
          college_name: colProfile?.name || "",
          kam_id: colProfile?.kam_id || ""
        };
      });
  }, [usersList, colleges]);

  const handleOpenCampusModal = (col?: College) => {
    setEditingCampus(col || null);
    setShowCampusModal(true);
  };

  const handleDeleteCampus = async (id: string, name: string) => {
    if (
      !(await showConfirm({
        title: "Delete Campus",
        message: `Are you sure you want to permanently delete "${name}"? This will delete all courses, slots, and mentors assigned to this campus.`,
        danger: true,
        confirmLabel: "Delete Campus"
      }))
    ) {
      return;
    }
    setAction(`campus_${id}`, true);
    try {
      const res = await deleteCollege(id);
      if (res.success) {
        toast(`Campus "${name}" deleted successfully.`, "success");
        await refreshData(true);
      } else {
        toast(res.message || "Failed to delete campus.", "error");
      }
    } catch (err: any) {
      toast(err.message || "An error occurred while deleting.", "error");
    } finally {
      setAction(`campus_${id}`, false);
    }
  };

  const renderCampusName = (name: string) => {
    if (name.includes(" of ")) {
      const parts = name.split(" of ");
      return (
        <>
          <div className="text-[20px] font-semibold text-gray-900 leading-snug">{parts[0]}</div>
          <div className="text-[13px] font-medium text-gray-400 mt-0.5">of {parts[1]}</div>
        </>
      );
    }
    return <div className="text-[20px] font-semibold text-gray-900 leading-snug">{name}</div>;
  };

  return (
    <div className="space-y-4 animate-fadeIn font-sans text-xs">
      <PageHeader
        icon={Building2}
        title="Campuses"
        subtitle="Manage all active university campuses."
        actions={
          <Button
            variant="ghost"
            onClick={() => handleOpenCampusModal()}
            className="h-auto btn-gradient px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm text-white"
          >
            <Plus className="h-4 w-4" />
            Add Campus
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {colleges.map(col => {
          const colMentors = mentors.filter(m => m.college_id === col.id);
          const colSlots = slots.filter(s => colMentors.some(m => m.id === s.mentorId));
          const colDeptsCount = Array.from(new Set(colMentors.map(m => m.mentor_group).filter(Boolean))).length;
          const cam = camList.find(cm => cm.college_id === col.id);
          const kamOwner = kamList.find(k => k.id === col.kam_id);

          return (
            <div
              key={col.id}
              className="p-4 rounded-xl border border-slate-200/80 bg-white hover:shadow-md transition-all flex flex-col justify-between min-h-[320px] relative overflow-hidden group"
            >
              {/* Shift badge in top-right corner */}
              <div className="absolute top-3 right-3">
                <span
                  className={`px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider ${
                    col.has_shifts === 0
                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                      : "bg-teal-50 text-teal-700 border border-teal-200"
                  }`}
                >
                  {col.has_shifts === 0 ? "General Shift Only" : "Multi-Shift"}
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  {renderCampusName(col.name)}
                  <p className="text-[13px] text-gray-400 mt-1 flex items-center gap-1 font-medium">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    {col.address || "No Address Added"}
                  </p>
                </div>

                {/* KAM and Campus Manager details */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-[13px] space-y-1.5">
                  <div className="flex text-gray-500">
                    <span className="w-[120px] shrink-0 font-medium">KAM Owner</span>
                    <span className="font-bold text-gray-900">
                      : {kamQuery.isLoading ? (
                        <span className="inline-block h-3 w-20 rounded bg-slate-200 animate-pulse align-middle ml-1" />
                      ) : (
                        kamOwner ? kamOwner.name : "Unassigned"
                      )}
                    </span>
                  </div>
                  <div className="flex text-gray-500">
                    <span className="w-[120px] shrink-0 font-medium">Campus Manager</span>
                    <span className="font-bold text-gray-900">
                      : {usersQuery.isLoading ? (
                        <span className="inline-block h-3 w-24 rounded bg-slate-200 animate-pulse align-middle ml-1" />
                      ) : (
                        cam ? cam.name : "Unassigned"
                      )}
                    </span>
                  </div>
                </div>

                {/* Statistics Row */}
                <div className="grid grid-cols-3 gap-2.5 text-center">
                  <div className="bg-gray-50 p-2 rounded-xl border border-gray-100 flex flex-col items-center justify-center">
                    <div className="font-bold text-gray-900 text-lg leading-none">{colMentors.length}</div>
                    <div className="text-[10px] text-gray-400 font-semibold mt-1">Faculty</div>
                  </div>
                  <div className="bg-gray-50 p-2 rounded-xl border border-gray-100 flex flex-col items-center justify-center">
                    <div className="font-bold text-gray-900 text-lg leading-none">{colSlots.length}</div>
                    <div className="text-[10px] text-gray-400 font-semibold mt-1">Slots</div>
                  </div>
                  <div className="bg-gray-50 p-2 rounded-xl border border-gray-100 flex flex-col items-center justify-center">
                    <div className="font-bold text-gray-900 text-lg leading-none">{colDeptsCount}</div>
                    <div className="text-[10px] text-gray-400 font-semibold mt-1">Depts</div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3 mt-auto pt-4 border-t border-gray-100">
                <Button
                  variant="ghost"
                  onClick={() => setDrillDownCollegeId(col.id)}
                  className="h-auto w-full btn-gradient font-bold py-2.5 rounded-xl text-xs text-white transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  Manage Campus Console
                </Button>
                <div className="flex justify-center gap-5">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenCampusModal(col)}
                    title="Edit Campus Details"
                    className="h-auto w-auto p-2 bg-gray-50 border border-gray-200 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteCampus(col.id, col.name)}
                    isLoading={actionLoading[`campus_${col.id}`]}
                    title="Delete Campus"
                    className="h-auto w-auto p-2 bg-gray-50 border border-gray-200 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Campus Setup / Edit Wizard Dialog */}
      <CampusWizardDialog
        open={showCampusModal}
        onOpenChange={setShowCampusModal}
        collegeToEdit={editingCampus}
        kamList={kamList}
        camList={camList}
        onSaved={async () => {
          await refreshData(true);
        }}
        onOpenCampusConsole={colId => setDrillDownCollegeId(colId)}
      />

      {/* Slide-over CAM Campus Console */}
      <Sheet open={!!drillDownCollegeId} onOpenChange={open => { if (!open) setDrillDownCollegeId(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-6xl p-0 flex flex-col bg-slate-50 overflow-hidden">
          <SheetHeader className="p-4 bg-white border-b border-slate-200">
            <SheetTitle className="text-base font-bold text-slate-800">
              Campus Console — {colleges.find(c => c.id === drillDownCollegeId)?.name || drillDownCollegeId}
            </SheetTitle>
            <SheetDescription className="text-xs text-slate-400">
              Admin drill-down into Campus Manager view.
            </SheetDescription>
          </SheetHeader>
          <SheetBody className="flex-1 overflow-y-auto p-0">
            {drillDownCollegeId && <CAMDashboard overrideCollegeId={drillDownCollegeId} />}
          </SheetBody>
        </SheetContent>
      </Sheet>
    </div>
  );
};
