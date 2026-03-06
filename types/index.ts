// ===== Region (Content Language) =====
export interface Region {
  code: string;
  name: string;
  countryCode: string;
  flagEmoji: string;
  languageIds: string[];
}

// ===== Language (Target Audience) =====
export interface Language {
  id: string;
  code: string;
  label: string;
  countryCode: string;
  sortOrder: number;
}

// ===== Platform config per device (from device_config.json) =====
export interface DevicePlatformConfig {
  enabled: boolean;
  schedule_hours: number;
  phone_video_dir: string;
  location: string | null;
  account: string;
}

// ===== Account slot (stored in dashboard-state.json) =====
export interface AccountSlot {
  username: string;
  shadowban: boolean;
  shadowbanDate: string | null;
  shadowbanCount: number;
}

// ===== Device state (stored in dashboard-state.json) =====
export interface DeviceState {
  isNew: boolean;
  newDeviceDate: string | null;
  suspended: boolean;
  tiktok: (AccountSlot | null)[];
  instagram: (AccountSlot | null)[];
  youtube: (AccountSlot | null)[];
}

// ===== Device (merged: config + state) =====
export interface Device {
  id: string;
  number: number;
  name: string;
  host: string;
  phase: string;
  model: string;
  deviceLocale: string;
  systemPort: number;
  vpnApp: string;
  vpnRegion: string;
  vpnCity: string;
  contentLanguage: string;
  targetAudience: string;
  contentType: string;
  uploadDir: string;
  uploadedDir: string;
  platforms: Record<string, DevicePlatformConfig>;
  state: DeviceState;
}
