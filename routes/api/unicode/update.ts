import path from "node:path";

import type { Request, Response } from "express";

import { BackgroundTaskQueue } from "#utils/background-task-queue.ts";
import { store } from "./lib/store-init.ts";

const workerFile = path.join(import.meta.dirname, "update.worker.ts");
const taskQueue = new BackgroundTaskQueue<typeof import("./update.worker.ts")>(
  workerFile,
  "unicode_update",
);

export default async function route(_req: Request, res: Response) {
  const job = taskQueue.add({});
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
