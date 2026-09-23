import cors from "cors";
import { Router } from "express";

import authGithubWebhook from "#utils/auth-github-webhook.ts";
import { env } from "#utils/misc.ts";
import groupsRoute from "./group.ts";
import updateRoute from "./update.ts";

const w3c = Router();
w3c.get("/groups{/:shortname}{/:type}", cors(), groupsRoute);
w3c.post("/update", authGithubWebhook(env("W3C_GROUPS_SECRET")), updateRoute);

export default w3c;
