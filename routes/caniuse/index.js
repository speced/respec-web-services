// @ts-check
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { createResponseBody } = require("respec-caniuse-route");
const rawBodyParser = require("../../utils/raw-body-parser");
const authGithubWebhook = require("../../utils/auth-github-webhook");
const { env, seconds } = require("../../utils/misc");

const caniuse = express.Router({ mergeParams: true });

caniuse.options("/", cors({ methods: ["GET"] }));
caniuse.get("/", cors(), route);
caniuse.post(
  "/update",
  bodyParser.json({ verify: rawBodyParser }),
  authGithubWebhook(env("CANIUSE_SECRET")),
  require("./update").route,
);

module.exports = {
  route,
  routes: caniuse,
};

async function route(req, res) {
  const options = {
    feature: req.query.feature,
    browsers: req.query.browsers ? req.query.browsers.split(",") : "default",
    versions: parseInt(req.query.versions, 10),
    format: req.query.format,
  };
  if (!options.feature) {
    res.sendStatus(400);
    return;
  }
  if (Number.isNaN(options.versions)) {
    options.versions = 0;
  }
  const body = await createResponseBody(options);
  if (body === null) {
    res.sendStatus(404);
    return;
  }

  res.set("Cache-Control", `max-age=${seconds("24h")}`);
  res.send(body);
}
