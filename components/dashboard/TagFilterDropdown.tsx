"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDashboardStore } from "@/stores/dashboard-store";
import { TagBadge } from "@/components/common/TagBadge";
import { ListFilter, Check } from "lucide-react";

export const TagFilterDropdown = () => {
  const tags = useDashboardStore((s) => s.tags);
  const tagFilter = useDashboardStore((s) => s.tagFilter);
  const setTagFilter = useDashboardStore((s) => s.setTagFilter);

  const activeTag = tagFilter ? tags.find((t) => t.id === tagFilter) : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="inline-flex items-center gap-1.5 text-sm font-medium">
          Tags
          {activeTag ? (
            <span
              className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold text-white"
              style={{ backgroundColor: activeTag.color }}
            >
              {activeTag.label}
            </span>
          ) : (
            <ListFilter size={14} className="text-neutral-400" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={() => setTagFilter(null)}>
          <span className="flex w-full items-center justify-between">
            All Tags
            {tagFilter === null && <Check size={14} />}
          </span>
        </DropdownMenuItem>
        {tags.map((tag) => (
          <DropdownMenuItem
            key={tag.id}
            onSelect={() => setTagFilter(tag.id)}
          >
            <span className="flex w-full items-center justify-between gap-4">
              <TagBadge label={tag.label} color={tag.color} />
              {tagFilter === tag.id && <Check size={14} />}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
