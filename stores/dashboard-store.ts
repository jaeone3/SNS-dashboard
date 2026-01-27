import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Region, Language, Platform, Tag, Account } from "@/types";
import {
  SEED_REGIONS,
  SEED_LANGUAGES,
  SEED_PLATFORMS,
  SEED_TAGS,
  SEED_ACCOUNTS,
} from "@/lib/constants";
import { generateId, nowISO } from "@/lib/utils";

interface DashboardState {
  // --- Data ---
  regions: Region[];
  languages: Language[];
  platforms: Platform[];
  tags: Tag[];
  accounts: Account[];

  // --- Filters ---
  selectedRegion: string;
  selectedLanguage: string;
  platformFilter: string | null;
  tagFilter: string | null;

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

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      // --- Initial Data ---
      regions: SEED_REGIONS,
      languages: SEED_LANGUAGES,
      platforms: SEED_PLATFORMS,
      tags: SEED_TAGS,
      accounts: SEED_ACCOUNTS,

      // --- Initial Filters ---
      selectedRegion: SEED_REGIONS[0].code,
      selectedLanguage: SEED_LANGUAGES[0].code,
      platformFilter: null,
      tagFilter: null,

      // ========== Region ==========
      addRegion: (region) =>
        set((state) => ({
          regions: [...state.regions, region],
        })),

      removeRegion: (code) =>
        set((state) => ({
          regions: state.regions.filter((r) => r.code !== code),
          accounts: state.accounts.filter((a) => a.regionCode !== code),
          selectedRegion:
            state.selectedRegion === code
              ? state.regions.find((r) => r.code !== code)?.code ?? ""
              : state.selectedRegion,
        })),

      assignLanguageToRegion: (regionCode, languageId) =>
        set((state) => ({
          regions: state.regions.map((r) =>
            r.code === regionCode && !r.languageIds.includes(languageId)
              ? { ...r, languageIds: [...r.languageIds, languageId] }
              : r
          ),
        })),

      unassignLanguageFromRegion: (regionCode, languageId) =>
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
        }),

      // ========== Language ==========
      addLanguage: (lang) => {
        const newId = generateId();
        set((state) => ({
          languages: [
            ...state.languages,
            { ...lang, id: newId, sortOrder: state.languages.length },
          ],
        }));
        return newId;
      },

      removeLanguage: (id) =>
        set((state) => {
          const lang = state.languages.find((l) => l.id === id);
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
        }),

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
      addPlatform: (platform) =>
        set((state) => ({
          platforms: [...state.platforms, { ...platform, id: generateId() }],
        })),

      removePlatform: (id) =>
        set((state) => ({
          platforms: state.platforms.filter((p) => p.id !== id),
          accounts: state.accounts.filter((a) => a.platformId !== id),
        })),

      // ========== Tag ==========
      addTag: (tag) =>
        set((state) => ({
          tags: [...state.tags, { ...tag, id: generateId() }],
        })),

      updateTag: (id, data) =>
        set((state) => ({
          tags: state.tags.map((t) =>
            t.id === id ? { ...t, ...data } : t
          ),
        })),

      removeTag: (id) =>
        set((state) => ({
          tags: state.tags.filter((t) => t.id !== id),
          accounts: state.accounts.map((a) => ({
            ...a,
            tagIds: a.tagIds.filter((tid) => tid !== id),
          })),
        })),

      // ========== Account ==========
      addAccount: (account) =>
        set((state) => ({
          accounts: [
            ...state.accounts,
            {
              ...account,
              id: generateId(),
              createdAt: nowISO(),
              updatedAt: nowISO(),
            },
          ],
        })),

      updateAccount: (id, data) =>
        set((state) => ({
          accounts: state.accounts.map((a) =>
            a.id === id ? { ...a, ...data, updatedAt: nowISO() } : a
          ),
        })),

      removeAccount: (id) =>
        set((state) => ({
          accounts: state.accounts.filter((a) => a.id !== id),
        })),

      // ========== Account Tags ==========
      assignTag: (accountId, tagId) =>
        set((state) => ({
          accounts: state.accounts.map((a) =>
            a.id === accountId && !a.tagIds.includes(tagId)
              ? { ...a, tagIds: [...a.tagIds, tagId], updatedAt: nowISO() }
              : a
          ),
        })),

      unassignTag: (accountId, tagId) =>
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
        })),

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
    }),
    {
      name: "koko-sns-dashboard",
      version: 7,
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Record<string, unknown>;

        if (version < 1) {
          // v0 → v1: Patch languages missing countryCode
          const LANG_TO_COUNTRY: Record<string, string> = {
            EN: "US", JP: "JP", SP: "ES", CN: "CN", KR: "KR",
            FR: "FR", DE: "DE", PT: "BR", IT: "IT", RU: "RU",
          };
          const langs = state.languages as Array<Record<string, unknown>>;
          if (Array.isArray(langs)) {
            state.languages = langs.map((l) => ({
              ...l,
              countryCode:
                l.countryCode ||
                LANG_TO_COUNTRY[l.code as string] ||
                (l.code as string),
            }));
          }

          // Patch platforms missing profileUrlTemplate
          const PLATFORM_URLS: Record<string, string> = {
            tiktok: "https://www.tiktok.com/@{username}",
            instagram: "https://www.instagram.com/{username}",
            youtube: "https://www.youtube.com/@{username}",
          };
          const platforms = state.platforms as Array<Record<string, unknown>>;
          if (Array.isArray(platforms)) {
            state.platforms = platforms.map((p) => ({
              ...p,
              profileUrlTemplate:
                p.profileUrlTemplate ||
                PLATFORM_URLS[p.name as string] ||
                "https://example.com/{username}",
            }));
          }
        }

        if (version < 2) {
          // v1 → v2: Add languageIds to regions
          const langs = state.languages as Array<Record<string, unknown>>;
          const allLangIds = Array.isArray(langs)
            ? langs.map((l) => l.id as string)
            : [];

          const regions = state.regions as Array<Record<string, unknown>>;
          if (Array.isArray(regions)) {
            state.regions = regions.map((r) => ({
              ...r,
              languageIds: r.languageIds || allLangIds,
            }));
          }
        }

        if (version < 3) {
          // v2 → v3: Reset accounts to fresh seed (removes dummy data)
          state.accounts = SEED_ACCOUNTS;
        }

        if (version < 7) {
          // v3-6 → v7: Reset to latest seed (brand logos, YouTube, all 22 accounts)
          state.accounts = SEED_ACCOUNTS;
          state.platforms = SEED_PLATFORMS;
        }

        return state as unknown as DashboardState;
      },
    }
  )
);
