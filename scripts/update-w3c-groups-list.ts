/**
 * Run this script occasionally to update {@link {DATA_DIR}/w3c/groups.json}
 * with new group shortnames and IDs.
 */

import path from "path";
import { fileURLToPath } from "url";
import { writeFile, mkdir } from "fs/promises";

import "dotenv/config";
import fetch from "node-fetch";

import { env } from "../utils/misc.js";

const DATA_DIR = env("DATA_DIR");
const OUTPUT_FILE = path.join(DATA_DIR, "w3c/groups.json");

const mapGroupType = new Map([
  ["business group", "bg"],
  ["community group", "cg"],
  ["interest group", "ig"],
  ["working group", "wg"],
  // placeholder types (not matched by regular filters) follow:
  ["_miscellaneous_", "other"],
]);

interface GroupBase {
  id: number;
  shortname: string;
  name: string;
  discr: string;
  is_closed: boolean;
  _links: {
    homepage?: { href: string };
  };
}
interface GroupResponseWithoutMembers extends GroupBase {
  discr: "w3cgroup" | "group";
  type: string;
}
interface GroupResponseWithMembers extends GroupBase {
  discr: "tf";
  members: GroupResponseWithoutMembers[];
}
type GroupResponse = GroupResponseWithoutMembers | GroupResponseWithMembers;

interface APIResponse {
  _embedded: {
    groups: GroupResponse[];
  };
}

interface Group {
  id: number;
  name: string;
  URI?: string;
}

export default async function update() {
  const data: Record<string, Record<string, Group>> = Object.fromEntries(
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
  const json = await fetch(apiUrl.href).then(
    r => r.json() as Promise<APIResponse>,
  );

  const groups = json._embedded.groups.flatMap(g => {
    switch (g.discr) {
      case "w3cgroup":
      case "group":
        return g;
      case "tf":
        return g.members;
      default:
        return [];
    }
  });
  console.log(`Processing ${groups.length} items...`);
  for (const group of groups) {
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
  const otherGroupFilters = [
    (group: GroupResponse) => group.shortname === "tag",
    (group: GroupResponse) => group.shortname === "ab",
  ];
  for (const filter of otherGroupFilters) {
    const group = groups.find(filter);
    if (!group) continue;
    const { shortname, id, name, _links: links } = group;
    const url = links.homepage?.href;
    data["other"][shortname] = { id, name, URI: url };
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
  await update();
}
