import path from "path";

import { Request, Response } from "express";

import { BackgroundTaskQueue } from "../../../utils/background-task-queue.js";
import { store } from "./lib/store-init.js";

const workerFile = path.join(import.meta.dirname, "update.worker.js");
const taskQueue = new BackgroundTaskQueue<typeof import("./update.worker.ts")>(
  workerFile,
  "baseline_update",
);

export default async function route(req: Request, res: Response) {
  if (req.body.action !== "published") {
    res.status(400);
    res.locals.reason = "action-not-published";
    res.send("Webhook action ignored (expected 'published').");
    return;
  }

  const job = taskQueue.add({ webhookId: req.get("X-GitHub-Delivery") || "" });
  try {
    const { updated } = await job.run();
    if (updated) {
      store.fill();
    }
  } catch {
    res.status(500);
  } finally {
    res.locals.job = job.id;
    res.send(job.id);
  }
}
