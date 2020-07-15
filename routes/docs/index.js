// @ts-check
const express = require("express");
const bodyParser = require("body-parser");
const rawBodyParser = require("../../utils/raw-body-parser");
const authGithubWebhook = require("../../utils/auth-github-webhook");
const { env } = require("../../utils/misc");

const routes = express.Router({ mergeParams: true });

routes.post(
  "/update",
  bodyParser.json({ verify: rawBodyParser }),
  authGithubWebhook(env("RESPEC_SECRET")),
  require("./update").route,
);

module.exports = {
  routes,
};
