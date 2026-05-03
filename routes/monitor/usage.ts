import { Request, Response } from "express";
import { readFileSync } from "fs";
import path from "path";

import { PROJECT_ROOT } from "../../utils/constants.js";

const { version } = JSON.parse(
  readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf-8"),
);

export default function route(_req: Request, res: Response) {
  const { heapUsed, heapTotal } = process.memoryUsage();
  res.json({
    name: "respec.org",
    version,
    uptime: process.uptime(),
    heapUsed,
    heapTotal,
  });
}
