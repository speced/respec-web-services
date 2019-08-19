// @ts-check
const { search } = require("respec-xref-route/search");

module.exports.route = function route(req, res) {
  const { keys = [], options } = req.body;
  const body = search(keys, options);

  const errors = getErrorCount(body.result);
  // add error stats to logs
  Object.assign(res.locals, { errors, queries: keys.length });

  res.json(body);
};

function getErrorCount(results) {
  let errorCount = 0;
  for (const [, entries] of results) {
    if (entries.length !== 1) {
      errorCount++;
    }
  }
  return errorCount;
}
