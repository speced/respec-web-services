const xrefResponseBody = require("respec-xref-route");
const xrefData = require("../../xref-data.json");

module.exports.route = function route(req, res) {
  const body = xrefResponseBody(req.body, xrefData);
  res.json(body);
};
