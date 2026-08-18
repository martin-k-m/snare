"use client";

import { motion } from "motion/react";

interface ReplacePanelProps {
  replacement: string;
  onChange: (value: string) => void;
  output: string | null;
  error: string | null;
  changed: boolean;
}

const TOKENS = [
  { token: "$1", label: "group 1" },
  { token: "$<name>", label: "named group" },
  { token: "$&", label: "whole match" },
  { token: "$`", label: "text before" },
  { token: "$'", label: "text after" },
];

export function ReplacePanel({ replacement, onChange, output, error, changed }: ReplacePanelProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <span className="shrink-0 text-[11px] uppercase tracking-wider text-subtle">with</span>
        <input
          value={replacement}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
          placeholder="replacement, e.g. $<year>-$<month>"
          aria-label="Replacement string"
          className="min-w-0 flex-1 font-mono text-[13px] outline-none placeholder:text-subtle"
        />
        <div className="hidden shrink-0 items-center gap-1 sm:flex">
          {TOKENS.map(({ token, label }) => (
            <button
              key={token}
              type="button"
              title={label}
              onClick={() => onChange(replacement + token)}
              className="rounded border border-line px-1.5 py-0.5 font-mono text-[11px] text-subtle transition-colors hover:border-line-strong hover:text-fg"
            >
              {token}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
        {error ? (
          <p className="font-mono text-xs text-err">{error}</p>
        ) : output === null || output === "" ? (
          <p className="text-xs text-subtle">
            The result of applying this replacement appears here as you type.
          </p>
        ) : (
          <motion.pre
            key={output}
            initial={{ opacity: 0.4 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="whitespace-pre-wrap break-words font-mono text-[13px] leading-[1.65] text-fg"
          >
            {output}
          </motion.pre>
        )}
      </div>

      {!error && output !== null && (
        <p className="border-t border-line px-4 py-1.5 text-[11px] text-subtle">
          {changed ? "Replacement applied" : "No change — the pattern matched nothing"}
        </p>
      )}
    </div>
  );
}
