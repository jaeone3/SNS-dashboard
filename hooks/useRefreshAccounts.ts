"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useDashboardStore } from "@/stores/dashboard-store";
import { toast } from "@/stores/toast-store";
import type { ScrapeResult } from "@/app/api/scrape/route";

const SHADOWBAN_TAG_LABEL = "#Shadowban";
const SHADOWBAN_RECHECK_DELAY = 10 * 60 * 1000; // 10 minutes

export function useRefreshAccounts() {
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());
  const [shadowbanCheckingIds, setShadowbanCheckingIds] = useState<Set<string>>(
    new Set()
  );
  const accounts = useDashboardStore((s) => s.accounts);
  const platforms = useDashboardStore((s) => s.platforms);
  const tags = useDashboardStore((s) => s.tags);
  const updateAccount = useDashboardStore((s) => s.updateAccount);
  const assignTag = useDashboardStore((s) => s.assignTag);
  const getFilteredAccounts = useDashboardStore((s) => s.getFilteredAccounts);

  // Track pending shadowban re-check timeouts for cleanup
  const shadowbanTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      shadowbanTimers.current.forEach((timer) => clearTimeout(timer));
      shadowbanTimers.current.clear();
    };
  }, []);

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
    (accountId: string, data: ScrapeResult) => {
      const updates: Partial<Record<string, unknown>> = {};
      if (data.followers !== null) updates.followers = data.followers;
      if (data.lastPostDate !== null) updates.lastPostDate = data.lastPostDate;
      if (data.lastPostView !== null) updates.lastPostView = data.lastPostView;
      if (data.lastPostLike !== null) updates.lastPostLike = data.lastPostLike;
      if (data.lastPostSave !== null) updates.lastPostSave = data.lastPostSave;
      if (Object.keys(updates).length > 0) {
        updateAccount(accountId, updates);
      }
    },
    [updateAccount]
  );

  /** Schedule a shadowban re-check for an account after the delay. */
  const scheduleShadowbanCheck = useCallback(
    (accountId: string) => {
      // Clear any existing timer for this account
      const existing = shadowbanTimers.current.get(accountId);
      if (existing) clearTimeout(existing);

      setShadowbanCheckingIds((prev) => new Set(prev).add(accountId));

      const timer = setTimeout(async () => {
        shadowbanTimers.current.delete(accountId);

        // Re-scrape
        setRefreshingIds((prev) => new Set(prev).add(accountId));
        try {
          const data = await scrapeAccount(accountId);
          if (data) {
            applyScrapeResult(accountId, data);
            // If lastPostView is still exactly 0, assign shadowban tag
            if (data.lastPostView === 0) {
              const shadowbanTag = tags.find((t) => t.label === SHADOWBAN_TAG_LABEL);
              if (shadowbanTag) {
                assignTag(accountId, shadowbanTag.id);
              }
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          toast.error(`Shadowban re-check failed: ${msg}`);
        } finally {
          setRefreshingIds((prev) => {
            const next = new Set(prev);
            next.delete(accountId);
            return next;
          });
          setShadowbanCheckingIds((prev) => {
            const next = new Set(prev);
            next.delete(accountId);
            return next;
          });
        }
      }, SHADOWBAN_RECHECK_DELAY);

      shadowbanTimers.current.set(accountId, timer);
    },
    [scrapeAccount, applyScrapeResult, assignTag, tags]
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
          applyScrapeResult(accountId, data);

          // Shadowban detection: if lastPostView is exactly 0, schedule re-check
          if (data.lastPostView === 0) {
            scheduleShadowbanCheck(accountId);
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
    [accounts, platforms, scrapeAccount, applyScrapeResult, scheduleShadowbanCheck]
  );

  const refreshAll = useCallback(async () => {
    const visible = getFilteredAccounts();

    // Split by platform: TikTok needs sequential with delay to avoid bot detection
    const tiktokPlatform = platforms.find(
      (p) => p.name.toLowerCase() === "tiktok"
    );
    const tiktokAccounts = tiktokPlatform
      ? visible.filter((a) => a.platformId === tiktokPlatform.id)
      : [];
    const otherAccounts = tiktokPlatform
      ? visible.filter((a) => a.platformId !== tiktokPlatform.id)
      : visible;

    // Others run in parallel
    const othersPromise = Promise.allSettled(
      otherAccounts.map((a) => refreshOne(a.id))
    );

    // TikTok runs sequentially with 3-5s random delay between each
    const tiktokPromise = (async () => {
      for (let i = 0; i < tiktokAccounts.length; i++) {
        await refreshOne(tiktokAccounts[i].id);
        if (i < tiktokAccounts.length - 1) {
          const delay = 3000 + Math.random() * 2000; // 3-5 seconds
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    })();

    await Promise.allSettled([othersPromise, tiktokPromise]);
  }, [getFilteredAccounts, refreshOne, platforms]);

  return {
    refreshOne,
    refreshAll,
    refreshingIds,
    isRefreshing: refreshingIds.size > 0,
    shadowbanCheckingIds,
  };
}
