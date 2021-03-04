// @ts-check
import { seconds } from "../../utils/misc.js";
import { getFiles } from "./lib/files.js";

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export default async function route(req, res) {
  const { org, repo } = req.params;
  const { path = "", branch = "master" } = req.query;
  const depth = normalizeDepth(parseInt(req.query.depth, 10));

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

/** @param {number} depth (could be NaN) */
function normalizeDepth(depth) {
  const MIN_DEPTH = 1;
  const MAX_DEPTH = 6;
  const DEFAULT_DEPTH = 3;
  return Math.max(MIN_DEPTH, Math.min(depth || DEFAULT_DEPTH, MAX_DEPTH));
}
