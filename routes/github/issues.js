// @ts-check
import { createRequire } from "module";

import { seconds } from "../../utils/misc.js";

const require = createRequire(import.meta.url);
const { getIssues } = require("respec-github-apis/issues");
const { TTLCache } = require("respec-github-apis/utils/cache");

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export default async function route(req, res) {
  const { org, repo } = req.params;
  if (!req.query.issues) {
    res.set("Content-Type", "text/plain");
    return res.status(400).send("query parameter 'issues' is required");
  }
  if (Array.isArray(req.query.issues)) {
    // ?issues=879,817&issues=912 => ?issues=879,817,912
    req.query.issues = req.query.issues.join(",");
  }
  const issues = [
    ...new Set(
      /** @type {string} */ (req.query.issues)
        .split(/\,/)
        .map(issue => parseInt(issue.trim(), 10))
        .filter(issue => !Number.isNaN(issue) && issue > 0),
    ),
  ];

  res.set("Cache-Control", `max-age=${seconds("30m")}`);

  try {
    const result = await getIssues(org, repo, issues);
    if (result === null) return res.sendStatus(404);
    res.json(result);
  } catch (error) {
    res.sendStatus(500);
  }
}
