export interface Reference {
  id?: string;
  aliasOf?: string;
  versionOf?: string;
  title?: string;
  href?: string;
  [key: string]: unknown;
}

export type References = Record<string, Reference>;

/**
 * Reject a data file holding fewer references than this.
 *
 * The real database holds around 150,000, so this is a floor for spotting a
 * truncated or half-written build rather than a meaningful lower bound on the
 * data itself.
 */
export const SMALLEST_PLAUSIBLE_DATABASE = 80_000;

/**
 * Reference identifiers we refuse to look up or to answer with. Checked at both
 * ends, because the data can carry `aliasOf: "__proto__"` as easily as a caller
 * can ask for it.
 */
const UNSAFE_KEY = /^(?:__proto__|constructor|prototype)$/i;

export function isUnsafeKey(key: string) {
  return UNSAFE_KEY.test(key);
}

const SENTINELS = ["WEBIDL", "rfc2119", "HTML", "rfc5234"];

const SENTINEL_ALIASES = [
  ["ABNF", "RFC5234"],
  ["RFC5234", "rfc5234"],
];

/** @returns a reason to reject the data, or null if it is fit to serve. */
export function validate(data: unknown): string | null {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return "not a plain object";
  }
  const references = data as References;
  const size = Object.keys(references).length;
  if (size < SMALLEST_PLAUSIBLE_DATABASE)
    return `only ${size} references, expected ${SMALLEST_PLAUSIBLE_DATABASE}+`;

  for (const id of SENTINELS) {
    const entry = references[id];
    if (typeof entry?.href !== "string" || typeof entry?.title !== "string") {
      return `sentinel ${id} is missing or malformed`;
    }
  }

  for (const [id, target] of SENTINEL_ALIASES) {
    if (references[id]?.aliasOf !== target)
      return `alias chain broken at ${id}`;
  }

  return null;
}
