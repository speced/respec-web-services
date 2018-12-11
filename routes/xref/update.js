const crypto = require("crypto");
const { exec } = require("child_process");
const { queue } = require("../../utils/background-task-queue");

const bikeshedSecret = process.env.BIKESHED_SECRET;
if (!bikeshedSecret) {
  throw new Error("env variable `BIKESHED_SECRET` is not set.");
}

module.exports.route = function route(req, res) {
  if (!isValidGithubSignature(req)) {
    res.status(401); // Unauthorized
    return res.send("Failed to authenticate GitHub hook Signature");
  }

  if (req.body.refs !== "refs/heads/master") {
    res.status(400); // Bad request
    return res.send("Payload was not for master, ignored it.");
  }

  if (!hasAnchorUpdate(req.body.commits)) {
    res.status(400); // Bad request
    return res.send("Anchors were not modified, ignored it.");
  }

  const taskId = `[/xref/update]: ${req.get("X-GitHub-Delivery")}`;
  queue.add(updateData, taskId);
  res.status(201); // Accepted
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

function updateData() {
  return new Promise((resolve, reject) => {
    exec("npm run get-xref-data", error => {
      if (error) {
        console.error(error);
        reject(new Error("Error while updating data. See server logs."));
      }
      resolve("Succesfully updated.");
    });
  });
}
