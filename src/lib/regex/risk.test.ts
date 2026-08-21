import { describe, expect, it } from "vitest";
import { explain } from "./explain";
import { assessRisk, worstLevel } from "./risk";

/** The findings for a pattern, as the id prefixes that name each check. */
function checks(pattern: string): string[] {
  return assessRisk(explain(pattern)).map((f) => f.id.split(":")[0]!);
}

describe("assessRisk", () => {
  it("flags an unbounded repeat wrapping another one", () => {
    expect(checks("(a+)+")).toEqual(["nested"]);
    expect(checks("(a*)*")).toEqual(["nested"]);
    expect(worstLevel(assessRisk(explain("(a+)+$")))).toBe("high");
  });

  it("flags two adjacent unbounded repeats over the same characters", () => {
    expect(checks(".*.*")).toEqual(["adjacent"]);
    expect(checks("\\d+\\d+")).toEqual(["adjacent"]);
  });

  it("does not flag adjacent repeats over different characters", () => {
    expect(checks("\\d*\\w*")).toEqual([]);
  });

  it("flags a large minimum repetition count", () => {
    expect(checks("a{1000,}")).toEqual(["large"]);
    expect(worstLevel(assessRisk(explain("a{1000,}")))).toBe("low");
  });

  it("leaves an ordinary pattern alone", () => {
    expect(checks("^[a-z]+@[a-z]+\\.[a-z]{2,}$")).toEqual([]);
    expect(worstLevel(assessRisk(explain("^\\d{4}-\\d{2}-\\d{2}$")))).toBeNull();
  });

  // The ambiguous-alternation check compares the opening node of each branch,
  // firing when one branch's opening text is a prefix of another's. Equality is
  // the special case where the two are the same length.
  it("flags alternation branches that begin with the same node", () => {
    expect(checks("(a|a)*")).toEqual(["ambiguous"]);
  });

  // The textbook ambiguous alternation. The parser coalesces adjacent literals,
  // so `ab` arrives as one node and the sources differ; comparing by prefix is
  // what catches it. Order must not matter.
  it("flags branches where one opening is a prefix of another", () => {
    expect(checks("(a|ab)*")).toEqual(["ambiguous"]);
    expect(checks("(ab|a)*")).toEqual(["ambiguous"]);
    expect(checks("(ab|abc)*")).toEqual(["ambiguous"]);
  });

  it("does not flag alternation branches that start differently", () => {
    expect(checks("(a|b)*")).toEqual([]);
    expect(checks("(ab|ba)*")).toEqual([]);
  });

  // Still a documented limit: overlap through a character class rather than a
  // shared literal prefix is not detected. Pinned so a fix changes it here.
  it("misses branches that overlap through a character class", () => {
    expect(checks("(a|[ab])*")).toEqual([]);
  });
});
