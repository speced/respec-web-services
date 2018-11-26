const crypto = require("crypto");
const { exec } = require("child_process");

const bikeshedSecret = process.env.BIKESHED_SECRET;
if (!bikeshedSecret) {
  throw new Error("env variable `BIKESHED_SECRET` is not set.")
}

module.exports.route = function route(req, res, next) {
  if (!isValidGithubSignature(req)) {
    return next("Failed to authenticate GitHub hook Signature")
  }

  if (req.body.refs !== "refs/heads/master") {
    res.status(202); // Accepted
    return res.send("Payload was not for master, ignored it.");
  }

  if (!hasAnchorUpdate(req.body.commits)) {
    res.status(202); // Accepted
    return res.send("Anchors were not modified, ignored it.");
  }

  exec("npm run get-xref-data", error => {
    if (error) {
      console.error("X-GitHub-Delivery", req.get("X-GitHub-Delivery"));
      console.error(error);
      res.status(500); // Internal Server Error
      return res.send("Error while updating data. See server logs.");
    }

    res.send("Updated.");
  });
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
