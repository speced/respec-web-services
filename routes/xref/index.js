// @ts-check
const { search } = require("respec-xref-route/search");

module.exports.route = function route(req, res) {
  const { keys = [], options } = req.body;
  const body = search(keys, options);

  const errors = getErrorCount(body.result);
  if (errors / keys.length > 0.05) {
    // add to logs if error rate is more than 5%
    Object.assign(res.locals, { errors, queries: keys.length });
  }

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
