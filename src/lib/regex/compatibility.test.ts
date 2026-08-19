import { describe, expect, it } from "vitest";
import { checkCompatibility, constructsUsed, portableTo } from "./compatibility";
import { LANGUAGES } from "./codegen";

describe("constructsUsed", () => {
  it("finds the constructs that differ between engines", () => {
    const used = constructsUsed("(?<=x)(?<name>a)\\1b+?(?!c)").map((item) => item.construct);
    expect(used).toContain("lookbehind");
    expect(used).toContain("named-group");
    expect(used).toContain("backreference");
    expect(used).toContain("lazy-quantifier");
    expect(used).toContain("lookahead");
  });

  it("reports nothing for a plain pattern", () => {
    expect(constructsUsed("^\\d{4}-\\d{2}-\\d{2}$")).toEqual([]);
  });

  it("says nothing about a pattern that does not parse", () => {
    expect(constructsUsed("a(")).toEqual([]);
  });

  it("reports each construct once, however often it appears", () => {
    const used = constructsUsed("(?=a)(?=b)(?=c)");
    expect(used.filter((item) => item.construct === "lookahead")).toHaveLength(1);
  });
});

describe("checkCompatibility", () => {
  it("blocks lookaround and backreferences for RE2 targets", () => {
    for (const language of ["go", "rust"] as const) {
      const problems = checkCompatibility("(?<=a)b\\1", language).map((item) => item.construct);
      expect(problems, language).toContain("lookbehind");
      expect(problems, language).toContain("backreference");
    }
  });

  it("explains why, rather than only that", () => {
    const [first] = checkCompatibility("(?=a)b", "go");
    expect(first?.detail).toContain("RE2 has no lookaround");
  });

  it("lets a plain pattern through everywhere", () => {
    for (const language of LANGUAGES) {
      expect(checkCompatibility("^[a-z0-9-]+$", language), language).toEqual([]);
    }
  });

  it("passes named groups and lazy quantifiers for RE2, which supports both", () => {
    expect(checkCompatibility("(?<year>\\d+?)", "go")).toEqual([]);
    expect(checkCompatibility("(?<year>\\d+?)", "rust")).toEqual([]);
  });

  it("notes Python's fixed-width lookbehind restriction", () => {
    const [problem] = checkCompatibility("(?<=ab)c", "python");
    expect(problem?.detail).toContain("fixed width");
  });

  it("leaves JavaScript alone, since that is the reference engine", () => {
    expect(checkCompatibility("(?<=a)(?<n>b)\\1(?!c)", "javascript")).toEqual([]);
  });
});

describe("portableTo", () => {
  it("lists the targets that can run the pattern unchanged", () => {
    expect(portableTo("^\\d+$", LANGUAGES)).toEqual(LANGUAGES);

    const withLookbehind = portableTo("(?<=a)b", LANGUAGES);
    expect(withLookbehind).toContain("javascript");
    expect(withLookbehind).toContain("ruby");
    expect(withLookbehind).not.toContain("go");
    expect(withLookbehind).not.toContain("rust");
    expect(withLookbehind).not.toContain("python");
  });
});
