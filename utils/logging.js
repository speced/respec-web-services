// @ts-check
const morgan = require("morgan");
const chalk = require("chalk").default;

/** @param {string} bytes */
const prettyBytes = bytes => {
  const threshold = 1024;
  let size = parseFloat(bytes);
  for (const unit of ["B", "KB", "MB"]) {
    if (size >= threshold) {
      size /= threshold;
    } else {
      return `${unit === "B" ? size : size.toFixed(2)} ${unit}`;
    }
  }
  return bytes;
};

const prettyJSON = (() => {
  const colored = value => {
    switch (typeof value) {
      case "number":
        return chalk.cyan(value.toString());
      case "boolean":
        return chalk.green(value.toString());
      default:
        return chalk.yellow(value);
    }
  };
  return obj =>
    Object.entries(obj)
      .map(([key, value]) => chalk.magentaBright(key + "=") + colored(value))
      .join(" ");
})();

/** @type {import('morgan').FormatFn} */
const formatter = (tokens, req, res) => {
  const date = tokens.date(req, res, "iso");
  const remoteAddr = tokens["remote-addr"](req, res);
  const method = tokens.method(req, res);
  const status = parseInt(tokens.status(req, res), 10);
  const url = new URL(tokens.url(req, res), "https://respec.org/");
  const referrer = tokens.referrer(req, res);
  const contentLength = res.get("content-length");
  const responseTime = tokens["response-time"](req, res);
  const locals = Object.keys(res.locals).length ? { ...res.locals } : null;

  const color = status < 300 ? "green" : status >= 400 ? "red" : "yellow";
  const request =
    chalk[color](`${method.padEnd(4)} ${status}`) +
    ` ${chalk.blueBright(url.pathname)}${chalk.italic.gray(url.search)}`;

  let formattedReferrer;
  if (referrer) {
    const { origin, pathname, search } = new URL(referrer);
    formattedReferrer =
      chalk.magenta(origin + chalk.bold(pathname)) + chalk.italic.gray(search);
  }

  const unknown = chalk.dim.gray("-");

  return [
    chalk.gray(date),
    chalk.gray(remoteAddr.padStart(15)),
    request,
    referrer ? formattedReferrer : unknown,
    contentLength ? chalk.cyan(prettyBytes(contentLength)) : unknown,
    chalk.cyan(responseTime + " ms"),
    locals ? prettyJSON(locals) : unknown,
  ].join(" | ");
};

/** @type {import('morgan').Options['skip']} */
const skipCommon = (req, res) => {
  const { method, path, hostname, query } = req;
  const { statusCode } = res;
  return (
    // /xref pre-flight request
    (method === "OPTIONS" && /^\/xref\/?$/.test(path) && statusCode === 204) ||
    // automated tests
    hostname === "localhost:9876" ||
    // successful healthcheck
    (query.healthcheck && statusCode < 400)
  );
};

/** @type {import('morgan').Options} */
const optionsStdout = {
  skip: (req, res) => res.statusCode >= 400 || skipCommon(req, res),
  stream: process.stdout,
};

/** @type {import('morgan').Options} */
const optionsStderr = {
  skip: (req, res) => res.statusCode < 400 || skipCommon(req, res),
  stream: process.stderr,
};

module.exports = {
  stdout: () => morgan(formatter, optionsStdout),
  stderr: () => morgan(formatter, optionsStderr),
};
