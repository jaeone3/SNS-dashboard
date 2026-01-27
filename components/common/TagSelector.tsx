"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useDashboardStore } from "@/stores/dashboard-store";
import { TagBadge } from "./TagBadge";
import { Check } from "lucide-react";

interface TagSelectorProps {
  accountId: string;
  assignedTagIds: string[];
  children: React.ReactNode;
}

export const TagSelector = ({
  accountId,
  assignedTagIds,
  children,
}: TagSelectorProps) => {
  const tags = useDashboardStore((s) => s.tags);
  const assignTag = useDashboardStore((s) => s.assignTag);
  const unassignTag = useDashboardStore((s) => s.unassignTag);

  const handleToggle = (tagId: string) => {
    if (assignedTagIds.includes(tagId)) {
      unassignTag(accountId, tagId);
    } else {
      assignTag(accountId, tagId);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-[200px] p-2" align="start">
        <p className="mb-2 px-1 text-xs font-medium text-neutral-500">
          Assign Tags
        </p>
        {tags.length === 0 && (
          <p className="px-1 py-2 text-xs text-neutral-400">
            No tags available. Add from Manage.
          </p>
        )}
        {tags.map((tag) => {
          const isAssigned = assignedTagIds.includes(tag.id);
          return (
            <button
              key={tag.id}
              onClick={() => handleToggle(tag.id)}
              className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-neutral-100"
            >
              <TagBadge label={tag.label} color={tag.color} />
              {isAssigned && <Check size={14} className="text-black" />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
};
