import { Request, Response } from "express";

import { seconds } from "../../../utils/misc.js";
import { store } from "./lib/store-init.js";
import { normalizeUrl } from "./lib/store.js";

const MAX_SPECS = 50;

interface SearchBody {
  specs: string[];
}

type IRequest = Request<unknown, unknown, SearchBody>;

export default function route(req: IRequest, res: Response) {
  const { specs } = req.body;

  if (!Array.isArray(specs) || specs.length === 0) {
    res.status(400);
    res.json({ error: "Request body must contain a `specs` array." });
    return;
  }

  if (specs.length > MAX_SPECS) {
    res.status(400);
    res.json({ error: `Too many spec URLs. Maximum is ${MAX_SPECS}, got ${specs.length}.` });
    return;
  }

  if (!specs.every(s => typeof s === "string")) {
    res.status(400);
    res.json({ error: "Each spec must be a string." });
    return;
  }

  const normalizedSpecs = specs.map(normalizeUrl);

  const matchingIds = new Set<string>();
  for (const [url, ids] of store.bySpecUrl) {
    if (normalizedSpecs.some(spec => url.startsWith(spec))) {
      for (const id of ids) {
        matchingIds.add(id);
      }
    }
  }

  const result = [...matchingIds]
    .map(id => ({ id, ...store.byFeature.get(id)! }))
    .filter(entry => entry.name);

  res.set("Cache-Control", `max-age=${seconds("30m")}`);
  res.json({ result });
}
