import cors from "cors";
import express, { Request, Response } from "express";
import rateLimit from "express-rate-limit";

import { ms, seconds } from "../../utils/misc.js";
import { DATA_FILE } from "./lib/paths.js";
import { startRefreshing } from "./lib/refresh.js";
import { store } from "./lib/store-init.js";
import { isUnsafeKey } from "./lib/validate.js";

const MAX_REFERENCES_PER_REQUEST = 500;
const CACHE_SECONDS = seconds("1h");

/**
 * Two limits: a lookup answers with tens of kilobytes, the whole store with
 * 26 MB. That URL never varies, so a cache in front should absorb almost all of
 * it and volume reaching us is abuse rather than spec builds.
 */
const lookupRateLimit = rateLimit({
  windowMs: ms("1m"),
  max: 120,
  skip: wantsWholeStore,
});
const wholeStoreRateLimit = rateLimit({
  windowMs: ms("1h"),
  max: 20,
  skip: request => !wantsWholeStore(request),
});

const bibrefs = express.Router({ mergeParams: true });

bibrefs
  .options("/", cors({ methods: ["GET"], maxAge: ms("1day") }))
  .get("/", cors(), lookupRateLimit, wholeStoreRateLimit, route);

startRefreshing();

export default bibrefs;

export function route(req: Request, res: Response) {
  if (store.degraded) {
    // Uncacheable: a cached failure would outlive the recovery.
    res.locals.reason = "degraded";
    res.set("Cache-Control", "no-store");
    res.sendStatus(503);
    return;
  }

  if (wantsWholeStore(req)) {
    res.locals.reason = "whole-store";
    setCacheHeaders(res);
    // dotfiles: send() answers 404 for any path with a dot-segment, and
    // DATA_DIR is free to live under one.
    res.type("application/json").sendFile(DATA_FILE, { dotfiles: "allow" });
    return;
  }

  const requested = requestedReferences(req.query.refs);

  if (requested.length > MAX_REFERENCES_PER_REQUEST) {
    res.locals.reason = "too-many-references";
    res.set("Cache-Control", "no-store");
    res.status(400).json({
      error: `Too many references: ${requested.length}, the limit is ${MAX_REFERENCES_PER_REQUEST}.`,
    });
    return;
  }

  const body = store.getRefs(requested);
  Object.assign(res.locals, {
    queries: requested.length,
    errors: requested.filter(reference => !Object.hasOwn(body, reference))
      .length,
  });

  setCacheHeaders(res);
  // jsonp, not json: keeps `?callback=` working, and is plain JSON without it.
  res.jsonp(body);
}

/**
 * Only a request naming nothing to look up. `?refs=` and `?refs[]=a` leave
 * `req.query.refs` empty, so testing that instead gives the store away.
 * `callback` picks a format rather than content, so it does not count.
 */
function wantsWholeStore(req: Request) {
  return Object.keys(req.query).every(key => key === "callback");
}

/** `?refs=A,B&refs=C` becomes ["A", "B", "C"]. */
function requestedReferences(references: unknown) {
  const values = Array.isArray(references) ? references : [references];
  return values
    .flatMap(value => (typeof value === "string" ? value.split(",") : []))
    .map(reference => reference.trim())
    .filter(reference => reference && !isUnsafeKey(reference));
}

function setCacheHeaders(res: Response) {
  res.set("Cache-Control", `public, max-age=${CACHE_SECONDS}`);
  // Keep Expires. ReSpec parses this header itself to decide how long to hold
  // entries in IndexedDB, so it does more here than ordinary HTTP caching.
  res.set("Expires", new Date(Date.now() + CACHE_SECONDS * 1000).toUTCString());
}
