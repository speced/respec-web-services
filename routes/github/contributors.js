// @ts-check
import { ms, seconds } from "../../utils/misc.js";

import { getContributors } from "respec-github-apis/contributors.js";
import { getUsersDetails } from "respec-github-apis/users.js";
import { TTLCache } from "respec-github-apis/utils/cache.js";

const cache = new TTLCache(ms("3 days"));

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export default async function route(req, res) {
  const { org, repo } = req.params;
  const cacheKey = `${org}/${repo}`;

  res.set("Cache-Control", `max-age=${seconds("24h")}`);

  const cachedData = cache.get(cacheKey);
  if (typeof cachedData !== "undefined") {
    res.set("X-Cache", "HIT");
    if (Array.isArray(cachedData)) {
      return res.json(cachedData);
    }
    if (cachedData === null) {
      return res.sendStatus(404);
    }
  }

  res.set("X-Cache", "MISS");

  // get basic list of contributors
  const contributors = [];
  try {
    for await (const contributor of getContributors(org, repo)) {
      contributors.push(contributor);
    }
  } catch (err) {
    if (err.message && err.message.includes("404 Not Found")) {
      cache.set(cacheKey, null);
      return res.sendStatus(404);
    } else {
      res.removeHeader("Cache-Control");
      return res.sendStatus(500);
    }
  }

  // get optional user details (like full name)
  let users;
  try {
    const logins = contributors.map(contributor => contributor.login);
    users = await getUsersDetails(logins);
  } catch (error) {
    console.error(error);
    users = {};
  }

  // merge basic contributor details with user details
  const result = [];
  for (const contributor of contributors) {
    const { name } = users[contributor.login] || {};
    result.push({ name, ...contributor });
  }

  cache.set(cacheKey, result);
  return res.json(result);
}
