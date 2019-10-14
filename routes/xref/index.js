// @ts-check
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const rawBodyParser = require("../../utils/raw-body-parser");
const { search } = require("respec-xref-route/search");

const xref = express.Router({ mergeParams: true });

xref.options("/", cors({ methods: ["POST", "GET"] }));
xref.post("/", bodyParser.json(), cors(), route);
xref.get("/meta/:field?", cors(), require("./meta").route);
xref.post(
  "/update",
  bodyParser.json({ verify: rawBodyParser }),
  require("./update").route,
);

module.exports = {
  route,
  routes: xref,
};

function route(req, res) {
  const { keys = [], options } = req.body;
  const body = search(keys, options);

  const errors = getErrorCount(body.result);
  // add error stats to logs
  Object.assign(res.locals, { errors, queries: keys.length });

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
