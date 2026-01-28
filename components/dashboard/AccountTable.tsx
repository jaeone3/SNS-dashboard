"use client";

import { useMemo } from "react";
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

interface AccountTableProps {
  refreshOne: (accountId: string) => Promise<void>;
  refreshingIds: Set<string>;
  shadowbanCheckingIds?: Set<string>;
}

export const AccountTable = ({
  refreshOne,
  refreshingIds,
  shadowbanCheckingIds = new Set(),
}: AccountTableProps) => {
  const allAccounts = useDashboardStore((s) => s.accounts);
  const selectedRegion = useDashboardStore((s) => s.selectedRegion);
  const selectedLanguage = useDashboardStore((s) => s.selectedLanguage);
  const platformFilter = useDashboardStore((s) => s.platformFilter);
  const tagFilter = useDashboardStore((s) => s.tagFilter);

  const accounts = useMemo(
    () =>
      allAccounts.filter((account) => {
        if (account.regionCode !== selectedRegion) return false;
        if (account.languageCode !== selectedLanguage) return false;
        if (platformFilter && account.platformId !== platformFilter)
          return false;
        if (tagFilter && !account.tagIds.includes(tagFilter)) return false;
        return true;
      }),
    [allAccounts, selectedRegion, selectedLanguage, platformFilter, tagFilter]
  );

  return (
    <div className="w-full overflow-x-auto">
      <Table className="w-full min-w-[900px]">
        <TableHeader>
          <TableRow className="border-t">
            <TableHead className="text-center">
              <PlatformFilterDropdown />
            </TableHead>
            <TableHead className="text-center">id</TableHead>
            <TableHead className="text-center">Followers</TableHead>
            <TableHead className="text-center">Latest Post Date</TableHead>
            <TableHead className="text-center">Latest Post View</TableHead>
            <TableHead className="text-center">Latest Post Like</TableHead>
            <TableHead className="text-center">Latest Post Save</TableHead>
            <TableHead className="text-center">
              <TagFilterDropdown />
            </TableHead>
            <TableHead className="w-[50px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map((account) => (
            <AccountTableRow
              key={account.id}
              account={account}
              onRefresh={refreshOne}
              isRefreshing={refreshingIds.has(account.id)}
              isShadowbanChecking={shadowbanCheckingIds.has(account.id)}
            />
          ))}
        </TableBody>
      </Table>

      {accounts.length === 0 && <EmptyState />}
    </div>
  );
};
