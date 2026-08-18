/**
 * Pattern execution, kept free of DOM and React so it can run in a worker and
 * be unit tested directly.
 */

import { captureNames } from "./explain";

export interface MatchRequest {
  pattern: string;
  flags: string;
  input: string;
  /** Upper bound on returned matches; protects the UI from pathological input. */
  limit?: number;
}

export interface CaptureInfo {
  index: number;
  name?: string;
  value: string | undefined;
  start: number | null;
  end: number | null;
}

export interface MatchRecord {
  ordinal: number;
  start: number;
  end: number;
  value: string;
  captures: CaptureInfo[];
}

export type MatchOutcome =
  | {
      status: "ok";
      matches: MatchRecord[];
      truncated: boolean;
      durationMs: number;
    }
  | { status: "invalid"; message: string };

const DEFAULT_LIMIT = 500;

/** Adds the `d` flag when the engine supports it, so captures carry offsets. */
function compile(pattern: string, flags: string): RegExp {
  const withIndices = flags.includes("d") ? flags : `${flags}d`;
  try {
    return new RegExp(pattern, withIndices);
  } catch {
    return new RegExp(pattern, flags);
  }
}

function readCaptures(match: RegExpExecArray, names: Array<string | undefined>): CaptureInfo[] {
  const indices = (match as RegExpExecArray & { indices?: Array<[number, number] | undefined> })
    .indices;

  const captures: CaptureInfo[] = [];
  for (let i = 1; i < match.length; i += 1) {
    const span = indices?.[i];
    captures.push({
      index: i,
      name: names[i - 1],
      value: match[i],
      start: span ? span[0] : null,
      end: span ? span[1] : null,
    });
  }
  return captures;
}

export function collectMatches(request: MatchRequest, now: () => number = () => Date.now()): MatchOutcome {
  const { pattern, flags, input } = request;
  const limit = request.limit ?? DEFAULT_LIMIT;

  if (pattern === "") return { status: "ok", matches: [], truncated: false, durationMs: 0 };

  let regex: RegExp;
  try {
    regex = compile(pattern, flags);
  } catch (error) {
    return {
      status: "invalid",
      message: error instanceof Error ? error.message.replace(/^Invalid regular expression:\s*/, "") : "Invalid pattern",
    };
  }

  // Group names come from parsing the pattern, so groups that captured the same
  // text are still told apart.
  const names = captureNames(pattern);
  const started = now();
  const matches: MatchRecord[] = [];
  let truncated = false;

  if (!regex.global && !regex.sticky) {
    const single = regex.exec(input);
    if (single) {
      matches.push({
        ordinal: 0,
        start: single.index,
        end: single.index + single[0].length,
        value: single[0],
        captures: readCaptures(single, names),
      });
    }
    return { status: "ok", matches, truncated: false, durationMs: now() - started };
  }

  regex.lastIndex = 0;
  let guard = 0;
  for (;;) {
    const match = regex.exec(input);
    if (!match) break;

    matches.push({
      ordinal: matches.length,
      start: match.index,
      end: match.index + match[0].length,
      value: match[0],
      captures: readCaptures(match, names),
    });

    if (match[0] === "") regex.lastIndex += 1;
    if (matches.length >= limit) {
      truncated = true;
      break;
    }
    guard += 1;
    if (guard > input.length + limit) break;
  }

  return { status: "ok", matches, truncated, durationMs: now() - started };
}

export interface ReplaceRequest extends MatchRequest {
  replacement: string;
}

export type ReplaceOutcome =
  | { status: "ok"; output: string; changed: boolean }
  | { status: "invalid"; message: string };

export function applyReplacement(request: ReplaceRequest): ReplaceOutcome {
  const { pattern, flags, input, replacement } = request;
  if (pattern === "") return { status: "ok", output: input, changed: false };

  try {
    const regex = new RegExp(pattern, flags.replace("d", ""));
    const output = input.replace(regex, replacement);
    return { status: "ok", output, changed: output !== input };
  } catch (error) {
    return {
      status: "invalid",
      message: error instanceof Error ? error.message : "Replacement failed",
    };
  }
}

export interface Segment {
  text: string;
  /** `null` for text outside any match. */
  matchOrdinal: number | null;
}

/** Splits input into alternating plain and matched segments for highlighting. */
export function toSegments(input: string, matches: MatchRecord[]): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;

  for (const match of matches) {
    if (match.start < cursor) continue; // overlapping zero-length artefacts
    if (match.start > cursor) {
      segments.push({ text: input.slice(cursor, match.start), matchOrdinal: null });
    }
    if (match.end > match.start) {
      segments.push({ text: input.slice(match.start, match.end), matchOrdinal: match.ordinal });
    }
    cursor = Math.max(cursor, match.end);
  }

  if (cursor < input.length) {
    segments.push({ text: input.slice(cursor), matchOrdinal: null });
  }
  return segments;
}
