import morgan, { FormatFn, Options } from "morgan";
import chalk from "chalk";
import { Request, Response } from "express";

const prettyBytes = (bytes: number) => {
  const threshold = 1024;
  let size = bytes;
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
  type BasicTypes = number | boolean | null | string;
  const colored = (value: BasicTypes) => {
    switch (typeof value) {
      case "number":
        return chalk.cyan(value.toString());
      case "boolean":
        return chalk.green(value.toString());
      default:
        return chalk.yellow(value);
    }
  };
  return (obj: Record<string, BasicTypes>) =>
    Object.entries(obj)
      .map(([key, value]) => chalk.magentaBright(key + "=") + colored(value))
      .join(" ");
})();

const tryURL = (url?: string, base?: string) => {
  try {
    if (!url) return null;
    return new URL(url, base);
  } catch {
    return null;
  }
};

const formatter: FormatFn<Request, Response> = (tokens, req, res) => {
  const date = tokens.date(req, res, "iso");
  const remoteAddr = tokens["remote-addr"](req, res);
  const method = tokens.method(req, res);
  const status = parseInt(tokens.status(req, res) || "", 10);
  const url = tryURL(tokens.url(req, res)!, "https://respec.org/")!;
  const referrer = tryURL(tokens.referrer(req, res));
  const contentLength = res.getHeader("content-length") as number | undefined;
  const responseTime = tokens["response-time"](req, res);
  const locals = Object.keys(res.locals).length ? { ...res.locals } : null;

  // Cleaner searchParams, while making sure they stay in single line.
  const searchParams = url.search
    ? decodeURIComponent(url.search).replace(/(\s+)/g, encodeURIComponent)
    : "";
  let color =
    status < 300 ? chalk.green : status >= 400 ? chalk.red : chalk.yellow;
  if (res.locals.deprecated) {
    color = color.underline;
  }
  const request =
    color(`${method!.padEnd(4)} ${status}`) +
    ` ${chalk.blueBright(url.pathname)}${chalk.italic.gray(searchParams)}`;

  let formattedReferrer: string | undefined;
  if (referrer) {
    const { origin, pathname, search } = referrer;
    formattedReferrer =
      chalk.magenta(origin + chalk.bold(pathname)) + chalk.italic.gray(search);
  }

  const unknown = chalk.dim.gray("-");

  return [
    chalk.gray(date),
    remoteAddr ? chalk.gray(remoteAddr.padStart(15)) : unknown,
    request,
    formattedReferrer || unknown,
    contentLength ? chalk.cyan(prettyBytes(contentLength)) : unknown,
    chalk.cyan(responseTime + " ms"),
    locals ? prettyJSON(locals) : unknown,
  ].join(" | ");
};

const skipCommon = (req: Request, res: Response) => {
  const { method, query } = req;
  const { statusCode } = res;
  const ref = req.get("referer") || req.get("referrer");
  const referrer = tryURL(ref);

  return (
    // successful pre-flight requests
    (method === "OPTIONS" && statusCode === 204) ||
    // automated tests
    (referrer && referrer.host === "localhost:9876") ||
    // successful healthcheck
    (typeof query.healthcheck !== "undefined" && statusCode < 400)
  );
};

const optionsStdout: Options<Request, Response> = {
  skip: (req, res) => res.statusCode >= 400 || skipCommon(req, res),
  stream: process.stdout,
};

const optionsStderr: Options<Request, Response> = {
  skip: (req, res) => res.statusCode < 400 || skipCommon(req, res),
  stream: process.stderr,
};

export const stdout = () => morgan(formatter, optionsStdout);
export const stderr = () => morgan(formatter, optionsStderr);
