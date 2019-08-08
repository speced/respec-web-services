import crypto from "crypto";
import { exec } from "child_process";
import { cache } from "respec-xref-route";
import { queue } from "../../utils/background-task-queue.js";

const bikeshedSecret = process.env.BIKESHED_SECRET;
if (!bikeshedSecret) {
  throw new Error("env variable `BIKESHED_SECRET` is not set.");
}

export function route(req, res) {
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

function updateData() {
  return new Promise((resolve, reject) => {
    exec("npm run get-xref-data", error => {
      if (error) {
        console.error(error);
        reject(new Error("Error while updating data. See server logs."));
      }
      cache.reset();
      resolve("Succesfully updated.");
    });
  });
}
