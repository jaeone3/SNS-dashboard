"use client";

import { useState, useCallback } from "react";
import { useDashboardStore } from "@/stores/dashboard-store";
import { toast } from "@/stores/toast-store";
import type { ScrapeResult } from "@/app/api/scrape/route";

const SHADOWBAN_TAG_LABEL = "#Shadowban";

export function useRefreshAccounts() {
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());
  const accounts = useDashboardStore((s) => s.accounts);
  const platforms = useDashboardStore((s) => s.platforms);
  const tags = useDashboardStore((s) => s.tags);
  const updateAccount = useDashboardStore((s) => s.updateAccount);
  const assignTag = useDashboardStore((s) => s.assignTag);
  const unassignTag = useDashboardStore((s) => s.unassignTag);
  const getFilteredAccounts = useDashboardStore((s) => s.getFilteredAccounts);

  /** Scrape a single account and return the result (or null on failure). */
  const scrapeAccount = useCallback(
    async (accountId: string): Promise<ScrapeResult | null> => {
      const account = accounts.find((a) => a.id === accountId);
      if (!account) return null;
      const platform = platforms.find((p) => p.id === account.platformId);
      if (!platform) return null;

      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: platform.name,
          username: account.username,
        }),
      });
      if (!res.ok) return null;
      return res.json();
    },
    [accounts, platforms]
  );

  /** Apply non-null scrape fields to the store. */
  const applyScrapeResult = useCallback(
    async (accountId: string, data: ScrapeResult) => {
      const updates: Partial<Record<string, unknown>> = {};
      if (data.followers !== null) updates.followers = data.followers;
      if (data.lastPostDate !== null) updates.lastPostDate = data.lastPostDate;
      if (data.lastPostView !== null) updates.lastPostView = data.lastPostView;
      if (data.lastPostLike !== null) updates.lastPostLike = data.lastPostLike;
      if (data.lastPostSave !== null) updates.lastPostSave = data.lastPostSave;
      if (Object.keys(updates).length > 0) {
        await updateAccount(accountId, updates);
      }
    },
    [updateAccount]
  );

  const refreshOne = useCallback(
    async (accountId: string) => {
      const account = accounts.find((a) => a.id === accountId);
      if (!account) return;
      const platform = platforms.find((p) => p.id === account.platformId);
      if (!platform) return;

      setRefreshingIds((prev) => new Set(prev).add(accountId));
      try {
        const data = await scrapeAccount(accountId);
        if (data) {
          await applyScrapeResult(accountId, data);

          // Show feedback about what was fetched
          const fetched: string[] = [];
          const missed: string[] = [];
          if (data.followers !== null) fetched.push("followers");
          else missed.push("followers");
          if (data.lastPostDate !== null) fetched.push("date");
          else missed.push("date");
          if (data.lastPostView !== null) fetched.push("views");
          else missed.push("views");
          if (data.lastPostLike !== null) fetched.push("likes");
          else missed.push("likes");
          if (data.lastPostSave !== null) fetched.push("saves");
          else missed.push("saves");

          if (fetched.length > 0 && missed.length > 0) {
            toast.info(`${account.username}: fetched ${fetched.join(", ")} (${missed.join(", ")} unavailable)`);
          } else if (fetched.length === 0) {
            toast.error(`${account.username}: no data could be fetched`);
          }

          // Shadowban auto-tagging
          const shadowbanTag = tags.find((t) => t.label === SHADOWBAN_TAG_LABEL);
          if (shadowbanTag && data.lastPostDate !== null && data.lastPostView !== null) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split("T")[0];

            if (data.lastPostDate === yesterdayStr && data.lastPostView < 100) {
              // Assign shadowban tag
              if (!account.tagIds.includes(shadowbanTag.id)) {
                assignTag(accountId, shadowbanTag.id);
              }
            } else {
              // Remove shadowban tag if views recovered
              if (account.tagIds.includes(shadowbanTag.id)) {
                unassignTag(accountId, shadowbanTag.id);
              }
            }
          }
        } else {
          const acct = accounts.find((a) => a.id === accountId);
          toast.error(`Could not fetch data for ${acct?.username ?? "account"}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        const acct = accounts.find((a) => a.id === accountId);
        toast.error(`Failed to refresh ${acct?.username ?? "account"}: ${msg}`);
      } finally {
        setRefreshingIds((prev) => {
          const next = new Set(prev);
          next.delete(accountId);
          return next;
        });
      }
    },
    [accounts, platforms, scrapeAccount, applyScrapeResult, tags, assignTag, unassignTag]
  );

  const refreshAll = useCallback(async () => {
    const visible = getFilteredAccounts();

    const tiktokPlatformIds = new Set(
      platforms.filter((p) => p.name.toLowerCase() === "tiktok").map((p) => p.id)
    );

    const tiktokAccounts = visible.filter((a) => tiktokPlatformIds.has(a.platformId));
    const otherAccounts = visible.filter((a) => !tiktokPlatformIds.has(a.platformId));

    // Non-TikTok (YouTube, Facebook, etc.) run fully in parallel
    const otherPromise = Promise.allSettled(
      otherAccounts.map((a) => refreshOne(a.id))
    );

    // TikTok: server-side concurrency pool handles parallelism (3 slots).
    // Client sends all requests — the server queues them automatically.
    const tiktokPromise = Promise.allSettled(
      tiktokAccounts.map((a) => refreshOne(a.id))
    );

    await Promise.allSettled([otherPromise, tiktokPromise]);
  }, [getFilteredAccounts, refreshOne, platforms]);

  return {
    refreshOne,
    refreshAll,
    refreshingIds,
    isRefreshing: refreshingIds.size > 0,
  };
}
