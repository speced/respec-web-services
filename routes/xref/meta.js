const { cache, types } = require("respec-xref-route");

module.exports.route = function route(req, res) {
  const data = getData();
  const supportedFields = new Set(Object.keys(data));
  const fields = (req.query.fields || "")
    .split(",")
    .filter(field => supportedFields.has(field));

  if (!fields.length) {
    res.json(data);
  } else {
    const filteredData = pickFields(fields, data);
    res.json(filteredData);
  }
};

// TODO: cache this based on `cache.reset()`
function getData() {
  return {
    types,
    specs: cache.get("specmap"),
    terms: Object.keys(cache.get("by_term")),
  };
}

function pickFields(fields, data) {
  return fields.reduce((result, field) => {
    result[field] = data[field];
    return result;
  }, {});
}
