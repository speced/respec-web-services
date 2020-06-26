// @ts-check
const fetch = require("node-fetch").default;
const { MemCache } = require("../../utils/mem-cache.js");
const { env, ms, seconds } = require("../../utils/misc.js");
const groups = require("./groups.json");

const API_KEY = env("W3C_API_KEY");
/**
 * @typedef {{ id: number, shortname: string, name: string, URI: string, patentURI: string }} Group
 * @type {MemCache<Group>}
 */
const cache = new MemCache(ms("2 weeks"));

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
module.exports.route = async function route(req, res) {
  const { groupName } = req.params;
  if (!groupName) {
    const data = await getAllGroupInfo();
    return res.render("w3c/groups.njk", { groups: data });
  }

  try {
    const groupInfo = await getGroupInfo(groupName);
    res.set("Cache-Control", `max-age=${seconds("24h")}`);
    res.json(groupInfo);
  } catch (error) {
    const { statusCode, message } = error;
    res.set("Content-Type", "text/plain");
    res.status(statusCode).send(message);
  }
};

/**
 * @param {string} groupName
 */
async function getGroupInfo(groupName) {
  const cached = cache.get(groupName);
  if (cached) {
    return cached;
  }

  const groupId = groups.hasOwnProperty(groupName) && groups[groupName];
  if (!groupId) {
    throw { statusCode: 404, message: `No group with groupName: ${groupName}` };
  }

  const url = new URL(groupId.toString(), "https://api.w3.org/groups/");
  url.searchParams.set("apikey", API_KEY);

  const res = await fetch(url);
  if (!res.ok) {
    throw { statusCode: res.status, message: res.statusText };
  }
  const json = await res.json();

  const { id, name, _links: links } = json;
  /** @type {Group} */
  const result = {
    shortname: groupName,
    id,
    name,
    URI: links.homepage.href,
    patentURI: links["pp-status"].href,
  };

  cache.set(groupName, result);
  return result;
}

async function getAllGroupInfo() {
  const groupNames = Object.keys(groups);

  // Fill the cache with the groups not fetched recently.
  await Promise.allSettled(groupNames.map(getGroupInfo));

  return groupNames.map(
    group => cache.get(group) || { group, id: groups[group] },
  );
}
