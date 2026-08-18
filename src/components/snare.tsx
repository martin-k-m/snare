"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { PatternField, type PatternHighlight } from "@/components/pattern-field";
import { TestCanvas } from "@/components/test-canvas";
import { MatchList } from "@/components/match-list";
import { ExplainTree } from "@/components/explain-tree";
import { RiskBadge, RiskList } from "@/components/risk-list";
import { ReplacePanel } from "@/components/replace-panel";
import { LibraryPalette } from "@/components/library-palette";
import { Panel } from "@/components/ui/panel";
import { Button, Kbd, Tabs } from "@/components/ui/controls";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useMatcher } from "@/lib/hooks/use-matcher";
import { applyReplacement, toSegments, type MatchRecord } from "@/lib/regex/matcher";
import { explain, PatternError, type RxNode } from "@/lib/regex/explain";
import { assessRisk, worstLevel } from "@/lib/regex/risk";
import { LIBRARY, type LibraryEntry } from "@/lib/regex/library";
import { decodeState, encodeState } from "@/lib/share";
import { ExpectationsPanel } from "@/components/expectations-panel";
import { CodePanel } from "@/components/code-panel";
import { evaluateExpectations, type Expectation } from "@/lib/regex/expectations";

type Tab = "matches" | "explain" | "risk" | "expect" | "code";

const INITIAL = LIBRARY.find((entry) => entry.id === "log-line")!;
const NO_MATCHES: MatchRecord[] = [];

const INITIAL_EXPECTATIONS: Expectation[] = [
  { id: "x1", text: "2026-08-18T09:15:00Z INFO worker started", shouldMatch: true },
  { id: "x2", text: "2026-08-18T09:15:04Z ERROR upstream timeout", shouldMatch: true },
  { id: "x3", text: "not a log line", shouldMatch: false },
];

