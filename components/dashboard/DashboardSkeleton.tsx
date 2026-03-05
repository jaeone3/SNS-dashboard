"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { DashboardHeader } from "./DashboardHeader";

export const DashboardSkeleton = () => {
  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-[1400px] px-4 sm:px-8 py-6 sm:py-10">
        <DashboardHeader />

        {/* Region selector skeleton */}
        <div className="mt-4 sm:mt-6">
          <Skeleton className="mb-2 h-3 w-28" />
          <Skeleton className="h-9 w-[120px] rounded-md" />
        </div>

        {/* Language tabs + buttons skeleton */}
        <div className="mt-4 sm:mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Skeleton className="mb-2 h-3 w-24" />
            <div className="flex gap-2">
              {[80, 60, 70, 65].map((w, i) => (
                <Skeleton key={i} className="h-8 rounded-full" style={{ width: w }} />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-[90px] rounded-md" />
            <Skeleton className="h-9 w-[80px] rounded-md" />
          </div>
        </div>

        {/* Divider */}
        <hr className="mt-4 border-neutral-200" />

        {/* Table skeleton */}
        <div className="mt-4 space-y-0">
          {/* Header */}
          <div className="flex gap-4 border-b border-neutral-200 py-3 px-2">
            {[90, 80, 80, 100, 90, 80, 80, 60, 40].map((w, i) => (
              <Skeleton key={i} className="h-4 rounded" style={{ width: w }} />
            ))}
          </div>
          {/* Rows */}
          {Array.from({ length: 6 }).map((_, row) => (
            <div key={row} className="flex items-center gap-4 border-b border-neutral-100 py-4 px-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-4 w-20" />
              {Array.from({ length: 5 }).map((_, col) => (
                <Skeleton key={col} className="h-4 w-16" />
              ))}
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-5 w-5 rounded" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};
