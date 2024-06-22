import type { Request, Response } from "express";

import { store, type Store } from "./lib/store-init.js";

interface Query {
  codepoint: string;
}
interface Result {
  name: string;
}

type Options = Record<never, never>;

interface RequestBody {
  queries: Query[];
  options?: Options;
}
type IRequest = Request<never, any, RequestBody>;

interface ResponseData {
  data: Array<{ query: Query; result: Result | null }>;
  metadata: { lastParsedAt: string };
}

export default function route(req: IRequest, res: Response) {
  const { options = {}, queries = [] } = req.body;
  const data: ResponseData["data"] = queries.map(query => ({
    query,
    result: search(query, store, options),
  }));

  Object.assign(res.locals, {
    errors: getErrorCount(data),
    queries: queries.length,
  });

  const result: ResponseData = {
    data,
    metadata: {
      lastParsedAt: "",
    },
  };
  res.json(result);
}

function search(query: Query, store: Store, _options: Options): Result | null {
  if (query.codepoint) {
    const name = store.getNameByCodepoint(query.codepoint);
    return typeof name === "string" ? { name } : null;
  }
  return null;
}

function getErrorCount(results: ResponseData["data"]) {
  return results.filter(({ result }) => !result).length;
}
