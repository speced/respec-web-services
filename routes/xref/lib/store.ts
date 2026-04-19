import path from "path";
import { readFileSync, existsSync } from "fs";

import { env } from "../../../utils/misc.js";
import { DataEntry } from "./search.js";
import { HeadingEntry, HeadingsBySpec } from "./scraper.js";

/** Headings indexed by id for O(1) lookup. */
type HeadingsIndex = {
  [shortname: string]: { [id: string]: HeadingEntry };
};

export class Store {
  version = -1;
  bySpec: { [shortname: string]: DataEntry[] } = {};
  byTerm: { [term: string]: DataEntry[] } = {};
  specmap: {
    [specid: string]: {
      url: string;
      shortname: string;
      title: string;
    };
  } = {};
  /** Headings indexed by spec shortname, then by fragment id. */
  headings: HeadingsIndex = {};
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
    const rawHeadings: HeadingsBySpec = readJsonOptional("headings.json");
    this.headings = indexHeadings(rawHeadings);
    this.specTitleByShortname = buildSpecTitleMap(this.specmap);
    this.version = Date.now();
  }

  /** Look up a heading by spec shortname and fragment id. */
  getHeading(
    spec: string,
    id: string,
  ): (HeadingEntry & { specTitle: string }) | null {
    const normalizedSpec = spec.toLowerCase();
    const specHeadings = this.headings[normalizedSpec];
    if (!specHeadings) return null;

    const heading = specHeadings[id];
    if (!heading) return null;

    return {
      ...heading,
      specTitle: this.specTitleByShortname.get(normalizedSpec) || spec,
    };
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
  } catch {
    return {}
  }
}

/** Index headings arrays by id for O(1) lookup per spec. */
function indexHeadings(raw: HeadingsBySpec): HeadingsIndex {
  const indexed: HeadingsIndex = Object.create(null);
  for (const [shortname, headings] of Object.entries(raw)) {
    const byId: { [id: string]: HeadingEntry } = Object.create(null);
    for (const h of headings) {
      byId[h.id] = h;
    }
    indexed[shortname] = byId;
  }
  return indexed;
}

/** Build a shortname → title map from the specmap for O(1) title lookup. */
function buildSpecTitleMap(specmap: Store["specmap"]): Map<string, string> {
  const result = new Map<string, string>();
  for (const entry of Object.values(specmap)) {
    result.set(entry.shortname, entry.title);
  }
  return result;
}
