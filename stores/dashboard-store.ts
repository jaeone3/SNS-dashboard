import { create } from "zustand";
import type { Region, Language, Platform, Tag, Account } from "@/types";
import { generateId, nowISO } from "@/lib/utils";

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
  addRegion: (region: Region) => void;
  removeRegion: (code: string) => void;
  assignLanguageToRegion: (regionCode: string, languageId: string) => void;
  unassignLanguageFromRegion: (regionCode: string, languageId: string) => void;

  // --- Language ---
  addLanguage: (lang: Omit<Language, "id">) => void;
  removeLanguage: (id: string) => void;
  reorderLanguages: (ids: string[]) => void;

  // --- Platform ---
  addPlatform: (platform: Omit<Platform, "id">) => void;
  removePlatform: (id: string) => void;

  // --- Tag ---
  addTag: (tag: Omit<Tag, "id">) => void;
  updateTag: (id: string, data: Partial<Tag>) => void;
  removeTag: (id: string) => void;

  // --- Account ---
  addAccount: (
    account: Omit<Account, "id" | "createdAt" | "updatedAt">
  ) => void;
  updateAccount: (id: string, data: Partial<Account>) => void;
  removeAccount: (id: string) => void;

  // --- Account Tags ---
  assignTag: (accountId: string, tagId: string) => void;
  unassignTag: (accountId: string, tagId: string) => void;

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
  addRegion: (region) => {
    set((state) => ({
      regions: [...state.regions, region],
    }));
    fetch("/api/regions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(region),
    }).catch((e) => console.error("addRegion sync error:", e));
  },

  removeRegion: (code) => {
    set((state) => ({
      regions: state.regions.filter((r) => r.code !== code),
      accounts: state.accounts.filter((a) => a.regionCode !== code),
      selectedRegion:
        state.selectedRegion === code
          ? state.regions.find((r) => r.code !== code)?.code ?? ""
          : state.selectedRegion,
    }));
    fetch("/api/regions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    }).catch((e) => console.error("removeRegion sync error:", e));
  },

  assignLanguageToRegion: (regionCode, languageId) => {
    set((state) => ({
      regions: state.regions.map((r) =>
        r.code === regionCode && !r.languageIds.includes(languageId)
          ? { ...r, languageIds: [...r.languageIds, languageId] }
          : r
      ),
    }));
    fetch(`/api/regions/${regionCode}/languages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ languageId }),
    }).catch((e) => console.error("assignLanguageToRegion sync error:", e));
  },

  unassignLanguageFromRegion: (regionCode, languageId) => {
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
    fetch(`/api/regions/${regionCode}/languages`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ languageId }),
    }).catch((e) => console.error("unassignLanguageFromRegion sync error:", e));
  },

  // ========== Language ==========
  addLanguage: (lang) => {
    const newId = generateId();
    const newLang = { ...lang, id: newId, sortOrder: get().languages.length };
    set((state) => ({
      languages: [...state.languages, newLang],
    }));
    fetch("/api/languages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newLang),
    }).catch((e) => console.error("addLanguage sync error:", e));
    return newId;
  },

  removeLanguage: (id) => {
    const lang = get().languages.find((l) => l.id === id);
    set((state) => {
      return {
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
      };
    });
    fetch("/api/languages", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch((e) => console.error("removeLanguage sync error:", e));
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
  addPlatform: (platform) => {
    const newPlatform = { ...platform, id: generateId() };
    set((state) => ({
      platforms: [...state.platforms, newPlatform],
    }));
    fetch("/api/platforms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newPlatform),
    }).catch((e) => console.error("addPlatform sync error:", e));
  },

  removePlatform: (id) => {
    set((state) => ({
      platforms: state.platforms.filter((p) => p.id !== id),
      accounts: state.accounts.filter((a) => a.platformId !== id),
    }));
    fetch("/api/platforms", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch((e) => console.error("removePlatform sync error:", e));
  },

  // ========== Tag ==========
  addTag: (tag) => {
    const newTag = { ...tag, id: generateId() };
    set((state) => ({
      tags: [...state.tags, newTag],
    }));
    fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newTag),
    }).catch((e) => console.error("addTag sync error:", e));
  },

  updateTag: (id, data) => {
    set((state) => ({
      tags: state.tags.map((t) =>
        t.id === id ? { ...t, ...data } : t
      ),
    }));
    fetch("/api/tags", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...data }),
    }).catch((e) => console.error("updateTag sync error:", e));
  },

  removeTag: (id) => {
    set((state) => ({
      tags: state.tags.filter((t) => t.id !== id),
      accounts: state.accounts.map((a) => ({
        ...a,
        tagIds: a.tagIds.filter((tid) => tid !== id),
      })),
    }));
    fetch("/api/tags", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch((e) => console.error("removeTag sync error:", e));
  },

  // ========== Account ==========
  addAccount: (account) => {
    const newAccount = {
      ...account,
      id: generateId(),
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    set((state) => ({
      accounts: [...state.accounts, newAccount],
    }));
    fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newAccount),
    }).catch((e) => console.error("addAccount sync error:", e));
  },

  updateAccount: (id, data) => {
    const updatedData = { ...data, updatedAt: nowISO() };
    set((state) => ({
      accounts: state.accounts.map((a) =>
        a.id === id ? { ...a, ...updatedData } : a
      ),
    }));
    fetch("/api/accounts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updatedData }),
    }).catch((e) => console.error("updateAccount sync error:", e));
  },

  removeAccount: (id) => {
    set((state) => ({
      accounts: state.accounts.filter((a) => a.id !== id),
    }));
    fetch("/api/accounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch((e) => console.error("removeAccount sync error:", e));
  },

  // ========== Account Tags ==========
  assignTag: (accountId, tagId) => {
    set((state) => ({
      accounts: state.accounts.map((a) =>
        a.id === accountId && !a.tagIds.includes(tagId)
          ? { ...a, tagIds: [...a.tagIds, tagId], updatedAt: nowISO() }
          : a
      ),
    }));
    fetch(`/api/accounts/${accountId}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId }),
    }).catch((e) => console.error("assignTag sync error:", e));
  },

  unassignTag: (accountId, tagId) => {
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
    fetch(`/api/accounts/${accountId}/tags`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId }),
    }).catch((e) => console.error("unassignTag sync error:", e));
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
