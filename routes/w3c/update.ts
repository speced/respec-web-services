import path from "path";

import type { Request, Response } from "express";

import { BackgroundTaskQueue } from "#utils/background-task-queue.ts";

import { reloadGroups } from "./group.ts";

const workerFile = path.join(import.meta.dirname, "update.worker.ts");
const taskQueue = new BackgroundTaskQueue<typeof import("./update.worker.ts")>(
  workerFile,
  "w3c_groups_update",
);

export default async function route(_req: Request, res: Response) {
  const job = taskQueue.add();
  try {
    const { updated } = await job.run();
    if (updated && !reloadGroups()) {
      res.status(500);
    }
  } catch {
    res.status(500);
  } finally {
    res.locals.job = job.id;
    res.send(job.id);
  }
}
