"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDashboardStore } from "@/stores/dashboard-store";
import { PlatformIcon } from "@/components/common/PlatformIcon";
import { ListFilter, Check } from "lucide-react";

export const PlatformFilterDropdown = () => {
  const platforms = useDashboardStore((s) => s.platforms);
  const platformFilter = useDashboardStore((s) => s.platformFilter);
  const setPlatformFilter = useDashboardStore((s) => s.setPlatformFilter);

  const activePlatform = platformFilter
    ? platforms.find((p) => p.id === platformFilter)
    : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="inline-flex items-center gap-1.5 text-sm font-medium">
          Platform
          {activePlatform ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-900 px-2 py-0.5 text-[11px] font-semibold text-white">
              <PlatformIcon iconName={activePlatform.iconName} size={11} />
              {activePlatform.displayName}
            </span>
          ) : (
            <ListFilter size={14} className="text-neutral-400" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={() => setPlatformFilter(null)}>
          <span className="flex w-full items-center justify-between">
            All Platforms
            {platformFilter === null && <Check size={14} />}
          </span>
        </DropdownMenuItem>
        {platforms.map((platform) => (
          <DropdownMenuItem
            key={platform.id}
            onSelect={() => setPlatformFilter(platform.id)}
          >
            <span className="flex w-full items-center justify-between">
              <span className="flex items-center gap-2">
                <PlatformIcon iconName={platform.iconName} size={14} />
                {platform.displayName}
              </span>
              {platformFilter === platform.id && <Check size={14} />}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
