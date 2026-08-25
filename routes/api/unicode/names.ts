import type { Request, Response } from "express";

import { store, type Store } from "./lib/store-init.js";

interface Query {
  /** Codepoint as hex */
  hex: string;
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
  metadata: { lastParsedAt: string; dataSource: string };
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
      lastParsedAt: store.version.toString(),
      dataSource: store.dataSource,
    },
  };
  res.json(result);
}

function search(query: Query, store: Store, _options: Options): Result | null {
  if (query.hex) {
    query.hex = query.hex.toUpperCase().padStart(4, "0");
    const data = store.getNameByHexCodePoint(query.hex);
    return data;
  }
  return null;
}

function getErrorCount(results: ResponseData["data"]) {
  return results.filter(({ result }) => !result).length;
}
