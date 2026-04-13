import path from "path";
import { readFileSync, existsSync } from "fs";

import { env } from "../../../utils/misc.js";
import { DataEntry } from "./search.js";
import { HeadingEntry, HeadingsBySpec } from "./scraper.js";

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
  headings: HeadingsBySpec = {};

  constructor() {
    this.fill();
  }

  /** Fill the store with its contents from the filesystem. */
  fill() {
    this.byTerm = readJson("xref.json");
    this.bySpec = readJson("specs.json");
    this.specmap = readJson("specmap.json");
    this.headings = readJson("headings.json") || {};
    this.version = Date.now();
  }

  /** Look up a heading by spec shortname and fragment id. */
  getHeading(spec: string, id: string): (HeadingEntry & { specTitle: string }) | null {
    const normalizedSpec = spec.toLowerCase();
    const headings = this.headings[normalizedSpec];
    if (!headings) return null;

    const heading = headings.find(h => h.id === id);
    if (!heading) return null;

    const specInfo = Object.values(this.specmap).find(
      s => s.shortname === normalizedSpec || s.url?.includes(normalizedSpec),
    );
    return {
      ...heading,
      specTitle: specInfo?.title || spec,
    };
  }
}

function readJson(filename: string) {
  const DATA_DIR = env("DATA_DIR");
  const dataFile = path.resolve(DATA_DIR, `./xref/${filename}`);
  if (!existsSync(dataFile)) return {};
  const text = readFileSync(dataFile, "utf8");
  return JSON.parse(text);
}
