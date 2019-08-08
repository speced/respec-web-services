import { xrefSearch } from "respec-xref-route";

export function route(req, res) {
  const { keys, options } = req.body;
  const body = xrefSearch(keys, options);
  res.json(body);
}
