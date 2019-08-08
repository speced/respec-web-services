import crypto from "crypto";
import { exec } from "child_process";
import { cache } from "respec-caniuse-route";
import { queue } from "../../utils/background-task-queue.js";

const caniuseSecret = process.env.CANIUSE_SECRET;
if (!caniuseSecret) {
  throw new Error("env variable `CANIUSE_SECRET` is not set.");
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
    const msg = `Xref Payload was for ${req.body.ref}, ignored it.`;
    console.error(msg);
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
