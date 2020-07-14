// @ts-check
const express = require("express");
const bodyParser = require("body-parser");
const rawBodyParser = require("../../utils/raw-body-parser");

const routes = express.Router({ mergeParams: true });

routes.post(
  "/update",
  bodyParser.json({ verify: rawBodyParser }),
  require("./update").route,
);

module.exports = {
  routes,
};
