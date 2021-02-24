// @ts-check
import path from "path";

import { legacyDirname } from "../../utils/misc.js";
import { BackgroundTaskQueue } from "../../utils/background-task-queue.js";
import { ms } from "../../utils/misc.js";

import { cache as searchCache } from "./lib/search.js";
import { store } from "./lib/store-init.js";

const workerFile = path.join(legacyDirname(import.meta), "update.worker.js");
/** @type {BackgroundTaskQueue<typeof import("./update.worker")>} */
const taskQueue = new BackgroundTaskQueue(workerFile, "xref_update");

setInterval(() => searchCache.invalidate(), ms("4h"));

export default async function route(req, res) {
  if (req.body.ref !== "refs/heads/master") {
    res.status(400); // Bad request
    res.locals.reason = `ref-not-master`;
    const msg = `Webref payload was for ${req.body.ref}, ignored webhook.`;
    return res.send(msg);
  }

  if (!hasRelevantUpdate(req.body.commits)) {
    res.status(400); // Bad request
    res.locals.reason = `no-relevant-changes`;
    const msg = "No relevant Webref changes, ignored webhook.";
    return res.send(msg);
  }

  const job = taskQueue.add({ webhookId: req.get("X-GitHub-Delivery") || "" });
  try {
    const { updated } = await job.run();
    if (updated) {
      searchCache.clear();
      store.fill();
    }
  } catch {
    res.status(500);
  } finally {
    res.locals.job = job.id;
    res.send(job.id);
  }
}

/**
 * @typedef {{ message: string, added: string[], removed: string[], modified: string[] }} Commit
 * @param {Commit[]} commits
 */
function hasRelevantUpdate(commits) {
  if (!Array.isArray(commits)) return false;
  const changedFiles = commits
    .map(commit => [commit.added, commit.removed, commit.modified])
    .flat(2);
  return changedFiles.some(file => file?.startsWith("ed/dfns/"));
}
