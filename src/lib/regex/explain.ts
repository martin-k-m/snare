/**
 * A small recursive-descent parser for the JavaScript regular expression
 * grammar. It exists to *describe* a pattern, not to execute it, so it favours
 * readable output over completeness: constructs it does not model are still
 * reported, just with a generic label.
 */

export type RxKind =
  | "literal"
  | "any"
  | "anchor"
  | "class"
  | "shorthand"
  | "group"
  | "branch"
  | "alternation"
  | "backreference"
  | "escape"
  | "unicode-property";

export interface Quantifier {
  min: number;
  max: number | null;
  lazy: boolean;
  label: string;
  source: string;
}

export interface RxNode {
  id: string;
  kind: RxKind;
  /** One-line, human readable summary. */
  label: string;
  /** Optional secondary line with extra nuance. */
  detail?: string;
  /** The exact slice of the pattern this node came from. */
  source: string;
  start: number;
  end: number;
  children?: RxNode[];
  quantifier?: Quantifier;
  /** 1-based position among capture groups, for capturing groups only. */
  captureIndex?: number;
  captureName?: string;
}

export class PatternError extends Error {
  constructor(
    message: string,
    readonly index: number,
  ) {
    super(message);
    this.name = "PatternError";
  }
}

const SHORTHAND: Record<string, string> = {
  d: "any digit (0-9)",
  D: "any character that is not a digit",
  w: "any word character (letter, digit or underscore)",
  W: "any character that is not a word character",
  s: "any whitespace character",
  S: "any character that is not whitespace",
  b: "a word boundary",
  B: "a position that is not a word boundary",
};

const CONTROL: Record<string, string> = {
  n: "a line feed",
  r: "a carriage return",
  t: "a tab",
  f: "a form feed",
  v: "a vertical tab",
  "0": "a NUL character",
};

const QUANTIFIER_HEADS = new Set(["*", "+", "?", "{"]);

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

function quantifierLabel(min: number, max: number | null, lazy: boolean): string {
  let base: string;
  if (min === 0 && max === null) base = "zero or more times";
  else if (min === 1 && max === null) base = "one or more times";
  else if (min === 0 && max === 1) base = "optionally (zero or one time)";
  else if (max === null) base = `at least ${plural(min, "time")}`;
  else if (min === max) base = `exactly ${plural(min, "time")}`;
  else base = `between ${min} and ${max} times`;
  return lazy ? `${base}, as few as possible` : base;
}

function describeLiteral(text: string): string {
  if (text === " ") return "a space";
  return text.length === 1 ? `the character “${text}”` : `the text “${text}”`;
}

function joinList(parts: string[]): string {
  if (parts.length === 0) return "nothing";
  if (parts.length === 1) return parts[0]!;
  return `${parts.slice(0, -1).join(", ")} or ${parts[parts.length - 1]}`;
}

function unescapeLiteral(source: string): string {
  return source.replace(/\\(.)/g, "$1");
}

class Parser {
  private i = 0;
  private groupIndex = 0;

  constructor(private readonly src: string) {}

  parse(): RxNode[] {
    const nodes = this.parseAlternation("0");
    if (this.i < this.src.length) {
      throw new PatternError(`Unexpected “${this.src[this.i]}”`, this.i);
    }
    return nodes;
  }

  private peek(offset = 0): string | undefined {
    return this.src[this.i + offset];
  }

  private parseAlternation(path: string): RxNode[] {
    const start = this.i;
    let branch = this.parseSequence(`${path}.0`);
    if (this.peek() !== "|") return branch;

    const branches: RxNode[] = [];
    let branchStart = start;

    for (;;) {
      const index = branches.length;
      branches.push({
        id: `${path}.b${index}`,
        kind: "branch",
        label: `Option ${index + 1}`,
        source: this.src.slice(branchStart, this.i),
        start: branchStart,
        end: this.i,
        children: branch,
      });
      if (this.peek() !== "|") break;
      this.i += 1;
      branchStart = this.i;
      branch = this.parseSequence(`${path}.${branches.length}`);
    }

    return [
      {
        id: `${path}.alt`,
        kind: "alternation",
        label: `Match one of ${branches.length} options`,
        detail: "The leftmost option that matches wins.",
        source: this.src.slice(start, this.i),
        start,
        end: this.i,
        children: branches,
      },
    ];
  }

  private parseSequence(path: string): RxNode[] {
    const out: RxNode[] = [];
    while (this.i < this.src.length) {
      const ch = this.peek();
      if (ch === "|" || ch === ")") break;

      const node = this.parseAtom(`${path}.${out.length}`);
      const quantifier = this.tryQuantifier();
      if (quantifier) {
        node.quantifier = quantifier;
        node.end = this.i;
        node.source = this.src.slice(node.start, this.i);
      }

      const prev = out[out.length - 1];
      const mergeable =
        prev !== undefined &&
        prev.kind === "literal" &&
        !prev.quantifier &&
        node.kind === "literal" &&
        !node.quantifier;

      if (mergeable) {
        const merged = this.src.slice(prev.start, node.end);
        prev.end = node.end;
        prev.source = merged;
        prev.label = describeLiteral(unescapeLiteral(merged));
      } else {
        out.push(node);
      }
    }
    return out;
  }

