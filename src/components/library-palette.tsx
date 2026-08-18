"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDialog } from "@/lib/hooks/use-dialog";
import { LIBRARY, type LibraryEntry } from "@/lib/regex/library";

interface LibraryPaletteProps {
  open: boolean;
  onClose: () => void;
  onPick: (entry: LibraryEntry) => void;
}

export function LibraryPalette({ open, onClose, onPick }: LibraryPaletteProps) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useDialog(open, onClose);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return LIBRARY;
    return LIBRARY.filter((entry) =>
      [entry.name, entry.category, entry.pattern, entry.note]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setCursor(0);
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    setCursor((current) => Math.min(current, Math.max(0, results.length - 1)));
  }, [results.length]);

  const commit = (entry: LibraryEntry | undefined) => {
    if (!entry) return;
    onPick(entry);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="library-palette"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh] backdrop-blur-sm"
          onClick={onClose}
          role="presentation"
        >
          <motion.div
            ref={dialogRef}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal
            aria-label="Pattern library"
            className="w-full max-w-xl overflow-hidden rounded-panel border border-line bg-surface shadow-2xl"
          >
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setCursor((c) => (c + 1) % Math.max(1, results.length));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setCursor((c) => (c - 1 + results.length) % Math.max(1, results.length));
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  commit(results[cursor]);
                }
              }}
              placeholder="Search patterns…"
              aria-label="Search patterns"
              className="w-full border-b border-line px-4 py-3.5 text-sm outline-none placeholder:text-subtle"
            />

            <ul className="max-h-[46vh] overflow-auto p-1.5">
              {results.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-subtle">
                  Nothing matches “{query}”.
                </li>
              )}
              {results.map((entry, index) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setCursor(index)}
                    onClick={() => commit(entry)}
                    data-active={index === cursor || undefined}
                    className="w-full rounded-lg px-3 py-2.5 text-left transition-colors data-[active]:bg-raised"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13px] font-medium text-fg">{entry.name}</span>
                      <span className="shrink-0 text-[10px] uppercase tracking-wider text-subtle">
                        {entry.category}
                      </span>
                    </div>
                    <code className="mt-1 block truncate font-mono text-[12px] text-accent">
                      /{entry.pattern}/{entry.flags}
                    </code>
                    <p className="mt-1 text-xs text-subtle">{entry.note}</p>
                  </button>
                </li>
              ))}
            </ul>

            <footer className="flex items-center gap-3 border-t border-line px-4 py-2 text-[11px] text-subtle">
              <span>↑↓ to move</span>
              <span>↵ to load</span>
              <span>esc to dismiss</span>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
