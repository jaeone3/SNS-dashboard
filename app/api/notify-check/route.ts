import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { readState } from "@/lib/state";
import { notifyShadowbanReady, notifyNewDeviceReady } from "@/lib/slack-notifier";

const CONFIG_PATH = path.join(
  "C:\\Users\\user\\dev\\koko\\tools\\pipeline",
  "device_config.json"
);
const NOTIFIED_PATH = path.join(process.cwd(), "data", "notified.json");

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function loadNotified(): Set<string> {
  try {
    if (fs.existsSync(NOTIFIED_PATH)) {
      const raw = fs.readFileSync(NOTIFIED_PATH, "utf-8");
      return new Set(JSON.parse(raw));
    }
  } catch { /* ignore */ }
  return new Set();
}

function saveNotified(notified: Set<string>) {
  const dir = path.dirname(NOTIFIED_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(NOTIFIED_PATH, JSON.stringify([...notified], null, 2), "utf-8");
}

/**
 * GET /api/notify-check
 * Checks all devices for shadowban/new-device readiness and sends Slack notifications.
 * Deduplicates so each event is only notified once.
 * Can be called by polling or cron.
 */
export async function GET() {
  try {
    const configRaw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const config = JSON.parse(configRaw);
    const state = readState();
    const notified = loadNotified();
    const notifications: string[] = [];

    for (const dev of config.devices ?? []) {
      const id = dev.id as string;
      const num = dev.number as number;
      const name = (dev.name as string) || id;
      const deviceState = state.devices[id];
      if (!deviceState) continue;

      // Check shadowbans
      for (const platform of ["tiktok", "instagram", "youtube"] as const) {
        const label = platform === "tiktok" ? "TikTok" : platform === "instagram" ? "Instagram" : "YouTube";
        for (let i = 0; i < (deviceState[platform]?.length ?? 0); i++) {
          const slot = deviceState[platform]?.[i];
          if (!slot?.shadowban || !slot.shadowbanDate) continue;
          const elapsed = Date.now() - new Date(slot.shadowbanDate).getTime();
          if (elapsed >= THREE_DAYS_MS) {
            const key = `sb:${id}:${platform}:${i}:${slot.shadowbanDate}`;
            if (!notified.has(key)) {
              await notifyShadowbanReady(num, name, `${label} ${i + 1}`, slot.username);
              notified.add(key);
              notifications.push(`Shadowban ready: #${num} ${label} ${i + 1} @${slot.username}`);
            }
          }
        }
      }

      // Check new device
      if (deviceState.isNew && deviceState.newDeviceDate) {
        const elapsed = Date.now() - new Date(deviceState.newDeviceDate).getTime();
        if (elapsed >= SEVEN_DAYS_MS) {
          const key = `new:${id}:${deviceState.newDeviceDate}`;
          if (!notified.has(key)) {
            await notifyNewDeviceReady(num, name);
            notified.add(key);
            notifications.push(`New device ready: #${num} ${name}`);
          }
        }
      }
    }

    saveNotified(notified);
    return NextResponse.json({ checked: true, notifications });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
