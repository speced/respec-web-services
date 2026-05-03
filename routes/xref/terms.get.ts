import { Request, Response } from "express";

import { seconds } from "../../utils/misc.js";
import { store } from "./lib/store-init.js";

interface TermEntry {
  lower: string;
  original: string;
}

let termsIndex: TermEntry[] = [];
let termsVersion = -1;

function getTermsIndex(): TermEntry[] {
  if (termsVersion < store.version) {
    const keys = Object.keys(store.byTerm).filter(k => k !== "");
    termsIndex = keys
      .map(k => ({ lower: k.toLowerCase(), original: k }))
      .sort((a, b) => (a.lower < b.lower ? -1 : a.lower > b.lower ? 1 : 0));
    termsVersion = store.version;
  }
  return termsIndex;
}

function bisectLeft(arr: TermEntry[], target: string): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid].lower < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function searchTerms(query: string, limit: number): string[] {
  const index = getTermsIndex();
  const q = query.toLowerCase();
  const results: string[] = [];
  const seen = new Set<string>();

  const start = bisectLeft(index, q);
  for (let i = start; i < index.length && results.length < limit; i++) {
    if (!index[i].lower.startsWith(q)) break;
    seen.add(index[i].lower);
    results.push(index[i].original);
  }

  if (results.length < limit) {
    for (let i = 0; i < index.length && results.length < limit; i++) {
      if (seen.has(index[i].lower)) continue;
      if (index[i].lower.includes(q)) {
        results.push(index[i].original);
      }
    }
  }

  return results;
}

interface QueryParams {
  q?: string | string[];
  limit?: string;
}
type IRequest = Request<never, any, never, QueryParams>;

export default function route(req: IRequest, res: Response) {
  const q = Array.isArray(req.query.q) ? req.query.q[0] : req.query.q;
  if (!q || q.length < 2) {
    res.status(400).json({ error: "query must be at least 2 characters" });
    return;
  }

  const limit = Math.min(Math.max(parseInt(req.query.limit || "15", 10) || 15, 1), 50);
  const results = searchTerms(q, limit);

  res.set("Cache-Control", `max-age=${seconds("24h")}`);
  res.json(results);
}
