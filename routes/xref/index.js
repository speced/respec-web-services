const bodyParser = require("body-parser");
const xrefResponseBody = require("respec-xref-route");

const xrefData = require("../../xref-data.json");

function route(req, res) {
  const body = xrefResponseBody(req.body, xrefData);
  res.json(body);
}

module.exports = [
  bodyParser.json(),
  route,
];
