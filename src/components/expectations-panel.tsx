"use client";

import { AnimatePresence, motion } from "motion/react";
import type { Expectation, ExpectationReport } from "@/lib/regex/expectations";
import { Button } from "@/components/ui/controls";

interface ExpectationsPanelProps {
  expectations: Expectation[];
  report: ExpectationReport;
  onChange: (id: string, patch: Partial<Expectation>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}

export function ExpectationsPanel({
  expectations,
  report,
  onChange,
  onRemove,
  onAdd,
}: ExpectationsPanelProps) {
  const resultFor = (id: string) => report.results.find((result) => result.expectation.id === id);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-2">
        {report.error ? (
          <span className="font-mono text-xs text-err">{report.error}</span>
        ) : expectations.length === 0 ? (
          <span className="text-xs text-subtle">
            Add the strings this pattern must accept — and the ones it must reject.
          </span>
        ) : (
          <span className="text-xs">
            <span className={report.failed > 0 ? "text-err" : "text-ok"}>
              {report.passed} passing
            </span>
            {report.failed > 0 && <span className="text-err"> · {report.failed} failing</span>}
          </span>
        )}
        <Button variant="outline" onClick={onAdd}>
          Add case
        </Button>
      </div>

      <ul className="min-h-0 flex-1 overflow-auto">
        <AnimatePresence initial={false}>
          {expectations.map((expectation) => {
            const result = resultFor(expectation.id);
            const failed = result !== undefined && !result.passed;

            return (
              <motion.li
                key={expectation.id}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className={`group border-b border-line ${failed ? "bg-err/[0.06]" : ""}`}
              >
                <div className="flex items-center gap-2 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => onChange(expectation.id, { shouldMatch: !expectation.shouldMatch })}
                    title={
                      expectation.shouldMatch
                        ? "This string must match"
                        : "This string must not match"
                    }
                    className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px] transition-colors ${
                      expectation.shouldMatch
                        ? "bg-accent-soft text-fg"
                        : "border border-line text-subtle"
                    }`}
                  >
                    {expectation.shouldMatch ? "must match" : "must not"}
                  </button>

                  <input
                    value={expectation.text}
                    onChange={(event) => onChange(expectation.id, { text: event.target.value })}
                    spellCheck={false}
                    placeholder="example input"
                    aria-label="Example input"
                    className="min-w-0 flex-1 rounded px-1 py-0.5 font-mono text-[13px] outline-none placeholder:text-subtle focus:bg-raised"
                  />

                  <StatusMark passed={result?.passed} />

                  <button
                    type="button"
                    onClick={() => onRemove(expectation.id)}
                    aria-label="Remove this case"
                    className="shrink-0 rounded p-1 text-subtle opacity-0 transition-opacity hover:text-err focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {failed && (
                  <p className="px-3 pb-2 pl-[92px] text-[11px] text-err">
                    {result?.matched
                      ? `Matched “${result.matchedText}” but should not have.`
                      : "Did not match, but should have."}
                  </p>
                )}
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}

function StatusMark({ passed }: { passed?: boolean }) {
  if (passed === undefined) return <span className="w-4 shrink-0" />;
  return (
    <span
      className={`shrink-0 text-[13px] ${passed ? "text-ok" : "text-err"}`}
      title={passed ? "Passing" : "Failing"}
    >
      {passed ? "✓" : "✕"}
    </span>
  );
}
