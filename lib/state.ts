import fs from "fs";
import path from "path";
import type { DeviceState } from "@/types";

const STATE_PATH = path.join(process.cwd(), "data", "dashboard-state.json");

interface HistoryEntry {
  timestamp: string;
  deviceId: string;
  changes: string;
}

interface StateFile {
  devices: Record<string, DeviceState>;
  history?: HistoryEntry[];
}

function ensureDir() {
  const dir = path.dirname(STATE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export const DEFAULT_DEVICE_STATE: DeviceState = {
  isNew: false,
  newDeviceDate: null,
  suspended: false,
  tiktok: [null, null, null],
  instagram: [null, null, null],
  youtube: [null, null, null],
};

export function readState(): StateFile {
  ensureDir();
  if (!fs.existsSync(STATE_PATH)) {
    const empty: StateFile = { devices: {} };
    fs.writeFileSync(STATE_PATH, JSON.stringify(empty, null, 2), "utf-8");
    return empty;
  }
  const raw = fs.readFileSync(STATE_PATH, "utf-8");
  return JSON.parse(raw);
}

const BACKUP_DIR = path.join(process.cwd(), "data", "backups");
const MAX_BACKUPS = 20;

function createBackup() {
  if (!fs.existsSync(STATE_PATH)) return;
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(BACKUP_DIR, `state-${timestamp}.json`);
  fs.copyFileSync(STATE_PATH, backupPath);

  // Keep only latest MAX_BACKUPS
  const files = fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("state-") && f.endsWith(".json"))
    .sort();
  while (files.length > MAX_BACKUPS) {
    const oldest = files.shift()!;
    fs.unlinkSync(path.join(BACKUP_DIR, oldest));
  }
}

export function writeState(state: StateFile) {
  ensureDir();
  createBackup();
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf-8");
}

export function getDeviceState(deviceId: string): DeviceState {
  const state = readState();
  return state.devices[deviceId] ?? { ...DEFAULT_DEVICE_STATE, tiktok: [null, null, null], instagram: [null, null, null], youtube: [null, null, null] };
}

const MAX_HISTORY = 100;

function diffState(prev: DeviceState, next: DeviceState): string[] {
  const changes: string[] = [];
  if (prev.isNew !== next.isNew) changes.push(next.isNew ? "NEW 등록" : "NEW 해제");
  if (prev.suspended !== next.suspended) changes.push(next.suspended ? "정지" : "정지 해제");

  for (const platform of ["tiktok", "instagram", "youtube"] as const) {
    const label = platform === "tiktok" ? "TikTok" : platform === "instagram" ? "Instagram" : "YouTube";
    for (let i = 0; i < 3; i++) {
      const p = prev[platform]?.[i] ?? null;
      const n = next[platform]?.[i] ?? null;
      const slot = `${label}${i + 1}`;
      if (!p?.username && n?.username) changes.push(`${slot} @${n.username} 추가`);
      else if (p?.username && !n?.username) changes.push(`${slot} @${p.username} 삭제`);
      else if (p?.username && n?.username) {
        if (p.username !== n.username) changes.push(`${slot} @${p.username}→@${n.username}`);
        if (!p.shadowban && n.shadowban) changes.push(`${slot} 쉐도우밴 등록`);
        if (p.shadowban && !n.shadowban) changes.push(`${slot} 쉐도우밴 해제`);
        if (p.shadowbanCount !== n.shadowbanCount && n.shadowbanCount === 0) changes.push(`${slot} SB카운트 초기화`);
      }
    }
  }
  return changes;
}

export function setDeviceState(deviceId: string, deviceState: DeviceState) {
  const state = readState();
  const prev = state.devices[deviceId];
  state.devices[deviceId] = deviceState;

  // Record history
  if (prev) {
    const changes = diffState(prev, deviceState);
    if (changes.length > 0) {
      if (!state.history) state.history = [];
      state.history.push({
        timestamp: new Date().toISOString(),
        deviceId,
        changes: changes.join(", "),
      });
      // Keep only latest entries
      if (state.history.length > MAX_HISTORY) {
        state.history = state.history.slice(-MAX_HISTORY);
      }
    }
  }

  writeState(state);
}
