"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { Segment } from "@/lib/regex/matcher";

interface TestCanvasProps {
  value: string;
  onChange: (value: string) => void;
  segments: Segment[];
  activeOrdinal: number | null;
  onHoverMatch: (ordinal: number | null) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

/**
 * A textarea with a highlight layer rendered behind it. Both layers share the
 * exact same typography and padding so the painted spans line up with the real
 * glyphs, and scrolling is mirrored from the textarea to the layer below.
 */
export function TestCanvas({
  value,
  onChange,
  segments,
  activeOrdinal,
  onHoverMatch,
  textareaRef,
}: TestCanvasProps) {
  const layerRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const layer = layerRef.current;
    const textarea = textareaRef.current;
    if (layer && textarea) {
      layer.scrollTop = textarea.scrollTop;
      layer.scrollLeft = textarea.scrollLeft;
    }
  }, [value, segments, textareaRef]);

  const shared =
    "absolute inset-0 h-full w-full whitespace-pre-wrap break-words px-4 py-3 font-mono text-[13px] leading-[1.65]";

  return (
    <div className="relative h-full">
      <pre ref={layerRef} aria-hidden className={`${shared} overflow-hidden text-transparent`}>
        {segments.map((segment, index) =>
          segment.matchOrdinal === null ? (
            <span key={index}>{segment.text}</span>
          ) : (
            <mark
              key={index}
              onMouseEnter={() => onHoverMatch(segment.matchOrdinal)}
              onMouseLeave={() => onHoverMatch(null)}
              data-active={segment.matchOrdinal === activeOrdinal || undefined}
              className="rounded-[3px] bg-accent-soft text-transparent ring-1 ring-accent/25 transition-colors data-[active]:bg-accent data-[active]:ring-accent"
            >
              {segment.text}
            </mark>
          ),
        )}
        {"\n"}
      </pre>

      <textarea
        ref={textareaRef}
        value={value}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        onScroll={(event) => {
          const layer = layerRef.current;
          if (!layer) return;
          layer.scrollTop = event.currentTarget.scrollTop;
          layer.scrollLeft = event.currentTarget.scrollLeft;
        }}
        placeholder="Paste the text you are matching against…"
        aria-label="Test input"
        className={`${shared} resize-none overflow-auto bg-transparent text-fg caret-accent outline-none placeholder:text-subtle`}
      />
    </div>
  );
}
