import { Router } from "express";

import authGithubWebhook from "#utils/auth-github-webhook.ts";
import { env } from "#utils/misc.ts";
import updateRoute from "./update.ts";

const routes = Router({ mergeParams: true });

routes.post("/update", authGithubWebhook(env("RESPEC_SECRET")), updateRoute);

export default routes;
