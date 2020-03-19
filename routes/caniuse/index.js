// @ts-check
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const rawBodyParser = require("../../utils/raw-body-parser");
const { createResponseBody } = require("respec-caniuse-route");

const caniuse = express.Router({ mergeParams: true });

caniuse.options("/", cors({ methods: ["GET"] }));
caniuse.get("/", cors(), route);
caniuse.post(
  "/update",
  bodyParser.json({ verify: rawBodyParser }),
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

  // cache for 24hours (86400 seconds)
  res.set("Cache-Control", "max-age=86400");
  res.send(body);
}
