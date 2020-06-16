// @ts-check
const { getCommits } = require("respec-github-apis/commits");
const { seconds } = require("../../utils/misc");

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
module.exports.route = async function route(req, res) {
  const { org, repo } = req.params;
  const { from, to } = req.query;
  if (!from || typeof from !== "string") {
    res.set("Content-Type", "text/plain");
    return res.status(400).send("query parameter 'from' is required");
  }

  res.set("Cache-Control", `max-age=${seconds("30m")}`);

  try {
    const commits = [];
    for await (const commit of getCommits(org, repo, from, to)) {
      commits.push({
        hash: commit.abbreviatedOid,
        message: commit.messageHeadline,
      });
    }
    res.json(commits);
  } catch (error) {
    res.status(404).send(error.message);
  }
};
