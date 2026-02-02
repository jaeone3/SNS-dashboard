"use client";

import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AccountTableRow } from "./AccountTableRow";
import { PlatformFilterDropdown } from "./PlatformFilterDropdown";
import { TagFilterDropdown } from "./TagFilterDropdown";
import { EmptyState } from "@/components/common/EmptyState";
import { useDashboardStore } from "@/stores/dashboard-store";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

interface AccountTableProps {
  refreshOne: (accountId: string) => Promise<void>;
  refreshingIds: Set<string>;
}

type SortField = "followers" | "lastPostView" | null;
type SortDirection = "asc" | "desc";

export const AccountTable = ({
  refreshOne,
  refreshingIds,
}: AccountTableProps) => {
  const allAccounts = useDashboardStore((s) => s.accounts);
  const platforms = useDashboardStore((s) => s.platforms);
  const selectedRegion = useDashboardStore((s) => s.selectedRegion);
  const selectedLanguage = useDashboardStore((s) => s.selectedLanguage);
  const platformFilter = useDashboardStore((s) => s.platformFilter);
  const tagFilter = useDashboardStore((s) => s.tagFilter);

  const [sortBy, setSortBy] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      // Toggle direction if clicking same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Default to descending when clicking new field
      setSortBy(field);
      setSortDirection("desc");
    }
  };

  const accounts = useMemo(
    () => {
      // Platform sort order: TikTok -> Instagram -> YouTube -> Facebook
      const platformOrder = ["tiktok", "instagram", "youtube", "facebook"];

      return allAccounts
        .filter((account) => {
          if (account.regionCode !== selectedRegion) return false;
          if (account.languageCode !== selectedLanguage) return false;
          if (platformFilter && account.platformId !== platformFilter)
            return false;
          if (tagFilter && !account.tagIds.includes(tagFilter)) return false;
          return true;
        })
        .sort((a, b) => {
          // First, sort by platform
          const platformA = platforms.find((p) => p.id === a.platformId);
          const platformB = platforms.find((p) => p.id === b.platformId);

          const orderA = platformA ? platformOrder.indexOf(platformA.name) : 999;
          const orderB = platformB ? platformOrder.indexOf(platformB.name) : 999;

          if (orderA !== orderB) {
            return orderA - orderB;
          }

          // Then, sort by selected field if any
          if (sortBy) {
            const valueA = a[sortBy] ?? -1;
            const valueB = b[sortBy] ?? -1;

            if (valueA === valueB) return 0;

            if (sortDirection === "asc") {
              return valueA > valueB ? 1 : -1;
            } else {
              return valueA < valueB ? 1 : -1;
            }
          }

          return 0;
        });
    },
    [allAccounts, platforms, selectedRegion, selectedLanguage, platformFilter, tagFilter, sortBy, sortDirection]
  );

  const SortButton = ({ field, label }: { field: SortField; label: string }) => {
    const isActive = sortBy === field;
    const Icon = !isActive
      ? ArrowUpDown
      : sortDirection === "asc"
        ? ArrowUp
        : ArrowDown;

    return (
      <button
        onClick={() => handleSort(field)}
        className="flex items-center justify-center gap-1 w-full hover:text-blue-600 transition-colors"
      >
        <span>{label}</span>
        <Icon className={`h-4 w-4 ${isActive ? "text-blue-600" : "text-gray-400"}`} />
      </button>
    );
  };

  return (
    <div className="w-full">
      <div className="w-full overflow-x-auto overflow-y-auto h-[calc(100vh-320px)] min-h-[500px] max-h-[800px]">
        <Table className="w-full min-w-[900px]">
          <TableHeader className="sticky top-0 bg-white z-10">
            <TableRow className="border-t">
              <TableHead className="text-center bg-white">
                <PlatformFilterDropdown />
              </TableHead>
              <TableHead className="text-center bg-white">id</TableHead>
              <TableHead className="text-center bg-white">
                <SortButton field="followers" label="Followers" />
              </TableHead>
              <TableHead className="text-center bg-white">Latest Post Date</TableHead>
              <TableHead className="text-center bg-white">
                <SortButton field="lastPostView" label="Latest Post View" />
              </TableHead>
              <TableHead className="text-center bg-white">
                <TagFilterDropdown />
              </TableHead>
              <TableHead className="w-[50px] bg-white" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((account) => (
              <AccountTableRow
                key={account.id}
                account={account}
                onRefresh={refreshOne}
                isRefreshing={refreshingIds.has(account.id)}
              />
            ))}
          </TableBody>
        </Table>

        {accounts.length === 0 && <EmptyState />}
      </div>
    </div>
  );
};
