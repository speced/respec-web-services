import { join } from "path";
import { readdirSync } from "fs";

export const isDevEnv = process.env.NODE_ENV !== "production";

export const PROJECT_ROOT = (() => {
  let currentDir = import.meta.dirname;
  while (!readdirSync(currentDir).includes("package.json")) {
    const newCurrentDir = join(currentDir, "..");
    if (currentDir === newCurrentDir) {
      throw new Error("Failed to find project root.");
    }
    currentDir = newCurrentDir;
  }
  return currentDir;
})();
