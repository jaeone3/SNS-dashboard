"use client";

import { useEffect, useState } from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { RegionSelector } from "@/components/dashboard/RegionSelector";
import { LanguageTabs } from "@/components/dashboard/LanguageTabs";
import { DeviceTable } from "@/components/dashboard/DeviceTable";
import { useDashboardStore } from "@/stores/dashboard-store";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { ToastContainer } from "@/components/common/ToastContainer";
import { toast } from "@/stores/toast-store";
import { AlertCircle } from "lucide-react";
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

/* ─── Battery Status (all languages) ─── */
function DeviceBattery() {
  const devices = useDashboardStore((s) => s.devices);
  const selectedRegion = useDashboardStore((s) => s.selectedRegion);
  const getLanguagesForRegion = useDashboardStore((s) => s.getLanguagesForRegion);

  const languages = getLanguagesForRegion(selectedRegion);
  const regionDevices = devices.filter((d) => d.contentLanguage === selectedRegion);
  if (regionDevices.length === 0) return null;

  return (
    <div className="mb-4 flex flex-col gap-1.5">
      {languages.map((lang) => {
        const filtered = regionDevices.filter((d) => d.targetAudience === lang.code);
        if (filtered.length === 0) return null;

        const total = filtered.length;
        const counts: Record<DeviceStatus, number> = { normal: 0, shadowban: 0, suspended: 0, unconnected: 0 };
        for (const d of filtered) counts[classifyDevice(d)]++;

        const segments = (["normal", "shadowban", "suspended", "unconnected"] as DeviceStatus[])
          .map((s) => ({ status: s, count: counts[s] }))
          .filter((s) => s.count > 0);

        const normalPct = Math.round((counts.normal / total) * 100);

        return (
          <div key={lang.code} className="flex items-center gap-3">
            <span className="text-xs font-bold text-neutral-600 w-14 shrink-0 truncate">{lang.label}</span>

            {/* Battery shell */}
            <div className="flex items-center w-40">
              <div className="relative flex-1 h-5 rounded-[4px] border-2 border-neutral-300 bg-neutral-100 overflow-hidden">
                <div className="absolute inset-[2px] flex gap-[1px] rounded-[2px] overflow-hidden">
                  {segments.map((seg) => (
                    <div
                      key={seg.status}
                      className={`${statusConfig[seg.status].bg} transition-all duration-300`}
                      style={{ flex: seg.count }}
                    />
                  ))}
                </div>
              </div>
              <div className="w-[4px] h-2.5 rounded-r-[2px] bg-neutral-300 -ml-[1px]" />
            </div>

            <span className="text-xs font-semibold text-neutral-500 w-8">{normalPct}%</span>

            <div className="flex items-center gap-2.5">
              {segments.map((seg) => (
                <span
                  key={seg.status}
                  className={`inline-flex items-center gap-1 text-[11px] font-medium ${statusConfig[seg.status].text}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${statusConfig[seg.status].bg}`} />
                  {seg.count}
                </span>
              ))}
            </div>
          </div>
        );
      })}
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
    // SB ready to lift
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
            label: `#${d.number} ${pLabel}${i + 1} @${slot.username} — SB ${daysElapsed}일 경과, 해제가능`,
            langLabel,
            platform: p,
            slotIndex: i,
          });
        }
      }
    }

    // Suspended
    if (d.state.suspended) {
      items.push({
        id: `sus-${d.id}`,
        type: "suspended",
        deviceId: d.id,
        deviceNumber: d.number,
        label: `#${d.number} — 정지됨`,
        langLabel,
      });
    }

    // Unconnected (no accounts, not suspended)
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
          label: `#${d.number} — 미연결`,
          langLabel,
        });
      }
    }
  }

  const visibleItems = items.filter((item) => !dismissed.has(item.id));
  if (visibleItems.length === 0) return null;

  const typeOrder: Record<string, number> = { sb_ready: 0, suspended: 1, unconnected: 2 };
  visibleItems.sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);

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

  const typeStyle: Record<string, string> = {
    sb_ready: "text-orange-600",
    suspended: "text-red-500",
    unconnected: "text-neutral-500",
  };

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 mb-4">
      <h3 className="text-xs font-bold text-neutral-500 uppercase mb-2">
        할 일 · {visibleItems.length}
      </h3>
      <div className="flex flex-col gap-0.5">
        {visibleItems.map((item) => (
          <label
            key={item.id}
            className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-neutral-50 cursor-pointer transition-colors ${
              processing.has(item.id) ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            <input
              type="checkbox"
              className="rounded w-4 h-4 cursor-pointer accent-emerald-500"
              checked={false}
              onChange={() => handleCheck(item)}
              disabled={processing.has(item.id)}
            />
            <span className="inline-flex items-center gap-1.5 rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-neutral-500">
              {item.langLabel}
            </span>
            <span className={`text-sm ${typeStyle[item.type] ?? "text-neutral-600"}`}>
              {item.label}
            </span>
          </label>
        ))}
      </div>
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
              <LanguageTabs />
            </div>
            <DashboardHeader />
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1400px] px-4 sm:px-8 py-4">
        <DeviceBattery />
        <ActionChecklist />
        <DeviceTable />
      </main>

      <ToastContainer />
    </div>
  );
}
