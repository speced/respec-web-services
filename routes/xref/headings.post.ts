import { Request, Response } from "express";
import { store } from "./lib/store-init.js";

interface HeadingsQuery {
  spec: string;
  id: string;
}

interface RequestBody {
  queries: HeadingsQuery[];
}

type IRequest = Request<never, any, RequestBody>;

/**
 * POST /xref/search/headings
 *
 * Looks up section headings by spec shortname and fragment id.
 * Used by ReSpec's [[[SPEC#id]]] syntax to get heading text for
 * cross-spec section links.
 *
 * Request body: { queries: [{ spec: "fetch", id: "cookie-header" }] }
 * Response: { result: [{ spec: "fetch", id: "cookie-header", ... }] }
 */
export default function route(req: IRequest, res: Response) {
  const { queries } = req.body;
  if (!Array.isArray(queries)) {
    res.status(400).json({ error: "queries must be an array" });
    return;
  }
  if (queries.length > 1000) {
    res.status(400).json({ error: "too many queries (max 1000)" });
    return;
  }
  for (const item of queries) {
    if (typeof item?.spec !== "string" || typeof item?.id !== "string") {
      res
        .status(400)
        .json({ error: "each query must have string fields: spec, id" });
      return;
    }
    if (!item.spec.trim() || !item.id.trim()) {
      res
        .status(400)
        .json({ error: "spec and id must be non-empty strings" });
      return;
    }
  }
  const result = queries.map(({ spec, id }) => {
    const heading = store.getHeading(spec.trim(), id.trim());
    if (!heading) {
      return { spec, id, error: "not found" };
    }
    return {
      spec,
      id,
      title: heading.title,
      number: heading.number || null,
      href: heading.href,
      level: heading.level,
      specTitle: heading.specTitle,
    };
  });
  res.json({ result });
}
