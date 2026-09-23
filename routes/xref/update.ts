import path from "path";

import type { Request, Response } from "express";

import { BackgroundTaskQueue } from "#utils/background-task-queue.ts";
import { ms } from "#utils/misc.ts";

import { cache as searchCache } from "./lib/search.ts";
import { store } from "./lib/store-init.ts";

const workerFile = path.join(import.meta.dirname, "update.worker.ts");
const taskQueue = new BackgroundTaskQueue<typeof import("./update.worker.ts")>(
  workerFile,
  "xref_update",
);

setInterval(() => searchCache.invalidate(), ms("4h"));

export default async function route(req: Request, res: Response) {
  if (req.body.ref !== "refs/heads/main") {
    res.status(400); // Bad request
    res.locals.reason = `ref-not-main`;
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

interface Commit {
  message: string;
  added: string[];
  removed: string[];
  modified: string[];
}

function hasRelevantUpdate(commits: Commit[]) {
  if (!Array.isArray(commits)) return false;
  const changedFiles = commits
    .map(commit => [commit.added, commit.removed, commit.modified])
    .flat(2);
  return changedFiles.some(
    file => file?.startsWith("ed/dfns/") || file?.startsWith("ed/headings/"),
  );
}
