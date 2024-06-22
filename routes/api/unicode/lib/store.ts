import path from "path";
import { readFileSync } from "fs";

import { env } from "../../../../utils/misc.js";

export class Store {
  version = -1;
  private codepointToName: Map<string, string> = new Map();

  constructor() {
    this.fill();
  }

  /** Fill the store with its contents from the filesystem. */
  fill() {
    this.codepointToName = new Map(
      Object.entries(readJson("codepoint-to-name.json")),
    );
    this.version = Date.now();
  }


  getNameByCodepoint(codepoint: string) {
    return this.codepointToName.get(String.raw`\u` + codepoint) ?? null;
  }
}

function readJson(filename: string) {
  const DATA_DIR = env("DATA_DIR");
  const dataFile = path.resolve(DATA_DIR, `./unicode/${filename}`);
  const text = readFileSync(dataFile, "utf8");
  return JSON.parse(text);
}
