import { search } from "respec-xref-route/search.js";

export function route(req, res) {
  const { keys, options } = req.body;
  const body = search(keys, options);
  res.json(body);
}
