import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { readState } from "@/lib/state";

const CONFIG_PATH =
  process.env.DEVICE_CONFIG_PATH ??
  path.join("C:\\Users\\user\\dev\\koko\\tools\\pipeline", "device_config.json");

// language code -> display info
const LANG_INFO: Record<string, { label: string; countryCode: string }> = {
  en: { label: "English", countryCode: "US" },
  kr: { label: "Korean", countryCode: "KR" },
  jp: { label: "Japanese", countryCode: "JP" },
  cn: { label: "Chinese", countryCode: "CN" },
  es: { label: "Spanish", countryCode: "ES" },
  fr: { label: "French", countryCode: "FR" },
  ge: { label: "German", countryCode: "DE" },
};

export async function GET() {
  try {
    let config: { devices?: Record<string, unknown>[] } = { devices: [] };
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
      config = JSON.parse(raw);
    }
    const stateFile = readState();

    // Extract regions and languages directly from devices
    const regionLangMap: Record<string, Set<string>> = {};

    for (const d of config.devices ?? []) {
      const cl = d.content_language as string;
      const ta = d.target_audience as string;
      if (!cl || !ta) continue;
      if (!regionLangMap[cl]) regionLangMap[cl] = new Set();
      regionLangMap[cl].add(ta);
    }

    // Build regions
    const regions = Object.entries(regionLangMap).map(([code, langSet]) => ({
      code,
      name: LANG_INFO[code]?.label ?? code.toUpperCase(),
      countryCode: LANG_INFO[code]?.countryCode ?? code.toUpperCase(),
      flagEmoji: "",
      languageIds: [...langSet],
    }));

    // Build languages (unique across all target audiences)
    const allLangCodes = new Set<string>();
    for (const langSet of Object.values(regionLangMap)) {
      for (const code of langSet) allLangCodes.add(code);
    }

    const languages = [...allLangCodes].map((code, i) => ({
      id: code,
      code,
      label: LANG_INFO[code]?.label ?? code.toUpperCase(),
      countryCode: LANG_INFO[code]?.countryCode ?? code.toUpperCase(),
      sortOrder: i,
    }));

    // Build devices (merge config + state)
    const devices = (config.devices ?? []).map(
      (d: Record<string, unknown>) => {
        const id = d.id as string;
        const savedState = stateFile.devices[id];
        return {
          id,
          number: d.number,
          name: d.name,
          host: d.host ?? "",
          phase: d.phase ?? "",
          model: d.model ?? "",
          deviceLocale: d.device_locale ?? "",
          systemPort: d.system_port ?? 0,
          vpnApp: d.vpn_app ?? "",
          vpnRegion: d.vpn_region ?? "",
          vpnCity: d.vpn_city ?? "",
          contentLanguage: d.content_language ?? "",
          targetAudience: d.target_audience ?? "",
          contentType: d.content_type ?? "",
          uploadDir: d.upload_dir ?? "",
          uploadedDir: d.uploaded_dir ?? "",
          platforms: d.platforms ?? {},
          state: savedState
            ? {
                ...savedState,
                youtube: savedState.youtube ?? [null, null, null],
              }
            : {
                isNew: false,
                newDeviceDate: null,
                suspended: false,
                tiktok: [null, null, null],
                instagram: [null, null, null],
                youtube: [null, null, null],
              },
        };
      }
    );

    return NextResponse.json({ regions, languages, devices });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to load config: ${message}` },
      { status: 500 }
    );
  }
}
