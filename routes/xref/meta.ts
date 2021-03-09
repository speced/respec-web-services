import { Request, Response } from "express";

import {
  IDL_TYPES,
  CONCEPT_TYPES,
  CSS_TYPES,
  MARKUP_TYPES,
} from "./lib/constants.js";
import { store } from "./lib/store-init.js";

let data = getData();

const supportedFields = new Set(Object.keys(data));

type FieldType = "version" | "types" | "specs" | "terms";
type Params = { field?: FieldType };
type Query = { fields?: string };
type IRequest = Request<Params, any, any, Query>;
export default function route(req: IRequest, res: Response) {
  if (data.version < store.version) {
    data = getData();
  }

  if (req.params.field) {
    switch (req.params.field) {
      case "version":
        res.set("Cache-Control", "no-cache");
        res.set("Content-Type", "text/plain");
        res.send(data.version.toString());
        break;
      case "types":
      case "specs":
      case "terms":
        res.send(data[req.params.field]);
        break;
      default:
        res.sendStatus(404);
    }
    return;
  }

  const fields = (req.query.fields || "")
    .split(",")
    .filter((field): field is FieldType => supportedFields.has(field));

  if (!fields.length) {
    res.json(data);
  } else {
    const filteredData = pickFields(fields, data);
    res.json(filteredData);
  }
}

function getData() {
  const terms = Object.keys(store.byTerm);
  terms.splice(terms.indexOf(""), 1, '""');

  return {
    types: {
      idl: [...IDL_TYPES],
      concept: [...CONCEPT_TYPES],
      markup: [...MARKUP_TYPES],
      css: [...CSS_TYPES],
    },
    specs: store.specmap,
    terms,
    version: store.version,
  };
}

function pickFields<T, K extends keyof T>(fields: K[], data: T): Pick<T, K> {
  return fields.reduce((result, field) => {
    result[field] = data[field];
    return result;
  }, {} as Pick<T, K>);
}
