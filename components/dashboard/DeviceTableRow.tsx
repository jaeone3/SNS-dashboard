"use client";

import { useState } from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { CircleFlag } from "@/components/common/CircleFlag";
import { useDashboardStore } from "@/stores/dashboard-store";
import { toast } from "@/stores/toast-store";
import { AccountModal } from "./AccountModal";
import type { Device, AccountSlot } from "@/types";

interface DeviceTableRowProps {
  device: Device;
  selected?: boolean;
  onToggleSelect?: () => void;
}

function daysElapsed(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const elapsed = Date.now() - new Date(dateStr).getTime();
  return Math.min(3, Math.floor(elapsed / (24 * 60 * 60 * 1000)));
}

function daysRemaining(dateStr: string | null, totalDays: number): number | null {
  if (!dateStr) return null;
  const elapsed = Date.now() - new Date(dateStr).getTime();
  const remaining = totalDays - elapsed / (24 * 60 * 60 * 1000);
  return Math.max(0, Math.ceil(remaining));
}

/** Platform border class for the first slot column of each platform group */
const platformBorderClass = (_platform: string, index: number) => {
  if (index !== 0) return "";
  return "border-l border-neutral-200";
};

const AccountCell = ({
  slot,
  deviceSuspended,
  onClickUsername,
  onQuickShadowban,
}: {
  slot: AccountSlot | null;
  deviceSuspended: boolean;
  onClickUsername: () => void;
  onQuickShadowban: () => void;
}) => {
  if (!slot?.username) {
    return (
      <button
        onClick={onClickUsername}
        className="w-full flex items-center justify-center min-h-[52px] rounded text-neutral-300 hover:text-neutral-500 hover:bg-neutral-50 transition-colors text-lg font-light"
      >
        +
      </button>
    );
  }

  const sbElapsed = daysElapsed(slot.shadowbanDate);
  const sbDone = sbElapsed !== null && sbElapsed >= 3;

  return (
    <div className="group relative flex flex-col items-center gap-1 rounded px-1 py-2 min-h-[52px] justify-center hover:bg-neutral-50 transition-colors">
      {/* Username — click to open modal */}
      <button
        onClick={onClickUsername}
        className={`text-xs font-medium truncate max-w-full leading-tight ${
          deviceSuspended
            ? "text-red-400 line-through"
            : slot.shadowban
              ? "text-orange-600 font-semibold"
              : "text-neutral-800"
        }`}
        title={`@${slot.username} (클릭: 상세)`}
      >
        @{slot.username}
      </button>

      {/* Shadowban status — clear text badge */}
      {slot.shadowban && (
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold leading-none ${
            sbDone
              ? "bg-green-100 text-green-700"
              : "bg-orange-100 text-orange-700"
          }`}
        >
          {sbDone ? "해제가능" : `SB ${sbElapsed}/3일`}
        </span>
      )}

      {/* Past shadowban count — only when NOT currently banned */}
      {slot.shadowbanCount > 0 && !slot.shadowban && (
        <span className="text-[10px] text-neutral-400 font-medium">
          SB×{slot.shadowbanCount}
        </span>
      )}

      {/* Quick action: SB toggle — visible on hover */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onQuickShadowban();
        }}
        className={`
          absolute -right-1 -top-1 opacity-0 group-hover:opacity-100
          rounded-full w-5 h-5 flex items-center justify-center
          text-[9px] font-bold shadow-sm border transition-all
          ${slot.shadowban
            ? "bg-green-500 text-white border-green-600 hover:bg-green-600"
            : "bg-orange-500 text-white border-orange-600 hover:bg-orange-600"
          }
        `}
        title={slot.shadowban ? "쉐도우밴 해제" : "쉐도우밴 등록"}
      >
        {slot.shadowban ? "V" : "S"}
      </button>
    </div>
  );
};

export const DeviceTableRow = ({ device, selected, onToggleSelect }: DeviceTableRowProps) => {
  const updateDeviceState = useDashboardStore((s) => s.updateDeviceState);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalTarget, setModalTarget] = useState<{
    platform: "tiktok" | "instagram" | "youtube";
    index: number;
  } | null>(null);

  const newDaysLeft = device.state.isNew
    ? daysRemaining(device.state.newDeviceDate, 7)
    : null;

  const withSaving = async (fn: () => Promise<void>) => {
    if (saving) return;
    setSaving(true);
    try { await fn(); } finally { setSaving(false); }
  };

  const handleToggleNew = () => withSaving(async () => {
    try {
      if (device.state.isNew) {
        await updateDeviceState(device.id, { isNew: false, newDeviceDate: null });
        toast.success(`#${device.number} NEW 해제`);
      } else {
        await updateDeviceState(device.id, {
          isNew: true,
          newDeviceDate: new Date().toISOString(),
        });
        toast.success(`#${device.number} NEW 등록`);
      }
    } catch {
      toast.error("상태 변경 실패");
    }
  });

  const handleToggleSuspend = () => withSaving(async () => {
    try {
      await updateDeviceState(device.id, { suspended: !device.state.suspended });
      toast.success(`#${device.number} ${device.state.suspended ? "정지 해제" : "정지"}`);
    } catch {
      toast.error("상태 변경 실패");
    }
  });

  const openModal = (platform: "tiktok" | "instagram" | "youtube", index: number) => {
    setModalTarget({ platform, index });
    setModalOpen(true);
  };

  const currentSlot = modalTarget
    ? (device.state[modalTarget.platform]?.[modalTarget.index] ?? null)
    : null;

  const handleQuickShadowban = (platform: "tiktok" | "instagram" | "youtube", index: number) => {
    withSaving(async () => {
      try {
        const slots = [...(device.state[platform] ?? [null, null, null])];
        const current = slots[index];
        if (!current) return;
        const label = platform === "tiktok" ? "TT" : platform === "instagram" ? "IG" : "YT";
        if (current.shadowban) {
          slots[index] = { ...current, shadowban: false, shadowbanDate: null };
          await updateDeviceState(device.id, { [platform]: slots });
          toast.success(`#${device.number} ${label}${index + 1} @${current.username} 쉐도우밴 해제`);
        } else {
          slots[index] = {
            ...current,
            shadowban: true,
            shadowbanDate: new Date().toISOString(),
            shadowbanCount: (current.shadowbanCount ?? 0) + 1,
          };
          await updateDeviceState(device.id, { [platform]: slots });
          toast.success(`#${device.number} ${label}${index + 1} @${current.username} 쉐도우밴 등록`);
        }
      } catch {
        toast.error("쉐도우밴 변경 실패");
      }
    });
  };

  const handleAccountSave = async (username: string) => {
    if (!modalTarget) return;
    try {
      const { platform, index } = modalTarget;
      const slots = [...(device.state[platform] ?? [null, null, null])];
      slots[index] = {
        username,
        shadowban: slots[index]?.shadowban ?? false,
        shadowbanDate: slots[index]?.shadowbanDate ?? null,
        shadowbanCount: slots[index]?.shadowbanCount ?? 0,
      };
      await updateDeviceState(device.id, { [platform]: slots });
      toast.success(`@${username} 저장`);
    } catch {
      toast.error("계정 저장 실패");
    }
  };

  const handleAccountDelete = async () => {
    if (!modalTarget) return;
    try {
      const { platform, index } = modalTarget;
      const slots = [...(device.state[platform] ?? [null, null, null])];
      const name = slots[index]?.username;
      slots[index] = null;
      await updateDeviceState(device.id, { [platform]: slots });
      toast.success(`@${name} 삭제`);
    } catch {
      toast.error("계정 삭제 실패");
    }
  };

  const handleToggleShadowban = async () => {
    if (!modalTarget) return;
    const { platform, index } = modalTarget;
    handleQuickShadowban(platform, index);
  };

  const handleResetShadowbanCount = async () => {
    if (!modalTarget) return;
    try {
      const { platform, index } = modalTarget;
      const slots = [...(device.state[platform] ?? [null, null, null])];
      const current = slots[index];
      if (!current) return;
      slots[index] = { ...current, shadowbanCount: 0, shadowban: false, shadowbanDate: null };
      await updateDeviceState(device.id, { [platform]: slots });
      toast.success(`@${current.username} SB 카운트 초기화`);
    } catch {
      toast.error("초기화 실패");
    }
  };

  const rowBg = device.state.suspended
    ? "bg-red-50/60"
    : device.state.isNew
      ? "bg-blue-50/40"
      : "";

  const renderPlatformCells = (platform: "tiktok" | "instagram" | "youtube") =>
    [0, 1, 2].map((i) => (
      <TableCell
        key={`${platform}-${i}`}
        className={`text-center px-1 py-1 ${platformBorderClass(platform, i)}`}
      >
        <AccountCell
          slot={device.state[platform]?.[i] ?? null}
          deviceSuspended={device.state.suspended}
          onClickUsername={() => openModal(platform, i)}
          onQuickShadowban={() => handleQuickShadowban(platform, i)}
        />
      </TableCell>
    ));

  const deviceHeader = (
    <div className="flex items-center gap-2">
      <span className="font-mono text-sm font-bold tabular-nums">#{device.number}</span>
      <CircleFlag countryCode={device.vpnRegion} size={14} />
      <span className="text-[11px] text-neutral-500">{device.vpnCity}</span>
      <div className="flex items-center gap-1.5 ml-auto">
        {device.state.isNew ? (
          <button onClick={handleToggleNew} disabled={saving} className="rounded-md bg-blue-500 text-white px-3 py-1 text-xs font-bold hover:bg-blue-600 disabled:opacity-50 transition-colors">
            NEW D-{newDaysLeft}
          </button>
        ) : (
          <button onClick={handleToggleNew} disabled={saving} className="rounded-md bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600 disabled:opacity-50 transition-colors">
            NEW
          </button>
        )}
        <button onClick={handleToggleSuspend} disabled={saving} className={`rounded-md px-3 py-1 text-xs font-bold transition-colors disabled:opacity-50 ${device.state.suspended ? "bg-red-500 text-white hover:bg-red-600" : "bg-neutral-100 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600"}`}>
          정지
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <TableRow className={`hidden md:table-row transition-colors hover:bg-neutral-50/80 ${rowBg}`}>
        <TableCell className="px-2 py-2">
          <div className="flex flex-col items-center gap-1">
            <span className="font-mono text-sm font-bold tabular-nums">#{device.number}</span>
            <div className="flex items-center gap-1">
              <CircleFlag countryCode={device.vpnRegion} size={12} />
              <span className="text-[10px] text-neutral-400 leading-tight">{device.vpnCity}</span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              {device.state.isNew ? (
                <button onClick={handleToggleNew} disabled={saving} className="rounded bg-blue-500 text-white px-2 py-0.5 text-[11px] font-bold hover:bg-blue-600 disabled:opacity-50 transition-colors">
                  NEW D-{newDaysLeft}
                </button>
              ) : (
                <button onClick={handleToggleNew} disabled={saving} className="rounded bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600 disabled:opacity-50 transition-colors">
                  NEW
                </button>
              )}
              <button onClick={handleToggleSuspend} disabled={saving} className={`rounded px-2 py-0.5 text-[11px] font-bold transition-colors disabled:opacity-50 ${device.state.suspended ? "bg-red-500 text-white hover:bg-red-600" : "bg-neutral-100 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600"}`}>
                정지
              </button>
            </div>
          </div>
        </TableCell>

        {renderPlatformCells("tiktok")}
        {renderPlatformCells("instagram")}
        {renderPlatformCells("youtube")}
      </TableRow>

      {/* Mobile */}
      <tr className="md:hidden">
        <td colSpan={10}>
          <div className={`rounded-lg border p-3 mb-2 ${rowBg || "bg-white"} ${device.state.suspended ? "border-red-200" : "border-neutral-200"}`}>
            {deviceHeader}
            <div className="mt-2 grid grid-cols-3 gap-1">
              <span className="text-[10px] text-neutral-400 font-bold col-span-3 uppercase">TikTok</span>
              {[0, 1, 2].map((i) => (
                <AccountCell key={`m-tt-${i}`} slot={device.state.tiktok?.[i] ?? null} deviceSuspended={device.state.suspended} onClickUsername={() => openModal("tiktok", i)} onQuickShadowban={() => handleQuickShadowban("tiktok", i)} />
              ))}
              <span className="text-[10px] text-neutral-400 font-bold col-span-3 mt-1 uppercase">Instagram</span>
              {[0, 1, 2].map((i) => (
                <AccountCell key={`m-ig-${i}`} slot={device.state.instagram?.[i] ?? null} deviceSuspended={device.state.suspended} onClickUsername={() => openModal("instagram", i)} onQuickShadowban={() => handleQuickShadowban("instagram", i)} />
              ))}
              <span className="text-[10px] text-neutral-400 font-bold col-span-3 mt-1 uppercase">YouTube</span>
              {[0, 1, 2].map((i) => (
                <AccountCell key={`m-yt-${i}`} slot={device.state.youtube?.[i] ?? null} deviceSuspended={device.state.suspended} onClickUsername={() => openModal("youtube", i)} onQuickShadowban={() => handleQuickShadowban("youtube", i)} />
              ))}
            </div>
          </div>
        </td>
      </tr>

      <AccountModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        slot={currentSlot}
        platform={modalTarget?.platform ?? "tiktok"}
        slotIndex={modalTarget?.index ?? 0}
        deviceNumber={device.number}
        onSave={handleAccountSave}
        onDelete={handleAccountDelete}
        onToggleShadowban={handleToggleShadowban}
        onResetShadowbanCount={handleResetShadowbanCount}
      />
    </>
  );
};
