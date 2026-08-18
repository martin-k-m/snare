"use client";

import { useEffect, useRef, useState } from "react";
import { collectMatches, type MatchOutcome, type MatchRequest } from "@/lib/regex/matcher";
import type { WorkerRequest, WorkerResponse } from "@/lib/regex/matcher.worker";

export type MatcherState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; outcome: MatchOutcome; isolated: boolean }
  | { kind: "timeout"; budgetMs: number };

const TIMEOUT_MS = 900;

function createWorker(): Worker | null {
  try {
    return new Worker(new URL("../regex/matcher.worker.ts", import.meta.url));
  } catch {
    return null;
  }
}

/**
 * Runs a pattern against the input off the main thread, terminating the worker
 * if it does not answer within the time budget. Falls back to running inline
 * where workers are unavailable, in which case the budget cannot be enforced.
 */
export function useMatcher(request: MatchRequest): MatcherState {
  const [state, setState] = useState<MatcherState>({ kind: "idle" });
  const workerRef = useRef<Worker | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const { pattern, flags, input, limit } = request;

  useEffect(() => {
    if (pattern === "") {
      setState({ kind: "done", outcome: { status: "ok", matches: [], truncated: false, durationMs: 0 }, isolated: true });
      return;
    }

    workerRef.current ??= createWorker();
    const worker = workerRef.current;

    if (!worker) {
      setState({ kind: "done", outcome: collectMatches({ pattern, flags, input, limit }), isolated: false });
      return;
    }

    requestId.current += 1;
    const id = requestId.current;
    setState({ kind: "running" });

    const timer = setTimeout(() => {
      worker.terminate();
      workerRef.current = null;
      setState({ kind: "timeout", budgetMs: TIMEOUT_MS });
    }, TIMEOUT_MS);

    const onMessage = (event: MessageEvent<WorkerResponse>) => {
      if (event.data.id !== id) return;
      clearTimeout(timer);
      setState({ kind: "done", outcome: event.data.outcome, isolated: true });
    };

    worker.addEventListener("message", onMessage);
    worker.postMessage({ id, pattern, flags, input, limit } satisfies WorkerRequest);

    return () => {
      clearTimeout(timer);
      worker.removeEventListener("message", onMessage);
    };
  }, [pattern, flags, input, limit]);

  return state;
}
