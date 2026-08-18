import { describe, expect, it } from "vitest";
import { captureNames, countNodes, explain, PatternError } from "./explain";

describe("explain", () => {
  it("merges adjacent literals into one node", () => {
    const [node, ...rest] = explain("abc");
    expect(rest).toHaveLength(0);
    expect(node?.kind).toBe("literal");
    expect(node?.label).toContain("abc");
  });

  it("keeps a quantified literal separate from the run before it", () => {
    const nodes = explain("ab+");
    expect(nodes).toHaveLength(2);
    expect(nodes[0]?.source).toBe("a");
    expect(nodes[1]?.quantifier?.label).toBe("one or more times");
  });

  it("numbers capture groups in source order and names them", () => {
    const nodes = explain("(a)(?<year>b)(?:c)");
    expect(nodes[0]?.label).toBe("Capture group 1");
    expect(nodes[1]?.label).toContain("Capture group 2");
    expect(nodes[1]?.label).toContain("year");
    expect(nodes[2]?.label).toBe("Group, without capturing");
  });

  it("describes bounded and lazy quantifiers", () => {
    expect(explain("a{2,4}")[0]?.quantifier?.label).toBe("between 2 and 4 times");
    expect(explain("a{3}")[0]?.quantifier?.label).toBe("exactly 3 times");
    expect(explain("a{2,}")[0]?.quantifier?.label).toBe("at least 2 times");
    expect(explain("a+?")[0]?.quantifier?.label).toContain("as few as possible");
  });

  it("treats a brace that is not a quantifier as a literal", () => {
    const nodes = explain("a{oops}");
    expect(nodes[0]?.quantifier).toBeUndefined();
    expect(countNodes(nodes)).toBe(1);
  });

  it("builds an alternation with one branch per option", () => {
    const [node] = explain("cat|dog|bird");
    expect(node?.kind).toBe("alternation");
    expect(node?.children).toHaveLength(3);
    expect(node?.children?.[2]?.children?.[0]?.label).toContain("bird");
  });

  it("reads character classes including ranges and negation", () => {
    expect(explain("[a-z0-9_]")[0]?.label).toContain("a to z");
    expect(explain("[^\\s]")[0]?.label).toContain("except");
  });

  it("recognises lookaround and backreferences", () => {
    expect(explain("(?=x)")[0]?.label).toContain("Lookahead");
    expect(explain("(?<!x)")[0]?.label).toContain("Negative lookbehind");
    expect(explain("(a)\\1")[1]?.label).toContain("capture group 1");
    expect(explain("(?<w>a)\\k<w>")[1]?.label).toContain("“w”");
  });

  it("lists capture group names in source order", () => {
    expect(captureNames("(a)(?<year>b)(?:c)(?<month>d)")).toEqual([
      undefined,
      "year",
      "month",
    ]);
    expect(captureNames("((a)(b))")).toHaveLength(3);
    expect(captureNames("a(")).toEqual([]);
  });

  it("reports the offset of a syntax error", () => {
    expect(() => explain("a(b")).toThrowError(PatternError);
    try {
      explain("[a-z");
    } catch (error) {
      expect((error as PatternError).index).toBe(0);
    }
    try {
      explain("ab)c");
    } catch (error) {
      expect((error as PatternError).index).toBe(2);
    }
  });

  it("rejects a quantifier with nothing to repeat", () => {
    expect(() => explain("+a")).toThrowError(/Nothing to repeat/);
  });
});
