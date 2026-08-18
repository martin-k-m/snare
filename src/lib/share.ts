import type { Expectation } from "./regex/expectations";

export interface ShareState {
  pattern: string;
  flags: string;
  input: string;
  replacement: string;
  expectations: Expectation[];
}

/** Base64url so the payload survives a URL fragment without escaping newlines. */
function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeState(state: ShareState): string {
  return toBase64Url(JSON.stringify(state));
}

export function decodeState(fragment: string): ShareState | null {
  const raw = fragment.startsWith("#") ? fragment.slice(1) : fragment;
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(raw));
    if (typeof parsed !== "object" || parsed === null) return null;
    const value = parsed as Partial<ShareState>;
    return {
      pattern: typeof value.pattern === "string" ? value.pattern : "",
      flags: typeof value.flags === "string" ? value.flags : "g",
      input: typeof value.input === "string" ? value.input : "",
      replacement: typeof value.replacement === "string" ? value.replacement : "",
      // Links shared before expectations existed simply carry none.
      expectations: Array.isArray(value.expectations)
        ? value.expectations.filter(
            (item): item is Expectation =>
              typeof item?.id === "string" &&
              typeof item?.text === "string" &&
              typeof item?.shouldMatch === "boolean",
          )
        : [],
    };
  } catch {
    return null;
  }
}
