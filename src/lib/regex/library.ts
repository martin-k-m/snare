export interface LibraryEntry {
  id: string;
  name: string;
  category: "Web" | "Data" | "Code" | "Text";
  pattern: string;
  flags: string;
  sample: string;
  note: string;
}

/**
 * Patterns chosen because they are the ones people actually reach for, with
 * honest notes about where each one stops being correct.
 */
export const LIBRARY: LibraryEntry[] = [
  {
    id: "email",
    name: "Email address",
    category: "Web",
    pattern: "[\\w.+-]+@[\\w-]+\\.[\\w.-]+",
    flags: "g",
    sample: "ops@example.com, no-reply+alerts@mail.acme.co.uk, not an address",
    note: "Good enough to find addresses in text. Deliverability is the only real validation.",
  },
  {
    id: "url",
    name: "HTTP(S) URL",
    category: "Web",
    pattern: "https?://[^\\s<>\"')]+",
    flags: "g",
    sample: "See https://example.com/docs?ref=1 and http://localhost:3000/health.",
    note: "Stops at whitespace and common closing punctuation.",
  },
  {
    id: "ipv4",
    name: "IPv4 address",
    category: "Data",
    pattern: "\\b(?:(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)\\b",
    flags: "g",
    sample: "10.0.0.1 routes to 192.168.1.254 but 999.1.1.1 is not an address.",
    note: "Range-checked per octet, so 256.0.0.1 is correctly rejected.",
  },
  {
    id: "uuid",
    name: "UUID (any version)",
    category: "Data",
    pattern: "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}",
    flags: "gi",
    sample: "trace 9f2c1b7e-53a1-4a70-9a1e-2c0b8a7d6e55 completed",
    note: "Shape only. Add a version nibble check if you need v4 specifically.",
  },
  {
    id: "iso-date",
    name: "ISO 8601 timestamp",
    category: "Data",
    pattern: "(?<date>\\d{4}-\\d{2}-\\d{2})[T ](?<time>\\d{2}:\\d{2}(?::\\d{2})?)(?<zone>Z|[+-]\\d{2}:?\\d{2})?",
    flags: "g",
    sample: "2026-08-18T09:15:00Z and 2026-08-18 09:15+02:00",
    note: "Named groups make the parts easy to pull out in a replacement.",
  },
  {
    id: "semver",
    name: "Semantic version",
    category: "Code",
    pattern: "\\bv?(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)(?:-(?<pre>[0-9A-Za-z.-]+))?\\b",
    flags: "g",
    sample: "upgrading from v1.4.2 to 2.0.0-rc.1",
    note: "Follows the semver spec for the numeric core and prerelease tag.",
  },
  {
    id: "hex-color",
    name: "Hex colour",
    category: "Code",
    pattern: "#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\b",
    flags: "g",
    sample: "--bg: #0f1117; --accent: #7C6CFF; --bad: #12345",
    note: "Accepts the 3 and 6 digit forms; the word boundary rejects longer runs.",
  },
  {
    id: "slug",
    name: "URL slug",
    category: "Text",
    pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
    flags: "",
    sample: "regex-playground-for-teams",
    note: "Anchored, so it validates a whole string rather than finding one.",
  },
  {
    id: "log-line",
    name: "Log line with level",
    category: "Text",
    pattern: "^(?<ts>\\S+)\\s+(?<level>TRACE|DEBUG|INFO|WARN|ERROR)\\s+(?<msg>.*)$",
    flags: "gm",
    sample:
      "2026-08-18T09:15:00Z INFO worker started\n2026-08-18T09:15:04Z ERROR upstream timeout after 30s\n2026-08-18T09:15:09Z WARN retry 1 of 3",
    note: "The m flag makes ^ and $ line anchors, so each line is matched separately.",
  },
  {
    id: "duplicate-word",
    name: "Repeated word",
    category: "Text",
    pattern: "\\b(\\w+)\\s+\\1\\b",
    flags: "gi",
    sample: "This this slipped past review, but the the second one did not.",
    note: "Uses a backreference: group 1 must appear again verbatim.",
  },
];
