/**
 * Run this script occasionally to update {@link {DATA_DIR}/w3c/groups.json}
 * with new group shortnames and IDs.
 */

const path = require("path");
const { writeFile, mkdir } = require("fs").promises;
const fetch = require("node-fetch").default;
const { env } = require("../utils/misc.js");

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

async function update() {
  const apiUrl = new URL("https://api.w3.org/groups/");
  apiUrl.searchParams.set("apikey", env("W3C_API_KEY"));
  apiUrl.searchParams.set("embed", "true");
  apiUrl.searchParams.set("items", "500");
  const json = await fetch(apiUrl).then(r => r.json());

  const data = Object.fromEntries(
    [...mapGroupType.values()].map(type => [type, {}]),
  );
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

update().catch(error => {
  console.log(error);
  process.exit(1);
});
