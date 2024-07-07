import path from "node:path";
import { tmpdir } from "node:os";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { Readable } from "node:stream";
import { ReadableStream } from "node:stream/web";
import { finished } from "node:stream/promises";
import { createInterface } from "node:readline/promises";

import { env } from "../../../../utils/misc.js";

const DATA_DIR = env("DATA_DIR");

export const INPUT_DATA_SOURCE = `https://unicode.org/Public/UNIDATA/UnicodeData.txt`;
const OUT_DIR_BASE = path.join(DATA_DIR, "unicode");
const OUT_FILE_BY_CODEPOINT = path.resolve(
  OUT_DIR_BASE,
  "./codepoint-to-name.json",
);

const defaultOptions = { forceUpdate: false };
type Options = typeof defaultOptions;

export default async function main(options: Partial<Options> = {}) {
  options = { ...defaultOptions, ...options } as Options;
  const hasUpdated = await updateInputSource();
  if (!hasUpdated && !options.forceUpdate) {
    console.log("Nothing to update");
    return false;
  }

  return true;
}

// download file and convert its data to JSON
async function updateInputSource() {
  await mkdir(OUT_DIR_BASE, { recursive: true });

  const namesJs = path.join(tmpdir(), "unicode-all-names.js");
  await rm(namesJs, { force: true });
  await rm(OUT_FILE_BY_CODEPOINT, { force: true });

  console.log(`Downloading`, INPUT_DATA_SOURCE, "to", namesJs);
  await downloadFile(INPUT_DATA_SOURCE, namesJs);

  console.log("Converting to JSON and writing to", OUT_FILE_BY_CODEPOINT);
  const rl = createInterface({
    input: createReadStream(namesJs),
    crlfDelay: Infinity,
  });
  const dest = createWriteStream(OUT_FILE_BY_CODEPOINT, { flags: "a" });
  dest.write("[\n");
  for await (const line of rl) {
    const parsed = parseLine(line);
    if (!parsed) continue;
    dest.write(JSON.stringify(parsed) + ",\n");
  }
  dest.write(`["null", {"name": ""}]`);
  dest.write("\n]\n");
  await new Promise(resolve => dest.end(resolve));

  console.log("Wrote to", OUT_FILE_BY_CODEPOINT);
  await rm(namesJs, { force: true });

  return true;
}

// Parse a line based on https://www.unicode.org/Public/5.1.0/ucd/UCD.html#UnicodeData.txt
// e.g. 0001;<control>;Cc;0;BN;;;;;N;START OF HEADING;;;;
// -> 0001 -> {name: "[control]", generalCategory: "Cc", ...}
function parseLine(line: string) {
  if (line.startsWith("#")) {
    return null; // comments
  }

  const parts = line.split(";");
  const codepoint = parts[0];
  const name = parts[1].replace(/[<>]/g, s => (s === "<" ? "[" : "]"));
  return [codepoint, { name }] as const;
}

async function downloadFile(url: string, destination: string) {
  const res = await fetch(url);
  await mkdir(path.dirname(destination), { recursive: true });
  const outStream = createWriteStream(destination, { flags: "wx" });
  await finished(
    Readable.fromWeb(res.body as ReadableStream<any>).pipe(outStream),
  );
}