  private tryQuantifier(): Quantifier | undefined {
    const ch = this.peek();
    if (!ch || !QUANTIFIER_HEADS.has(ch)) return undefined;
    const start = this.i;

    let min: number;
    let max: number | null;

    if (ch === "*") {
      min = 0;
      max = null;
      this.i += 1;
    } else if (ch === "+") {
      min = 1;
      max = null;
      this.i += 1;
    } else if (ch === "?") {
      min = 0;
      max = 1;
      this.i += 1;
    } else {
      const close = this.src.indexOf("}", this.i);
      const body = close === -1 ? "" : this.src.slice(this.i + 1, close);
      const match = /^(\d+)(,(\d*))?$/.exec(body);
      if (close === -1 || !match) return undefined; // a literal brace, not a quantifier
      min = Number(match[1]);
      max = match[2] === undefined ? min : match[3] ? Number(match[3]) : null;
      if (max !== null && max < min) {
        throw new PatternError("Quantifier range runs backwards", start);
      }
      this.i = close + 1;
    }

    const lazy = this.peek() === "?";
    if (lazy) this.i += 1;

    return {
      min,
      max,
      lazy,
      label: quantifierLabel(min, max, lazy),
      source: this.src.slice(start, this.i),
    };
  }

  private node(
    kind: RxKind,
    id: string,
    start: number,
    label: string,
    detail?: string,
    children?: RxNode[],
  ): RxNode {
    return {
      id,
      kind,
      label,
      detail,
      source: this.src.slice(start, this.i),
      start,
      end: this.i,
      children,
    };
  }

  private parseAtom(id: string): RxNode {
    const start = this.i;
    const ch = this.src[this.i];

    if (ch === undefined) throw new PatternError("Pattern ended unexpectedly", start);
    if (ch === "(") return this.parseGroup(id);
    if (ch === "[") return this.parseClass(id);
    if (ch === "\\") return this.parseEscape(id);

    if (ch === ".") {
      this.i += 1;
      return this.node(
        "any",
        id,
        start,
        "any character",
        "Excludes line breaks unless the s (dotAll) flag is set.",
      );
    }

    if (ch === "^") {
      this.i += 1;
      return this.node(
        "anchor",
        id,
        start,
        "start of the input",
        "With the m flag this also matches the start of each line.",
      );
    }

    if (ch === "$") {
      this.i += 1;
      return this.node(
        "anchor",
        id,
        start,
        "end of the input",
        "With the m flag this also matches the end of each line.",
      );
    }

    if (ch === "*" || ch === "+") {
      throw new PatternError(`Nothing to repeat before “${ch}”`, start);
    }

    this.i += 1;
    return this.node("literal", id, start, describeLiteral(ch));
  }

  private parseEscape(id: string): RxNode {
    const start = this.i;
    this.i += 1;
    const ch = this.src[this.i];
    if (ch === undefined) throw new PatternError("Pattern ends with a lone backslash", start);
    this.i += 1;

    const shorthand = SHORTHAND[ch];
    if (shorthand) return this.node("shorthand", id, start, shorthand);

    const control = CONTROL[ch];
    if (control) return this.node("escape", id, start, control);

    if (ch >= "1" && ch <= "9") {
      let digits = ch;
      while (this.peek() !== undefined && /\d/.test(this.peek()!)) {
        digits += this.src[this.i];
        this.i += 1;
      }
      return this.node("backreference", id, start, `whatever capture group ${digits} matched`);
    }

    if (ch === "k" && this.peek() === "<") {
      const close = this.src.indexOf(">", this.i);
      if (close === -1) throw new PatternError("Unterminated group name", start);
      const name = this.src.slice(this.i + 1, close);
      this.i = close + 1;
      return this.node(
        "backreference",
        id,
        start,
        `whatever the group “${name}” matched`,
      );
    }

    if (ch === "x" || ch === "u") {
      if (ch === "u" && this.peek() === "{") {
        const close = this.src.indexOf("}", this.i);
        if (close === -1) throw new PatternError("Unterminated unicode escape", start);
        const code = this.src.slice(this.i + 1, close);
        this.i = close + 1;
        return this.node("escape", id, start, `the character U+${code.toUpperCase()}`);
      }
      const width = ch === "x" ? 2 : 4;
      const code = this.src.slice(this.i, this.i + width);
      this.i += width;
      return this.node("escape", id, start, `the character U+${code.toUpperCase()}`);
    }

    if (ch === "p" || ch === "P") {
      const close = this.src.indexOf("}", this.i);
      if (this.peek() !== "{" || close === -1) {
        throw new PatternError("Unicode property escape needs braces", start);
      }
      const prop = this.src.slice(this.i + 1, close);
      this.i = close + 1;
      const lead = ch === "p" ? "any character" : "any character that is not one";
      return this.node(
        "unicode-property",
        id,
        start,
        `${lead} with the unicode property ${prop}`,
        "Requires the u or v flag.",
      );
    }

    return this.node("literal", id, start, describeLiteral(ch));
  }

