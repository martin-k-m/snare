"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { LANGUAGES, toSnippet, type Language } from "@/lib/regex/codegen";
import { checkCompatibility, portableTo } from "@/lib/regex/compatibility";
import { useEntrance } from "@/components/ui/motion";

export function CodePanel({ pattern, flags }: { pattern: string; flags: string }) {
  const [language, setLanguage] = useState<Language>("python");
  const snippet = useMemo(() => toSnippet(pattern, flags, language), [pattern, flags, language]);
  const problems = useMemo(() => checkCompatibility(pattern, language), [pattern, language]);
  const portable = useMemo(() => portableTo(pattern, LANGUAGES), [pattern]);
  const [copied, setCopied] = useState(false);
  const entrance = useEntrance({ distance: 4, duration: 0.2 });

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-line px-2 py-1.5">
        {LANGUAGES.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setLanguage(option)}
            aria-pressed={option === language}
            title={portable.includes(option) ? undefined : "This target cannot run the pattern as written"}
            className={`relative rounded px-2 py-1 text-[11px] transition-colors ${
              option === language ? "text-fg" : portable.includes(option) ? "text-subtle hover:text-muted" : "text-subtle/50 hover:text-muted"
            }`}
          >
            {option === language && (
              <motion.span
                layoutId="code-language"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded bg-raised"
              />
            )}
            <span className="relative">
              {toSnippet("", "", option).label}
              {!portable.includes(option) && <span className="ml-1 text-warn">!</span>}
            </span>
          </button>
        ))}

        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(snippet.code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            } catch {
              setCopied(false);
            }
          }}
          className="ml-auto rounded border border-line px-2 py-1 text-[11px] text-subtle transition-colors hover:border-line-strong hover:text-fg"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <motion.div key={language} {...entrance} className="min-h-0 flex-1 overflow-auto">
        {problems.length > 0 && (
          <ul className="space-y-2 p-3 pb-0">
            {problems.map((problem) => (
              <li
                key={problem.construct}
                className="rounded-lg border border-warn/40 bg-warn/[0.07] p-3 text-xs text-muted"
              >
                <code className="font-mono text-[12px] text-fg">{problem.source}</code>
                <span className="ml-2">{problem.detail}</span>
              </li>
            ))}
          </ul>
        )}

        <pre className="px-4 py-3 font-mono text-[12px] leading-relaxed text-fg">{snippet.code}</pre>

        {snippet.notes.length > 0 && (
          <ul className="space-y-2 px-3 pb-3">
            {snippet.notes.map((note) => (
              <li
                key={note}
                className="rounded-lg border border-line bg-raised p-2.5 text-xs text-muted"
              >
                {note}
              </li>
            ))}
          </ul>
        )}
      </motion.div>
    </div>
  );
}
