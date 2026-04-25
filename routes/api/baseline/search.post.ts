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
    res.json({ error: "Each spec must be a string URL." });
    return;
  }

  const normalizedSpecs = specs.map(normalizeUrl);

  const matchingIds = [...store.bySpecUrl.entries()]
    .filter(([url]) => normalizedSpecs.some(spec => url.startsWith(spec)))
    .flatMap(([, ids]) => ids);

  const result = [...new Set(matchingIds)]
    .map(id => ({ id, ...store.byFeature.get(id)! }))
    .filter(entry => entry.name);

  res.set("Cache-Control", `max-age=${seconds("30m")}`);
  res.json({ result });
}
