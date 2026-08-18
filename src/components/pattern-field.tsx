"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRef } from "react";

export const FLAGS = [
  { flag: "g", name: "global", hint: "find every match, not just the first" },
  { flag: "i", name: "ignore case", hint: "match regardless of upper or lower case" },
  { flag: "m", name: "multiline", hint: "^ and $ match at line breaks" },
  { flag: "s", name: "dotAll", hint: ". also matches line breaks" },
  { flag: "u", name: "unicode", hint: "treat the pattern as unicode code points" },
] as const;

/** Shared by the input and the mirror behind it; they must match exactly. */
const TEXT_STYLE = "font-mono text-base tracking-tight";

export interface PatternHighlight {
  start: number;
  end: number;
}

interface PatternFieldProps {
  pattern: string;
  flags: string;
  error: { message: string; index?: number } | null;
  /** Slice of the pattern to light up, e.g. the hovered explanation line. */
  highlight: PatternHighlight | null;
  onPatternChange: (pattern: string) => void;
  onToggleFlag: (flag: string) => void;
}

export function PatternField({
  pattern,
  flags,
  error,
  highlight,
  onPatternChange,
  onToggleFlag,
}: PatternFieldProps) {
  const mirrorRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col">
      <div
        className={`flex items-center gap-2 px-4 py-3 transition-colors ${
          error ? "bg-err/[0.06]" : ""
        }`}
      >
        <span className="select-none font-mono text-base text-subtle">/</span>

        {/*
          The input sits over a mirror of its own text, which is what lets a
          hovered line of the explanation light up the exact slice of the
          pattern it came from. Both layers must share typography precisely.
        */}
        <div className="relative min-w-0 flex-1">
          <div
            ref={mirrorRef}
            aria-hidden
            className={`${TEXT_STYLE} pointer-events-none absolute inset-0 overflow-hidden whitespace-pre text-transparent`}
          >
            {highlight ? (
              <>
                {pattern.slice(0, highlight.start)}
                <mark className="rounded-[2px] bg-accent-soft text-transparent ring-1 ring-accent/40">
                  {pattern.slice(highlight.start, highlight.end)}
                </mark>
                {pattern.slice(highlight.end)}
              </>
            ) : (
              pattern
            )}
          </div>

          <input
            value={pattern}
            onChange={(event) => onPatternChange(event.target.value)}
            onScroll={(event) => {
              if (mirrorRef.current) mirrorRef.current.scrollLeft = event.currentTarget.scrollLeft;
            }}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            placeholder="pattern"
            aria-label="Regular expression"
            aria-invalid={error !== null}
            className={`${TEXT_STYLE} relative w-full bg-transparent text-fg outline-none placeholder:text-subtle`}
          />
        </div>
        <span className="select-none font-mono text-base text-subtle">/</span>

        <div className="flex items-center gap-1">
          {FLAGS.map(({ flag, name, hint }) => {
            const active = flags.includes(flag);
            return (
              <button
                key={flag}
                type="button"
                onClick={() => onToggleFlag(flag)}
                aria-pressed={active}
                title={`${name} — ${hint}`}
                className={`relative h-7 w-7 rounded-md font-mono text-sm transition-colors ${
                  active ? "text-accent-fg" : "text-subtle hover:bg-raised hover:text-muted"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId={`flag-${flag}`}
                    transition={{ type: "spring", stiffness: 500, damping: 32 }}
                    className="absolute inset-0 rounded-md bg-accent"
                  />
                )}
                <span className="relative">{flag}</span>
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {error && (
          <motion.div
            key="pattern-error"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden border-t border-line"
          >
            <div className="px-4 py-2">
              <p className="font-mono text-xs text-err">{error.message}</p>
              {error.index !== undefined && (
                <p className="mt-1 font-mono text-xs text-subtle">
                  {" ".repeat(Math.max(0, error.index))}
                  <span className="text-err">▲</span> position {error.index}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
