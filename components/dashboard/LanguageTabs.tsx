"use client";

import { useDashboardStore } from "@/stores/dashboard-store";
import { CircleFlag } from "@/components/common/CircleFlag";
import { cn } from "@/lib/utils";

export const LanguageTabs = () => {
  const selectedRegion = useDashboardStore((s) => s.selectedRegion);
  const selectedLanguage = useDashboardStore((s) => s.selectedLanguage);
  const setLanguage = useDashboardStore((s) => s.setLanguage);
  const getLanguagesForRegion = useDashboardStore(
    (s) => s.getLanguagesForRegion
  );

  const sorted = getLanguagesForRegion(selectedRegion);

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-neutral-400">
        No languages assigned. Add from Manage.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {sorted.map((lang) => {
        const isActive = lang.code === selectedLanguage;
        return (
          <button
            key={lang.id}
            onClick={() => setLanguage(lang.code)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-black text-white"
                : "bg-neutral-200 text-neutral-500 hover:bg-neutral-300"
            )}
          >
            <CircleFlag countryCode={lang.countryCode} size={16} />
            {lang.code}
          </button>
        );
      })}
    </div>
  );
};
