"use client";

import { useState, useEffect } from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { RegionSelector } from "@/components/dashboard/RegionSelector";
import { LanguageTabs } from "@/components/dashboard/LanguageTabs";
import { AccountTable } from "@/components/dashboard/AccountTable";
import { ManageSheet } from "@/components/manage/ManageSheet";
import { useRefreshAccounts } from "@/hooks/useRefreshAccounts";
import { useDashboardStore } from "@/stores/dashboard-store";
import { RefreshCw, Loader2 } from "lucide-react";

export default function Home() {
  const [manageOpen, setManageOpen] = useState(false);
  const { refreshOne, refreshAll, refreshingIds, isRefreshing, shadowbanCheckingIds } =
    useRefreshAccounts();
  const isLoading = useDashboardStore((s) => s.isLoading);
  const fetchAll = useDashboardStore((s) => s.fetchAll);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <main className="mx-auto max-w-[1400px] px-8 py-10">
          <DashboardHeader />
          <div className="mt-20 flex flex-col items-center justify-center gap-3 text-neutral-400">
            <Loader2 size={24} className="animate-spin" />
            <p className="text-sm">Loading data…</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-[1400px] px-8 py-10">
        {/* Title */}
        <DashboardHeader />

        {/* Learning Language Selector */}
        <div className="mt-6">
          <label className="mb-2 block text-[11px] font-semibold tracking-[0.15em] text-neutral-400 uppercase">
            Learning Language
          </label>
          <RegionSelector />
        </div>

        {/* Target Language Tabs + Buttons */}
        <div className="mt-6 flex items-center justify-between">
          <div>
            <label className="mb-2 block text-[11px] font-semibold tracking-[0.15em] text-neutral-400 uppercase">
              Target Language
            </label>
            <LanguageTabs />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refreshAll}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 rounded-md border border-black px-4 py-1.5 text-sm font-medium transition-colors hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw
                size={14}
                className={isRefreshing ? "animate-spin" : ""}
              />
              {isRefreshing ? "Updating…" : "Update"}
            </button>
            <button
              onClick={() => setManageOpen(true)}
              className="rounded-md border border-black px-5 py-1.5 text-sm font-medium transition-colors hover:bg-neutral-50"
            >
              Manage
            </button>
          </div>
        </div>

        {/* Divider */}
        <hr className="mt-4 border-neutral-200" />

        {/* Account Table */}
        <div className="mt-0">
          <AccountTable
            refreshOne={refreshOne}
            refreshingIds={refreshingIds}
            shadowbanCheckingIds={shadowbanCheckingIds}
          />
        </div>
      </main>

      {/* Manage Sheet */}
      <ManageSheet open={manageOpen} onOpenChange={setManageOpen} />
    </div>
  );
}
