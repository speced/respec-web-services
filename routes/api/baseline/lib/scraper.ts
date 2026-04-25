import path from "path";
import { mkdir, writeFile } from "fs/promises";

import { env } from "../../../../utils/misc.js";

const DATA_DIR = env("DATA_DIR");

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface ReleaseResponse {
  assets: ReleaseAsset[];
}

export default async function main() {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };

  const ghToken = process.env.GH_TOKEN;
  if (ghToken) {
    headers.Authorization = `Bearer ${ghToken}`;
  }

  const releaseRes = await fetch(
    "https://api.github.com/repos/web-platform-dx/web-features/releases/latest",
    { headers },
  );
  if (!releaseRes.ok) {
    throw new Error(
      `Failed to fetch latest release: ${releaseRes.status} ${releaseRes.statusText}`,
    );
  }
  const release: ReleaseResponse = await releaseRes.json();

  const asset = release.assets.find(a => a.name === "data.json");
  if (!asset) {
    throw new Error("No data.json asset in latest web-features release");
  }

  const dataRes = await fetch(asset.browser_download_url);
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
