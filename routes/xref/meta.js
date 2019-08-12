import { IDL_TYPES, CONCEPT_TYPES } from "respec-xref-route/constants.js";
import { cache } from "respec-xref-route/search.js";

export function route(req, res) {
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
}

// TODO: cache this based on `cache.reset()`
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
  };
}

function pickFields(fields, data) {
  return fields.reduce((result, field) => {
    result[field] = data[field];
    return result;
  }, {});
}
