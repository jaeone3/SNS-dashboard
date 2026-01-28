"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface InlineEditCellProps {
  value: number | string | null;
  onSave: (value: number | string | null) => void | Promise<void>;
  type: "number" | "date";
  align?: "left" | "right" | "center";
  placeholder?: string;
}

export const InlineEditCell = ({
  value,
  onSave,
  type,
  align = "left",
  placeholder = "-",
}: InlineEditCellProps) => {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startEdit = () => {
    if (saving) return;
    if (type === "number") {
      setDraft(value !== null && value !== undefined ? String(value) : "");
    } else {
      setDraft(value !== null && value !== undefined ? String(value) : "");
    }
    setEditing(true);
  };

  const commit = useCallback(async () => {
    setEditing(false);
    let newValue: number | string | null = null;

    if (type === "number") {
      const trimmed = draft.trim();
      if (trimmed === "") {
        newValue = null;
      } else {
        const parsed = Number(trimmed);
        if (isNaN(parsed)) return;
        newValue = parsed;
      }
    } else {
      const trimmed = draft.trim();
      newValue = trimmed === "" ? null : trimmed;
    }

    setSaving(true);
    try {
      await onSave(newValue);
    } finally {
      setSaving(false);
    }
  }, [draft, onSave, type]);

  const cancel = () => {
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      commit();
    } else if (e.key === "Escape") {
      cancel();
    }
  };

  // Display value
  const displayValue = (() => {
    if (value === null || value === undefined) return placeholder;
    if (type === "number" && typeof value === "number") {
      return value.toLocaleString("en-US");
    }
    return String(value);
  })();

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type === "number" ? "number" : "date"}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className={cn(
          "h-7 w-full rounded border border-neutral-300 bg-white px-2 text-sm outline-none",
          "focus:border-black focus:ring-1 focus:ring-black/20",
          align === "right" && "text-right",
          align === "center" && "text-center"
        )}
      />
    );
  }

  if (saving) {
    return (
      <span
        className={cn(
          "flex items-center justify-center py-0.5 text-sm text-neutral-400",
          align === "right" && "justify-end",
          align === "center" && "justify-center"
        )}
      >
        <Loader2 size={14} className="animate-spin" />
      </span>
    );
  }

  return (
    <span
      onClick={startEdit}
      className={cn(
        "block cursor-pointer rounded px-1 py-0.5 text-sm tabular-nums transition-colors hover:bg-neutral-100",
        align === "right" && "text-right",
        align === "center" && "text-center",
        displayValue === placeholder && "text-neutral-400"
      )}
    >
      {displayValue}
    </span>
  );
};
