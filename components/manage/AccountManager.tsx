"use client";

import { useState, useCallback } from "react";
import { useDashboardStore } from "@/stores/dashboard-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { PlatformIcon } from "@/components/common/PlatformIcon";
import { CircleFlag } from "@/components/common/CircleFlag";
import { accountSchema } from "@/lib/validators";
import { parseSNSLink, looksLikeURL } from "@/lib/utils";
import type { ScrapeResult } from "@/app/api/scrape/route";
import { Trash2, Plus, Link, CheckCircle2, Loader2 } from "lucide-react";

export const AccountManager = () => {
  const accounts = useDashboardStore((s) => s.accounts);
  const platforms = useDashboardStore((s) => s.platforms);
  const regions = useDashboardStore((s) => s.regions);
  const selectedRegion = useDashboardStore((s) => s.selectedRegion);
  const selectedLanguage = useDashboardStore((s) => s.selectedLanguage);
  const addAccount = useDashboardStore((s) => s.addAccount);
  const removeAccount = useDashboardStore((s) => s.removeAccount);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [linkInput, setLinkInput] = useState("");
  const [platformId, setPlatformId] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [linkParsed, setLinkParsed] = useState(false);

  // Scraping state
  const [scraping, setScraping] = useState(false);
  const [scraped, setScraped] = useState<ScrapeResult | null>(null);

  const currentRegion = regions.find((r) => r.code === selectedRegion);

  const resetForm = () => {
    setLinkInput("");
    setPlatformId("");
    setUsername("");
    setError("");
    setLinkParsed(false);
    setScraping(false);
    setScraped(null);
  };

  // Scrape profile data from API
  const scrapeProfile = useCallback(
    async (platformName: string, user: string) => {
      setScraping(true);
      setScraped(null);
      try {
        const res = await fetch("/api/scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform: platformName, username: user }),
        });
        if (res.ok) {
          const data: ScrapeResult = await res.json();
          setScraped(data);
        }
      } catch {
        // scraping is best-effort, don't block the flow
      } finally {
        setScraping(false);
      }
    },
    []
  );

  // Auto-parse SNS link
  const handleLinkChange = useCallback(
    (value: string) => {
      setLinkInput(value);
      setError("");
      setLinkParsed(false);
      setScraped(null);

      if (!value.trim()) return;

      if (!looksLikeURL(value)) return;

      const parsed = parseSNSLink(value);
      if (parsed) {
        const matchedPlatform = platforms.find(
          (p) => p.name === parsed.platformName
        );
        if (matchedPlatform) {
          setPlatformId(matchedPlatform.id);
          setUsername(parsed.username);
          setLinkParsed(true);
          // Auto-scrape
          scrapeProfile(parsed.platformName, parsed.username);
        } else {
          setError(
            `Platform "${parsed.platformName}" is not registered. Add it in Platforms tab first.`
          );
        }
      } else {
        setError("Could not recognize this SNS link.");
      }
    },
    [platforms, scrapeProfile]
  );

  const handleAdd = () => {
    const regionCode = selectedRegion;
    const languageCode = selectedLanguage;

    const result = accountSchema.safeParse({
      platformId,
      username,
      regionCode,
      languageCode,
    });

    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }

    const exists = accounts.some(
      (a) => a.platformId === platformId && a.username === username
    );
    if (exists) {
      setError("This account already exists.");
      return;
    }

    // Use scraped data if available
    addAccount({
      platformId,
      username,
      regionCode,
      languageCode,
      followers: scraped?.followers ?? null,
      lastPostDate: scraped?.lastPostDate ?? null,
      lastPostView: scraped?.lastPostView ?? null,
      lastPostLike: scraped?.lastPostLike ?? null,
      lastPostSave: scraped?.lastPostSave ?? null,
      tagIds: [],
    });

    resetForm();
    setDialogOpen(false);
  };

  const handleDeleteClick = (id: string) => {
    setDeleteId(id);
    setConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (deleteId) {
      removeAccount(deleteId);
      setDeleteId(null);
    }
  };

  const resolvedPlatform = platformId
    ? platforms.find((p) => p.id === platformId)
    : null;

  // Format number for display
  const fmt = (n: number | null) =>
    n !== null ? n.toLocaleString("en-US") : "-";

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
        Add Account
      </Button>

      {/* Account list */}
      <div className="space-y-1">
        {accounts.length === 0 && (
          <p className="py-4 text-center text-sm text-neutral-400">
            No accounts registered.
          </p>
        )}
        {accounts.map((account) => {
          const platform = platforms.find((p) => p.id === account.platformId);
          return (
            <div
              key={account.id}
              className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2"
            >
              <div className="flex items-center gap-2 text-sm">
                {platform && (
                  <PlatformIcon iconName={platform.iconName} size={16} />
                )}
                <span className="font-medium">{account.username}</span>
                <CircleFlag countryCode={account.regionCode} size={14} />
                <span className="text-neutral-400">
                  {account.regionCode} / {account.languageCode}
                </span>
              </div>
              <button
                onClick={() => handleDeleteClick(account.id)}
                className="text-neutral-400 hover:text-red-500"
              >
                <Trash2 size={15} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Add Account</DialogTitle>
            <DialogDescription>
              Account will be added to{" "}
              <span className="inline-flex items-center gap-1 font-semibold text-neutral-700">
                {currentRegion && (
                  <CircleFlag countryCode={currentRegion.code} size={14} />
                )}
                {selectedRegion}
              </span>
              {" / "}
              <span className="font-semibold text-neutral-700">
                {selectedLanguage}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* SNS Link input */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-500">
                Paste SNS profile link
              </label>
              <div className="relative">
                <Link
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                />
                <Input
                  placeholder="https://www.tiktok.com/@username"
                  value={linkInput}
                  onChange={(e) => handleLinkChange(e.target.value)}
                  className="pl-8"
                />
                {scraping && (
                  <Loader2
                    size={16}
                    className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-neutral-400"
                  />
                )}
                {!scraping && linkParsed && (
                  <CheckCircle2
                    size={16}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500"
                  />
                )}
              </div>

              {/* Parsed platform info */}
              {linkParsed && resolvedPlatform && (
                <p className="flex items-center gap-1.5 text-xs text-green-600">
                  <PlatformIcon
                    iconName={resolvedPlatform.iconName}
                    size={12}
                  />
                  {resolvedPlatform.displayName} / @{username}
                </p>
              )}

              {/* Scraped data preview */}
              {scraped && (
                <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-green-700">
                    Fetched Data
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-green-800">
                    <span>Followers</span>
                    <span className="font-mono font-medium">
                      {fmt(scraped.followers)}
                    </span>
                    <span>Last Post Date</span>
                    <span className="font-mono font-medium">
                      {scraped.lastPostDate ?? "-"}
                    </span>
                    <span>Views</span>
                    <span className="font-mono font-medium">
                      {fmt(scraped.lastPostView)}
                    </span>
                    <span>Likes</span>
                    <span className="font-mono font-medium">
                      {fmt(scraped.lastPostLike)}
                    </span>
                    <span>Saves</span>
                    <span className="font-mono font-medium">
                      {fmt(scraped.lastPostSave)}
                    </span>
                  </div>
                </div>
              )}

              {scraping && (
                <p className="text-xs text-neutral-400">
                  Fetching profile data...
                </p>
              )}
            </div>

            <div className="relative flex items-center">
              <div className="flex-grow border-t border-neutral-200" />
              <span className="mx-3 shrink-0 text-xs text-neutral-400">
                or enter manually
              </span>
              <div className="flex-grow border-t border-neutral-200" />
            </div>

            {/* Manual platform + username */}
            <Select
              value={platformId}
              onValueChange={(v) => {
                setPlatformId(v);
                setLinkParsed(false);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent>
                {platforms.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      <PlatformIcon iconName={p.iconName} size={14} />
                      {p.displayName}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Username (without @)"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setLinkParsed(false);
              }}
            />

            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={scraping}>
              {scraping ? "Fetching..." : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete Account"
        description="This account and all its data will be permanently removed."
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
