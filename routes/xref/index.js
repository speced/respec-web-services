// @ts-check
import path from "path";

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";

import rawBodyParser from "../../utils/raw-body-parser.js";
import authGithubWebhook from "../../utils/auth-github-webhook.js";
import { env } from "../../utils/misc.js";

import metaRoute from "./meta.js";
import updateRoute from "./update.js";
import { search } from "respec-xref-route/search.js";
import { DATA_DIR } from "respec-xref-route/constants.js";

const xref = express.Router({ mergeParams: true });

xref.options("/", cors({ methods: ["POST", "GET"] }));
xref.post("/", bodyParser.json(), cors(), route);
xref.get("/meta/:field?", cors(), metaRoute);
xref.post(
  "/update",
  bodyParser.json({ verify: rawBodyParser }),
  authGithubWebhook(env("W3C_WEBREF_SECRET")),
  updateRoute,
);
xref.use("/data", express.static(path.join(DATA_DIR, "xref")));

export default xref;

export function route(req, res) {
  const { options } = req.body;
  // req.body.keys for backward compatibility
  const queries = req.body.queries || req.body.keys || [];
  const body = search(queries, options);

  const errors = getErrorCount(body.result);
  // add error stats to logs
  Object.assign(res.locals, { errors, queries: queries.length });

  res.json(body);
}

function getErrorCount(results) {
  let errorCount = 0;
  for (const [, entries] of results) {
    if (entries.length !== 1) {
      errorCount++;
    }
  }
  return errorCount;
}
