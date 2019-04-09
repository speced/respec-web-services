const { xrefSearch } = require("respec-xref-route");

module.exports.route = function route(req, res) {
  const { keys, options } = req.body;
  const body = xrefSearch(keys, options);
  res.json(body);
};
