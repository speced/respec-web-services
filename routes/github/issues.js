// @ts-check
const { getIssues } = require("respec-github-apis/issues");
const { TTLCache } = require("respec-github-apis/utils/cache");

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
module.exports.route = async function route(req, res) {
  const { org, repo } = req.params;
  if (!req.query.issues) {
    res.set("Content-Type", "text/plain");
    return res.status(400).send("query parameter 'issues' is required");
  }
  const issues = req.query.issues
    .split(/\,/)
    .map(issue => parseInt(issue.trim(), 10))
    .filter(issue => !Number.isNaN(issue) && issue > 0);

  // cache all results for 30 min (1800 seconds)
  res.set("Cache-Control", "max-age=1800");

  try {
    const result = await getIssues(org, repo, issues);
    if (result === null) return res.sendStatus(404);
    res.json(result);
  } catch (error) {
    res.sendStatus(500)
  }
};