  private parseGroup(id: string): RxNode {
    const start = this.i;
    this.i += 1; // consume (

    let label: string;
    let detail: string | undefined;
    let capture: { index: number; name?: string } | undefined;

    if (this.peek() === "?") {
      const marker = this.src.slice(this.i, this.i + 3);
      if (marker.startsWith("?:")) {
        this.i += 2;
        label = "Group, without capturing";
        detail = "Groups the contents for a quantifier or alternation only.";
      } else if (marker.startsWith("?=")) {
        this.i += 2;
        label = "Lookahead: the text ahead must match";
        detail = "Asserts without consuming any characters.";
      } else if (marker.startsWith("?!")) {
        this.i += 2;
        label = "Negative lookahead: the text ahead must not match";
        detail = "Asserts without consuming any characters.";
      } else if (marker === "?<=") {
        this.i += 3;
        label = "Lookbehind: the text before must match";
      } else if (marker === "?<!") {
        this.i += 3;
        label = "Negative lookbehind: the text before must not match";
      } else if (marker.startsWith("?<")) {
        const close = this.src.indexOf(">", this.i);
        if (close === -1) throw new PatternError("Unterminated group name", start);
        const name = this.src.slice(this.i + 2, close);
        this.i = close + 1;
        this.groupIndex += 1;
        capture = { index: this.groupIndex, name };
        label = `Capture group ${this.groupIndex}, named “${name}”`;
      } else {
        this.i += 2;
        label = "Group with a modifier";
      }
    } else {
      this.groupIndex += 1;
      capture = { index: this.groupIndex };
      label = `Capture group ${this.groupIndex}`;
      detail = "The matched text is kept for reuse and replacement.";
    }

    const children = this.parseAlternation(id);
    if (this.peek() !== ")") throw new PatternError("Unclosed group", start);
    this.i += 1;

    const node = this.node("group", id, start, label, detail, children);
    if (capture) {
      node.captureIndex = capture.index;
      node.captureName = capture.name;
    }
    return node;
  }

  private parseClass(id: string): RxNode {
    const start = this.i;
    this.i += 1; // consume [
    const negated = this.peek() === "^";
    if (negated) this.i += 1;

    const parts: string[] = [];
    let first = true;

    while (this.i < this.src.length) {
      const ch = this.src[this.i];
      if (ch === "]" && !first) break;
      first = false;

      if (ch === "\\") {
        const next = this.src[this.i + 1];
        this.i += 2;
        if (next !== undefined && SHORTHAND[next]) parts.push(SHORTHAND[next]!);
        else if (next !== undefined && CONTROL[next]) parts.push(CONTROL[next]!);
        else parts.push(`“${next ?? ""}”`);
        continue;
      }

      const dash = this.src[this.i + 1];
      const upper = this.src[this.i + 2];
      if (dash === "-" && upper !== undefined && upper !== "]") {
        parts.push(`${ch} to ${upper}`);
        this.i += 3;
        continue;
      }

      parts.push(`“${ch}”`);
      this.i += 1;
    }

    if (this.peek() !== "]") throw new PatternError("Unclosed character class", start);
    this.i += 1;

    const list = joinList(parts);
    return this.node(
      "class",
      id,
      start,
      negated ? `any character except ${list}` : `any of ${list}`,
    );
  }
}

export function explain(pattern: string): RxNode[] {
  return new Parser(pattern).parse();
}

/**
 * Names of the capture groups, indexed by group number minus one. Reading them
 * from the parse is the only reliable way round: matching them up by comparing
 * captured *values* mislabels groups whenever two of them capture the same text.
 * Returns an empty list for a pattern that does not parse.
 */
export function captureNames(pattern: string): Array<string | undefined> {
  let tree: RxNode[];
  try {
    tree = explain(pattern);
  } catch {
    return [];
  }

  const names: Array<string | undefined> = [];
  const walk = (nodes: RxNode[]): void => {
    for (const node of nodes) {
      if (node.captureIndex !== undefined) names[node.captureIndex - 1] = node.captureName;
      if (node.children) walk(node.children);
    }
  };
  walk(tree);
  return names;
}

export function countNodes(nodes: RxNode[]): number {
  return nodes.reduce((total, node) => total + 1 + countNodes(node.children ?? []), 0);
}