export function Snare() {
  const [pattern, setPattern] = useState(INITIAL.pattern);
  const [flags, setFlags] = useState(INITIAL.flags);
  const [input, setInput] = useState(INITIAL.sample);
  const [replacement, setReplacement] = useState("$<level> · $<msg>");
  const [tab, setTab] = useState<Tab>("matches");
  const [activeOrdinal, setActiveOrdinal] = useState<number | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [highlight, setHighlight] = useState<PatternHighlight | null>(null);
  const [expectations, setExpectations] = useState<Expectation[]>(INITIAL_EXPECTATIONS);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Restore a shared permalink before the first match runs.
  useEffect(() => {
    const shared = decodeState(window.location.hash);
    if (!shared) return;
    setPattern(shared.pattern);
    setFlags(shared.flags);
    setInput(shared.input);
    setReplacement(shared.replacement);
    if (shared.expectations.length > 0) setExpectations(shared.expectations);
  }, []);

  // Keep the address bar in step so a refresh — or a copied URL — restores the
  // exact state. Debounced, and replaceState so it does not fill up history.
  useEffect(() => {
    const timer = setTimeout(() => {
      const hash = encodeState({ pattern, flags, input, replacement, expectations });
      window.history.replaceState(null, "", `#${hash}`);
    }, 400);
    return () => clearTimeout(timer);
  }, [pattern, flags, input, replacement, expectations]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const deferredPattern = useDeferredValue(pattern);
  const deferredInput = useDeferredValue(input);
  const state = useMatcher({ pattern: deferredPattern, flags, input: deferredInput });

  const parsed = useMemo<{ tree: RxNode[]; error: PatternError | null }>(() => {
    if (deferredPattern === "") return { tree: [], error: null };
    try {
      return { tree: explain(deferredPattern), error: null };
    } catch (error) {
      return { tree: [], error: error instanceof PatternError ? error : null };
    }
  }, [deferredPattern]);

  const findings = useMemo(() => assessRisk(parsed.tree), [parsed.tree]);
  const report = useMemo(
    () => evaluateExpectations(deferredPattern, flags, expectations),
    [deferredPattern, flags, expectations],
  );
  const risk = worstLevel(findings);

  const outcome = state.kind === "done" ? state.outcome : null;
  const matches = useMemo(
    () => (outcome?.status === "ok" ? outcome.matches : NO_MATCHES),
    [outcome],
  );
  const segments = useMemo(() => toSegments(deferredInput, matches), [deferredInput, matches]);

  const engineError =
    outcome?.status === "invalid"
      ? { message: outcome.message, index: parsed.error?.index }
      : parsed.error
        ? { message: parsed.error.message, index: parsed.error.index }
        : null;

  // Only run a replacement once the worker has proved the pattern terminates on
  // this input, so the main thread cannot be trapped by backtracking.
  const replaced = useMemo(() => {
    if (outcome?.status !== "ok") return null;
    return applyReplacement({ pattern: deferredPattern, flags, input: deferredInput, replacement });
  }, [outcome?.status, deferredPattern, flags, deferredInput, replacement]);

  const toggleFlag = useCallback((flag: string) => {
    setFlags((current) =>
      current.includes(flag)
        ? current.replace(flag, "")
        : [...current.split(""), flag].sort().join(""),
    );
  }, []);

  const loadEntry = useCallback((entry: LibraryEntry) => {
    setPattern(entry.pattern);
    setFlags(entry.flags);
    setInput(entry.sample);
    setActiveOrdinal(null);
  }, []);

  const revealMatch = useCallback((match: MatchRecord) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(match.start, match.end);
  }, []);

  const copyMatches = useCallback(async () => {
    const payload = matches.map((match) => ({
      match: match.value,
      start: match.start,
      end: match.end,
      groups: Object.fromEntries(
        match.captures.map((capture) => [capture.name ?? capture.index, capture.value ?? null]),
      ),
    }));
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 1600);
    } catch {
      setCopiedJson(false);
    }
  }, [matches]);

  const share = useCallback(async () => {
    const hash = encodeState({ pattern, flags, input, replacement, expectations });
    const url = `${window.location.origin}${window.location.pathname}#${hash}`;
    window.history.replaceState(null, "", `#${hash}`);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }, [pattern, flags, input, replacement, expectations]);

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-[1500px] flex-col gap-3 p-3 lg:h-[100dvh] lg:p-4">
      <header className="flex shrink-0 items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h1 className="font-mono text-sm font-medium tracking-tight text-fg">
            snare<span className="text-accent">.</span>
          </h1>
          <p className="hidden text-xs text-subtle sm:block">
            Regular expressions: match, explain, and catch the backtracking traps.
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <Button variant="outline" onClick={() => setPaletteOpen(true)}>
            Library <Kbd>⌘K</Kbd>
          </Button>
          <Button variant="outline" onClick={share}>
            {copied ? "Link copied" : "Copy link"}
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[1.1fr_1fr]">
        <div className="flex min-h-0 flex-col gap-3">
          <Panel order={0} className="shrink-0" bodyClassName="">
            <PatternField
              pattern={pattern}
              flags={flags}
              error={engineError}
              highlight={highlight}
              onPatternChange={setPattern}
              onToggleFlag={toggleFlag}
            />
          </Panel>

          <Panel
            order={1}
            title="Test input"
            hint={`${deferredInput.length.toLocaleString()} characters`}
            actions={<StatusPill state={state} count={matches.length} />}
            className="min-h-0 flex-1"
            bodyClassName="relative"
          >
            <TestCanvas
              value={input}
              onChange={setInput}
              segments={segments}
              activeOrdinal={activeOrdinal}
              onHoverMatch={setActiveOrdinal}
              textareaRef={textareaRef}
            />
          </Panel>

          <Panel order={2} title="Replace" className="h-52 shrink-0">
            <ReplacePanel
              replacement={replacement}
              onChange={setReplacement}
              output={replaced?.status === "ok" ? replaced.output : null}
              error={replaced?.status === "invalid" ? replaced.message : null}
              changed={replaced?.status === "ok" ? replaced.changed : false}
            />
          </Panel>
        </div>

        <Panel
          order={3}
          className="min-h-0"
          actions={
            <div className="flex items-center gap-2">
              {tab === "risk" && <RiskBadge level={risk} />}
              {tab === "matches" && matches.length > 0 && (
                <Button variant="ghost" onClick={copyMatches}>
                  {copiedJson ? "Copied" : "Copy JSON"}
                </Button>
              )}
              <Tabs
                layoutId="inspector-tab"
                value={tab}
                onChange={setTab}
                options={[
                  { value: "matches", label: "Matches", badge: matches.length },
                  { value: "explain", label: "Explain" },
                  { value: "risk", label: "Risk", badge: findings.length || undefined },
                  { value: "expect", label: "Tests", badge: report.failed || undefined },
                  { value: "code", label: "Code" },
                ]}
              />
            </div>
          }
          bodyClassName="relative"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
              className="absolute inset-0"
            >
              {tab === "matches" && (
                <MatchList
                  matches={matches}
                  activeOrdinal={activeOrdinal}
                  onHover={setActiveOrdinal}
                  onSelect={revealMatch}
                  truncated={outcome?.status === "ok" ? outcome.truncated : false}
                />
              )}
              {tab === "explain" && (
                <ExplainTree
                  nodes={parsed.tree}
                  onHover={(node) =>
                    setHighlight(node ? { start: node.start, end: node.end } : null)
                  }
                />
              )}
              {tab === "risk" && <RiskList findings={findings} />}
              {tab === "expect" && (
                <ExpectationsPanel
                  expectations={expectations}
                  report={report}
                  onChange={(id, patch) =>
                    setExpectations((current) =>
                      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
                    )
                  }
                  onRemove={(id) =>
                    setExpectations((current) => current.filter((item) => item.id !== id))
                  }
                  onAdd={() =>
                    setExpectations((current) => [
                      ...current,
                      { id: `x${Date.now().toString(36)}`, text: "", shouldMatch: true },
                    ])
                  }
                />
              )}
              {tab === "code" && <CodePanel pattern={deferredPattern} flags={flags} />}
            </motion.div>
          </AnimatePresence>
        </Panel>
      </div>

      <LibraryPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onPick={loadEntry}
      />
    </div>
  );
}

function StatusPill({
  state,
  count,
}: {
  state: ReturnType<typeof useMatcher>;
  count: number;
}) {
  if (state.kind === "timeout") {
    return (
      <span className="rounded bg-err/15 px-2 py-0.5 text-[11px] text-err">
        stopped after {state.budgetMs}ms — see Risk
      </span>
    );
  }
  if (state.kind === "running") {
    return (
      <motion.span
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.1, repeat: Infinity }}
        className="text-[11px] text-subtle"
      >
        matching…
      </motion.span>
    );
  }
  if (state.kind === "done" && state.outcome.status === "ok") {
    return (
      <span className="tabular text-[11px] text-subtle">
        {count} {count === 1 ? "match" : "matches"} · {state.outcome.durationMs}ms
        {state.isolated ? "" : " · inline"}
      </span>
    );
  }
  return null;
}
