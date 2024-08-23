import path from "path";
import { readFileSync } from "fs";

import { env } from "../../../../utils/misc.js";
import { INPUT_DATA_SOURCE } from "./scraper.js";

export class Store {
  version = -1;
  private codepointToName: Map<string, { name: string }> = new Map();

  constructor() {
    this.fill();
  }

  /** Fill the store with its contents from the filesystem. */
  fill() {
    this.codepointToName = new Map(readJson("codepoint-to-name.json"));
    this.version = Date.now();
  }

  getNameByHexCodePoint(hex: string) {
    return this.codepointToName.get(hex) ?? null;
  }

  get dataSource() {
    return INPUT_DATA_SOURCE;
  }
}

function readJson(filename: string) {
  const DATA_DIR = env("DATA_DIR");
  const dataFile = path.resolve(DATA_DIR, `./unicode/${filename}`);
  const text = readFileSync(dataFile, "utf8");
  return JSON.parse(text);
}
