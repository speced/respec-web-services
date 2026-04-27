import path from "path";
import { mkdir, readFile, rename, writeFile } from "fs/promises";
import { existsSync } from "fs";

import { env } from "../../../../utils/misc.js";

const DATA_DIR = env("DATA_DIR");
const LATEST_DATA_URL =
  "https://github.com/web-platform-dx/web-features/releases/latest/download/data.json";

export default async function main() {
  const outputDir = path.join(DATA_DIR, "baseline");
  const dataFile = path.join(outputDir, "baseline.json");
  const etagFile = path.join(outputDir, "baseline.etag");

  const headers: Record<string, string> = {};
  if (existsSync(etagFile)) {
    const savedEtag = (await readFile(etagFile, "utf8")).trim();
    if (savedEtag) {
      headers["If-None-Match"] = savedEtag;
    }
  }

  const dataRes = await fetch(LATEST_DATA_URL, { headers });

  if (dataRes.status === 304) {
    return false;
  }

  if (!dataRes.ok) {
    throw new Error(
      `Failed to download data.json: ${dataRes.status} ${dataRes.statusText}`,
    );
  }

  const data = await dataRes.text();

  await mkdir(outputDir, { recursive: true });

  const tempFile = `${dataFile}.tmp`;
  await writeFile(tempFile, data);
  await rename(tempFile, dataFile);

  const etag = dataRes.headers.get("etag");
  if (etag) {
    await writeFile(etagFile, etag);
  }

  return true;
}
