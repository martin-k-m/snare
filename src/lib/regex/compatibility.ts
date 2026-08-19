import { explain, type RxNode } from "./explain";
import type { Language } from "./codegen";

/**
 * A pattern that works in JavaScript can fail to compile elsewhere, or compile
 * and mean something else. These are the differences that actually bite when a
 * regex is copied from a browser into a service.
 */
export type Construct =
  | "lookbehind"
  | "lookahead"
  | "backreference"
  | "named-group"
  | "unicode-property"
  | "lazy-quantifier";

export interface Incompatibility {
  construct: Construct;
  /** The slice of the pattern that raised it. */
  source: string;
  detail: string;
}

const CONSTRUCT_LABEL: Record<Construct, string> = {
  lookbehind: "lookbehind",
  lookahead: "lookahead",
  backreference: "a backreference",
  "named-group": "a named group",
  "unicode-property": "a unicode property escape",
  "lazy-quantifier": "a lazy quantifier",
};

/**
 * What each target cannot do. Go and Rust use RE2-style engines, which trade
 * these features for a guarantee of linear-time matching — the same guarantee
 * that makes catastrophic backtracking impossible there.
 */
const UNSUPPORTED: Record<Language, Partial<Record<Construct, string>>> = {
  javascript: {},
  typescript: {},
  python: {
    lookbehind: "Python's re requires lookbehind to be fixed width; the regex module lifts this.",
  },
  ruby: {},
  java: {},
  go: {
    lookbehind: "RE2 has no lookaround at all.",
    lookahead: "RE2 has no lookaround at all.",
    backreference: "RE2 cannot refer back to an earlier group.",
    "unicode-property": "Go supports \\p{…} but not every property name JavaScript accepts.",
  },
  rust: {
    lookbehind: "The regex crate has no lookaround.",
    lookahead: "The regex crate has no lookaround.",
    backreference: "The regex crate cannot refer back to an earlier group.",
  },
};

function walk(nodes: RxNode[], visit: (node: RxNode) => void): void {
  for (const node of nodes) {
    visit(node);
    if (node.children) walk(node.children, visit);
  }
}

/** Constructs the pattern actually uses, in source order. */
export function constructsUsed(pattern: string): Incompatibility[] {
  let tree: RxNode[];
  try {
    tree = explain(pattern);
  } catch {
    return [];
  }

  const found: Incompatibility[] = [];
  const add = (construct: Construct, source: string) => {
    if (found.some((item) => item.construct === construct)) return;
    found.push({ construct, source, detail: "" });
  };

  walk(tree, (node) => {
    if (node.kind === "backreference") add("backreference", node.source);
    if (node.kind === "unicode-property") add("unicode-property", node.source);
    if (node.captureName !== undefined) add("named-group", node.source);
    if (node.quantifier?.lazy) add("lazy-quantifier", node.quantifier.source);
    if (node.kind === "group") {
      if (node.label.includes("Lookbehind") || node.label.includes("lookbehind")) {
        add("lookbehind", node.source);
      } else if (node.label.includes("Lookahead") || node.label.includes("lookahead")) {
        add("lookahead", node.source);
      }
    }
  });

  return found;
}

/**
 * Which of those constructs the chosen target cannot run. An empty list means
 * the pattern should behave the same there.
 */
export function checkCompatibility(pattern: string, language: Language): Incompatibility[] {
  const unsupported = UNSUPPORTED[language];

  return constructsUsed(pattern)
    .filter((item) => unsupported[item.construct] !== undefined)
    .map((item) => ({
      ...item,
      detail: `${capitalise(CONSTRUCT_LABEL[item.construct])} is not supported. ${unsupported[item.construct]}`,
    }));
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Targets that can run the pattern unchanged, for the summary line. */
export function portableTo(pattern: string, languages: Language[]): Language[] {
  return languages.filter((language) => checkCompatibility(pattern, language).length === 0);
}
