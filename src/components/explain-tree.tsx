"use client";

import { motion, useReducedMotion } from "motion/react";
import { entranceProps } from "@/components/ui/motion";
import type { RxNode } from "@/lib/regex/explain";
import { EmptyState } from "@/components/ui/controls";

const KIND_LABEL: Record<string, string> = {
  literal: "text",
  any: "wildcard",
  anchor: "anchor",
  class: "set",
  shorthand: "set",
  group: "group",
  branch: "option",
  alternation: "choice",
  backreference: "backreference",
  escape: "escape",
  "unicode-property": "unicode",
};

interface ExplainTreeProps {
  nodes: RxNode[];
  onHover: (node: RxNode | null) => void;
}

export function ExplainTree({ nodes, onHover }: ExplainTreeProps) {
  if (nodes.length === 0) {
    return <EmptyState title="Nothing to explain" hint="Type a pattern above." />;
  }

  return (
    <div className="h-full overflow-auto px-4 py-3">
      <NodeList nodes={nodes} depth={0} onHover={onHover} />
    </div>
  );
}

function NodeList({
  nodes,
  depth,
  onHover,
}: {
  nodes: RxNode[];
  depth: number;
  onHover: (node: RxNode | null) => void;
}) {
  const reduce = useReducedMotion();

  return (
    <ol className={depth === 0 ? "space-y-1.5" : "mt-1.5 space-y-1.5 border-l border-line pl-3"}>
      {nodes.map((node, index) => (
        <motion.li
          key={node.id}
          {...entranceProps(reduce, { index: index + depth, axis: "x", distance: -4, duration: 0.22, step: 0.02 })}
          onMouseEnter={() => onHover(node)}
          onMouseLeave={() => onHover(null)}
          onFocus={() => onHover(node)}
          onBlur={() => onHover(null)}
          tabIndex={0}
          className="rounded outline-offset-2 transition-colors hover:bg-raised/60"
        >
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <code className="rounded bg-raised px-1.5 py-0.5 font-mono text-[12px] text-accent">
              {node.source}
            </code>
            <span className="text-[10px] uppercase tracking-wider text-subtle">
              {KIND_LABEL[node.kind] ?? node.kind}
            </span>
            <span className="text-[13px] text-fg">{node.label}</span>
            {node.quantifier && (
              <span className="text-[13px] text-muted">— repeated {node.quantifier.label}</span>
            )}
          </div>
          {node.detail && <p className="mt-0.5 text-xs text-subtle">{node.detail}</p>}
          {node.children && node.children.length > 0 && (
            <NodeList nodes={node.children} depth={depth + 1} onHover={onHover} />
          )}
        </motion.li>
      ))}
    </ol>
  );
}
