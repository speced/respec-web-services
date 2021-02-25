// Reads features-json/*.json files from caniuse repository
// and writes each file in a "respec friendly way"
//  - Keep only the `stats` from features-json data
//  - Sort browser versions (latest first)
//  - Remove footnotes and other unnecessary data

import * as path from "path";
import { existsSync } from "fs";
import { readFile, writeFile, readdir, mkdir } from "fs/promises";

import sh from "../../../utils/sh.js";
import { env } from "../../../utils/misc.js";

interface Input {
  stats: {
    [browserName: string]: { [version: string]: string };
  };
}

interface Output {
  [browserName: string]: [string, ReturnType<typeof formatStatus>][];
}

const DATA_DIR = env("DATA_DIR");
const INPUT_REPO_SRC = "https://github.com/Fyrd/caniuse.git";
const INPUT_REPO_NAME = "caniuse-raw";
const INPUT_DIR = path.join(DATA_DIR, INPUT_REPO_NAME, "features-json");
const OUTPUT_DIR = path.join(DATA_DIR, "caniuse");

const defaultOptions = { forceUpdate: false };
type Options = typeof defaultOptions;

export default async function main(options: Partial<Options> = {}) {
  const opts = { ...defaultOptions, ...options };
  const hasUpdated = await updateInputSource();
  if (!hasUpdated && !opts.forceUpdate) {
    console.log("Nothing to update");
    return false;
  }

  console.log("INPUT_DIR:", INPUT_DIR);
  console.log("OUTPUT_DIR:", OUTPUT_DIR);
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true });
  }

  const fileNames = await readdir(INPUT_DIR);
  console.log(`Processing ${fileNames.length} files...`);
  const promisesToProcess = fileNames.map(processFile);
  await Promise.all(promisesToProcess);
  console.log(`Processed ${fileNames.length} files.`);
  return true;
}

async function updateInputSource() {
  const dataDir = path.join(DATA_DIR, INPUT_REPO_NAME);
  const shouldClone = !existsSync(dataDir);

  const command = shouldClone
    ? `git clone ${INPUT_REPO_SRC} ${INPUT_REPO_NAME}`
    : `git pull`;
  const cwd = shouldClone ? path.resolve(DATA_DIR) : dataDir;

  const stdout = await sh(command, { cwd, output: "stream" });
  const hasUpdated = !stdout.toString().includes("Already up to date");
  return hasUpdated;
}

const semverCompare = new Intl.Collator("en", { numeric: true }).compare;
async function processFile(fileName: string) {
  const inputFile = path.join(INPUT_DIR, fileName);
  const outputFile = path.join(OUTPUT_DIR, fileName);

  const json = await readJSON(inputFile);

  const output: Output = {};
  for (const [browserName, browserData] of Object.entries(json.stats)) {
    const stats = Object.entries(browserData)
      .sort(([a], [b]) => semverCompare(a, b))
      .map(([version, status]) => [version, formatStatus(status)])
      .reverse() as [string, string[]][];
    output[browserName] = stats;
  }

  await writeJSON(outputFile, output);
}

/**  @example "n d #6" => ["n", "d"] */
function formatStatus(status: string) {
  return status
    .split("#", 1)[0] // don't care about footnotes.
    .split(" ")
    .filter(item => item);
}

async function readJSON(file: string) {
  const str = await readFile(file, "utf8");
  return JSON.parse(str) as Input;
}

async function writeJSON(file: string, json: Output) {
  const str = JSON.stringify(json);
  await writeFile(file, str);
}
