/**
 * Rendering a pattern into another language is mostly a quoting problem, and
 * quoting it wrongly is how a working expression becomes a broken one. Each
 * target below states which flags it can honour and which it cannot.
 */

export type Language = "javascript" | "typescript" | "python" | "go" | "java" | "ruby" | "rust";

export interface Snippet {
  language: Language;
  label: string;
  /** Syntax hint for display. */
  highlight: string;
  code: string;
  /** Anything the target cannot express, said plainly rather than dropped. */
  notes: string[];
}

const FLAG_NAMES: Record<string, string> = {
  g: "global",
  i: "ignore case",
  m: "multiline",
  s: "dotAll",
  u: "unicode",
  y: "sticky",
};

function quoteDouble(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Python raw strings cannot end in a backslash, and cannot contain the quote. */
function pythonLiteral(pattern: string): string {
  if (!pattern.includes("'") && !pattern.endsWith("\\")) return `r'${pattern}'`;
  if (!pattern.includes('"') && !pattern.endsWith("\\")) return `r"${pattern}"`;
  return `"${quoteDouble(pattern)}"`;
}

/** Go raw strings are backtick-delimited and cannot contain a backtick. */
function goLiteral(pattern: string): string {
  return pattern.includes("`") ? `"${quoteDouble(pattern)}"` : `\`${pattern}\``;
}

function unsupported(flags: string, supported: string, target: string): string[] {
  const missing = [...flags].filter((flag) => !supported.includes(flag));
  if (missing.length === 0) return [];
  const names = missing.map((flag) => `${flag} (${FLAG_NAMES[flag] ?? flag})`).join(", ");
  return [`${target} has no equivalent for the ${names} flag.`];
}

export function toSnippet(pattern: string, flags: string, language: Language): Snippet {
  const safe = pattern === "" ? "" : pattern;

  switch (language) {
    case "javascript":
    case "typescript": {
      const label = language === "javascript" ? "JavaScript" : "TypeScript";
      const typing = language === "typescript" ? ": RegExp" : "";
      return {
        language,
        label,
        highlight: "js",
        code: `const pattern${typing} = /${safe}/${flags};\n\nif (pattern.test(input)) {\n  // …\n}`,
        notes: [],
      };
    }

    case "python": {
      const modifiers = [
        flags.includes("i") ? "re.IGNORECASE" : null,
        flags.includes("m") ? "re.MULTILINE" : null,
        flags.includes("s") ? "re.DOTALL" : null,
        flags.includes("u") ? "re.UNICODE" : null,
      ].filter(Boolean);
      const args = modifiers.length ? `, ${modifiers.join(" | ")}` : "";
      return {
        language,
        label: "Python",
        highlight: "python",
        code: `import re\n\npattern = re.compile(${pythonLiteral(safe)}${args})\n\nif pattern.search(text):\n    ...`,
        notes: [
          ...unsupported(flags, "imsu", "Python's re"),
          ...(flags.includes("g")
            ? ["Use re.finditer or re.findall where JavaScript would use the g flag."]
            : []),
        ],
      };
    }

    case "go": {
      const prefix = flags.includes("i") || flags.includes("m") || flags.includes("s")
        ? `(?${flags.includes("i") ? "i" : ""}${flags.includes("m") ? "m" : ""}${flags.includes("s") ? "s" : ""})`
        : "";
      return {
        language,
        label: "Go",
        highlight: "go",
        code: `var pattern = regexp.MustCompile(${goLiteral(prefix + safe)})\n\nif pattern.MatchString(input) {\n\t// …\n}`,
        notes: [
          "Go's regexp is RE2: it runs in linear time and cannot backtrack, but it has no lookaround or backreferences.",
          ...(prefix ? ["Flags are expressed as an inline (?ims) group."] : []),
        ],
      };
    }

    case "java":
      return {
        language,
        label: "Java",
        highlight: "java",
        code: `Pattern pattern = Pattern.compile("${quoteDouble(safe)}"${
          [
            flags.includes("i") ? "Pattern.CASE_INSENSITIVE" : null,
            flags.includes("m") ? "Pattern.MULTILINE" : null,
            flags.includes("s") ? "Pattern.DOTALL" : null,
            flags.includes("u") ? "Pattern.UNICODE_CASE" : null,
          ]
            .filter(Boolean)
            .reduce((acc: string, flag) => `${acc}, ${flag}`, "")
        });\n\nif (pattern.matcher(input).find()) {\n    // …\n}`,
        notes: unsupported(flags, "imsu", "java.util.regex"),
      };

    case "ruby": {
      const modifiers = `${flags.includes("i") ? "i" : ""}${flags.includes("m") ? "m" : ""}`;
      return {
        language,
        label: "Ruby",
        highlight: "ruby",
        code: `pattern = /${safe}/${modifiers}\n\nif input =~ pattern\n  # …\nend`,
        notes: [
          "Ruby's /m is JavaScript's s (dot matches newline); ^ and $ are already line anchors.",
          ...unsupported(flags, "imu", "Ruby"),
        ],
      };
    }

    case "rust": {
      const prefix = flags.includes("i") || flags.includes("m") || flags.includes("s")
        ? `(?${flags.includes("i") ? "i" : ""}${flags.includes("m") ? "m" : ""}${flags.includes("s") ? "s" : ""})`
        : "";
      return {
        language,
        label: "Rust",
        highlight: "rust",
        code: `use regex::Regex;\n\nlet pattern = Regex::new(r"${prefix}${safe}").unwrap();\n\nif pattern.is_match(input) {\n    // …\n}`,
        notes: [
          "The regex crate guarantees linear time, so lookaround and backreferences are not supported.",
          ...(safe.includes('"') ? ['The pattern contains a quote; use r#"…"# instead.'] : []),
        ],
      };
    }
  }
}

export const LANGUAGES: Language[] = [
  "javascript",
  "typescript",
  "python",
  "go",
  "java",
  "ruby",
  "rust",
];
