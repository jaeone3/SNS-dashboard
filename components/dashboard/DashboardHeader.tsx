"use client";

import { useState, useEffect } from "react";
import { useDashboardStore } from "@/stores/dashboard-store";
import { RefreshCw } from "lucide-react";

function RelativeTime({ date }: { date: Date }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 5) return <span>방금</span>;
  if (diff < 60) return <span>{diff}초 전</span>;
  if (diff < 3600) return <span>{Math.floor(diff / 60)}분 전</span>;
  return <span>{Math.floor(diff / 3600)}시간 전</span>;
}

export const DashboardHeader = () => {
  const lastUpdated = useDashboardStore((s) => s.lastUpdated);
  const fetchAll = useDashboardStore((s) => s.fetchAll);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  return (
    <div className="flex items-center gap-2 text-neutral-400">
      <div className="flex items-center gap-2 text-neutral-400">
        {lastUpdated && (
          <span className="text-[11px]">
            <RelativeTime date={lastUpdated} />
          </span>
        )}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="rounded-md p-1.5 hover:bg-neutral-100 transition-colors disabled:opacity-50"
          title="새로고침"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
        </button>
      </div>
    </div>
  );
};
