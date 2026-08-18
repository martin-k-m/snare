import { collectMatches, type MatchOutcome, type MatchRequest } from "./matcher";

export interface WorkerRequest extends MatchRequest {
  id: number;
}

export interface WorkerResponse {
  id: number;
  outcome: MatchOutcome;
}

/**
 * Matching runs here so a pattern that backtracks forever can be terminated
 * without taking the page down with it.
 */
const ctx = self as unknown as {
  addEventListener(type: "message", listener: (event: MessageEvent<WorkerRequest>) => void): void;
  postMessage(message: WorkerResponse): void;
};

ctx.addEventListener("message", (event) => {
  const { id, ...request } = event.data;
  ctx.postMessage({ id, outcome: collectMatches(request) });
});
