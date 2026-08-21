import type { RxNode } from "./explain";

/**
 * Static heuristics for patterns that can backtrack catastrophically. These are
 * deliberately conservative: a finding means "worth a second look", not "proven
 * exponential".
 */

export type RiskLevel = "high" | "medium" | "low";

export interface Finding {
  id: string;
  level: RiskLevel;
  title: string
  detail: string;
  source: string;
}

const UNBOUNDED_MIN = 1_000;

function isUnbounded(node: RxNode): boolean {
  return node.quantifier?.max === null;
}

function hasUnboundedDescendant(nodes: RxNode[]): boolean {
  return nodes.some(
    (node) => isUnbounded(node) || hasUnboundedDescendant(node.children ?? []),
  );
}

function classOf(node: RxNode): string | null {
  if (node.kind === "any") return "any";
  if (node.kind === "shorthand" || node.kind === "class") return node.source.replace(/[*+?]|\{.*\}$/g, "");
  return null;
}

function walk(nodes: RxNode[], visit: (node: RxNode, siblings: RxNode[], index: number) => void): void {
  nodes.forEach((node, index) => {
    visit(node, nodes, index);
    if (node.children) walk(node.children, visit);
  });
}

export function assessRisk(tree: RxNode[]): Finding[] {
  const findings: Finding[] = [];

  walk(tree, (node, siblings, index) => {
    // (a+)+ / (a*)* — an unbounded repeat wrapping another unbounded repeat.
    if (isUnbounded(node) && node.children && hasUnboundedDescendant(node.children)) {
      findings.push({
        id: `nested:${node.id}`,
        level: "high",
        title: "Nested unbounded repetition",
        detail:
          "A repeated group that itself repeats can retry the same input in exponentially many ways when the match ultimately fails.",
        source: node.source,
      });
    }

    // (a|ab)* — alternation branches that can match the same text.
    if (isUnbounded(node)) {
      const alternation = (node.children ?? []).find((child) => child.kind === "alternation");
      const branches = alternation?.children ?? [];
      const firsts = branches.map((branch) => branch.children?.[0]?.source ?? "");
      // One branch's opening text being a prefix of another's is enough: both
      // branches can start on the same input, so the engine has a choice to
      // make and to retry. Equality is the special case where they are the
      // same length. The parser coalesces adjacent literals, so `ab` arrives as
      // one node and a plain equality test would miss `(a|ab)*`.
      const overlapping = firsts.some(
        (value, i) =>
          value !== "" &&
          firsts.some((other, j) => i !== j && other !== "" && other.startsWith(value)),
      );
      if (overlapping) {
        findings.push({
          id: `ambiguous:${node.id}`,
          level: "medium",
          title: "Ambiguous alternation inside a repeat",
          detail:
            "Two branches can match the same text, so the engine has more than one way to split the input and must try them all before failing.",
          source: node.source,
        });
      }
    }

    // .*.* — adjacent unbounded repeats over the same character set.
    const next = siblings[index + 1];
    if (next && isUnbounded(node) && isUnbounded(next)) {
      const a = classOf(node);
      const b = classOf(next);
      if (a !== null && a === b) {
        findings.push({
          id: `adjacent:${node.id}`,
          level: "medium",
          title: "Two adjacent repeats over the same characters",
          detail: "The engine must try every way of dividing the text between them. One repeat is enough.",
          source: `${node.source}${next.source}`,
        });
      }
    }

    if (node.quantifier && node.quantifier.min >= UNBOUNDED_MIN) {
      findings.push({
        id: `large:${node.id}`,
        level: "low",
        title: "Very large repetition count",
        detail: `Requires at least ${node.quantifier.min.toLocaleString()} repetitions, which is slow on long input.`,
        source: node.source,
      });
    }
  });

  return findings;
}

export function worstLevel(findings: Finding[]): RiskLevel | null {
  if (findings.some((f) => f.level === "high")) return "high";
  if (findings.some((f) => f.level === "medium")) return "medium";
  if (findings.some((f) => f.level === "low")) return "low";
  return null;
}
