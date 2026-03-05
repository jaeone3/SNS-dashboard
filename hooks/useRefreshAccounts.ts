"use client";

import { useState, useCallback } from "react";
import { useDashboardStore } from "@/stores/dashboard-store";
import { toast } from "@/stores/toast-store";
import type { ScrapeResult } from "@/app/api/scrape/route";
import type { BulkNotificationData, FailedAccountData } from "@/lib/slack-notifier";

const SHADOWBAN_TAG_LABEL = "#Shadowban";
const DELAY_BETWEEN_ACCOUNTS_MS = 5000; // 5초 딜레이
const TIKTOK_DELAY_MS = 8000; // TikTok Apify run 간 딜레이 (프록시 풀 + 메모리 회수 대기)
const RETRY_DELAY_MS = 30000; // 재시도 전 30초 대기

/** 딜레이 유틸리티 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
    async (accountId: string, isRetry = false): Promise<ScrapeResult | null> => {
      const account = accounts.find((a) => a.id === accountId);
      if (!account) return null;
      const platform = platforms.find((p) => p.id === account.platformId);
      if (!platform) return null;

      // Check for test mode
      const testMode = typeof window !== "undefined" ? localStorage.getItem("scrapeTestMode") : null;
      const simulateError = testMode ? testMode : undefined;

      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: platform.name,
          username: account.username,
          simulateError,
        }),
      });
      
      if (!res.ok) {
        // Handle HTTP error responses
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data: ScrapeResult = await res.json();

      // 주요 필드가 모두 null이면 재시도 (1회만)
      const hasNoData =
        data.followers === null &&
        data.lastPostView === null &&
        data.lastPostLike === null &&
        data.lastPostDate === null;

      if (hasNoData && !isRetry) {
        await delay(RETRY_DELAY_MS);
        return scrapeAccount(accountId, true);
      }

      return data;
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
    async (accountId: string): Promise<{ success: boolean; error?: string }> => {
      const account = accounts.find((a) => a.id === accountId);
      if (!account) return { success: false, error: "Account not found" };
      const platform = platforms.find((p) => p.id === account.platformId);
      if (!platform) return { success: false, error: "Platform not found" };

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
            const today = new Date();
            const todayStr = today.toISOString().split("T")[0];
            
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split("T")[0];

            let isBanned = false;
            
            // YouTube: Check both today and yesterday
            if (platform.name.toLowerCase() === "youtube") {
              isBanned = (data.lastPostDate === todayStr || data.lastPostDate === yesterdayStr) && data.lastPostView < 100;
            } else {
              // Other platforms: Only check yesterday
              isBanned = data.lastPostDate === yesterdayStr && data.lastPostView < 100;
            }

            if (isBanned) {
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
          const errorMsg = "Could not fetch data";
          toast.error(`${errorMsg} for ${acct?.username ?? "account"}`);
          return { success: false, error: errorMsg };
        }
        return { success: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        const acct = accounts.find((a) => a.id === accountId);
        
        toast.error(`Failed to refresh ${acct?.username ?? "account"}: ${msg}`);
        
        // Don't send individual error notification - will be sent in bulk
        return { success: false, error: msg };
      } finally {
        setRefreshingIds((prev) => {
          const next = new Set(prev);
          next.delete(accountId);
          return next;
        });
      }
    },
    [accounts, platforms, scrapeAccount, applyScrapeResult, tags, assignTag, unassignTag, toast]
  );

  const refreshAll = useCallback(async () => {
    console.log("[RefreshAll] Starting...");
    const visible = getFilteredAccounts();
    console.log(`[RefreshAll] Found ${visible.length} visible accounts`);

    // 플랫폼별로 그룹화
    const platformOrder = ["tiktok", "youtube", "instagram", "facebook"];
    const accountsByPlatform: Record<string, typeof visible> = {};

    // API 기반 플랫폼 (병렬 처리 가능)
    const parallelPlatforms = new Set(["tiktok", "youtube"]);

    for (const account of visible) {
      const platform = platforms.find((p) => p.id === account.platformId);
      if (!platform) continue;
      const platformName = platform.name.toLowerCase();
      if (!accountsByPlatform[platformName]) {
        accountsByPlatform[platformName] = [];
      }
      accountsByPlatform[platformName].push(account);
    }

    // Slack 알림용 데이터 수집
    const slackData: BulkNotificationData[] = [];
    const failedAccounts: FailedAccountData[] = [];
    console.log("[RefreshAll] Starting platform scraping loop...");

    // 플랫폼 순서대로 처리: TikTok → YouTube → Instagram → Facebook
    for (const platformName of platformOrder) {
      const platformAccounts = accountsByPlatform[platformName];
      if (!platformAccounts || platformAccounts.length === 0) continue;

      toast.info(`${platformName.toUpperCase()} 계정 ${platformAccounts.length}개 새로고침 시작...`);

      if (platformName === "tiktok") {
        // TikTok: Apify run 간 경합 방지를 위해 순차 처리 + 딜레이
        for (let i = 0; i < platformAccounts.length; i++) {
          const account = platformAccounts[i];
          const result = await refreshOne(account.id);

          if (!result.success) {
            const platform = platforms.find((p) => p.id === account.platformId);
            failedAccounts.push({
              platform: platform?.name || "Unknown",
              username: account.username,
              displayName: account.displayName,
              error: result.error || "Unknown error",
            });
          }

          if (i < platformAccounts.length - 1) {
            await delay(TIKTOK_DELAY_MS);
          }
        }
      } else if (parallelPlatforms.has(platformName)) {
        // YouTube: API 기반 → 전체 병렬 처리
        const results = await Promise.all(platformAccounts.map((account) => refreshOne(account.id)));
        // Track failures
        results.forEach((result, index) => {
          if (!result.success) {
            const account = platformAccounts[index];
            const platform = platforms.find((p) => p.id === account.platformId);
            failedAccounts.push({
              platform: platform?.name || "Unknown",
              username: account.username,
              displayName: account.displayName,
              error: result.error || "Unknown error",
            });
          }
        });
      } else {
        // Instagram, Facebook: Puppeteer 기반 → 순차 처리 + 딜레이
        for (let i = 0; i < platformAccounts.length; i++) {
          const account = platformAccounts[i];
          const result = await refreshOne(account.id);
          
          // Track failures
          if (!result.success) {
            const platform = platforms.find((p) => p.id === account.platformId);
            failedAccounts.push({
              platform: platform?.name || "Unknown",
              username: account.username,
              displayName: account.displayName,
              error: result.error || "Unknown error",
            });
          }

          if (i < platformAccounts.length - 1) {
            await delay(DELAY_BETWEEN_ACCOUNTS_MS);
          }
        }
      }

      toast.success(`${platformName.toUpperCase()} 완료`);

      console.log(`[RefreshAll] ${platformName} scraping done, collecting Slack data...`);
      // Slack 데이터 수집 (업데이트된 계정 정보)
      for (const account of platformAccounts) {
        // Get fresh data from store (not from closure)
        const freshAccounts = useDashboardStore.getState().accounts;
        const updatedAccount = freshAccounts.find((a) => a.id === account.id);
        if (!updatedAccount) continue;

        const platform = platforms.find((p) => p.id === updatedAccount.platformId);
        if (!platform) continue;

        // Shadow Ban 감지
        const shadowbanTag = tags.find((t) => t.label === SHADOWBAN_TAG_LABEL);
        let shadowBan: "OK" | "BANNED" | "UNKNOWN" = "UNKNOWN";
        
        if (shadowbanTag && updatedAccount.lastPostDate && updatedAccount.lastPostView !== null) {
          const today = new Date();
          const todayStr = today.toISOString().split("T")[0];
          
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split("T")[0];

          // YouTube: Check both today and yesterday
          if (platform.name.toLowerCase() === "youtube") {
            if ((updatedAccount.lastPostDate === todayStr || updatedAccount.lastPostDate === yesterdayStr) && updatedAccount.lastPostView < 100) {
              shadowBan = "BANNED";
            } else {
              shadowBan = "OK";
            }
          } else {
            // Other platforms: Only check yesterday
            if (updatedAccount.lastPostDate === yesterdayStr && updatedAccount.lastPostView < 100) {
              shadowBan = "BANNED";
            } else {
              shadowBan = "OK";
            }
          }
        }

        slackData.push({
          platform: platform.name,
          username: updatedAccount.username,
          displayName: updatedAccount.displayName,
          lastPostDate: updatedAccount.lastPostDate,
          lastPostView: updatedAccount.lastPostView,
          shadowBan,
        });
      }
      console.log(`[RefreshAll] After ${platformName}, slackData has ${slackData.length} items`);
    }

    console.log("[RefreshAll] All platforms done, preparing to send Slack notification...");

    // Slack 일괄 알림 전송 (via API)
    console.log(`[RefreshAll] Collected ${slackData.length} successful accounts for Slack notification`);
    console.log(`[RefreshAll] Collected ${failedAccounts.length} failed accounts`);
    
    if (slackData.length > 0 || failedAccounts.length > 0) {
      console.log(`[RefreshAll] Sending Slack notification for:`, slackData.map(d => d.username));
      
      // Call server API to send Slack notification
      fetch("/api/slack-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          accounts: slackData,
          failedAccounts: failedAccounts.length > 0 ? failedAccounts : undefined,
        }),
      })
        .then((res) => res.json())
        .then((result) => {
          if (result.success) {
            console.log(`[RefreshAll] Slack notification sent successfully for ${result.count} accounts`);
          } else {
            console.error("[RefreshAll] Slack notification failed:", result.error);
          }
        })
        .catch((err) => {
          console.error("[RefreshAll] Failed to send Slack notification:", err);
        });
    } else {
      console.warn("[RefreshAll] No data collected for Slack notification");
    }
  }, [getFilteredAccounts, refreshOne, platforms, accounts, tags, toast]);

  return {
    refreshOne,
    refreshAll,
    refreshingIds,
    isRefreshing: refreshingIds.size > 0,
  };
}
