import path from "path";
import { BackgroundTaskQueue } from "#utils/background-task-queue.ts";
import { store } from "./lib/store-init.ts";
import type { Request, Response } from "express";

const workerFile = path.join(import.meta.dirname, "update.worker.ts");
const taskQueue = new BackgroundTaskQueue<typeof import("./update.worker.ts")>(
  workerFile,
  "unicode_update",
);

export default async function route(req: Request, res: Response) {
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
