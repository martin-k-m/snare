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

  // The ambiguous-alternation check compares the first node of each branch by
  // its source text, so it only fires when two branches start identically.
  it("flags alternation branches that begin with the same node", () => {
    expect(checks("(a|a)*")).toEqual(["ambiguous"]);
  });

  // Documented limit rather than desired behaviour. `(a|ab)*` is the textbook
  // ambiguous alternation and this check misses it, because "a" and "ab" parse
  // into one literal node each and their sources differ. Pinned so that a fix
  // has to come here and change this expectation deliberately.
  it("misses ambiguous branches that merely share a prefix", () => {
    expect(checks("(a|ab)*")).toEqual([]);
  });
});
