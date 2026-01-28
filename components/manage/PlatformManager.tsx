"use client";

import { useState } from "react";
import { useDashboardStore } from "@/stores/dashboard-store";
import { toast } from "@/stores/toast-store";
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
import { PlatformIcon } from "@/components/common/PlatformIcon";
import { platformSchema } from "@/lib/validators";
import { Trash2, Plus } from "lucide-react";

export const PlatformManager = () => {
  const platforms = useDashboardStore((s) => s.platforms);
  const accounts = useDashboardStore((s) => s.accounts);
  const addPlatform = useDashboardStore((s) => s.addPlatform);
  const removePlatform = useDashboardStore((s) => s.removePlatform);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [iconName, setIconName] = useState("globe");
  const [profileUrl, setProfileUrl] = useState("https://example.com/{username}");
  const [error, setError] = useState("");

  const resetForm = () => {
    setName("");
    setDisplayName("");
    setIconName("globe");
    setProfileUrl("https://example.com/{username}");
    setError("");
  };

  const handleAdd = async () => {
    const lowerName = name.toLowerCase();
    const result = platformSchema.safeParse({
      name: lowerName,
      displayName,
      iconName,
    });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }

    if (platforms.some((p) => p.name === lowerName)) {
      setError("This platform already exists.");
      return;
    }

    setSaving(true);
    try {
      await addPlatform({
        name: lowerName,
        displayName,
        iconName,
        profileUrlTemplate: profileUrl,
      });
      resetForm();
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add platform");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeleteId(id);
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (deleteId) {
      try {
        await removePlatform(deleteId);
        setDeleteId(null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete platform");
      }
    }
  };

  const affectedCount = deleteId
    ? accounts.filter((a) => a.platformId === deleteId).length
    : 0;

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
        Add Platform
      </Button>

      <div className="space-y-1">
        {platforms.map((platform) => (
          <div
            key={platform.id}
            className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2"
          >
            <div className="flex items-center gap-2 text-sm">
              <PlatformIcon iconName={platform.iconName} size={16} />
              <span className="font-medium">{platform.displayName}</span>
              <span className="text-neutral-400">({platform.name})</span>
            </div>
            <button
              onClick={() => handleDeleteClick(platform.id)}
              className="rounded p-1 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-500"
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
            <DialogTitle>Add Platform</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Name (e.g. twitter)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              placeholder="Display Name (e.g. Twitter / X)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <Input
              placeholder="Icon name (e.g. twitter, music, globe)"
              value={iconName}
              onChange={(e) => setIconName(e.target.value)}
            />
            <Input
              placeholder="Profile URL (use {username})"
              value={profileUrl}
              onChange={(e) => setProfileUrl(e.target.value)}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
             <Button onClick={handleAdd} disabled={saving}>
               {saving ? "Saving..." : "Add"}
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete Platform"
        description={
          affectedCount > 0
            ? `${affectedCount} account(s) on this platform will be deleted.`
            : "This platform will be permanently removed."
        }
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
