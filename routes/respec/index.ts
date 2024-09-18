import path from "node:path";
import express from "express";

import { env, ms } from "../../utils/misc.js";
import authGithubWebhook from "../../utils/auth-github-webhook.js";

import * as sizeRoute from "./size.js";
import buildUpdateRoute, { PKG_DIR } from "./builds/update.js";

const router = express.Router({ mergeParams: true });

router.get("/size", sizeRoute.get);
router.put(
  "/size",
  express.urlencoded({ extended: false, parameterLimit: 4, limit: "128b" }),
  sizeRoute.put,
);
router.use(
  "/builds",
  (_req, res, next) => {
    res.removeHeader("content-security-policy");
    res.removeHeader("cross-origin-opener-policy");
    res.removeHeader("cross-origin-resource-policy");
    next();
  },
  express.static(path.join(PKG_DIR, "builds"), { maxAge: ms("10m") }),
);
router.post(
  "/builds/update",
  authGithubWebhook(env("RESPEC_SECRET")),
  buildUpdateRoute,
);

export default router;
