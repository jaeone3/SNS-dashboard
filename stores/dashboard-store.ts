import { create } from "zustand";
import type { Region, Language, Device, DeviceState } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

interface DashboardState {
  regions: Region[];
  languages: Language[];
  devices: Device[];

  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;

  selectedRegion: string;
  selectedLanguage: string;

  selectedDeviceIds: Set<string>;
  searchQuery: string;

  fetchAll: () => Promise<void>;
  updateDeviceState: (deviceId: string, state: Partial<DeviceState>) => Promise<void>;
  bulkUpdateDeviceState: (deviceIds: string[], state: Partial<DeviceState>) => Promise<void>;

  setRegion: (code: string) => void;
  setLanguage: (code: string) => void;

  toggleDeviceSelection: (deviceId: string) => void;
  selectAllVisible: (deviceIds: string[]) => void;
  clearSelection: () => void;
  setSearchQuery: (query: string) => void;

  getGroupedDevices: () => Record<string, Device[]>;
  getLanguagesForRegion: (regionCode: string) => Language[];
}

export const useDashboardStore = create<DashboardState>()((set, get) => ({
  regions: [],
  languages: [],
  devices: [],

  isLoading: false,
  error: null,
  lastUpdated: null,

  selectedRegion: "",
  selectedLanguage: "",

  selectedDeviceIds: new Set<string>(),
  searchQuery: "",

  fetchAll: async () => {
    const current = get();
    const isInitial = current.regions.length === 0;
    set({ isLoading: isInitial, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/data`);
      if (!res.ok) throw new Error(`Failed to fetch data: ${res.status}`);
      const data = await res.json();
      const regions = data.regions ?? [];
      const languages = data.languages ?? [];

      // Only reset selection on initial load, preserve user choice on poll
      const selectedRegion = isInitial
        ? (regions[0]?.code ?? "")
        : (current.selectedRegion || (regions[0]?.code ?? ""));

      // Pick first language that belongs to the selected region
      const firstRegion = regions.find((r: { code: string }) => r.code === selectedRegion);
      const firstRegionLangs = firstRegion
        ? languages.filter((l: { id: string }) => firstRegion.languageIds.includes(l.id))
        : languages;
      const selectedLanguage = isInitial
        ? (firstRegionLangs[0]?.code ?? "")
        : (current.selectedLanguage || (firstRegionLangs[0]?.code ?? ""));

      set({
        regions,
        languages,
        devices: data.devices ?? [],
        selectedRegion,
        selectedLanguage,
        isLoading: false,
        lastUpdated: new Date(),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      set({ isLoading: false, error: message });
    }
  },

  updateDeviceState: async (deviceId, partial) => {
    const device = get().devices.find((d) => d.id === deviceId);
    if (!device) return;

    const updated = { ...device.state, ...partial };
    const res = await fetch(`${API_BASE}/api/devices/${deviceId}/state`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    if (!res.ok) throw new Error("Failed to update device state");
    const saved = await res.json();

    set((s) => ({
      devices: s.devices.map((d) =>
        d.id === deviceId ? { ...d, state: saved } : d
      ),
    }));
  },

  bulkUpdateDeviceState: async (deviceIds, partial) => {
    await Promise.all(
      deviceIds.map((id) => get().updateDeviceState(id, partial))
    );
    set({ selectedDeviceIds: new Set() });
  },

  toggleDeviceSelection: (deviceId) =>
    set((s) => {
      const next = new Set(s.selectedDeviceIds);
      if (next.has(deviceId)) next.delete(deviceId);
      else next.add(deviceId);
      return { selectedDeviceIds: next };
    }),

  selectAllVisible: (deviceIds) =>
    set({ selectedDeviceIds: new Set(deviceIds) }),

  clearSelection: () => set({ selectedDeviceIds: new Set() }),

  setRegion: (code) =>
    set((state) => {
      const region = state.regions.find((r) => r.code === code);
      if (!region) return { selectedRegion: code };

      const regionLangs = state.languages.filter((l) =>
        region.languageIds.includes(l.id)
      );
      const sorted = [...regionLangs].sort((a, b) => a.sortOrder - b.sortOrder);
      const currentStillValid = sorted.some((l) => l.code === state.selectedLanguage);

      return {
        selectedRegion: code,
        selectedLanguage: currentStillValid
          ? state.selectedLanguage
          : sorted[0]?.code ?? "",
      };
    }),

  setLanguage: (code) => set({ selectedLanguage: code }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  getGroupedDevices: () => {
    const state = get();
    const filtered = state.devices.filter((d) => {
      if (d.contentLanguage !== state.selectedRegion) return false;
      if (d.targetAudience !== state.selectedLanguage) return false;
      return true;
    });

    const groups: Record<string, Device[]> = {};
    for (const d of filtered) {
      const key = d.contentType || "unknown";
      if (!groups[key]) groups[key] = [];
      groups[key].push(d);
    }

    // Sort devices within each group by number
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => a.number - b.number);
    }

    return groups;
  },

  getLanguagesForRegion: (regionCode: string) => {
    const state = get();
    const region = state.regions.find((r) => r.code === regionCode);
    if (!region) return [];
    return state.languages
      .filter((l) => region.languageIds.includes(l.id))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },
}));
