// https://github.com/motdotla/dotenv/issues/133#issuecomment-255298822

import { join } from "path";
import { readdirSync } from "fs";

import dotenv from "dotenv";

import { legacyDirname } from "./misc.js";
const __dirname = legacyDirname(import.meta);

// Traverse to parent directories until a `.env` file is found.
// See: https://github.com/motdotla/dotenv/issues/238#issuecomment-348017037
let currentDir = __dirname;
while (!readdirSync(currentDir).includes(".env")) {
  const newCurrentDir = join(currentDir, "..");
  if (currentDir === newCurrentDir) break;
  currentDir = newCurrentDir;
}
dotenv.config({ path: join(currentDir, ".env") });
