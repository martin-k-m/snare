import { describe, expect, it } from "vitest";
import { evaluateExpectations, matchesEntirely, type Expectation } from "./expectations";
import { toSnippet, LANGUAGES } from "./codegen";

const cases = (...entries: Array<[string, boolean]>): Expectation[] =>
  entries.map(([text, shouldMatch], index) => ({ id: `e${index}`, text, shouldMatch }));

describe("evaluateExpectations", () => {
  it("passes a case that matches when it should, and one that does not when it should not", () => {
    const report = evaluateExpectations(
      "^\\d{4}-\\d{2}-\\d{2}$",
      "",
      cases(["2026-08-18", true], ["18/08/2026", false]),
    );
    expect(report.passed).toBe(2);
    expect(report.failed).toBe(0);
    expect(report.error).toBeNull();
  });

  it("fails a case the pattern wrongly accepts", () => {
    // Unanchored: it finds a date inside a longer string.
    const report = evaluateExpectations(
      "\\d{4}-\\d{2}-\\d{2}",
      "",
      cases(["nonsense 2026-08-18 nonsense", false]),
    );
    expect(report.failed).toBe(1);
    expect(report.results[0]?.matched).toBe(true);
    expect(report.results[0]?.matchedText).toBe("2026-08-18");
  });

  it("judges each case independently of the global flag's lastIndex", () => {
    const report = evaluateExpectations("a", "g", cases(["a", true], ["a", true], ["a", true]));
    expect(report.passed).toBe(3);
  });

  it("reports a pattern that does not compile instead of failing every case", () => {
    const report = evaluateExpectations("a(", "", cases(["a", true]));
    expect(report.error).not.toBeNull();
    expect(report.results).toHaveLength(0);
  });

  it("has nothing to say about an empty pattern", () => {
    expect(evaluateExpectations("", "", cases(["a", true]))).toMatchObject({ passed: 0, failed: 0 });
  });
});

describe("matchesEntirely", () => {
  it("separates a whole-string match from a partial one", () => {
    expect(matchesEntirely("\\d+", "", "123")).toBe(true);
    expect(matchesEntirely("\\d+", "", "a123b")).toBe(false);
    expect(matchesEntirely("^\\d+$", "", "123")).toBe(true);
  });
});

describe("toSnippet", () => {
  it("keeps JavaScript flags on the literal", () => {
    const snippet = toSnippet("\\d+", "gi", "javascript");
    expect(snippet.code).toContain("/\\d+/gi");
    expect(snippet.notes).toHaveLength(0);
  });

  it("translates flags to Python's re constants", () => {
    const snippet = toSnippet("\\d+", "ims", "python");
    expect(snippet.code).toContain("re.IGNORECASE | re.MULTILINE | re.DOTALL");
    expect(snippet.code).toContain("r'\\d+'");
  });

  it("advises finditer where JavaScript would use the global flag", () => {
    expect(toSnippet("a", "g", "python").notes.join(" ")).toContain("finditer");
  });

  it("quotes a Python pattern that a raw string cannot hold", () => {
    expect(toSnippet("it's", "", "python").code).toContain('r"it\'s"');
    expect(toSnippet("ends\\", "", "python").code).toContain('"ends\\\\"');
  });

  it("uses an inline flag group for Go and warns about RE2", () => {
    const snippet = toSnippet("\\d+", "is", "go");
    expect(snippet.code).toContain("`(?is)\\d+`");
    expect(snippet.notes.join(" ")).toContain("RE2");
  });

  it("falls back to a quoted Go string when the pattern holds a backtick", () => {
    expect(toSnippet("a`b", "", "go").code).toContain('"a`b"');
  });

  it("escapes backslashes and quotes for Java", () => {
    const snippet = toSnippet('\\d"x', "i", "java");
    expect(snippet.code).toContain('"\\\\d\\"x"');
    expect(snippet.code).toContain("Pattern.CASE_INSENSITIVE");
  });

  it("explains that Ruby's m is not JavaScript's m", () => {
    expect(toSnippet("a", "m", "ruby").notes.join(" ")).toContain("Ruby's /m is JavaScript's s");
  });

  it("produces something for every language it offers", () => {
    for (const language of LANGUAGES) {
      const snippet = toSnippet("^a[b-z]+$", "gim", language);
      expect(snippet.code.length, language).toBeGreaterThan(10);
      expect(snippet.label.length, language).toBeGreaterThan(0);
    }
  });
});
