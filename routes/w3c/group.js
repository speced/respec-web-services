// @ts-check
const fetch = require("node-fetch").default;
const { MemCache } = require("../../utils/mem-cache.js");
const { env, ms, seconds, HTTPError } = require("../../utils/misc.js");
const groups = require("./groups.json");

const API_KEY = env("W3C_API_KEY");

/**
 * @typedef {{ id: number, shortname: string, name: string, URI: string, patentURI: string }} Group
 * @type {MemCache<Group>}
 */
const store = new MemCache(ms("2 weeks"));
/** @type {MemCache<Group[]>} */
const cache = new MemCache(ms("2 weeks"));

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
module.exports.route = async function route(req, res) {
  const { groupName } = req.params;
  if (!groupName) {
    const data = await getAllGroupInfo();
    if (req.headers.accept.includes("text/html")) {
      return res.render("w3c/groups.js", { groups: data });
    }
    return res.json(data);
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
  let groupInfo = store.get(groupName);
  if (groupInfo) {
    return groupInfo;
  }

  const groupId = groups.hasOwnProperty(groupName) && groups[groupName];
  if (!groupId) {
    throw new HTTPError(404, `No group with groupName: ${groupName}`);
  }

  await getAllGroupInfo();

  groupInfo = store.get(groupName);
  if (groupInfo) {
    return groupInfo;
  }
  throw new HTTPError(500, "Failed to fetch group details.");
}

async function getAllGroupInfo() {
  const cached = cache.get("DATA");
  if (cached) {
    return cached;
  }

  const url = new URL("https://api.w3.org/groups/");
  url.searchParams.set("items", "400");
  url.searchParams.set("embed", "true");
  url.searchParams.set("apikey", API_KEY);

  const res = await fetch(url);
  if (!res.ok) {
    throw new HTTPError(res.status, res.statusText);
  }
  const json = await res.json();

  /** @type {Map<number, { name: string, URI: string, patentURI: string }>} */
  const data = new Map();
  for (const group of json._embedded.groups) {
    const { id, name, _links: links } = group;
    const details = {
      name,
      URI: links.homepage?.href,
      patentURI: links["pp-status"]?.href,
    };
    data.set(id, details);
  }

  const result = [];
  for (const [shortname, id] of Object.entries(groups)) {
    const group = { shortname, id, ...data.get(id) };
    store.set(shortname, group);
    result.push(group);
  }
  cache.set("DATA", result);
  return result;
}
