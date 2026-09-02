// Keep this out of the server process: the transform it runs peaks near 560 MB.
//
// Runnable by hand to rebuild the data file without restarting the server:
//   node build/routes/bibrefs/lib/build-data.js <cloneDirectory> <outputFile>

import { createRequire } from "node:module";
import { lstatSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

import { validate } from "./validate.js";
import { prepareWorkspace } from "./workspace.js";

/** Symlinks survive a clone, and the transform reads every file in here. */
function assertEveryInputIsAPlainJsonFile(directory: string) {
  const rejected = readdirSync(directory).filter(
    name =>
      !name.endsWith(".json") ||
      !lstatSync(path.join(directory, name)).isFile(),
  );
  if (rejected.length) {
    throw new Error(
      `Refusing to build, these are not plain .json files: ${rejected.join(", ")}`,
    );
  }
}

function build(cloneDirectory: string, outputFile: string) {
  assertEveryInputIsAPlainJsonFile(path.join(cloneDirectory, "refs"));
  const transform = prepareWorkspace(cloneDirectory, outputFile);
  const bibref = createRequire(import.meta.url)(transform);
  const references = bibref.all;

  // Most of this process's peak, and nothing here reads them.
  bibref.raw = null;
  bibref.reverseLookupTable = null;

  const problem = validate(references);
  if (problem) throw new Error(`Refusing to publish: ${problem}.`);

  const temporary = `${outputFile}.incoming`;
  writeFileSync(temporary, JSON.stringify(references), "utf8");
  renameSync(temporary, outputFile);
  return Object.keys(references).length;
}

const [cloneDirectory, outputFile] = process.argv.slice(2);
if (!cloneDirectory || !outputFile) {
  console.error("usage: build-data.js <cloneDirectory> <outputFile>");
  process.exit(1);
}
const count = build(cloneDirectory, outputFile);
const peakMegabytes = Math.round(process.memoryUsage().rss / 1024 / 1024);
console.log(
  `Wrote ${count} references to ${outputFile} (peak ${peakMegabytes} MB)`,
);
