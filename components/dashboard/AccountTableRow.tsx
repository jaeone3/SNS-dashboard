"use client";

import { TableRow, TableCell } from "@/components/ui/table";
import { PlatformIcon } from "@/components/common/PlatformIcon";
import { TagBadge } from "@/components/common/TagBadge";
import { TagSelector } from "@/components/common/TagSelector";
import { InlineEditCell } from "./InlineEditCell";
import { useDashboardStore } from "@/stores/dashboard-store";
import { toast } from "@/stores/toast-store";
import { ExternalLink, RefreshCw } from "lucide-react";
import type { Account } from "@/types";

interface AccountTableRowProps {
  account: Account;
  onRefresh: (accountId: string) => Promise<void>;
  isRefreshing: boolean;
}

export const AccountTableRow = ({
  account,
  onRefresh,
  isRefreshing,
}: AccountTableRowProps) => {
  const platforms = useDashboardStore((s) => s.platforms);
  const tags = useDashboardStore((s) => s.tags);
  const updateAccount = useDashboardStore((s) => s.updateAccount);

  const platform = platforms.find((p) => p.id === account.platformId);
  const accountTags = tags.filter((t) => account.tagIds.includes(t.id));

  const profileUrl = platform
    ? platform.profileUrlTemplate.replace("{username}", account.username)
    : null;

  // Subtle platform brand color for row background
  const platformBg: Record<string, string> = {
    tiktok: "rgba(0,0,0,0.03)",
    instagram: "rgba(193,53,132,0.07)", // Instagram gradient purple-pink
    youtube: "rgba(255,0,0,0.04)",
    facebook: "rgba(24,119,242,0.05)",
  };
  const rowBg = platform ? platformBg[platform.name] ?? undefined : undefined;

  // Shadowban detection: yesterday's post with <100 views
  const isShadowbanView = (() => {
    if (account.lastPostDate === null || account.lastPostView === null) return false;
    if (account.lastPostView >= 100) return false;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];
    return account.lastPostDate === yesterdayStr;
  })();

  const handleSave = async (field: keyof Account, value: number | string | null) => {
    try {
      await updateAccount(account.id, { [field]: value });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update account");
    }
  };

  return (
    <TableRow
      className="transition-colors hover:bg-neutral-50"
      style={rowBg ? { backgroundColor: rowBg } : undefined}
    >
      {/* Platform */}
      <TableCell className="text-center">
        <div className="inline-flex items-center gap-2">
          {platform && (
            <>
              <PlatformIcon iconName={platform.iconName} size={18} />
              <span className="text-sm font-medium">
                {platform.displayName}
              </span>
            </>
          )}
        </div>
      </TableCell>

      {/* ID */}
      <TableCell className="text-center text-sm">
        {profileUrl ? (
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-black underline decoration-neutral-300 underline-offset-2 hover:decoration-black"
          >
            {account.displayName || account.username}
            <ExternalLink size={12} className="text-neutral-400" />
          </a>
        ) : (
          account.displayName || account.username
        )}
      </TableCell>

      {/* Followers */}
      <TableCell className="text-center">
        <InlineEditCell
          value={account.followers}
          onSave={(v) => handleSave("followers", v)}
          type="number"
          align="center"
        />
      </TableCell>

      {/* Last Post Date */}
      <TableCell className="text-center">
        <InlineEditCell
          value={account.lastPostDate}
          onSave={(v) => handleSave("lastPostDate", v)}
          type="date"
          align="center"
        />
      </TableCell>

      {/* Last Post View */}
      <TableCell className="text-center">
        <InlineEditCell
          value={account.lastPostView}
          onSave={(v) => handleSave("lastPostView", v)}
          type="number"
          align="center"
          className={isShadowbanView ? "text-red-500 font-semibold" : undefined}
        />
      </TableCell>

      {/* Tags — clickable for tag assignment */}
      <TableCell className="text-center whitespace-normal">
        <TagSelector accountId={account.id} assignedTagIds={account.tagIds}>
          <button className="inline-flex min-h-[28px] cursor-pointer flex-wrap justify-center gap-1 rounded px-1 py-0.5 hover:bg-neutral-100">
            {accountTags.length > 0 ? (
              accountTags.map((tag) => (
                <TagBadge key={tag.id} label={tag.label} color={tag.color} />
              ))
            ) : (
              <span className="text-sm text-neutral-400">-</span>
            )}
          </button>
        </TagSelector>
      </TableCell>

      {/* Refresh */}
      <TableCell className="text-center">
        <div className="inline-flex items-center gap-1">
          <button
            onClick={() => onRefresh(account.id)}
            disabled={isRefreshing}
            className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-black disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh account data"
          >
            <RefreshCw
              size={14}
              className={isRefreshing ? "animate-spin" : ""}
            />
          </button>
        </div>
      </TableCell>
    </TableRow>
  );
};
