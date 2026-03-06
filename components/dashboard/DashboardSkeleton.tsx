"use client";

import { Skeleton } from "@/components/ui/skeleton";

export const DashboardSkeleton = () => {
  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-[1400px] px-4 sm:px-8 py-6 sm:py-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-5 w-16" />
        </div>

        {/* Stats bar */}
        <div className="mt-5 flex flex-wrap gap-2">
          {[80, 80, 80, 80, 80, 80].map((w, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" style={{ width: w }} />
          ))}
        </div>

        {/* Filters */}
        <div className="mt-5 flex flex-wrap items-end gap-6">
          <div>
            <Skeleton className="mb-2 h-3 w-28" />
            <Skeleton className="h-9 w-[160px] rounded-md" />
          </div>
          <div>
            <Skeleton className="mb-2 h-3 w-24" />
            <div className="flex gap-2">
              {[90, 80, 70].map((w, i) => (
                <Skeleton key={i} className="h-8 rounded-full" style={{ width: w }} />
              ))}
            </div>
          </div>
        </div>

        <hr className="mt-4 border-neutral-200" />

        {/* Table */}
        <div className="mt-4 rounded-lg border border-neutral-200 overflow-hidden">
          <div className="bg-neutral-50 px-3 py-2 flex gap-2">
            {Array.from({ length: 11 }).map((_, i) => (
              <Skeleton key={i} className="h-4 flex-1 rounded" />
            ))}
          </div>
          {Array.from({ length: 5 }).map((_, row) => (
            <div key={row} className="flex items-center gap-2 border-t border-neutral-100 px-3 py-3">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-5 w-10" />
              {Array.from({ length: 9 }).map((_, col) => (
                <Skeleton key={col} className="h-5 flex-1 rounded" />
              ))}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};
