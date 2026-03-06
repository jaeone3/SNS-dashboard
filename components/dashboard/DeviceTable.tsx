"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeviceTableRow } from "./DeviceTableRow";
import { EmptyState } from "@/components/common/EmptyState";
import { useDashboardStore } from "@/stores/dashboard-store";
import type { Device } from "@/types";

const TikTokIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.73a8.19 8.19 0 004.76 1.52V6.8a4.84 4.84 0 01-1-.11z" />
  </svg>
);

const InstagramIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);

const YouTubeIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.5 6.19a3.02 3.02 0 00-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.55A3.02 3.02 0 00.5 6.19 31.6 31.6 0 000 12a31.6 31.6 0 00.5 5.81 3.02 3.02 0 002.12 2.14c1.88.55 9.38.55 9.38.55s7.5 0 9.38-.55a3.02 3.02 0 002.12-2.14A31.6 31.6 0 0024 12a31.6 31.6 0 00-.5-5.81zM9.75 15.02V8.98L15.5 12l-5.75 3.02z" />
  </svg>
);

interface ShadowbanEntry {
  deviceNumber: number;
  contentLanguage: string;
  targetAudience: string;
  platform: string;
  slotIndex: number;
  username: string;
  daysElapsed: number;
  ready: boolean;
}

interface NewDeviceEntry {
  deviceNumber: number;
  contentLanguage: string;
  targetAudience: string;
  daysElapsed: number;
  daysLeft: number;
  done: boolean;
}

export function computeStats(allDevices: Device[]) {
  let totalDevices = allDevices.length;
  let suspended = 0;
  let newDevices = 0;
  let shadowbanActive = 0;
  let shadowbanReady = 0;
  let totalAccounts = 0;
  let connectedDevices = 0;
  const shadowbanList: ShadowbanEntry[] = [];
  const newDeviceList: NewDeviceEntry[] = [];

  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  for (const d of allDevices) {
    if (d.state.suspended) suspended++;
    if (d.state.isNew) {
      newDevices++;
      const elapsedMs = d.state.newDeviceDate
        ? Date.now() - new Date(d.state.newDeviceDate).getTime()
        : 0;
      const daysElapsed = Math.min(7, Math.floor(elapsedMs / (24 * 60 * 60 * 1000)));
      const daysLeft = Math.max(0, Math.ceil((SEVEN_DAYS_MS - elapsedMs) / (24 * 60 * 60 * 1000)));
      const done = elapsedMs >= SEVEN_DAYS_MS;
      newDeviceList.push({
        deviceNumber: d.number,
        contentLanguage: d.contentLanguage,
        targetAudience: d.targetAudience,
        daysElapsed,
        daysLeft,
        done,
      });
    }

    let hasAccount = false;
    for (const platform of ["tiktok", "instagram", "youtube"] as const) {
      for (let i = 0; i < (d.state[platform]?.length ?? 0); i++) {
        const slot = d.state[platform]?.[i];
        if (!slot?.username) continue;
        totalAccounts++;
        hasAccount = true;
        if (slot.shadowban) {
          shadowbanActive++;
          const elapsedMs = slot.shadowbanDate
            ? Date.now() - new Date(slot.shadowbanDate).getTime()
            : 0;
          const days = Math.min(3, Math.floor(elapsedMs / (24 * 60 * 60 * 1000)));
          const ready = elapsedMs >= THREE_DAYS_MS;
          if (ready) shadowbanReady++;
          shadowbanList.push({
            deviceNumber: d.number,
            contentLanguage: d.contentLanguage,
            targetAudience: d.targetAudience,
            platform: platform === "tiktok" ? "TikTok" : platform === "instagram" ? "Instagram" : "YouTube",
            slotIndex: i + 1,
            username: slot.username,
            daysElapsed: days,
            ready,
          });
        }
      }
    }
    if (hasAccount) connectedDevices++;
  }

  // Sort: ready first, then by days elapsed desc
  shadowbanList.sort((a, b) => {
    if (a.ready !== b.ready) return a.ready ? -1 : 1;
    return b.daysElapsed - a.daysElapsed;
  });

  // Sort: done first, then by days left asc
  newDeviceList.sort((a, b) => {
    if (a.done !== b.done) return a.done ? -1 : 1;
    return a.daysLeft - b.daysLeft;
  });

  return { totalDevices, suspended, newDevices, shadowbanActive, shadowbanReady, totalAccounts, connectedDevices, shadowbanList, newDeviceList };
}

