import path from "path";

import { legacyDirname } from "../../utils/misc.js";
import { BackgroundTaskQueue } from "../../utils/background-task-queue.js";
import { cache } from "./lib/index.js";
import { Request, Response } from "express";

const workerFile = path.join(legacyDirname(import.meta), "update.worker.js");
const taskQueue = new BackgroundTaskQueue<typeof import("./update.worker")>(
  workerFile,
  "caniuse_update",
);

export default async function route(req: Request, res: Response) {
  if (req.body.ref !== "refs/heads/main") {
    res.status(400); // Bad request
    res.locals.reason = `ref-not-main`;
    const msg = `Caniuse payload was for ${req.body.ref}, ignored it.`;
    return res.send(msg);
  }

  const job = taskQueue.add({ webhookId: req.get("X-GitHub-Delivery") || "" });
  try {
    const { updated } = await job.run();
    if (updated) {
      cache.clear();
    }
  } catch {
    res.status(500);
  } finally {
    res.locals.job = job.id;
    res.send(job.id);
  }
}
