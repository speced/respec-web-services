const bodyParser = require("body-parser");
const crypto = require("crypto");
const { exec } = require("child_process");

const bikeshedSecret = process.env.BIKESHED_SECRET;
if (!bikeshedSecret) {
  throw new ReferenceError("env variable `BIKESHED_SECRET` is not set.")
}

// minimum delay between subsequent updates
const UPDATE_THRESHOLD = 60 * 60 * 1000; // 1 hour

let lastUpdateTime = new Date(0);

function validateGithubSignature(req, res, next) {
  // see: https://developer.github.com/webhooks/securing/
  const hash = crypto
    .createHmac("sha1", bikeshedSecret)
    .update(req.rawBody)
    .digest("hex");

  if (req.get("X-Hub-Signature") === `sha1=${hash}`) {
    next();
  } else {
    next("Failed to authenticate GitHub hook Signature");
  }
}

function ensureUpdateIsNeeded(req, res, next) {
  if (req.body.refs !== "refs/heads/master") {
    res.status(202); // Accepted
    return res.send("Payload was not for master, aborted.");
  }

  if (!hasAnchorUpdate(req.body.commits)) {
    res.status(202); // Accepted
    return res.send("Anchors were not modified, aborted.");
  }

  if (new Date() - lastUpdateTime < UPDATE_THRESHOLD) {
    res.status(429); // Too Many Requests
    const waitUntil = new Date(lastUpdateTime.valueOf() + UPDATE_THRESHOLD);
    const retryAfter = (waitUntil - new Date()).valueOf() / 1000; // in seconds
    res.set("Retry-After", parseInt(retryAfter, 10));
    return res.send("Tried to update too soon.");
  }

  next();
}

function handleBikeshedUpdate(req, res) {
  lastUpdateTime = new Date();
  exec("npm run get-xref-data", error => {
    if (error) {
      console.error("X-GitHub-Delivery", req.get("X-GitHub-Delivery"));
      console.error(error);
      res.status(500); // Internal Server Error
      return res.send("Error while updating data. See server logs.");
    }

    res.send("Updated.");
  });
}

function hasAnchorUpdate(commits) {
  if (!Array.isArray(commits)) return false;
  return commits.some(commit => commit.message.includes("anchors/"));
}

function rawBodyParser(req, res, buf, encoding) {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || "utf8");
  }
}

module.exports = [
  bodyParser.json({ verify: rawBodyParser }),
  validateGithubSignature,
  ensureUpdateIsNeeded,
  handleBikeshedUpdate,
];
