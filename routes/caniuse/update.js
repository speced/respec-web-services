// @ts-check
const crypto = require("crypto");
const { queue } = require("../../utils/background-task-queue");
const { cache } = require("respec-caniuse-route");
const { main: scraper } = require("respec-caniuse-route/scraper");

const caniuseSecret = process.env.CANIUSE_SECRET;
if (!caniuseSecret) {
  throw new Error("env variable `CANIUSE_SECRET` is not set.");
}

module.exports.route = function route(req, res) {
  if (!isValidGithubSignature(req)) {
    res.status(401); // Unauthorized
    const msg = "Failed to authenticate GitHub hook Signature";
    console.error(msg);
    return res.send(msg);
  }

  if (req.body.ref !== "refs/heads/master") {
    res.status(400); // Bad request
    const msg = `Xref Payload was for ${req.body.ref}, ignored it.`;
    console.log(msg);
    return res.send(msg);
  }

  const taskId = `[/caniuse/update]: ${req.get("X-GitHub-Delivery")}`;
  queue.add(updateData, taskId);
  res.status(202); // Accepted
  res.send();
};

function isValidGithubSignature(req) {
  // see: https://developer.github.com/webhooks/securing/
  const hash = crypto
    .createHmac("sha1", caniuseSecret)
    .update(req.rawBody)
    .digest("hex");

  return req.get("X-Hub-Signature") === `sha1=${hash}`;
}

// TODO: Move this to a Worker maybe
async function updateData() {
  const hasUpdated = await scraper();
  if (hasUpdated) {
    cache.clear();
  }
  return "Succesfully updated.";
}
