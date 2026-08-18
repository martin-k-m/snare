import { collectMatches } from "./matcher";

/**
 * A pattern is rarely finished when it matches the happy case; it is finished
 * when it also rejects the cases it must reject. Expectations turn that into
 * something you can see fail.
 */
export interface Expectation {
  id: string;
  text: string;
  /** What this case asserts: that the pattern matches it, or that it does not. */
  shouldMatch: boolean;
}

export interface ExpectationResult {
  expectation: Expectation;
  matched: boolean;
  passed: boolean;
  /** The text the pattern actually matched, for a case that matched. */
  matchedText?: string;
}

export interface ExpectationReport {
  results: ExpectationResult[];
  passed: number;
  failed: number;
  /** Null when the pattern itself does not compile. */
  error: string | null;
}

export function evaluateExpectations(
  pattern: string,
  flags: string,
  expectations: Expectation[],
): ExpectationReport {
  if (pattern === "") {
    return { results: [], passed: 0, failed: 0, error: null };
  }

  const results: ExpectationResult[] = [];

  for (const expectation of expectations) {
    // Each case is judged on its own, so `g` and `lastIndex` cannot leak
    // between them. The first match is all an assertion needs.
    const outcome = collectMatches({
      pattern,
      flags: flags.replace("g", ""),
      input: expectation.text,
      limit: 1,
    });

    if (outcome.status === "invalid") {
      return { results: [], passed: 0, failed: 0, error: outcome.message };
    }

    const first = outcome.matches[0];
    const matched = first !== undefined;
    results.push({
      expectation,
      matched,
      passed: matched === expectation.shouldMatch,
      matchedText: first?.value,
    });
  }

  return {
    results,
    passed: results.filter((result) => result.passed).length,
    failed: results.filter((result) => !result.passed).length,
    error: null,
  };
}

/**
 * Whether the pattern matches the *whole* string rather than part of it — the
 * distinction behind most "why did my validator accept that?" bugs.
 */
export function matchesEntirely(pattern: string, flags: string, text: string): boolean {
  const outcome = collectMatches({ pattern, flags: flags.replace("g", ""), input: text, limit: 1 });
  if (outcome.status === "invalid") return false;
  const first = outcome.matches[0];
  return first !== undefined && first.start === 0 && first.end === text.length;
}
