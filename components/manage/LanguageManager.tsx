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
import { CircleFlag } from "@/components/common/CircleFlag";
import { languageSchema } from "@/lib/validators";
import { Trash2, Plus, Check } from "lucide-react";

export const LanguageManager = () => {
  const languages = useDashboardStore((s) => s.languages);
  const regions = useDashboardStore((s) => s.regions);
  const accounts = useDashboardStore((s) => s.accounts);
  const addLanguage = useDashboardStore((s) => s.addLanguage);
  const removeLanguage = useDashboardStore((s) => s.removeLanguage);
  const assignLanguageToRegion = useDashboardStore(
    (s) => s.assignLanguageToRegion
  );
  const unassignLanguageFromRegion = useDashboardStore(
    (s) => s.unassignLanguageFromRegion
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [error, setError] = useState("");

  const resetForm = () => {
    setCode("");
    setLabel("");
    setCountryCode("");
    setError("");
  };

  const handleAdd = async () => {
    const result = languageSchema.safeParse({ code, label });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }

    const upperCode = code.toUpperCase();
    if (languages.some((l) => l.code === upperCode)) {
      setError("This language code already exists.");
      return;
    }

    setSaving(true);
    try {
      await addLanguage({
        code: upperCode,
        label,
        countryCode: countryCode.toUpperCase() || upperCode,
        sortOrder: languages.length,
      });
      resetForm();
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add language");
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
        await removeLanguage(deleteId);
        setDeleteId(null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete language");
      }
    }
  };

  const handleToggleRegion = async (regionCode: string, languageId: string) => {
    const region = regions.find((r) => r.code === regionCode);
    if (!region) return;

    try {
      if (region.languageIds.includes(languageId)) {
        await unassignLanguageFromRegion(regionCode, languageId);
      } else {
        await assignLanguageToRegion(regionCode, languageId);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update region assignment");
    }
  };

  const deleteTarget = deleteId
    ? languages.find((l) => l.id === deleteId)
    : null;
  const affectedCount = deleteTarget
    ? accounts.filter((a) => a.languageCode === deleteTarget.code).length
    : 0;

  const sorted = [...languages].sort((a, b) => a.sortOrder - b.sortOrder);

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
        Add Target Language
      </Button>

      <div className="space-y-2">
        {sorted.map((lang) => (
          <div
            key={lang.id}
            className="rounded-md border border-neutral-200 px-3 py-2"
          >
            {/* Language header row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <CircleFlag countryCode={lang.countryCode} size={16} />
                <span className="font-mono font-semibold">{lang.code}</span>
                <span className="text-neutral-500">{lang.label}</span>
              </div>
              <button
                onClick={() => handleDeleteClick(lang.id)}
                className="rounded p-1 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 size={15} />
              </button>
            </div>

            {/* Region toggles */}
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {regions.map((region) => {
                const isAssigned = region.languageIds.includes(lang.id);
                return (
                  <button
                    key={region.code}
                    onClick={() => handleToggleRegion(region.code, lang.id)}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
                      isAssigned
                        ? "bg-black text-white"
                        : "bg-neutral-100 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600"
                    }`}
                  >
                    <CircleFlag countryCode={region.code} size={12} />
                    {region.code}
                    {isAssigned && <Check size={10} />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Add Target Language</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Code (e.g. FR)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={5}
            />
            <Input
              placeholder="Label (e.g. French)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <Input
              placeholder="Country code for flag (e.g. FR)"
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              maxLength={2}
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
        title="Delete Language"
        description={
          affectedCount > 0
            ? `${affectedCount} account(s) use this language and will be removed.`
            : "This language will be permanently removed."
        }
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
