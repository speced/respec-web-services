const path = require("path");
const { promises: fs } = require("fs");
const fetch = require("node-fetch").default;
const { env } = require("../utils/misc");
const groups = require("../routes/w3c/groups.json");

const API_KEY = env("W3C_API_KEY");
const DATA_DIR = env("DATA_DIR");
const DATA_FILE = path.join(DATA_DIR, "w3c", "groups.json");

async function updateGroupData({ verbose = false } = {}) {
  const log = (...args) => verbose && console.log("(w3c/groups)", ...args);

  const groupIds = Object.values(groups);
  log(`Fetching details for ${groupIds.length} groups...`);
  const groupsDetails = await Promise.all(groupIds.map(getGroupInfo));
  const data = Object.fromEntries(
    Object.keys(groups).map((groupName, i) => [groupName, groupsDetails[i]]),
  );

  log(`Writing group details to ${DATA_FILE}`);
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf8");

  return data;
}

if (require.main === module) {
  updateGroupData({ verbose: true }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
module.exports = {
  groups: { update: updateGroupData, file: DATA_FILE },
};

/**
 * @param {number} groupId
 */
async function getGroupInfo(groupId) {
  const url = new URL(groupId.toString(), "https://api.w3.org/groups/");
  url.searchParams.set("apikey", API_KEY);

  const res = await fetch(url.href);
  if (!res.ok) {
    const safeURL = new URL(url);
    safeURL.searchParams.delete("apikey");
    throw new Error(`Request to ${safeURL} failed. HTTP ${res.status}`);
  }
  const json = await res.json();

  const { id, name, description, _links: links } = json;
  return {
    id,
    name,
    description,
    URI: links.homepage.href,
    patentURI: links["pp-status"].href,
  };
}
