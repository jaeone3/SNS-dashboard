"use client";

import { useEffect, useState } from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { RegionSelector } from "@/components/dashboard/RegionSelector";

import { DeviceTable } from "@/components/dashboard/DeviceTable";
import { useDashboardStore } from "@/stores/dashboard-store";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { ToastContainer } from "@/components/common/ToastContainer";
import { toast } from "@/stores/toast-store";
import { AlertCircle } from "lucide-react";
import { CircleFlag } from "@/components/common/CircleFlag";
import type { Device } from "@/types";

/* ─── Device status helpers ─── */
type DeviceStatus = "normal" | "shadowban" | "suspended" | "unconnected";

function classifyDevice(d: Device): DeviceStatus {
  if (d.state.suspended) return "suspended";
  let hasAccount = false;
  let hasSB = false;
  for (const p of ["tiktok", "instagram", "youtube"] as const) {
    for (const slot of d.state[p] ?? []) {
      if (slot?.username) {
        hasAccount = true;
        if (slot.shadowban) hasSB = true;
      }
    }
  }
  if (!hasAccount) return "unconnected";
  if (hasSB) return "shadowban";
  return "normal";
}

const statusConfig: Record<DeviceStatus, { bg: string; text: string; label: string }> = {
  normal:      { bg: "bg-emerald-500", text: "text-emerald-600", label: "정상" },
  shadowban:   { bg: "bg-orange-400",  text: "text-orange-500",  label: "쉐밴" },
  suspended:   { bg: "bg-red-500",     text: "text-red-500",     label: "정지" },
  unconnected: { bg: "bg-neutral-300", text: "text-neutral-400", label: "미연결" },
};

