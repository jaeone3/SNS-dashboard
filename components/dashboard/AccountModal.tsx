"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { AccountSlot } from "@/types";

interface AccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: AccountSlot | null;
  platform: string;
  slotIndex: number;
  deviceNumber: number;
  onSave: (username: string) => void;
  onDelete: () => void;
  onToggleShadowban: () => void;
  onResetShadowbanCount: () => void;
}

function daysElapsed(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const elapsed = Date.now() - new Date(dateStr).getTime();
  return Math.min(3, Math.floor(elapsed / (24 * 60 * 60 * 1000)));
}

export const AccountModal = ({
  open,
  onOpenChange,
  slot,
  platform,
  slotIndex,
  deviceNumber,
  onSave,
  onDelete,
  onToggleShadowban,
  onResetShadowbanCount,
}: AccountModalProps) => {
  const [value, setValue] = useState("");
  const isNew = !slot?.username;

  useEffect(() => {
    if (open) {
      setValue(slot?.username ?? "");
    }
  }, [open, slot?.username]);

  const handleSave = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSave(trimmed);
    onOpenChange(false);
  };

  const handleDelete = () => {
    onDelete();
    onOpenChange(false);
  };

  const platformLabel = platform === "tiktok" ? "TikTok" : platform === "instagram" ? "Instagram" : "YouTube";
  const sbElapsed = daysElapsed(slot?.shadowbanDate ?? null);
  const sbDone = sbElapsed !== null && sbElapsed >= 3;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>
            {isNew ? "계정 추가" : "계정 관리"}
          </DialogTitle>
          <DialogDescription>
            Device #{deviceNumber} &middot; {platformLabel} {slotIndex + 1}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-500">
              Username
            </label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-neutral-400">@</span>
              <input
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                }}
                className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
                placeholder="username"
              />
            </div>
          </div>

          {!isNew && slot && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-neutral-500">
                  쉐도우밴
                </label>
                {slot.shadowbanCount > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-orange-500">
                      총 {slot.shadowbanCount}회
                    </span>
                    <button
                      onClick={() => {
                        onResetShadowbanCount();
                        onOpenChange(false);
                      }}
                      className="text-[10px] text-neutral-400 hover:text-neutral-600 underline"
                    >
                      초기화
                    </button>
                  </div>
                )}
              </div>

              {slot.shadowban && (
                <div className={`rounded-md border px-3 py-2 text-sm ${
                  sbDone
                    ? "border-green-300 bg-green-50 text-green-700"
                    : "border-orange-300 bg-orange-50 text-orange-700"
                }`}>
                  {sbDone
                    ? "3일 경과 — 해제 가능"
                    : `휴식 중: ${sbElapsed}일 / 3일 경과`}
                </div>
              )}

              <button
                onClick={() => {
                  onToggleShadowban();
                  onOpenChange(false);
                }}
                className={`w-full rounded-md border px-3 py-2 text-xs font-semibold transition-colors ${
                  slot.shadowban
                    ? "border-green-300 bg-white text-green-600 hover:bg-green-50"
                    : "border-orange-200 bg-white text-orange-500 hover:bg-orange-50"
                }`}
              >
                {slot.shadowban ? "쉐도우밴 해제" : "쉐도우밴 등록"}
              </button>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:justify-between">
          {!isNew && (
            <Button
              variant="outline"
              className="text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
              onClick={handleDelete}
            >
              삭제
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button onClick={handleSave} disabled={!value.trim()}>
              {isNew ? "추가" : "저장"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
