// @ts-check
import path from "path";

import { legacyDirname } from "../../utils/misc.js";
import { BackgroundTaskQueue } from "../../utils/background-task-queue.js";
import { cache } from "./lib/index.js";

const workerFile = path.join(legacyDirname(import.meta), "update.worker.js");
/** @type {BackgroundTaskQueue<typeof import("./update.worker")>} */
const taskQueue = new BackgroundTaskQueue(workerFile, "caniuse_update");

export default function route(req, res) {
  if (req.body.ref !== "refs/heads/master") {
    res.status(400); // Bad request
    res.locals.reason = `ref-not-master`;
    const msg = `Xref Payload was for ${req.body.ref}, ignored it.`;
    return res.send(msg);
  }

  const job = taskQueue.add({ webhookId: req.get("X-GitHub-Delivery") || "" });
  res.locals.job = job.id;
  res.status(/** Accepted */ 202).send(job.id);

  job
    .run()
    .then(({ updated }) => updated && cache.clear())
    .catch(() => {});
}
