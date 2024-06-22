import path from "node:path";
import { tmpdir } from "node:os";
import { createWriteStream, writeFile } from "node:fs";
import { appendFile, mkdir, rm } from "node:fs/promises";
import { Readable } from "node:stream";
import { ReadableStream } from "node:stream/web";
import { finished } from "node:stream/promises";

import { env } from "../../../../utils/misc.js";
import sh from "../../../../utils/sh.js";

const DATA_DIR = env("DATA_DIR");

const INPUT_DATA_SOURCE = `https://raw.githubusercontent.com/r12a/shared/gh-pages/code/all-names.js`;
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

async function updateInputSource() {
  await mkdir(OUT_DIR_BASE, { recursive: true });

  const namesJs = path.join(tmpdir(), "unicode-all-names.js");
  await rm(namesJs, { force: true });
  // download file and convert its data to JSON
  console.log(`Downloading`, INPUT_DATA_SOURCE);
  await downloadFile(INPUT_DATA_SOURCE, namesJs);
  console.log("Converting to JSON");
  await appendFile(
    namesJs,
    "\n\n" +
      String.raw`require("fs").writeFileSync(
        "${OUT_FILE_BY_CODEPOINT}",
          JSON.stringify(charData, null, 2).replace(
            /[\u007f-\uffff]/g,
            c => "\\\\u" + ("0000" + c.charCodeAt(0).toString(16)).slice(-4)
          )
      )`,
  );
  await sh(`node ${namesJs}`);
  console.log("Wrote to", OUT_FILE_BY_CODEPOINT);
  await rm(namesJs, { force: true });

  return true;
}

async function downloadFile(url: string, destination: string) {
  const res = await fetch(url);
  await mkdir(path.dirname(destination), { recursive: true });
  const outStream = createWriteStream(destination, { flags: "wx" });
  await finished(
    Readable.fromWeb(res.body as ReadableStream<any>).pipe(outStream),
  );
}
