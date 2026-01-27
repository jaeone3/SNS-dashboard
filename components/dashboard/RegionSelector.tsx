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

  return (
    <Select value={selectedRegion} onValueChange={setRegion}>
      <SelectTrigger className="w-[120px] rounded-md border border-neutral-300 bg-white">
        <SelectValue>
          <span className="flex items-center gap-2">
            <CircleFlag countryCode={selectedRegion} size={18} />
            <span className="font-medium">{selectedRegion}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {regions.map((region) => (
          <SelectItem key={region.code} value={region.code}>
            <span className="flex items-center gap-2">
              <CircleFlag countryCode={region.code} size={18} />
              <span className="font-medium">{region.code}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
