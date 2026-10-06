import { styleText } from "node:util";

import type { Request, Response } from "express";
import morgan, { type FormatFn, type Options, type TokenIndexer } from "morgan";

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

type Format = Parameters<typeof styleText>[0];
type Paint = (format: Format, text: string) => string;

// Colors only when `stream` supports them (honors FORCE_COLOR and NO_COLOR).
// Empty text stays empty, so it never becomes bare escape codes.
const painter =
  (stream: NodeJS.WritableStream): Paint =>
  (format, text) =>
    text ? styleText(format, text, { stream }) : text;

type BasicTypes = number | boolean | null | string;
const prettyJSON = (obj: Record<string, BasicTypes>, paint: Paint) => {
  const colored = (value: BasicTypes) => {
    switch (typeof value) {
      case "number":
        return paint("cyan", String(value));
      case "boolean":
        return paint("green", String(value));
      default:
        return paint("yellow", String(value));
    }
  };
  return Object.entries(obj)
    .map(([key, value]) => paint("magentaBright", `${key}=`) + colored(value))
    .join(" ");
};

// A malformed escape like "%E0%A4%A" throws; log it undecoded instead.
const safeDecode = (text: string) => {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
};

const parseTokens = (
  tokens: TokenIndexer<Request, Response>,
  req: Request,
  res: Response,
) => {
  // Paths like "///" don't parse; log them raw rather than throw.
  const rawUrl = tokens.url(req, res) ?? "";
  const url = URL.parse(rawUrl, "https://respec.org/");
  const search = url?.search ?? "";
  return {
    date: tokens.date(req, res, "iso"),
    remoteAddr: tokens["remote-addr"](req, res),
    method: tokens.method(req, res),
    status: parseInt(tokens.status(req, res) || "", 10),
    pathname: url?.pathname ?? rawUrl,
    // Cleaner searchParams, while making sure they stay in single line.
    searchParams: search
      ? safeDecode(search).replace(/(\s+)/g, encodeURIComponent)
      : "",
    referrer: URL.parse(tokens.referrer(req, res) ?? ""),
    contentLength: res.getHeader("content-length") as number | undefined,
    responseTime: tokens["response-time"](req, res),
    locals: Object.keys(res.locals).length ? { ...res.locals } : null,
  };
};

export const formatter = (
  stream: NodeJS.WritableStream,
): FormatFn<Request, Response> => {
  const paint = painter(stream);
  return (tokens, req, res) => {
    const {
      date,
      remoteAddr,
      method,
      status,
      pathname,
      searchParams,
      referrer,
      contentLength,
      responseTime,
      locals,
    } = parseTokens(tokens, req, res);
    const color = status < 300 ? "green" : status >= 400 ? "red" : "yellow";
    const statusFormat: Format = res.locals.deprecated
      ? [color, "underline"]
      : color;
    const request =
      paint(statusFormat, `${method!.padEnd(4)} ${status}`) +
      ` ${paint("blueBright", pathname)}${paint(["italic", "gray"], searchParams)}`;

    let formattedReferrer: string | undefined;
    if (referrer) {
      formattedReferrer =
        paint("magenta", referrer.origin + paint("bold", referrer.pathname)) +
        paint(["italic", "gray"], referrer.search);
    }

    const unknown = paint(["dim", "gray"], "-");

    return [
      paint("gray", String(date)),
      remoteAddr ? paint("gray", remoteAddr.padStart(15)) : unknown,
      request,
      formattedReferrer || unknown,
      contentLength
        ? paint("cyan", String(prettyBytes(contentLength)))
        : unknown,
      paint("cyan", `${responseTime} ms`),
      locals ? prettyJSON(locals, paint) : unknown,
    ].join(" | ");
  };
};

const skipCommon = (req: Request, res: Response) => {
  const { method, query } = req;
  const { statusCode } = res;
  const ref = req.get("referer") || req.get("referrer");
  const referrer = URL.parse(ref ?? "");

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

export const stdout = () => morgan(formatter(process.stdout), optionsStdout);
export const stderr = () => morgan(formatter(process.stderr), optionsStderr);
