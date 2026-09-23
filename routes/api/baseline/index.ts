import cors from "cors";
import express from "express";

import authGithubWebhook from "#utils/auth-github-webhook.ts";
import { env, ms } from "#utils/misc.ts";
import allRoute from "./all.ts";
import featureRoute from "./feature.ts";
import searchRoute from "./search.post.ts";
import updateRoute from "./update.ts";

const baseline = express.Router({ mergeParams: true });

baseline
  .options("/", cors({ methods: ["GET"], maxAge: ms("1day") }))
  .get("/", cors(), allRoute);

baseline
  .options("/search", cors({ methods: ["POST"], maxAge: ms("1day") }))
  .post("/search", express.json({ limit: "1mb" }), cors(), searchRoute);

baseline
  .options("/:feature", cors({ methods: ["GET"], maxAge: ms("1day") }))
  .get("/:feature", cors(), featureRoute);

baseline.post(
  "/update",
  authGithubWebhook(env("WEB_FEATURES_SECRET")),
  updateRoute,
);

export default baseline;
