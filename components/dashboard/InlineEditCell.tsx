"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface InlineEditCellProps {
  value: number | string | null;
  onSave: (value: number | string | null) => void;
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
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startEdit = () => {
    if (type === "number") {
      setDraft(value !== null && value !== undefined ? String(value) : "");
    } else {
      setDraft(value !== null && value !== undefined ? String(value) : "");
    }
    setEditing(true);
  };

  const commit = useCallback(() => {
    setEditing(false);
    if (type === "number") {
      const trimmed = draft.trim();
      if (trimmed === "") {
        onSave(null);
      } else {
        const parsed = Number(trimmed);
        if (!isNaN(parsed)) {
          onSave(parsed);
        }
      }
    } else {
      // date
      const trimmed = draft.trim();
      onSave(trimmed === "" ? null : trimmed);
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
          "h-7 w-full rounded border border-neutral-300 bg-white px-2 text-sm outline-none focus:border-black",
          align === "right" && "text-right",
          align === "center" && "text-center"
        )}
      />
    );
  }

  return (
    <span
      onClick={startEdit}
      className={cn(
        "block cursor-pointer rounded px-1 py-0.5 text-sm tabular-nums hover:bg-neutral-100",
        align === "right" && "text-right",
        align === "center" && "text-center",
        displayValue === placeholder && "text-neutral-400"
      )}
    >
      {displayValue}
    </span>
  );
};
