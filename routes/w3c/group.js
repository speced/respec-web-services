// @ts-check
const fetch = require("node-fetch").default;
const { MemCache } = require("../../utils/mem-cache.js");
const { env, ms, seconds, HTTPError } = require("../../utils/misc.js");
const groups = require("./groups.json");

const API_KEY = env("W3C_API_KEY");

/**
 * @typedef {object} Group
 * @property {number} Group.id
 * @property {string} Group.shortname
 * @property {keyof typeof groups} Group.type
 * @property {string} Group.name
 * @property {string} [Group.URI]
 * @property {string} [Group.patentURI]
 * @property {"PP2017" | "PP2020" | null} [Group.patentPolicy]
 */
/** @type {MemCache<Group>} */
const cache = new MemCache(ms("2 weeks"));

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
module.exports.route = async function route(req, res) {
  const { shortname, type } = req.params;
  if (!shortname) {
    const data = await getAllGroupInfo();
    if (req.headers.accept.includes("text/html")) {
      return res.render("w3c/groups.js", { groups: data });
    }
    return res.json(data);
  }

  if (type && !groups.hasOwnProperty(type)) {
    return res.status(404).send(`Invalid group type: "${type}"`);
  }

  try {
    const requestedType = /** @type {Group["type"]} */ (type);
    const groupInfo = await getGroupInfo(shortname, requestedType);
    res.set("Cache-Control", `max-age=${seconds("24h")}`);
    res.json(groupInfo);
  } catch (error) {
    const { statusCode, message } = error;
    res.set("Content-Type", "text/plain");
    res.status(statusCode).send(message);
  }
};

/**
 * @param {string} shortname
 * @param {Group["type"]} [requestedType]
 */
async function getGroupInfo(shortname, requestedType) {
  const cacheKey = `${shortname}/${requestedType || ""}`;
  if (cache.expires(cacheKey) > 1000) {
    return cache.get(cacheKey);
  }

  const { id, type } = getGroupMeta(shortname, requestedType);
  const groupInfo = await fetchGroupInfo(id, shortname, type);

  cache.set(cacheKey, groupInfo);
  if (requestedType !== type) {
    cache.set(`${shortname}/${type}`, groupInfo);
  }
  return groupInfo;
}

async function getAllGroupInfo() {
  /** @type {[string, Group["type"]][]} */
  const allGroups = Object.keys(groups).flatMap(type =>
    Object.keys(groups[type]).map(name => [name, type]),
  );

  // fill cache
  await Promise.allSettled(
    allGroups.map(([name, type]) => getGroupInfo(name, type)),
  );

  return allGroups.map(
    ([name, type]) => cache.get(`${name}/${type}`) || getGroupMeta(name, type),
  );
}

/**
 * @param {number} id
 * @param {string} shortname
 * @param {Group["type"]} type
 * @returns {Promise<Group>}
 */
async function fetchGroupInfo(id, shortname, type) {
  const url = new URL(id.toString(), "https://api.w3.org/groups/");
  url.searchParams.set("apikey", API_KEY);

  const res = await fetch(url);
  if (!res.ok) {
    throw new HTTPError(res.status, res.statusText);
  }
  const json = await res.json();

  const { name, _links: links } = json;

  const patentPolicy = links["active-charter"]?.href
    ? await getPatentPolicy(links["active-charter"].href)
    : undefined;

  return {
    shortname,
    type,
    id,
    name,
    URI: links.homepage?.href,
    patentURI: links["pp-status"]?.href,
    patentPolicy,
  };
}

/** @param {string} activeCharterApiUrl */
async function getPatentPolicy(activeCharterApiUrl) {
  const url = new URL(activeCharterApiUrl);
  url.searchParams.set("apikey", API_KEY);

  const res = await fetch(url);
  const { ["patent-policy"]: patentPolicyURL } = await res.json();

  if (!patentPolicyURL || typeof patentPolicyURL !== "string") {
    return null;
  } else if (patentPolicyURL.includes("Patent-Policy-2017")) {
    return "PP2017";
  } else {
    return "PP2020";
  }
}

/**
 * @param {string} shortname
 * @param {Group["type"]} [requestedType]
 * */
function getGroupMeta(shortname, requestedType) {
  /** @type {Group["type"][]} */
  const types = requestedType ? [requestedType] : ["wg", "cg"];
  const data = types
    .map(type => {
      if (groups[type].hasOwnProperty(shortname)) {
        /** @type {number} */
        const id = groups[type][shortname];
        return { shortname, type, id };
      }
    })
    .filter(g => g);

  switch (data.length) {
    case 1:
      return data[0];
    case 0: {
      const msg = `No group with shortname: "${shortname}"${
        requestedType ? ` and type: "${requestedType}"` : ""
      }`;
      throw new HTTPError(404, msg);
    }
    default: {
      const suggestions = data.map(g => `"${shortname}/${g.type}"`).join(", ");
      const hint = `Please specify one of following: ${suggestions}`;
      const msg = `Multiple groups with shortname: "${shortname}".`;
      throw new HTTPError(409, `${msg} ${hint}`);
    }
  }
}
