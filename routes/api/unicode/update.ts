import path from "path";
import { legacyDirname } from "../../../utils/misc.js";
import { BackgroundTaskQueue } from "../../../utils/background-task-queue.js";
import { store } from "./lib/store-init.js";
import type { Request, Response } from "express";

const workerFile = path.join(legacyDirname(import.meta), "update.worker.js");
const taskQueue = new BackgroundTaskQueue<typeof import("./update.worker.js")>(
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