/* ─── Status Overview ─── */
function StatusOverview() {
  const devices = useDashboardStore((s) => s.devices);
  const selectedRegion = useDashboardStore((s) => s.selectedRegion);
  const getLanguagesForRegion = useDashboardStore((s) => s.getLanguagesForRegion);

  const languages = getLanguagesForRegion(selectedRegion);
  const regionDevices = devices.filter((d) => d.contentLanguage === selectedRegion);
  if (regionDevices.length === 0) return null;

  // Global stats
  const totalAll = regionDevices.length;
  const globalCounts: Record<DeviceStatus, number> = { normal: 0, shadowban: 0, suspended: 0, unconnected: 0 };
  for (const d of regionDevices) globalCounts[classifyDevice(d)]++;

  return (
    <div className="mb-3">
      {/* Global summary bar */}
      <div className="flex items-center gap-3 mb-2">
        <span className="text-xs font-bold text-neutral-700">{totalAll}대</span>
        <div className="flex-1 max-w-md h-2 rounded-full bg-neutral-100 overflow-hidden flex">
          {(["normal", "shadowban", "suspended", "unconnected"] as DeviceStatus[]).map((s) => {
            if (globalCounts[s] === 0) return null;
            return (
              <div
                key={s}
                className={`${statusConfig[s].bg} transition-all duration-500`}
                style={{ width: `${(globalCounts[s] / totalAll) * 100}%` }}
              />
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          {(["normal", "shadowban", "suspended", "unconnected"] as DeviceStatus[]).map((s) => {
            if (globalCounts[s] === 0) return null;
            return (
              <span key={s} className={`inline-flex items-center gap-1 text-[11px] font-medium ${statusConfig[s].text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusConfig[s].bg}`} />
                {statusConfig[s].label} {globalCounts[s]}
              </span>
            );
          })}
        </div>
      </div>

      {/* Per-language mini bars */}
      <div className="flex flex-wrap gap-x-4 gap-y-0.5">
        {languages.map((lang) => {
          const filtered = regionDevices.filter((d) => d.targetAudience === lang.code);
          if (filtered.length === 0) return null;

          const total = filtered.length;
          const counts: Record<DeviceStatus, number> = { normal: 0, shadowban: 0, suspended: 0, unconnected: 0 };
          for (const d of filtered) counts[classifyDevice(d)]++;
          const normalPct = Math.round((counts.normal / total) * 100);

          return (
            <div key={lang.code} className="flex items-center gap-1.5">
              <CircleFlag countryCode={lang.countryCode} size={12} />
              <span className="text-[10px] font-medium text-neutral-500 w-10 truncate">{lang.label}</span>
              <div className="w-16 h-1.5 rounded-full bg-neutral-100 overflow-hidden flex">
                {(["normal", "shadowban", "suspended", "unconnected"] as DeviceStatus[]).map((s) => {
                  if (counts[s] === 0) return null;
                  return (
                    <div
                      key={s}
                      className={`${statusConfig[s].bg}`}
                      style={{ width: `${(counts[s] / total) * 100}%` }}
                    />
                  );
                })}
              </div>
              <span className="text-[10px] font-semibold text-neutral-400 tabular-nums">{normalPct}% <span className="text-neutral-300">{counts.normal}/{total}</span></span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Action Checklist (TODO) ─── */
interface ActionItem {
  id: string;
  type: "sb_ready" | "suspended" | "unconnected";
  deviceId: string;
  deviceNumber: number;
  label: string;
  langLabel: string;
  platform?: "tiktok" | "instagram" | "youtube";
  slotIndex?: number;
}

type ActionGroup = {
  type: ActionItem["type"];
  title: string;
  color: string;
  bgColor: string;
  items: ActionItem[];
};

function ActionChecklist() {
  const devices = useDashboardStore((s) => s.devices);
  const selectedRegion = useDashboardStore((s) => s.selectedRegion);
  const languages = useDashboardStore((s) => s.languages);
  const updateDeviceState = useDashboardStore((s) => s.updateDeviceState);
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
  const items: ActionItem[] = [];

  const langMap: Record<string, string> = {};
  for (const l of languages) langMap[l.code] = l.label;

  const filtered = devices.filter(
    (d) => d.contentLanguage === selectedRegion,
  );

  for (const d of filtered) {
    const langLabel = langMap[d.targetAudience] ?? d.targetAudience;
    for (const p of ["tiktok", "instagram", "youtube"] as const) {
      for (let i = 0; i < (d.state[p]?.length ?? 0); i++) {
        const slot = d.state[p]?.[i];
        if (!slot?.username || !slot.shadowban) continue;
        const elapsed = slot.shadowbanDate
          ? Date.now() - new Date(slot.shadowbanDate).getTime()
          : 0;
        if (elapsed >= THREE_DAYS_MS) {
          const pLabel = p === "tiktok" ? "TT" : p === "instagram" ? "IG" : "YT";
          const daysElapsed = Math.floor(elapsed / (24 * 60 * 60 * 1000));
          items.push({
            id: `sb-${d.id}-${p}-${i}`,
            type: "sb_ready",
            deviceId: d.id,
            deviceNumber: d.number,
            label: `#${d.number} ${pLabel}${i + 1} @${slot.username} · ${daysElapsed}일`,
            langLabel,
            platform: p,
            slotIndex: i,
          });
        }
      }
    }

    if (d.state.suspended) {
      items.push({
        id: `sus-${d.id}`,
        type: "suspended",
        deviceId: d.id,
        deviceNumber: d.number,
        label: `#${d.number}`,
        langLabel,
      });
    }

    if (!d.state.suspended) {
      let hasAccount = false;
      for (const p of ["tiktok", "instagram", "youtube"] as const) {
        for (const slot of d.state[p] ?? []) {
          if (slot?.username) { hasAccount = true; break; }
        }
        if (hasAccount) break;
      }
      if (!hasAccount) {
        items.push({
          id: `unc-${d.id}`,
          type: "unconnected",
          deviceId: d.id,
          deviceNumber: d.number,
          label: `#${d.number}`,
          langLabel,
        });
      }
    }
  }

  const visibleItems = items.filter((item) => !dismissed.has(item.id));
  if (visibleItems.length === 0) return null;

  const groups: ActionGroup[] = [
    { type: "sb_ready", title: "SB 해제 가능", color: "text-orange-600", bgColor: "bg-orange-50 border-orange-200", items: [] },
    { type: "suspended", title: "정지됨", color: "text-red-500", bgColor: "bg-red-50 border-red-200", items: [] },
    { type: "unconnected", title: "미연결", color: "text-neutral-400", bgColor: "bg-neutral-50 border-neutral-200", items: [] },
  ];
  for (const item of visibleItems) {
    groups.find((g) => g.type === item.type)?.items.push(item);
  }

  const handleCheck = async (item: ActionItem) => {
    if (processing.has(item.id)) return;
    setProcessing((prev) => new Set(prev).add(item.id));
    try {
      if (item.type === "sb_ready" && item.platform !== undefined && item.slotIndex !== undefined) {
        const device = devices.find((dd) => dd.id === item.deviceId);
        if (!device) return;
        const slots = [...(device.state[item.platform] ?? [null, null, null])];
        const current = slots[item.slotIndex];
        if (!current) return;
        slots[item.slotIndex] = { ...current, shadowban: false, shadowbanDate: null };
        await updateDeviceState(item.deviceId, { [item.platform]: slots });
        toast.success(`#${item.deviceNumber} SB 해제 완료`);
      } else if (item.type === "suspended") {
        await updateDeviceState(item.deviceId, { suspended: false });
        toast.success(`#${item.deviceNumber} 정지 해제 완료`);
      } else if (item.type === "unconnected") {
        setDismissed((prev) => new Set(prev).add(item.id));
      }
    } catch {
      toast.error("처리 실패");
    } finally {
      setProcessing((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const sbGroup = groups.find((g) => g.type === "sb_ready");
  const susGroup = groups.find((g) => g.type === "suspended");
  const uncGroup = groups.find((g) => g.type === "unconnected");

  return (
    <div className="mb-3 flex flex-wrap items-start gap-2">
      {/* SB ready — most important, gets its own card */}
      {sbGroup && sbGroup.items.length > 0 && (
        <div className="rounded-md border border-orange-200 bg-orange-50 px-2.5 py-1.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-orange-600 uppercase mr-1">SB해제 {sbGroup.items.length}</span>
          {sbGroup.items.map((item) => (
            <button
              key={item.id}
              onClick={() => handleCheck(item)}
              disabled={processing.has(item.id)}
              className={`rounded px-1.5 py-0.5 text-[11px] font-medium bg-white border border-orange-200 hover:border-orange-400 text-orange-600 transition-colors cursor-pointer ${
                processing.has(item.id) ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Suspended — compact inline */}
      {susGroup && susGroup.items.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-red-500 uppercase">정지 {susGroup.items.length}</span>
          <span className="text-[11px] text-red-400">
            {susGroup.items.map((i) => i.label).join(" ")}
          </span>
        </div>
      )}

      {/* Unconnected — just a count badge */}
      {uncGroup && uncGroup.items.length > 0 && (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-neutral-400 uppercase">계정미등록 {uncGroup.items.length}</span>
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ─── */
export default function Home() {
  const isLoading = useDashboardStore((s) => s.isLoading);
  const error = useDashboardStore((s) => s.error);
  const fetchAll = useDashboardStore((s) => s.fetchAll);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white">
        <main className="mx-auto max-w-[1400px] px-4 sm:px-8 py-6 sm:py-10">
          <div className="mt-20 flex flex-col items-center justify-center gap-4 text-neutral-500">
            <AlertCircle size={28} className="text-red-400" />
            <p className="text-sm text-red-500">{error}</p>
            <button
              onClick={() => fetchAll()}
              className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
            >
              다시 시도
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Sticky top bar — compact navigation only */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-neutral-100">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-8 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <RegionSelector />
            </div>
            <DashboardHeader />
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1400px] px-4 sm:px-8 py-4">
        <StatusOverview />
        <ActionChecklist />
        <DeviceTable />
      </main>

      <ToastContainer />
    </div>
  );
}
