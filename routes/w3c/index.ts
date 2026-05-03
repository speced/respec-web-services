import { Router } from "express";
import cors from "cors";

import authGithubWebhook from "../../utils/auth-github-webhook.js";
import { env } from "../../utils/misc.js";

import groupsRoute from "./group.js";
import updateRoute from "./update.js";

const w3c = Router();
w3c.get("/groups{/:shortname}{/:type}", cors(), groupsRoute);
w3c.post("/update", authGithubWebhook(env("W3C_GROUPS_SECRET")), updateRoute);

export default w3c;
