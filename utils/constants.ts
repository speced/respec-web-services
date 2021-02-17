import { join } from "path";
import { readdirSync } from "fs";
import { legacyDirname } from "./misc.js";

export const isDevEnv = process.env.NODE_ENV !== "production";

export const PROJECT_ROOT = (() => {
  let currentDir = legacyDirname(import.meta);
  while (!readdirSync(currentDir).includes("package.json")) {
    const newCurrentDir = join(currentDir, "..");
    if (currentDir === newCurrentDir) {
      throw new Error("Failed to find project root.");
    }
    currentDir = newCurrentDir;
  }
  return currentDir;
})();
