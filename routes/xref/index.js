// @ts-check
const { search } = require("respec-xref-route/search");

module.exports.route = function route(req, res) {
  const { keys, options } = req.body;
  const body = search(keys, options);
  res.json(body);
};
