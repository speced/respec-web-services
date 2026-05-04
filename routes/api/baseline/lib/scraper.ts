import path from "path";
import { mkdir, readFile, rename, writeFile } from "fs/promises";

import { env } from "../../../../utils/misc.js";

const DATA_DIR = env("DATA_DIR");
const LATEST_DATA_URL =
  "https://github.com/web-platform-dx/web-features/releases/latest/download/data.json";

export default async function main(): Promise<boolean> {
  const outputDir = path.join(DATA_DIR, "baseline");
  const dataFile = path.join(outputDir, "baseline.json");
  const etagFile = path.join(outputDir, "baseline.etag");

  const headers: Record<string, string> = {};
  try {
    const savedEtag = (await readFile(etagFile, "utf8")).trim();
    if (savedEtag) {
      headers["If-None-Match"] = savedEtag;
    }
  } catch {
    // No saved ETag yet; proceed without conditional request
  }

  const dataRes = await fetch(LATEST_DATA_URL, { headers });

  if (dataRes.status === 304) {
    // Data is already up to date; no download needed.
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

  // Returns true when new data was downloaded, false when already up to date.
  return true;
}
