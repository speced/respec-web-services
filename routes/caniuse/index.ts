import { Router } from "express";
import cors from "cors";
import { Request, Response } from "express";

import authGithubWebhook from "../../utils/auth-github-webhook.js";
import { env, seconds } from "../../utils/misc.js";

import { createResponseBody } from "./lib/index.js";
import updateRoute from "./update.js";
import featureRoute from "./feature.js";

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

  if (typeof req.query.feature !== "string" || !req.query.feature) {
    res.sendStatus(400);
    return;
  }

  const browsers =
    typeof req.query.browsers === "string"
      ? req.query.browsers === "all"
        ? "all"
        : req.query.browsers.split(",")
      : "default";

  const versions =
    typeof req.query.versions === "string"
      ? parseInt(req.query.versions, 10)
      : 0;

  const format: "html" | "json" = req.query.format === "html" ? "html" : "json";

  const options = {
    feature: req.query.feature,
    browsers,
    versions,
    format,
  };

  if (Number.isNaN(options.versions)) {
    options.versions = 0;
  }
  const body = await createResponseBody(options);
  if (body === null) {
    const feature = options.feature;
    const hint = feature.startsWith("wf-") && feature.length > 3
      ? ` Try "${feature.slice(3)}" instead — "wf-" is a web-features prefix, not a caniuse ID.`
      : "";
    const message = `Feature "${feature}" not found.${hint}`;

    if (options.format === "html") {
      res.status(404).type("html").send(`<p>${message}</p>`);
      return;
    }

    res.status(404).json({ error: message });
    return;
  }

  res.set("Cache-Control", `max-age=${seconds("24h")}`);
  res.send(body);
}
