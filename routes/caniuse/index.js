const { createResponseBody } = require("respec-caniuse-route");

module.exports.route = async function route(req, res) {
  const options = {
    feature: req.query.feature,
    browsers: req.query.browsers ? req.query.browsers.split(",") : "default",
    versions: parseInt(req.query.versions, 10),
  };
  if (!options.feature) {
    res.send(400);
    return;
  }
  if (Number.isNaN(options.versions)) {
    options.versions = 0;
  }
  const body = await createResponseBody(options);
  res.json(body);
};
