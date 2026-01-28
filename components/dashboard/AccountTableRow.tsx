"use client";

import { TableRow, TableCell } from "@/components/ui/table";
import { PlatformIcon } from "@/components/common/PlatformIcon";
import { TagBadge } from "@/components/common/TagBadge";
import { TagSelector } from "@/components/common/TagSelector";
import { InlineEditCell } from "./InlineEditCell";
import { useDashboardStore } from "@/stores/dashboard-store";
import { toast } from "@/stores/toast-store";
import { ExternalLink, RefreshCw, ShieldAlert } from "lucide-react";
import type { Account } from "@/types";

interface AccountTableRowProps {
  account: Account;
  onRefresh: (accountId: string) => Promise<void>;
  isRefreshing: boolean;
  isShadowbanChecking?: boolean;
}

export const AccountTableRow = ({
  account,
  onRefresh,
  isRefreshing,
  isShadowbanChecking = false,
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
            {account.username}
            <ExternalLink size={12} className="text-neutral-400" />
          </a>
        ) : (
          account.username
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
        />
      </TableCell>

      {/* Last Post Like */}
      <TableCell className="text-center">
        <InlineEditCell
          value={account.lastPostLike}
          onSave={(v) => handleSave("lastPostLike", v)}
          type="number"
          align="center"
        />
      </TableCell>

      {/* Last Post Save */}
      <TableCell className="text-center">
        <InlineEditCell
          value={account.lastPostSave}
          onSave={(v) => handleSave("lastPostSave", v)}
          type="number"
          align="center"
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

      {/* Refresh + Shadowban Check Indicator */}
      <TableCell className="text-center">
        <div className="inline-flex items-center gap-1">
          {isShadowbanChecking && (
            <span
              className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 ring-1 ring-amber-200"
              title="Shadowban re-check pending — will re-scrape in ~10 min"
            >
              <ShieldAlert size={11} className="animate-pulse" />
              Checking
            </span>
          )}
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
