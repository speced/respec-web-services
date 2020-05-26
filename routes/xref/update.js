// @ts-check
const crypto = require("crypto");
const { queue } = require("../../utils/background-task-queue");
const { main: scraper } = require("respec-xref-route/scraper");
const { cache } = require("respec-xref-route/search");
const { store } = require("respec-xref-route/store");

const bikeshedSecret = process.env.BIKESHED_SECRET;
if (!bikeshedSecret) {
  throw new Error("env variable `BIKESHED_SECRET` is not set.");
}

const CACHE_INVALIDATION_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours
setInterval(() => cache.invalidate(), CACHE_INVALIDATION_INTERVAL);

module.exports.route = function route(req, res) {
  if (!isValidGithubSignature(req)) {
    res.status(401); // Unauthorized
    const msg = "Failed to authenticate GitHub hook Signature";
    console.error(msg);
    return res.send(msg);
  }

  if (req.body.ref !== "refs/heads/master") {
    res.status(400); // Bad request
    const msg = `Caniuse payload was for ${req.body.ref}, ignored it.`;
    console.error(msg);
    return res.send(msg);
  }

  if (!hasAnchorUpdate(req.body.commits)) {
    res.status(400); // Bad request
    const msg = "Anchors were not modified, ignored it.";
    console.error(msg);
    return res.send(msg);
  }

  const taskId = `[/xref/update]: ${req.get("X-GitHub-Delivery")}`;
  queue.add(updateData, taskId);
  res.status(202); // Accepted
  res.send();
};

function isValidGithubSignature(req) {
  // see: https://developer.github.com/webhooks/securing/
  const hash = crypto
    .createHmac("sha1", bikeshedSecret)
    .update(req.rawBody)
    .digest("hex");

  return req.get("X-Hub-Signature") === `sha1=${hash}`;
}

function hasAnchorUpdate(commits) {
  if (!Array.isArray(commits)) return false;
  return commits.some(commit => commit.message.includes("anchors/"));
}

// TODO: Move this to a Worker maybe
async function updateData() {
  const hasUpdated = await scraper();
  if (hasUpdated) {
    cache.clear();
    store.fill();
  }
  return "Succesfully updated.";
}
