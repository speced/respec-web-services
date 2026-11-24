import type { Request, Response } from "express";

import {
  type DataEntry,
  type Options,
  type Query,
  searchOne,
  validateSearchBody,
} from "./lib/search.ts";
import type { Store } from "./lib/store.ts";
import { store } from "./lib/store-init.ts";

interface RequestBody {
  options: Partial<Options>;
  queries: Query[];
  keys: Query[];
}
type IRequest = Request<never, any, RequestBody>;

export default function route(req: IRequest, res: Response) {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    res.status(400).json({ error: "body must be a JSON object" });
    return;
  }
  const { options = {}, queries = [] } = req.body;

  const validationError = validateSearchBody(queries, options);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const results = search(queries, store, options);

  Object.assign(res.locals, {
    errors: getErrorCount(results),
    queries: queries.length,
  });
  res.json({ results });
}

function getErrorCount(results: ReturnType<typeof search>) {
  return results.filter(({ result }) => result.length !== 1).length;
}

export function search(
  queries: Query[],
  store: Store,
  options: Partial<Options> = {},
): { query?: Query; result: Partial<DataEntry>[] }[] {
  return queries.map(query => {
    const result = searchOne(query, store, options);
    return {
      id: query.id,
      ...(options.query ? { query } : undefined),
      result,
    };
  });
}
