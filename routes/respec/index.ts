import path from "node:path";

import express from "express";
import rateLimit from "express-rate-limit";

import authGithubWebhook from "#utils/auth-github-webhook.ts";
import { env, ms } from "#utils/misc.ts";
import buildUpdateRoute, { PKG_DIR } from "./builds/update.ts";
import * as sizeRoute from "./size.ts";

const router = express.Router({ mergeParams: true });

const sizeRateLimit = rateLimit({ windowMs: ms("1m"), max: 10 });

router.get("/size", sizeRateLimit, sizeRoute.get);
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
