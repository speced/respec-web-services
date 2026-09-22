import type { Request, Response } from "express";

import { seconds } from "#utils/misc.ts";
import { store } from "./lib/store-init.ts";

export default function route(_req: Request, res: Response) {
  if (!store.data) {
    res.sendStatus(404);
    return;
  }

  res.set("Cache-Control", `max-age=${seconds("24h")}`);
  res.json(store.data);
}
