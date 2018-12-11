const xrefResponseBody = require("respec-xref-route");
const { readFileSync } = require("fs");
const path = require("path");

const dataFile = path.join(process.cwd(), "xref-data.json");
const xrefData = JSON.parse(readFileSync(dataFile, "utf8"));

module.exports.route = function route(req, res) {
  const body = xrefResponseBody(req.body, xrefData);
  res.json(body);
};
