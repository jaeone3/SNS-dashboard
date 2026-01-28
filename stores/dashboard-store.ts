import { create } from "zustand";
import type { Region, Language, Platform, Tag, Account } from "@/types";
import { generateId, nowISO } from "@/lib/utils";
import { toast } from "@/stores/toast-store";

/** Helper: fetch + parse error on non-ok response */
async function apiFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Server error: ${res.status}`);
  }
  return res;
}

interface DashboardState {
  // --- Data ---
  regions: Region[];
  languages: Language[];
  platforms: Platform[];
  tags: Tag[];
  accounts: Account[];

  // --- Loading / Error ---
  isLoading: boolean;
  error: string | null;

  // --- Filters ---
  selectedRegion: string;
  selectedLanguage: string;
  platformFilter: string | null;
  tagFilter: string | null;

  // --- Fetch ---
  fetchAll: () => Promise<void>;

  // --- Region ---
  addRegion: (region: Region) => Promise<void>;
  removeRegion: (code: string) => Promise<void>;
  assignLanguageToRegion: (regionCode: string, languageId: string) => Promise<void>;
  unassignLanguageFromRegion: (regionCode: string, languageId: string) => Promise<void>;

  // --- Language ---
  addLanguage: (lang: Omit<Language, "id">) => Promise<void>;
  removeLanguage: (id: string) => Promise<void>;
  reorderLanguages: (ids: string[]) => void;

  // --- Platform ---
  addPlatform: (platform: Omit<Platform, "id">) => Promise<void>;
  removePlatform: (id: string) => Promise<void>;

  // --- Tag ---
  addTag: (tag: Omit<Tag, "id">) => Promise<void>;
  updateTag: (id: string, data: Partial<Tag>) => Promise<void>;
  removeTag: (id: string) => Promise<void>;

  // --- Account ---
  addAccount: (
    account: Omit<Account, "id" | "createdAt" | "updatedAt">
  ) => Promise<void>;
  updateAccount: (id: string, data: Partial<Account>) => Promise<void>;
  removeAccount: (id: string) => Promise<void>;

  // --- Account Tags ---
  assignTag: (accountId: string, tagId: string) => Promise<void>;
  unassignTag: (accountId: string, tagId: string) => Promise<void>;

  // --- Filters ---
  setRegion: (code: string) => void;
  setLanguage: (code: string) => void;
  setPlatformFilter: (id: string | null) => void;
  setTagFilter: (id: string | null) => void;

  // --- Derived ---
  getFilteredAccounts: () => Account[];
  getLanguagesForRegion: (regionCode: string) => Language[];
}

export const useDashboardStore = create<DashboardState>()((set, get) => ({
  // --- Initial Data (empty — populated by fetchAll) ---
  regions: [],
  languages: [],
  platforms: [],
  tags: [],
  accounts: [],

  // --- Loading / Error ---
  isLoading: false,
  error: null,

  // --- Initial Filters ---
  selectedRegion: "",
  selectedLanguage: "",
  platformFilter: null,
  tagFilter: null,

  // ========== Fetch All ==========
  fetchAll: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/data");
      if (!res.ok) throw new Error(`Failed to fetch data: ${res.status}`);
      const data = await res.json();
      set({
        regions: data.regions ?? [],
        languages: data.languages ?? [],
        platforms: data.platforms ?? [],
        tags: data.tags ?? [],
        accounts: data.accounts ?? [],
        selectedRegion: data.regions?.[0]?.code ?? "",
        selectedLanguage: data.languages?.[0]?.code ?? "",
        isLoading: false,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      console.error("fetchAll error:", message);
      set({ isLoading: false, error: message });
    }
  },

  // ========== Region ==========
  addRegion: async (region) => {
    await apiFetch("/api/regions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(region),
    });
    set((state) => ({
      regions: [...state.regions, region],
    }));
  },

  removeRegion: async (code) => {
    await apiFetch("/api/regions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    set((state) => ({
      regions: state.regions.filter((r) => r.code !== code),
      accounts: state.accounts.filter((a) => a.regionCode !== code),
      selectedRegion:
        state.selectedRegion === code
          ? state.regions.find((r) => r.code !== code)?.code ?? ""
          : state.selectedRegion,
    }));
  },

  assignLanguageToRegion: async (regionCode, languageId) => {
    await apiFetch(`/api/regions/${regionCode}/languages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ languageId }),
    });
    set((state) => ({
      regions: state.regions.map((r) =>
        r.code === regionCode && !r.languageIds.includes(languageId)
          ? { ...r, languageIds: [...r.languageIds, languageId] }
          : r
      ),
    }));
  },

  unassignLanguageFromRegion: async (regionCode, languageId) => {
    await apiFetch(`/api/regions/${regionCode}/languages`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ languageId }),
    });
    set((state) => {
      const lang = state.languages.find((l) => l.id === languageId);
      return {
        regions: state.regions.map((r) =>
          r.code === regionCode
            ? {
                ...r,
                languageIds: r.languageIds.filter(
                  (id) => id !== languageId
                ),
              }
            : r
        ),
        // If currently selected language is being removed from active region, switch
        selectedLanguage:
          lang &&
          state.selectedRegion === regionCode &&
          state.selectedLanguage === lang.code
            ? (() => {
                const region = state.regions.find(
                  (r) => r.code === regionCode
                );
                const remaining = region
                  ? region.languageIds.filter((id) => id !== languageId)
                  : [];
                const firstLang = state.languages.find(
                  (l) => remaining.includes(l.id)
                );
                return firstLang?.code ?? "";
              })()
            : state.selectedLanguage,
      };
    });
  },

  // ========== Language ==========
  addLanguage: async (lang) => {
    const newId = generateId();
    const newLang = { ...lang, id: newId, sortOrder: get().languages.length };
    await apiFetch("/api/languages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newLang),
    });
    set((state) => ({
      languages: [...state.languages, newLang],
    }));
  },

  removeLanguage: async (id) => {
    const lang = get().languages.find((l) => l.id === id);
    await apiFetch("/api/languages", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    set((state) => ({
      languages: state.languages.filter((l) => l.id !== id),
      // Remove language from all regions
      regions: state.regions.map((r) => ({
        ...r,
        languageIds: r.languageIds.filter((lid) => lid !== id),
      })),
      // Remove accounts with this language
      accounts: lang
        ? state.accounts.filter((a) => a.languageCode !== lang.code)
        : state.accounts,
      selectedLanguage:
        lang && state.selectedLanguage === lang.code
          ? state.languages.find((l) => l.id !== id)?.code ?? ""
          : state.selectedLanguage,
    }));
  },

  reorderLanguages: (ids) =>
    set((state) => ({
      languages: ids
        .map((id, index) => {
          const lang = state.languages.find((l) => l.id === id);
          return lang ? { ...lang, sortOrder: index } : null;
        })
        .filter((l): l is Language => l !== null),
    })),

  // ========== Platform ==========
  addPlatform: async (platform) => {
    const newPlatform = { ...platform, id: generateId() };
    await apiFetch("/api/platforms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newPlatform),
    });
    set((state) => ({
      platforms: [...state.platforms, newPlatform],
    }));
  },

  removePlatform: async (id) => {
    await apiFetch("/api/platforms", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    set((state) => ({
      platforms: state.platforms.filter((p) => p.id !== id),
      accounts: state.accounts.filter((a) => a.platformId !== id),
    }));
  },

  // ========== Tag ==========
  addTag: async (tag) => {
    const newTag = { ...tag, id: generateId() };
    await apiFetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newTag),
    });
    set((state) => ({
      tags: [...state.tags, newTag],
    }));
  },

  updateTag: async (id, data) => {
    await apiFetch("/api/tags", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...data }),
    });
    set((state) => ({
      tags: state.tags.map((t) =>
        t.id === id ? { ...t, ...data } : t
      ),
    }));
  },

  removeTag: async (id) => {
    await apiFetch("/api/tags", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    set((state) => ({
      tags: state.tags.filter((t) => t.id !== id),
      accounts: state.accounts.map((a) => ({
        ...a,
        tagIds: a.tagIds.filter((tid) => tid !== id),
      })),
    }));
  },

  // ========== Account ==========
  addAccount: async (account) => {
    const newAccount = {
      ...account,
      id: generateId(),
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    await apiFetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newAccount),
    });
    set((state) => ({
      accounts: [...state.accounts, newAccount],
    }));
  },

  updateAccount: async (id, data) => {
    const updatedData = { ...data, updatedAt: nowISO() };
    const res = await apiFetch("/api/accounts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updatedData }),
    });
    // Use the actual API response to update the store
    const apiResponse = await res.json();
    set((state) => ({
      accounts: state.accounts.map((a) =>
        a.id === id ? { ...a, ...apiResponse } : a
      ),
    }));
  },

  removeAccount: async (id) => {
    await apiFetch("/api/accounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    set((state) => ({
      accounts: state.accounts.filter((a) => a.id !== id),
    }));
  },

  // ========== Account Tags ==========
  assignTag: async (accountId, tagId) => {
    await apiFetch(`/api/accounts/${accountId}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId }),
    });
    set((state) => ({
      accounts: state.accounts.map((a) =>
        a.id === accountId && !a.tagIds.includes(tagId)
          ? { ...a, tagIds: [...a.tagIds, tagId], updatedAt: nowISO() }
          : a
      ),
    }));
  },

  unassignTag: async (accountId, tagId) => {
    await apiFetch(`/api/accounts/${accountId}/tags`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId }),
    });
    set((state) => ({
      accounts: state.accounts.map((a) =>
        a.id === accountId
          ? {
              ...a,
              tagIds: a.tagIds.filter((tid) => tid !== tagId),
              updatedAt: nowISO(),
            }
          : a
      ),
    }));
  },

  // ========== Filters ==========
  setRegion: (code) =>
    set((state) => {
      const region = state.regions.find((r) => r.code === code);
      if (!region) return { selectedRegion: code };

      // Get languages for this region
      const regionLangs = state.languages.filter((l) =>
        region.languageIds.includes(l.id)
      );
      const sorted = [...regionLangs].sort(
        (a, b) => a.sortOrder - b.sortOrder
      );

      // If current selectedLanguage exists in new region, keep it
      const currentStillValid = sorted.some(
        (l) => l.code === state.selectedLanguage
      );

      return {
        selectedRegion: code,
        selectedLanguage: currentStillValid
          ? state.selectedLanguage
          : sorted[0]?.code ?? "",
        // Reset filters when switching region
        platformFilter: null,
        tagFilter: null,
      };
    }),

  setLanguage: (code) => set({ selectedLanguage: code }),
  setPlatformFilter: (id) => set({ platformFilter: id }),
  setTagFilter: (id) => set({ tagFilter: id }),

  // ========== Derived ==========
  getFilteredAccounts: () => {
    const state = get();
    return state.accounts.filter((account) => {
      if (account.regionCode !== state.selectedRegion) return false;
      if (account.languageCode !== state.selectedLanguage) return false;
      if (
        state.platformFilter &&
        account.platformId !== state.platformFilter
      )
        return false;
      if (state.tagFilter && !account.tagIds.includes(state.tagFilter))
        return false;
      return true;
    });
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