export const DeviceTable = () => {
  const devices = useDashboardStore((s) => s.devices);
  const selectedRegion = useDashboardStore((s) => s.selectedRegion);
  const selectedLanguage = useDashboardStore((s) => s.selectedLanguage);
  const searchQuery = useDashboardStore((s) => s.searchQuery);
  const setSearchQuery = useDashboardStore((s) => s.setSearchQuery);
  const [showSuspended, setShowSuspended] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") {
        setSearchQuery("");
        setSearchOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [setSearchQuery]);

  useEffect(() => {
    if (searchOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [searchOpen]);

  // Compute grouped devices inline to properly react to filter changes
  const groups = useMemo(() => {
    const filtered = devices.filter((d) => {
      if (d.contentLanguage !== selectedRegion) return false;
      if (d.targetAudience !== selectedLanguage) return false;
      return true;
    });
    const g: Record<string, Device[]> = {};
    for (const d of filtered) {
      const key = d.contentType || "unknown";
      if (!g[key]) g[key] = [];
      g[key].push(d);
    }
    for (const key of Object.keys(g)) {
      g[key].sort((a, b) => a.number - b.number);
    }
    return g;
  }, [devices, selectedRegion, selectedLanguage]);
  const groupKeys = Object.keys(groups);

  if (groupKeys.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Search toggle — magnifying glass icon */}
      <div className="flex items-center gap-2">
        {searchOpen ? (
          <div className="relative w-full max-w-sm">
            <input
              ref={searchRef}
              type="text"
              placeholder="검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 pr-8 text-sm focus:border-black focus:outline-none"
            />
            <button
              onClick={() => { setSearchQuery(""); setSearchOpen(false); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="rounded-md p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
            title="검색 ( / )"
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
          </button>
        )}
      </div>

      {groupKeys.map((groupKey) => {
        const allDevices = groups[groupKey];
        const active = allDevices.filter((d) => !d.state.suspended);
        const suspended = allDevices.filter((d) => d.state.suspended);

        // Apply search filter
        const filterFn = (d: Device) => {
          if (!searchQuery.trim()) return true;
          const q = searchQuery.toLowerCase();
          if (String(d.number).includes(q)) return true;
          for (const p of ["tiktok", "instagram", "youtube"] as const) {
            for (const slot of (d.state[p] ?? [])) {
              if (slot?.username?.toLowerCase().includes(q)) return true;
            }
          }
          return false;
        };

        const filteredActive = active.filter(filterFn);
        const filteredSuspended = suspended.filter(filterFn);

        if (filteredActive.length === 0 && filteredSuspended.length === 0) return null;

        return (
          <div key={groupKey}>
            <h3 className="mb-2 text-sm font-semibold tracking-wide text-neutral-500 uppercase">
              {groupKey}
              <span className="ml-2 text-xs text-neutral-400">
                ({allDevices.length} devices)
              </span>
            </h3>
            <div className="w-full overflow-x-auto rounded-lg border border-neutral-200">
              <Table className="w-full table-fixed">
                <colgroup>
                  <col style={{ width: '140px' }} />
                  <col /><col /><col />
                  <col /><col /><col />
                  <col /><col /><col />
                </colgroup>
                <TableHeader>
                  {/* Platform group headers */}
                  <TableRow className="bg-neutral-100 hidden md:table-row border-b-0">
                    <TableHead className="bg-neutral-100" />
                    <TableHead colSpan={3} className="text-center border-l border-neutral-200 bg-neutral-100">
                      <span className="inline-flex items-center gap-1.5 justify-center text-neutral-800 text-xs font-bold">
                        <TikTokIcon size={13} /> TikTok
                      </span>
                    </TableHead>
                    <TableHead colSpan={3} className="text-center border-l border-neutral-200 bg-neutral-100">
                      <span className="inline-flex items-center gap-1.5 justify-center text-pink-600 text-xs font-bold">
                        <InstagramIcon size={13} /> Instagram
                      </span>
                    </TableHead>
                    <TableHead colSpan={3} className="text-center border-l border-neutral-200 bg-neutral-100">
                      <span className="inline-flex items-center gap-1.5 justify-center text-red-600 text-xs font-bold">
                        <YouTubeIcon size={13} /> YouTube
                      </span>
                    </TableHead>
                  </TableRow>
                  <TableRow className="bg-neutral-50 hidden md:table-row">
                    <TableHead className="text-center px-2 text-xs font-bold text-neutral-600">#</TableHead>
                    {[1, 2, 3].map((n) => (
                      <TableHead key={`tt-h-${n}`} className={`text-center text-xs font-semibold text-neutral-500 px-1 ${n === 1 ? "border-l border-neutral-200" : ""}`}>
                        {n}
                      </TableHead>
                    ))}
                    {[1, 2, 3].map((n) => (
                      <TableHead key={`ig-h-${n}`} className={`text-center text-xs font-semibold text-neutral-500 px-1 ${n === 1 ? "border-l border-neutral-200" : ""}`}>
                        {n}
                      </TableHead>
                    ))}
                    {[1, 2, 3].map((n) => (
                      <TableHead key={`yt-h-${n}`} className={`text-center text-xs font-semibold text-neutral-500 px-1 ${n === 1 ? "border-l border-neutral-200" : ""}`}>
                        {n}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredActive.map((device) => (
                    <DeviceTableRow
                      key={device.id}
                      device={device}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Suspended devices collapsible */}
            {filteredSuspended.length > 0 && (
              <div className="mt-2">
                <button
                  onClick={() => setShowSuspended(!showSuspended)}
                  className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  <span className={`transition-transform ${showSuspended ? "rotate-90" : ""}`}>▶</span>
                  <span>정지된 디바이스 ({filteredSuspended.length})</span>
                </button>
                {showSuspended && (
                  <div className="mt-1 w-full overflow-x-auto rounded-lg border border-red-100 opacity-60">
                    <Table className="w-full table-fixed">
                      <colgroup>
                        <col style={{ width: '140px' }} />
                        <col /><col /><col />
                        <col /><col /><col />
                        <col /><col /><col />
                      </colgroup>
                      <TableBody>
                        {filteredSuspended.map((device) => (
                          <DeviceTableRow key={device.id} device={device} />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
