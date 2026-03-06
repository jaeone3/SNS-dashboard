import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getDeviceState, setDeviceState } from "@/lib/state";
import { notifyShadowbanReady, notifyNewDeviceReady } from "@/lib/slack-notifier";
import type { DeviceState, AccountSlot } from "@/types";

const CONFIG_PATH = path.join(
  "C:\\Users\\user\\dev\\koko\\tools\\pipeline",
  "device_config.json"
);

function getDeviceInfo(deviceId: string): { number: number; name: string } {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const config = JSON.parse(raw);
    const dev = (config.devices ?? []).find((d: Record<string, unknown>) => d.id === deviceId);
    return { number: dev?.number ?? 0, name: dev?.name ?? deviceId };
  } catch {
    return { number: 0, name: deviceId };
  }
}

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function checkAndNotify(deviceId: string, prev: DeviceState, next: DeviceState) {
  const info = getDeviceInfo(deviceId);

  // Check shadowban becoming ready (3 days elapsed)
  for (const platform of ["tiktok", "instagram", "youtube"] as const) {
    const label = platform === "tiktok" ? "TikTok" : platform === "instagram" ? "Instagram" : "YouTube";
    for (let i = 0; i < (next[platform]?.length ?? 0); i++) {
      const prevSlot = (prev[platform]?.[i] ?? null) as AccountSlot | null;
      const nextSlot = (next[platform]?.[i] ?? null) as AccountSlot | null;

      // Notify if shadowban was just set and is already 3+ days old
      // (e.g., data correction), or if it just crossed the threshold
      if (nextSlot?.shadowban && nextSlot.shadowbanDate) {
        const elapsed = Date.now() - new Date(nextSlot.shadowbanDate).getTime();
        const wasReady = prevSlot?.shadowbanDate
          ? Date.now() - new Date(prevSlot.shadowbanDate).getTime() >= THREE_DAYS_MS
          : false;
        if (elapsed >= THREE_DAYS_MS && !wasReady) {
          notifyShadowbanReady(info.number, info.name, `${label} ${i + 1}`, nextSlot.username);
        }
      }
    }
  }

  // Check new device becoming ready (7 days elapsed)
  if (next.isNew && next.newDeviceDate) {
    const elapsed = Date.now() - new Date(next.newDeviceDate).getTime();
    const wasReady = prev.newDeviceDate
      ? Date.now() - new Date(prev.newDeviceDate).getTime() >= SEVEN_DAYS_MS
      : false;
    if (elapsed >= SEVEN_DAYS_MS && !wasReady) {
      notifyNewDeviceReady(info.number, info.name);
    }
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as Partial<DeviceState>;
    const current = getDeviceState(id);

    const updated: DeviceState = {
      isNew: body.isNew ?? current.isNew,
      newDeviceDate: body.newDeviceDate !== undefined ? body.newDeviceDate : current.newDeviceDate,
      suspended: body.suspended ?? current.suspended,
      tiktok: body.tiktok ?? current.tiktok,
      instagram: body.instagram ?? current.instagram,
      youtube: body.youtube ?? current.youtube ?? [null, null, null],
    };

    setDeviceState(id, updated);

    // Fire-and-forget notification check
    checkAndNotify(id, current, updated);

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
