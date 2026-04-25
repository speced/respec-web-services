import path from "path";
import { readFileSync } from "fs";

import { env } from "../../../utils/misc.js";
import { DataEntry } from "./search.js";
import { HeadingEntry, HeadingsBySpec } from "./scraper.js";

export type SpecMapGroup = {
  [specid: string]: {
    url: string;
    shortname: string;
    title: string;
  };
};

export class Store {
  version = -1;
  bySpec: { [shortname: string]: DataEntry[] } = {};
  byTerm: { [term: string]: DataEntry[] } = {};
  specmap: { [group: string]: SpecMapGroup } = {};
  /** Headings pre-indexed by spec shortname, then by fragment id. */
  headings: HeadingsBySpec = {};
  /** Reverse lookup: shortname → spec title. */
  private specTitleByShortname: Map<string, string> = new Map();

  constructor() {
    this.fill();
  }

  /** Fill the store with its contents from the filesystem. */
  fill() {
    this.byTerm = readJson("xref.json");
    this.bySpec = readJson("specs.json");
    this.specmap = readJson("specmap.json");
    this.headings = readJsonOptional("headings.json");
    this.specTitleByShortname = buildSpecTitleMap(this.specmap);
    this.version = Date.now();
  }

  /** Look up a heading by spec shortname and fragment id. */
  getHeading(
    spec: string,
    id: string,
  ): (HeadingEntry & { specTitle: string }) | null {
    const normalizedSpec = spec.toLowerCase();
    const specHeadings = this.resolveHeadings(normalizedSpec);
    if (!specHeadings) return null;

    const heading = specHeadings[id];
    if (!heading) return null;

    return {
      ...heading,
      specTitle: this.specTitleByShortname.get(normalizedSpec)
        || this.specTitleByShortname.get(normalizedSpec.replace(/-\d+$/, ""))
        || spec,
    };
  }

  private resolveHeadings(spec: string): Record<string, HeadingEntry> | null {
    const direct = this.headings[spec];
    if (direct) return direct;

    // Try stripping version suffix (e.g., cssom-view-1 → cssom-view)
    const stripped = spec.replace(/-\d+$/, "");
    if (stripped !== spec) {
      const unversioned = this.headings[stripped];
      if (unversioned) return unversioned;
    }

    // Try resolving series shortname to versioned (or vice versa) via specmap
    for (const group of Object.values(this.specmap)) {
      for (const [specId, entry] of Object.entries(group)) {
        if (entry.shortname === spec || entry.shortname === stripped) {
          const resolved = this.headings[specId];
          if (resolved) return resolved;
        }
      }
    }

    return null;
  }
}

/** Read a required JSON data file. Throws if missing. */
function readJson(filename: string) {
  const DATA_DIR = env("DATA_DIR");
  const dataFile = path.resolve(DATA_DIR, `./xref/${filename}`);
  const text = readFileSync(dataFile, "utf8");
  return JSON.parse(text);
}

/** Read an optional JSON data file. Returns {} if missing. */
function readJsonOptional(filename: string) {
  try {
    return readJson(filename);
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      console.warn(`Optional data file not found: ${filename}`);
      return {};
    }
    throw err;
  }
}

/** Build a shortname → title map from the specmap for O(1) title lookup. */
function buildSpecTitleMap(specmap: Store["specmap"]): Map<string, string> {
  const result = new Map<string, string>();
  // specmap is { current: { [specid]: entry }, snapshot: { [specid]: entry } }
  for (const group of Object.values(specmap)) {
    for (const entry of Object.values(group)) {
      result.set(entry.shortname, entry.title);
    }
  }
  return result;
}
