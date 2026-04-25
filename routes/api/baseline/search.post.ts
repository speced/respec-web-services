import { Request, Response } from "express";

import { seconds } from "../../../utils/misc.js";
import { store } from "./lib/store-init.js";
import { normalizeUrl, FeatureData } from "./lib/store.js";

const MAX_SPECS = 50;

interface SearchBody {
  specs: string[];
}

type IRequest = Request<unknown, unknown, SearchBody>;

export default function route(req: IRequest, res: Response) {
  const { specs } = req.body;

  if (!Array.isArray(specs) || specs.length === 0) {
    res.status(400).json({ error: "Request body must contain a `specs` array." });
    return;
  }

  if (specs.length > MAX_SPECS) {
    res.status(400).json({
      error: `Too many spec URLs. Maximum is ${MAX_SPECS}, got ${specs.length}.`,
    });
    return;
  }

  const results: Record<string, { id: string; feature: FeatureData }[]> = {};

  for (const specUrl of specs) {
    const normalized = normalizeUrl(specUrl);
    const matched: { id: string; feature: FeatureData }[] = [];

    // Find all features whose spec URLs start with the normalized URL
    for (const [storedUrl, featureIds] of store.bySpecUrl) {
      if (storedUrl.startsWith(normalized)) {
        for (const id of featureIds) {
          const feature = store.byFeature.get(id);
          if (feature) {
            matched.push({ id, feature });
          }
        }
      }
    }

    results[specUrl] = matched;
  }

  res.set("Cache-Control", `max-age=${seconds("30m")}`);
  res.json(results);
}
