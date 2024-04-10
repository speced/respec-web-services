import { QUERY_CACHE_DURATION, IDL_TYPES, CONCEPT_TYPES } from "./constants.js";
import { Store } from "./store.js";
import { objectHash, pickFields, textVariations } from "./utils.js";
import { MemCache } from "../../../utils/mem-cache.js";

type Type =
  | "attribute"
  | "dfn"
  | "dict-member"
  | "dictionary"
  | "element"
  | "enum-value"
  | "enum"
  | "event"
  | "http-header"
  | "interface"
  | "method"
  | "permission"
  | "typedef";

export interface DataEntry {
  type: Type;
  spec: string;
  shortname: string;
  status: "snapshot" | "current";
  uri: string;
  normative: boolean;
  for?: string[];
  htmlProse?: string;
}

type SpecType = DataEntry["status"] | "draft" | "official";

export interface Options {
  fields: (keyof DataEntry)[];
  spec_type: SpecType[];
  types: (Type | "_IDL_" | "_CONCEPT_")[];
  query?: boolean;
  id?: string;
  all?: boolean;
}

export interface Query {
  term: string;
  id: string;
  types?: (Type | "_IDL_" | "_CONCEPT_")[];
  specs?: string[][];
  for?: string;
}

interface Response {
  result: [string, Partial<DataEntry>[]][];
  query?: Query[];
}

const specStatusAlias = new Map([
  ["draft", "current"],
  ["official", "snapshot"],
]);

export const defaultOptions: Options = {
  fields: ["shortname", "spec", "type", "for", "normative", "uri", "htmlProse"],
  spec_type: ["draft", "official"],
  types: [],
};

export const cache = new MemCache<DataEntry[]>(QUERY_CACHE_DURATION);

export function search(
  queries: Query[],
  store: Store,
  opts: Partial<Options> = {},
) {
  const options = { ...defaultOptions, ...opts };

  const response: Response = { result: [] };
  if (options.query) response.query = [];

  for (const query of queries) {
    const result = searchOne(query, store, options);
    response.result.push([query.id, result]);
    if (options.query) {
      response.query!.push(query);
    }
  }

  return response;
}

export function searchOne(
  query: Query,
  store: Store,
  options = defaultOptions,
) {
  normalizeQuery(query, options);

  const filtered = cache.getOr(query.id, () => filter(query, store, options));

  let prefereredData = filterBySpecType(filtered, options.spec_type);
  prefereredData = filterPreferLatestVersion(prefereredData);
  const result = prefereredData.map(item => pickFields(item, options.fields));
  return result;
}

function normalizeQuery(query: Query, options: Options) {
  if (Array.isArray(query.specs) && !Array.isArray(query.specs[0])) {
    // @ts-ignore
    query.specs = [query.specs]; // for backward compatibility
  }
  if (!Array.isArray(query.types) || !query.types.length) {
    query.types = options.types;
  }
  if (query.term === '""') {
    query.term = "";
  }
  if (!query.id) {
    query.id = objectHash(query);
  }
}

function filter(query: Query, store: Store, options: Options) {
  let result: DataEntry[] = [];
  for (const term of getTermVariations(query)) {
    const byTerm = filterByTerm(term, store);
    const bySpec = filterBySpec(byTerm, query);
    const byType = filterByType(bySpec, query);
    const byForContext = filterByForContext(byType, query, options);
    if (byForContext.length) {
      result = byForContext;
      break;
    }
  }
  return result;
}

function getTermVariations(query: Query) {
  const { term: inputTerm, types = [] } = query;

  const isConcept = types.some(t => CONCEPT_TYPES.has(t));
  const isIDL = types.some(t => IDL_TYPES.has(t));
  const shouldTreatAsConcept = isConcept && !isIDL && !!types.length;

  if (shouldTreatAsConcept) {
    const term = inputTerm.toLowerCase();
    return (function* () {
      yield term;
      yield* textVariations(term);
    })();
  } else {
    return (function* () {
      yield inputTerm;
    })();
  }
}

function filterByTerm(term: Query["term"], store: Store) {
  return store.byTerm[term] || [];
}

function filterBySpec(data: DataEntry[], query: Query) {
  const { specs: specsLists } = query;
  if (!Array.isArray(specsLists) || !specsLists.length) return data;
  for (const specs of specsLists) {
    const filteredBySpec = data.filter(
      item => specs.includes(item.spec) || specs.includes(item.shortname),
    );
    if (filteredBySpec.length) return filteredBySpec;
  }
  return [];
}

function filterByType(data: DataEntry[], query: Query) {
  const types = query.types!;
  if (!types.length) return data;

  const isIDL = types.includes("_IDL_");
  const isConcept = types.includes("_CONCEPT_");
  return data.filter(({ type }) => {
    return (
      types.includes(type) ||
      (isIDL && IDL_TYPES.has(type)) ||
      (isConcept && CONCEPT_TYPES.has(type))
    );
  });
}

function filterByForContext(data: DataEntry[], query: Query, options: Options) {
  const { for: forContext } = query;
  const shouldFilter = options.all ? typeof forContext === "string" : true;
  if (!shouldFilter) return data;

  return data.filter(item => {
    if (!forContext) return !item.for;
    if (!!item.for && item.for.includes(forContext)) return true;
    if (CONCEPT_TYPES.has(item.type)) {
      return !!item.for && item.for.includes(forContext.toLowerCase());
    }
    return false;
  });
}

function filterBySpecType(data: DataEntry[], specTypes: SpecType[]) {
  if (!specTypes.length) return data;

  const preferredType = specStatusAlias.get(specTypes[0]) || specTypes[0];
  if (specTypes.length === 1) {
    return data.filter(entry => entry.status === preferredType);
  }
  const sorted = [...data].sort((a, b) =>
    a.status === preferredType ? -1 : b.status === preferredType ? 1 : 0,
  );
  const preferredData: DataEntry[] = [];
  for (const item of sorted) {
    if (
      item.status === preferredType ||
      !preferredData.find(it => item.spec === it.spec && item.type === it.type)
    ) {
      preferredData.push(item);
    }
  }

  const hasPreferredData = specTypes.length === 2 && preferredData.length;
  return specTypes.length === 1 || hasPreferredData ? preferredData : data;
}

function filterPreferLatestVersion(data: DataEntry[]) {
  if (data.length <= 1) {
    return data;
  }

  const differingByVersion: Record<string, DataEntry[]> = {};
  for (const entry of data) {
    const key = `${entry.shortname}/${entry.uri}`;
    if (!differingByVersion[key]) {
      differingByVersion[key] = [];
    }
    differingByVersion[key].push(entry);
  }

  const result: DataEntry[] = [];
  for (const entries of Object.values(differingByVersion)) {
    if (entries.length > 1) {
      // sorted as largest version number (latest) first
      entries.sort((a, b) => getVersion(b.spec) - getVersion(a.spec));
    }
    result.push(entries[0]);
  }
  return result;
}

function getVersion(s: string) {
  const match = s.match(/(\d+)?$/);
  return match ? Number(match[1]) : 0;
}
