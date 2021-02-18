import path from "path";
import { readFileSync } from "fs";

import { env } from "../../../utils/misc.js";
import { DataEntry } from "./search.js";

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

  constructor() {
    this.fill();
  }

  /** Fill the store with its contents from the filesystem. */
  fill() {
    this.byTerm = readJson("xref.json");
    this.bySpec = readJson("specs.json");
    this.specmap = readJson("specmap.json");
    this.version = Date.now();
  }
}

function readJson(filename: string) {
  const DATA_DIR = env("DATA_DIR");
  const dataFile = path.resolve(DATA_DIR, `./xref/${filename}`);
  const text = readFileSync(dataFile, "utf8");
  return JSON.parse(text);
}
