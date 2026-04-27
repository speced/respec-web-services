import path from "path";
import { mkdir, writeFile } from "fs/promises";

import { env } from "../../../../utils/misc.js";

const DATA_DIR = env("DATA_DIR");
const LATEST_DATA_URL =
  "https://github.com/web-platform-dx/web-features/releases/latest/download/data.json";

export default async function main() {
  const dataRes = await fetch(LATEST_DATA_URL);
  if (!dataRes.ok) {
    throw new Error(
      `Failed to download data.json: ${dataRes.status} ${dataRes.statusText}`,
    );
  }
  const data = await dataRes.text();

  const outputDir = path.join(DATA_DIR, "baseline");
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "baseline.json"), data);

  return true;
}
