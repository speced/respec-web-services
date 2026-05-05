import { Request, Response } from "express";

import { seconds } from "../../../utils/misc.js";
import { store } from "./lib/store-init.js";

type Params = { feature: string };
type IRequest = Request<Params>;

export default function route(req: IRequest, res: Response) {
  const { feature: featureId } = req.params;
  const cacheControl = `max-age=${seconds("24h")}`;

  const featureData = store.byFeature.get(featureId);
  if (featureData) {
    res.set("Cache-Control", cacheControl);
    res.json({ id: featureId, ...featureData });
    return;
  }

  // Check if it's a moved or split feature in the raw data
  const rawFeature = store.data?.features[featureId];
  if (!rawFeature) {
    res.sendStatus(404);
    return;
  }

  if (rawFeature.kind === "moved" && rawFeature.redirect_target) {
    const target = store.byFeature.get(rawFeature.redirect_target);
    if (target) {
      res.set("Cache-Control", cacheControl);
      res.json({ id: rawFeature.redirect_target, redirected_from: featureId, ...target });
      return;
    }
  }

  if (rawFeature.kind === "split" && rawFeature.redirect_targets) {
    const targets = rawFeature.redirect_targets
      .map(targetId => {
        const target = store.byFeature.get(targetId);
        return target ? { id: targetId, ...target } : null;
      })
      .filter(Boolean);
    res.set("Cache-Control", cacheControl);
    res.json({ id: featureId, kind: "split", split_into: targets });
    return;
  }

  res.sendStatus(404);
}
