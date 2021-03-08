import { Request, Response } from "express";
import { seconds } from "../../utils/misc.js";
import { getCommits } from "./lib/commits.js";

export default async function route(req: Request, res: Response) {
  const { org, repo } = req.params;
  const { from, to } = req.query;
  if (!from || typeof from !== "string") {
    res.set("Content-Type", "text/plain");
    return res.status(400).send("query parameter 'from' is required");
  }
  if (typeof to !== "undefined" && typeof to !== "string") {
    res.set("Content-Type", "text/plain");
    const msg = "optional query parameter 'to' must be a single numeric string";
    return res.status(400).send(msg);
  }

  res.set("Cache-Control", `max-age=${seconds("30m")}`);

  try {
    const commits: { hash: string; message: string }[] = [];
    for await (const commit of getCommits(org, repo, from, to)) {
      commits.push({
        hash: commit.abbreviatedOid,
        message: commit.messageHeadline,
      });
    }
    res.json(commits);
  } catch (error) {
    res.status(404).send(error.message);
  }
}
