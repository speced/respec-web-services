// @ts-check
import { Router } from "express";

import authGithubWebhook from "../../utils/auth-github-webhook.js";
import { env } from "../../utils/misc.js";

import updateRoute from "./update.js";

const routes = Router({ mergeParams: true });

routes.post("/update", authGithubWebhook(env("RESPEC_SECRET")), updateRoute);

export default routes;
