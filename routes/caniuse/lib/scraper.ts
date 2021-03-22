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
import { BrowserVersionData, ScraperOutput as Output } from "./constants.js";

interface Input {
  stats: {
    [browserName: string]: { [version: string]: string };
  };
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

  const output: Output = { all: {}, summary: {} };
  for (const [browserName, browserData] of Object.entries(json.stats)) {
    const stats = Object.entries(browserData)
      .sort(([a], [b]) => semverCompare(a, b))
      .map(([version, status]) => [version, formatStatus(status)])
      .reverse() as BrowserVersionData[];
    output.all[browserName] = stats;
    output.summary[browserName] = groupStats(stats);
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

/**
 * @example
 * ```js
 * const Y = ['y'];
 * const N = ['n'];
 * assert.equal(
 *   groupStats([ ['1', Y], ['2', Y], ['3', Y], ['4', Y], ['5', N], ['6', N] ]),
 *   [ ['1', Y], ['2-4', Y], ['5-6', N] ]
 * )
 * ```
 */
function groupStats(versions: BrowserVersionData[]): BrowserVersionData[] {
  type SlidingWindow = Record<"start" | "end" | "key", string>;
  const [latestVersion, ...olderVersions] = versions;

  const groupedVersions: SlidingWindow[] = [];

  const window: SlidingWindow = { start: "", end: "", key: "" };
  for (const [version, supportKeys] of olderVersions.reverse()) {
    const key = supportKeys.join(",");
    if (!window.start) {
      // start window
      Object.assign(window, { start: version, end: version, key });
    } else if (key === window.key) {
      // extend window
      window.end = version;
    } else {
      // close window
      groupedVersions.push({ ...window });
      // and start new window
      Object.assign(window, { start: version, end: null, key });
    }
  }
  if (window.key) {
    groupedVersions.push({ ...window });
  }

  const groupedOlderVersions: BrowserVersionData[] = groupedVersions
    .reverse() // sort newest-first again
    .map(({ start, end, key }) => {
      const versionRange = end && start !== end ? `${start}-${end}` : start;
      const supportKeys = key.split(",");
      return [versionRange, supportKeys];
    });

  return [latestVersion].concat(groupedOlderVersions);
}

async function readJSON(file: string) {
  const str = await readFile(file, "utf8");
  return JSON.parse(str) as Input;
}

async function writeJSON(file: string, json: Output) {
  const str = JSON.stringify(json);
  await writeFile(file, str);
}
