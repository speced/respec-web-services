// @ts-check
const morgan = require("morgan");

morgan.token("locals", (req, res) => {
  if (Object.keys(res.locals).length) {
    return JSON.stringify(res.locals);
  }
});

const format =
  ":date[iso] | :remote-addr | :method :status :url | :referrer | :res[content-length] | :response-time ms | :locals";

/** @type {import('morgan').Options} */
const options = {
  skip(req, res) {
    const { method, path, hostname } = req;
    const { statusCode } = res;
    switch (true) {
      // /xref pre-flight request
      case method === "OPTIONS" && path === "/xref" && statusCode === 204:
      // automated tests
      case hostname === "localhost:9876":
        return true;
      default:
        return false;
    }
  },
};

module.exports = () => morgan(format, options);
