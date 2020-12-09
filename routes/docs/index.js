// @ts-check
import { Router } from "express";
import bodyParser from "body-parser";

import rawBodyParser from "../../utils/raw-body-parser.js";
import authGithubWebhook from "../../utils/auth-github-webhook.js";
import { env } from "../../utils/misc.js";

import updateRoute from "./update.js";

const routes = Router({ mergeParams: true });

routes.post(
  "/update",
  bodyParser.json({ verify: rawBodyParser }),
  authGithubWebhook(env("RESPEC_SECRET")),
  updateRoute,
);

export default routes;
