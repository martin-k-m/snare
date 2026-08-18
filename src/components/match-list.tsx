"use client";

import { motion } from "motion/react";
import type { MatchRecord } from "@/lib/regex/matcher";
import { EmptyState } from "@/components/ui/controls";

interface MatchListProps {
  matches: MatchRecord[];
  activeOrdinal: number | null;
  onHover: (ordinal: number | null) => void;
  onSelect: (match: MatchRecord) => void;
  truncated: boolean;
}

export function MatchList({ matches, activeOrdinal, onHover, onSelect, truncated }: MatchListProps) {
  if (matches.length === 0) {
    return (
      <EmptyState
        title="No matches yet"
        hint="Adjust the pattern, or open the library to start from a known-good one."
      />
    );
  }

  return (
    <div className="h-full overflow-auto">
      <ul className="divide-y divide-line">
        {matches.map((match, index) => (
          <motion.li
            key={`${match.start}-${match.ordinal}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: Math.min(index, 12) * 0.012 }}
            onMouseEnter={() => onHover(match.ordinal)}
            onMouseLeave={() => onHover(null)}
            data-active={match.ordinal === activeOrdinal || undefined}
            className="cursor-pointer px-4 py-2.5 transition-colors data-[active]:bg-raised"
          >
            <button
              type="button"
              onClick={() => onSelect(match)}
              className="flex w-full flex-col gap-1.5 text-left"
            >
              <div className="flex items-baseline gap-2">
                <span className="tabular w-8 shrink-0 font-mono text-[11px] text-subtle">
                  {match.ordinal + 1}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-fg">
                  {match.value === "" ? (
                    <em className="text-subtle">empty match</em>
                  ) : (
                    match.value
                  )}
                </span>
                <span className="tabular shrink-0 font-mono text-[11px] text-subtle">
                  {match.start}–{match.end}
                </span>
              </div>

              {match.captures.length > 0 && (
                <dl className="ml-8 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  {match.captures.map((capture) => (
                    <div key={capture.index} className="contents">
                      <dt className="font-mono text-[11px] text-subtle">
                        {capture.name ?? capture.index}
                      </dt>
                      <dd className="truncate font-mono text-[11px] text-muted">
                        {capture.value === undefined ? (
                          <span className="text-subtle">did not participate</span>
                        ) : capture.value === "" ? (
                          <span className="text-subtle">empty</span>
                        ) : (
                          capture.value
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </button>
          </motion.li>
        ))}
      </ul>

      {truncated && (
        <p className="border-t border-line px-4 py-2 text-xs text-warn">
          Showing the first {matches.length} matches. Narrow the pattern or shorten the input to see
          the rest.
        </p>
      )}
    </div>
  );
}
