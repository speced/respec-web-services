import cors from "cors";
import { type Request, type Response, Router } from "express";

import authGithubWebhook from "#utils/auth-github-webhook.ts";
import { env, seconds } from "#utils/misc.ts";
import featureRoute from "./feature.ts";
import { createResponseBody } from "./lib/index.ts";
import updateRoute from "./update.ts";

const caniuse = Router({ mergeParams: true });

caniuse.get("/", cors(), route);
caniuse.get("/:feature", cors(), featureRoute);
caniuse.post("/update", authGithubWebhook(env("CANIUSE_SECRET")), updateRoute);

export default caniuse;

interface Query {
  feature: string;
  browsers?: string;
  versions?: string;
  format?: "html" | "json";
}
type IRequest = Request<any, any, any, Query>;

export async function route(req: IRequest, res: Response) {
  res.locals.deprecated = true;
  const options = {
    feature: req.query.feature,
    browsers: req.query.browsers ? req.query.browsers.split(",") : "default",
    versions: parseInt(req.query.versions || "", 10),
    format: req.query.format,
  };
  if (!options.feature) {
    res.sendStatus(400);
    return;
  }
  if (Number.isNaN(options.versions)) {
    options.versions = 0;
  }
  const body = await createResponseBody(options);
  if (body === null) {
    res.sendStatus(404);
    return;
  }

  res.set("Cache-Control", `max-age=${seconds("24h")}`);
  res.send(body);
}
