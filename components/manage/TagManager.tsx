"use client";

import { useState } from "react";
import { useDashboardStore } from "@/stores/dashboard-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { TagBadge } from "@/components/common/TagBadge";
import { tagSchema } from "@/lib/validators";
import { Trash2, Plus } from "lucide-react";

const PRESET_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#6b7280",
];

export const TagManager = () => {
  const tags = useDashboardStore((s) => s.tags);
  const addTag = useDashboardStore((s) => s.addTag);
  const removeTag = useDashboardStore((s) => s.removeTag);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [label, setLabel] = useState("#");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [error, setError] = useState("");

  const resetForm = () => {
    setLabel("#");
    setColor(PRESET_COLORS[0]);
    setError("");
  };

  const handleAdd = () => {
    const result = tagSchema.safeParse({ label, color });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }

    if (tags.some((t) => t.label.toLowerCase() === label.toLowerCase())) {
      setError("This tag already exists.");
      return;
    }

    addTag({ label, color });
    resetForm();
    setDialogOpen(false);
  };

  const handleDeleteClick = (id: string) => {
    setDeleteId(id);
    setConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (deleteId) {
      removeTag(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-4">
      <Button
        size="sm"
        onClick={() => {
          resetForm();
          setDialogOpen(true);
        }}
        className="w-full"
      >
        <Plus size={16} className="mr-1" />
        Add Tag
      </Button>

      <div className="space-y-1">
        {tags.map((tag) => (
          <div
            key={tag.id}
            className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2"
          >
            <TagBadge label={tag.label} color={tag.color} />
            <button
              onClick={() => handleDeleteClick(tag.id)}
              className="text-neutral-400 hover:text-red-500"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      {/* Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Add Tag</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="#TagName"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />

            {/* Color presets */}
            <div>
              <p className="mb-1.5 text-xs text-neutral-500">Color</p>
              <div className="flex gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor: c === color ? "#000" : "transparent",
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Custom hex */}
            <Input
              placeholder="#hex color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="font-mono text-sm"
            />

            {/* Preview */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500">Preview:</span>
              <TagBadge label={label || "#Tag"} color={color} />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete Tag"
        description="This tag will be removed from all accounts and permanently deleted."
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
