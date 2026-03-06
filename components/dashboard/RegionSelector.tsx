"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CircleFlag } from "@/components/common/CircleFlag";
import { useDashboardStore } from "@/stores/dashboard-store";

export const RegionSelector = () => {
  const regions = useDashboardStore((s) => s.regions);
  const selectedRegion = useDashboardStore((s) => s.selectedRegion);
  const setRegion = useDashboardStore((s) => s.setRegion);

  const selectedCountryCode =
    regions.find((r) => r.code === selectedRegion)?.countryCode ?? selectedRegion;

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide">콘텐츠</span>
    <Select value={selectedRegion} onValueChange={setRegion}>
      <SelectTrigger className="w-[160px] rounded-md border border-neutral-300 bg-white">
        <SelectValue>
          <span className="flex items-center gap-2">
            <CircleFlag countryCode={selectedCountryCode} size={18} />
            <span className="font-medium">
              {regions.find((r) => r.code === selectedRegion)?.name ?? selectedRegion}
            </span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {regions.map((region) => (
          <SelectItem key={region.code} value={region.code}>
            <span className="flex items-center gap-2">
              <CircleFlag countryCode={region.countryCode} size={18} />
              <span className="font-medium">{region.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    </div>
  );
};
