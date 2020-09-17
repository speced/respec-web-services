/**
 * Run this script occasionally to update {@link routes/w3c/groups.json} with
 * new group shortnames.
 */

const path = require("path");
const { writeFile } = require("fs").promises;
const fetch = require("node-fetch").default;
const { env } = require("../utils/misc.js");

const mapGroupType = new Map([
  ["community group", "cg"],
  ["working group", "wg"],
]);

async function update() {
  const apiUrl = new URL("https://api.w3.org/groups/");
  apiUrl.searchParams.set("apikey", env("W3C_API_KEY"));
  apiUrl.searchParams.set("embed", "true");
  apiUrl.searchParams.set("items", "500");
  const json = await fetch(apiUrl).then(r => r.json());

  const data = { wg: {}, cg: {} };
  for (const group of json._embedded.groups) {
    const type = mapGroupType.get(group.type);
    if (!type) continue;

    const { shortname, id, name } = group;

    if (!shortname) {
      console.error(`No shortname for ${name} (${id}).`);
      continue;
    }

    data[type][shortname] = id;
  }

  // Sort results for presentation.
  for (const type of Object.keys(data)) {
    data[type] = Object.fromEntries(
      Object.entries(data[type]).sort((a, b) => a[0].localeCompare(b[0])),
    );
  }

  const filePath = path.resolve(__dirname, "../routes/w3c/groups.json");
  const count = Object.values(data).flatMap(_ => Object.keys(_)).length;
  console.log(`Writing ${count} entries to ${filePath}..`);
  writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

update().catch(error => {
  console.log(error);
  process.exit(1);
});
