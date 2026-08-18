import { describe, expect, it } from "vitest";
import { applyReplacement, collectMatches, toSegments } from "./matcher";
import { assessRisk, worstLevel } from "./risk";
import { explain } from "./explain";
import { LIBRARY } from "./library";

describe("collectMatches", () => {
  it("returns only the first match without the global flag", () => {
    const result = collectMatches({ pattern: "\\d+", flags: "", input: "a1 b22 c333" });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.matches.map((m) => m.value)).toEqual(["1"]);
  });

  it("walks every match with the global flag", () => {
    const result = collectMatches({ pattern: "\\d+", flags: "g", input: "a1 b22 c333" });
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.matches.map((m) => m.value)).toEqual(["1", "22", "333"]);
    expect(result.matches[1]?.start).toBe(4);
  });

  it("does not loop forever on a zero-length match", () => {
    const result = collectMatches({ pattern: "a*", flags: "g", input: "bbb" });
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.matches.length).toBeLessThan(10);
  });

  it("reports captures with names and offsets", () => {
    const result = collectMatches({
      pattern: "(?<key>\\w+)=(?<value>\\w+)",
      flags: "g",
      input: "mode=fast",
    });
    if (result.status !== "ok") throw new Error("expected ok");
    const [match] = result.matches;
    expect(match?.captures).toHaveLength(2);
    expect(match?.captures[0]?.name).toBe("key");
    expect(match?.captures[1]?.value).toBe("fast");
    expect(match?.captures[1]?.start).toBe(5);
  });

  it("names groups from the pattern, not by matching captured values", () => {
    // Both groups capture "1"; a value-based mapping labels them both "first".
    const result = collectMatches({
      pattern: "(?<first>\\d)(?<second>\\d)",
      flags: "",
      input: "11",
    });
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.matches[0]?.captures.map((c) => c.name)).toEqual(["first", "second"]);
  });

  it("leaves unnamed groups unnamed while numbering them", () => {
    const result = collectMatches({
      pattern: "(\\w+)-(?<tail>\\w+)",
      flags: "",
      input: "left-right",
    });
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.matches[0]?.captures.map((c) => [c.index, c.name])).toEqual([
      [1, undefined],
      [2, "tail"],
    ]);
  });

  it("truncates at the requested limit", () => {
    const result = collectMatches({ pattern: "a", flags: "g", input: "a".repeat(50), limit: 10 });
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.matches).toHaveLength(10);
    expect(result.truncated).toBe(true);
  });

  it("surfaces an invalid pattern instead of throwing", () => {
    const result = collectMatches({ pattern: "a(", flags: "", input: "a" });
    expect(result.status).toBe("invalid");
  });
});

describe("toSegments", () => {
  it("splits input into plain and matched runs", () => {
    const input = "a1b22c";
    const result = collectMatches({ pattern: "\\d+", flags: "g", input });
    if (result.status !== "ok") throw new Error("expected ok");
    const segments = toSegments(input, result.matches);
    expect(segments.map((s) => s.text).join("")).toBe(input);
    expect(segments.filter((s) => s.matchOrdinal !== null).map((s) => s.text)).toEqual(["1", "22"]);
  });
});

describe("applyReplacement", () => {
  it("supports numbered and named group references", () => {
    expect(
      applyReplacement({
        pattern: "(\\w+)@(\\w+)",
        flags: "g",
        input: "ops@acme",
        replacement: "$2/$1",
      }),
    ).toEqual({ status: "ok", output: "acme/ops", changed: true });

    expect(
      applyReplacement({
        pattern: "(?<a>\\d)-(?<b>\\d)",
        flags: "",
        input: "1-2",
        replacement: "$<b>$<a>",
      }),
    ).toEqual({ status: "ok", output: "21", changed: true });
  });
});

describe("assessRisk", () => {
  it("flags nested unbounded repetition", () => {
    const findings = assessRisk(explain("(a+)+$"));
    expect(worstLevel(findings)).toBe("high");
  });

  it("flags two adjacent repeats over the same characters", () => {
    const findings = assessRisk(explain(".*.*"));
    expect(findings.some((f) => f.title.includes("adjacent"))).toBe(true);
  });

  it("stays quiet on ordinary patterns", () => {
    expect(assessRisk(explain("^\\d{4}-\\d{2}-\\d{2}$"))).toHaveLength(0);
    expect(assessRisk(explain("[\\w.+-]+@[\\w-]+\\.[\\w.-]+"))).toHaveLength(0);
  });
});

describe("library", () => {
  it("ships patterns that compile and match their own sample", () => {
    for (const entry of LIBRARY) {
      const result = collectMatches({
        pattern: entry.pattern,
        flags: entry.flags,
        input: entry.sample,
      });
      expect(result.status, `${entry.id} should compile`).toBe("ok");
      if (result.status !== "ok") continue;
      expect(result.matches.length, `${entry.id} should match its sample`).toBeGreaterThan(0);
    }
  });

  it("uses unique ids", () => {
    expect(new Set(LIBRARY.map((e) => e.id)).size).toBe(LIBRARY.length);
  });
});
