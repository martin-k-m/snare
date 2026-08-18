"use client";

import { motion, useReducedMotion } from "motion/react";
import { entranceProps } from "@/components/ui/motion";
import type { Finding, RiskLevel } from "@/lib/regex/risk";
import { EmptyState } from "@/components/ui/controls";

const LEVEL_STYLE: Record<RiskLevel, string> = {
  high: "text-err border-err/40 bg-err/[0.07]",
  medium: "text-warn border-warn/40 bg-warn/[0.07]",
  low: "text-muted border-line bg-raised",
};

const LEVEL_LABEL: Record<RiskLevel, string> = {
  high: "likely exponential",
  medium: "worth a look",
  low: "minor",
};

export function RiskList({ findings }: { findings: Finding[] }) {
  const reduce = useReducedMotion();

  if (findings.length === 0) {
    return (
      <EmptyState
        title="No backtracking hazards found"
        hint="These checks are heuristics over the pattern's structure, not a proof. Untrusted input still deserves a length cap."
      />
    );
  }

  return (
    <div className="h-full overflow-auto p-3">
      <ul className="space-y-2">
        {findings.map((finding, index) => (
          <motion.li
            key={finding.id}
            {...entranceProps(reduce, { index, distance: 6, duration: 0.25, step: 0.04 })}
            className={`rounded-lg border p-3 ${LEVEL_STYLE[finding.level]}`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-[13px] font-medium text-fg">{finding.title}</h3>
              <span className="shrink-0 text-[10px] uppercase tracking-wider">
                {LEVEL_LABEL[finding.level]}
              </span>
            </div>
            <code className="mt-1.5 block truncate font-mono text-[12px] text-muted">
              {finding.source}
            </code>
            <p className="mt-1.5 text-xs text-muted">{finding.detail}</p>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

export function RiskBadge({ level }: { level: RiskLevel | null }) {
  if (!level) return null;
  return (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
        level === "high" ? "bg-err/15 text-err" : level === "medium" ? "bg-warn/15 text-warn" : "bg-raised text-subtle"
      }`}
    >
      {level} risk
    </motion.span>
  );
}
