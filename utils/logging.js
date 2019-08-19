// @ts-check
const morgan = require("morgan");

morgan.token("locals", (req, res) => {
  if (Object.keys(res.locals).length) {
    return JSON.stringify(res.locals);
  }
});

const format =
  ":date[iso] | :remote-addr | :method :status :url | :referrer | :res[content-length] | :response-time ms | :locals";

module.exports = () => morgan(format);
