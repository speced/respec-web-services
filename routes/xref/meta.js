// @ts-check
const { IDL_TYPES, CONCEPT_TYPES } = require("respec-xref-route/constants");
const { cache } = require("respec-xref-route/cache");

let data = getData();

const supportedFields = new Set(Object.keys(data));

module.exports.route = function route(req, res) {
  if (data.version < cache.version) {
    data = getData();
  }

  if (req.params.field) {
    switch (req.params.field) {
      case "version":
        res.set("Cache-Control", "no-cache");
        res.set("Content-Type", "text/plain");
        res.send(data.version.toString());
        break;
      case "types":
      case "specs":
      case "terms":
        res.send(data[req.params.field]);
        break;
      default:
        res.sendStatus(404);
    }
    return;
  }

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

function getData() {
  const terms = Object.keys(cache.get("by_term"));
  terms.splice(terms.indexOf(""), 1, '""');

  return {
    types: {
      idl: [...IDL_TYPES],
      concept: [...CONCEPT_TYPES],
    },
    specs: cache.get("specmap"),
    terms,
    version: cache.version,
  };
}

function pickFields(fields, data) {
  return fields.reduce((result, field) => {
    result[field] = data[field];
    return result;
  }, {});
}
