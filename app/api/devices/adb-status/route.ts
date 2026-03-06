import { NextResponse } from "next/server";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

function getAdbPath(): string {
  try {
    const configPath =
      process.env.DEVICE_CONFIG_PATH ??
      path.join("C:\\Users\\user\\dev\\koko\\tools\\pipeline", "device_config.json");
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (config.global?.adb_path) return config.global.adb_path;
    }
  } catch { /* fall through */ }
  return "adb";
}

export async function GET() {
  try {
    const adb = getAdbPath();
    const cmd = adb.includes(" ") ? `"${adb}" devices` : `${adb} devices`;
    const output = execSync(cmd, {
      timeout: 10000,
      encoding: "utf-8",
      shell: "cmd.exe",
    });

    const connected = new Set<string>();
    for (const line of output.split("\n")) {
      const match = line.trim().match(/^(\S+)\s+device$/);
      if (match) connected.add(match[1]);
    }

    return NextResponse.json({
      connected: [...connected],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `ADB check failed: ${message}`, connected: [] },
      { status: 500 }
    );
  }
}
