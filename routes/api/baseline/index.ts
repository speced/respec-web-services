import express from "express";
import cors from "cors";

import authGithubWebhook from "../../../utils/auth-github-webhook.js";
import { env, ms } from "../../../utils/misc.js";

import allRoute from "./all.js";
import featureRoute from "./feature.js";
import searchRoute from "./search.post.js";
import updateRoute from "./update.js";

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
