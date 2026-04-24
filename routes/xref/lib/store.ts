import path from "path";
import { readFileSync } from "fs";

import { env } from "../../../utils/misc.js";
import { DataEntry } from "./search.js";
import { HeadingEntry, HeadingsBySpec } from "./scraper.js";

export class Store {
  version = -1;
  bySpec: { [shortname: string]: DataEntry[] } = {};
  byTerm: { [term: string]: DataEntry[] } = {};
  specmap: {
    [group: string]: {
      [specid: string]: {
        url: string;
        shortname: string;
        title: string;
      };
    };
  } = {};
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
    let specHeadings = this.headings[normalizedSpec];
    // Fallback: try stripping version suffix (e.g., cssom-view → cssom-view-1)
    // or adding it via specmap lookup
    if (!specHeadings) {
      const stripped = normalizedSpec.replace(/-\d+$/, "");
      if (stripped !== normalizedSpec) {
        specHeadings = this.headings[stripped];
      }
      if (!specHeadings) {
        // Try resolving series shortname to versioned via specmap
        for (const [specId, entry] of this.specmapEntries()) {
          if (entry.shortname === normalizedSpec || entry.shortname === stripped) {
            specHeadings = this.headings[specId];
            if (specHeadings) break;
          }
        }
      }
    }
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

  private *specmapEntries() {
    for (const group of Object.values(this.specmap)) {
      for (const [specId, entry] of Object.entries(
        group as unknown as Record<string, { url: string; shortname: string; title: string }>
      )) {
        yield [specId, entry] as const;
      }
    }
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
  } catch (err: any) {
    if (err?.code === "ENOENT") {
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
    for (const entry of Object.values(group as unknown as Record<string, { url: string; shortname: string; title: string }>)) {
      result.set(entry.shortname, entry.title);
    }
  }
  return result;
}
