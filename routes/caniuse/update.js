const crypto = require("crypto");
const { exec } = require("child_process");
const { queue } = require("../../utils/background-task-queue");
const { cache } = require("respec-caniuse-route");

const caniuseSecret = process.env.CANIUSE_SECRET;
if (!caniuseSecret) {
  throw new Error("env variable `CANIUSE_SECRET` is not set.");
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

function updateData() {
  return new Promise((resolve, reject) => {
    exec("npm run get-caniuse-data", error => {
      if (error) {
        console.error(error);
        reject(new Error("Error while updating data. See server logs."));
      }
      cache.clear();
      resolve("Succesfully updated.");
    });
  });
}
