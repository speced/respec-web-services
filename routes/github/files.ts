import { Request, Response } from "express";
import { seconds } from "../../utils/misc.js";
import { getFiles } from "./lib/files.js";

type Params = { org: string; repo: string };
type Query = { path?: string; branch?: string; depth?: string };
type IRequest = Request<Params, any, any, Query>;

export default async function route(req: IRequest, res: Response) {
  const { org, repo } = req.params;
  const { path = "", branch = "master" } = req.query;
  const depth = normalizeDepth(req.query.depth);

  try {
    const options = { path, branch, depth };
    const entries = await getFiles(org, repo, options);
    res.set("Cache-Control", `max-age=${seconds("30m")}`);
    res.json({ entries });
  } catch (error) {
    const errorCode = error.message === "INTERNAL_ERROR" ? 500 : 404;
    res.status(errorCode);
    res.setHeader("Content-Type", "text/plain");
    res.send(error.message);
  }
}

function normalizeDepth(depth?: string) {
  const MIN_DEPTH = 1;
  const MAX_DEPTH = 6;
  const DEFAULT_DEPTH = 3;
  return !depth || Number.isNaN(parseInt(depth, 10))
    ? DEFAULT_DEPTH
    : Math.max(MIN_DEPTH, Math.min(parseInt(depth, 10), MAX_DEPTH));
}
