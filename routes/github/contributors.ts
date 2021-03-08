import { Request, Response } from "express";
import { ms, seconds } from "../../utils/misc.js";
import { DiskCache } from "../../utils/disk-cache.js";

import { Contributor, getContributors } from "./lib/contributors.js";
import { getUsersDetails, User, Users } from "./lib/users.js";

type Contributors = (Contributor & User)[];

const cache = new DiskCache<null | Contributors>({
  ttl: ms("3 days"),
  path: "github/contributors",
});

export default async function route(req: Request, res: Response) {
  const { org, repo } = req.params;
  const cacheKey = `${org}/${repo}`;

  res.set("Cache-Control", `max-age=${seconds("24h")}`);

  const cachedData = await cache.get(cacheKey);
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
  const contributors: Contributor[] = [];
  try {
    for await (const contributor of getContributors(org, repo)) {
      contributors.push(contributor);
    }
  } catch (err) {
    if (err.message && err.message.includes("404 Not Found")) {
      await cache.set(cacheKey, null);
      return res.sendStatus(404);
    } else {
      res.removeHeader("Cache-Control");
      return res.sendStatus(500);
    }
  }

  // get optional user details (like full name)
  let users: Users;
  try {
    const logins = contributors.map(contributor => contributor.login);
    users = await getUsersDetails(logins);
  } catch (error) {
    console.error(error);
    users = {};
  }

  // merge basic contributor details with user details
  const result: Contributors = [];
  for (const contributor of contributors) {
    const { name } = users[contributor.login] || {};
    result.push({ name, ...contributor });
  }

  await cache.set(cacheKey, result);
  return res.json(result);
}
