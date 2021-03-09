/**
 * Run this script occasionally to update {@link {DATA_DIR}/w3c/groups.json}
 * with new group shortnames and IDs.
 */

import path from "path";
import { fileURLToPath } from "url";
import { writeFile, mkdir } from "fs/promises";

import fetch from "node-fetch";

import { env } from "../build/utils/misc.js";

const DATA_DIR = env("DATA_DIR");
const OUTPUT_FILE = path.join(DATA_DIR, "w3c/groups.json");

const mapGroupType = new Map([
  ["business group", "bg"],
  ["community group", "cg"],
  ["interest group", "ig"],
  ["working group", "wg"],
  // placeholder types (not matched by regular filters) follow:
  ["_miscellaneous_", "misc"],
]);

export default async function update() {
  const data = Object.fromEntries(
    [...mapGroupType.values()].map(type => [type, {}]),
  );
  if (process.env.W3C_API_KEY === "IGNORE") {
    console.warn("No W3C_API_KEY is set.");
    console.warn(
      `Skipping update, but writing boilerplate data to ${OUTPUT_FILE}`,
    );
    await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
    await writeFile(OUTPUT_FILE, JSON.stringify(data, null, 2), "utf-8");
    return;
  }

  console.log("Updating W3C groups list...");
  const apiUrl = new URL("https://api.w3.org/groups/");
  apiUrl.searchParams.set("apikey", env("W3C_API_KEY"));
  apiUrl.searchParams.set("embed", "true");
  apiUrl.searchParams.set("items", "500");
  const json = await fetch(apiUrl).then(r => r.json());

  console.log("Processing results...");
  for (const group of json._embedded.groups) {
    const type = mapGroupType.get(group.type);
    if (!type) continue;

    const { shortname, id, name } = group;
    const url = group._links.homepage?.href;

    if (!shortname) {
      console.error(`No shortname for ${name} (${id}).`);
      continue;
    }

    data[type][shortname] = { id, name, URI: url };
  }

  // Exceptional groups that don't follow norms like other group types.
  const miscGroupFilters = [group => group.shortname === "tag"];
  for (const filter of miscGroupFilters) {
    const group = json._embedded.groups.find(filter);
    if (!group) continue;
    const { shortname, id, name, _links: links } = group;
    const url = links.homepage?.href;
    data["misc"][shortname] = { id, name, URI: url };
  }

  // Sort results for presentation.
  for (const type of Object.keys(data)) {
    data[type] = Object.fromEntries(
      Object.entries(data[type]).sort((a, b) => a[0].localeCompare(b[0])),
    );
  }

  const count = Object.values(data).flatMap(_ => Object.keys(_)).length;
  console.log(`Writing ${count} entries to ${OUTPUT_FILE}..`);
  await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(OUTPUT_FILE, JSON.stringify(data, null, 2), "utf-8");
}

const runAsScript = (() => {
  const modulePath = fileURLToPath(import.meta.url);
  const scriptPath = process.argv[1];
  return modulePath === scriptPath;
})();

if (runAsScript) {
  update().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
