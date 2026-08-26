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
  /** The canonical term this entry was indexed under (set on case-insensitive fallback hits). */
  term?: string;
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
  /**
   * The term to look up. An explicit empty string is a real term (the
   * empty-string enum value, which ReSpec writes as `Foo[""]`), so it is NOT
   * the browse signal. Browsing a whole spec is requested by omitting `term`.
   */
  term?: string;
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
  opts: Partial<Options> = {},
) {
  const options = { ...defaultOptions, ...opts };
  normalizeQuery(query, options);

  const filtered = cache.getOr(query.id, () => filter(query, store, options));

  let prefereredData = filterBySpecType(filtered, options.spec_type);
  prefereredData = filterPreferLatestVersion(prefereredData);
  // Cap empty-term browsing results after preference filters have run so that
  // preferred entries (e.g. current over snapshot, latest version) are retained.
  if (query.term == null && prefereredData.length > BROWSE_LIMIT) {
    prefereredData = prefereredData.slice(0, BROWSE_LIMIT);
  }
  const result = prefereredData.map(item => pickFields(item, options.fields));
  return result;
}

function normalizeQuery(query: Query, options: Options) {
  if (Array.isArray(query.specs) && !Array.isArray(query.specs[0])) {
    // @ts-expect-error - backward compatibility: wrapping flat specs array
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

/** Maximum entries returned for empty-term browsing queries. */
const BROWSE_LIMIT = 1000;

function filter(query: Query, store: Store, options: Options) {
  const searchTerm = query.term;
  // `== null` on purpose: a JSON body can carry {"term": null}, and the POST route
  // passes req.body.queries to searchOne unvalidated. An explicit "" is NOT caught
  // here, which is the whole point of this function.
  if (searchTerm == null) {
    // No term at all means "browse everything in these specs". An explicit
    // empty string is NOT this case: it is a real term, so it falls through to
    // the lookup below. Types-only browsing is unsupported (it would scan the
    // whole store) and the route rejects it with a 400. BROWSE_LIMIT is applied
    // in searchOne(), after the preference filters have chosen entries.
    if (!query.specs?.length) return [];
    const entries = collectBySpecs(query.specs, store);
    const byType = filterByType(entries, query);
    return filterByForContext(byType, query, options);
  }

  const { types = [] } = query;
  const isIDL = types.some(t => IDL_TYPES.has(t));
  const allowCaseFallback = !isIDL;

  for (const term of getTermVariations(searchTerm, query)) {
    // Try the exact-case bucket first (so `[=baseline=]` and `{{Baseline}}`
    // stay distinct), then a case-insensitive fallback. The fallback is
    // essential when an exact-case bucket exists but every entry is filtered
    // out downstream — e.g. term "url" matches only the for-scoped basic URL
    // parser variable, while the canonical URL concept lives under "URL".
    for (const byTerm of termCandidates(term, store, allowCaseFallback)) {
      const bySpec = filterBySpec(byTerm, query);
      const byType = filterByType(bySpec, query);
      const byForContext = filterByForContext(byType, query, options);
      if (byForContext.length) {
        return byForContext;
      }
    }
  }
  return [];
}

function resolveSpecKey(spec: string, store: Store) {
  if (store.bySpec[spec]) {
    return spec;
  }

  // specmap is { [group]: { [specid]: { shortname, url, title } } }
  for (const group of Object.values(store.specmap ?? {})) {
    const entry = group[spec];
    if (entry?.shortname && store.bySpec[entry.shortname]) {
      return entry.shortname;
    }
  }

  const versionlessSpec = spec.replace(/-\d+$/, "");
  if (versionlessSpec !== spec) {
    if (store.bySpec[versionlessSpec]) {
      return versionlessSpec;
    }

    for (const group of Object.values(store.specmap ?? {})) {
      const entry = group[versionlessSpec];
      if (entry?.shortname && store.bySpec[entry.shortname]) {
        return entry.shortname;
      }
    }
  }

  return spec;
}

/** Collect all entries from the store that belong to any of the given specs. */
function collectBySpecs(specsLists: string[][], store: Store) {
  const seen = new Set<string>();
  return specsLists.flatMap(specs =>
    specs
      .map(spec => resolveSpecKey(spec, store))
      .filter(spec => !seen.has(spec) && seen.add(spec))
      .flatMap(spec => store.bySpec[spec] ?? [])
  );
}

function getTermVariations(inputTerm: string, query: Query) {
  const { types = [] } = query;

  const isConcept = types.some(t => CONCEPT_TYPES.has(t));
  const isIDL = types.some(t => IDL_TYPES.has(t));
  const shouldTreatAsConcept = isConcept && !isIDL && !!types.length;

  if (shouldTreatAsConcept) {
    const term = inputTerm.toLowerCase();
    return (function* () {
      yield inputTerm;
      if (term !== inputTerm) yield term;
      yield* textVariations(term);
    })();
  } else {
    return (function* () {
      yield inputTerm;
    })();
  }
}

/**
 * Yields candidate entry sets for a term in priority order: the exact-case
 * bucket, then (non-IDL only) the case-insensitive fallback union, each
 * fallback entry tagged with its canonical term. Two separate sets so the
 * caller can prefer an exact match that survives filtering and reach for the
 * fallback only when it doesn't.
 */
function* termCandidates(
  term: Query["term"],
  store: Store,
  allowCaseFallback: boolean,
) {
  if (term == null) return;
  const direct = store.byTerm[term];
  if (direct) yield direct;
  if (!allowCaseFallback) return;
  const lower = term.toLowerCase();
  const variants = store.byTermLower.get(lower);
  if (!variants) return;
  const fallback = variants
    .filter(v => v !== term) // exclude the exact bucket already yielded above
    .flatMap(v =>
      (store.byTerm[v] || []).map(entry => ({ ...entry, term: v })),
    );
  if (fallback.length) yield fallback;
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

/**
 * Identity of a definition, independent of where it was published.
 *
 * The same definition appears twice in the store, once from the editor's draft
 * and once from the published snapshot, and the two differ only in `status` and
 * `uri` (a relative fragment versus an absolute URL). So `uri` cannot be part of
 * the identity, or the pair never collapses and the term becomes ambiguous.
 *
 * `for` is part of the identity: production data has 2198 groups sharing a spec,
 * type and term while differing only in `for` (e.g. `name` as a dict-member of
 * four different Cookie Store dictionaries), and dropping all but one of those
 * loses real definitions.
 */
function definitionIdentity(item: DataEntry) {
  // JSON encodes the parts unambiguously, so a term containing a separator
  // cannot forge another definition's identity.
  return JSON.stringify([
    item.spec,
    item.type,
    item.term,
    [...(item.for ?? [])].sort(),
  ]);
}

function filterBySpecType(data: DataEntry[], specTypes: SpecType[]) {
  if (!specTypes.length) return data;

  const preferredType = specStatusAlias.get(specTypes[0]) || specTypes[0];
  if (specTypes.length === 1) {
    return data.filter(entry => entry.status === preferredType);
  }
  // Preferred entries first. ReSpec itself does not depend on this (it requires
  // exactly one result and reports anything else as an error, see xref.js
  // addDataCiteToTerms), but the order is part of this API's existing responses
  // and several tests pin it, so it is left alone here.
  // NOTE: this comparator is not a valid strict weak ordering (it returns -1 when
  // both sides are the preferred status). Correcting it changes the order of every
  // response and breaks six order-pinning tests, so it is deliberately left alone
  // here and tracked separately rather than bundled into this fix.
  const sorted = [...data].sort((a, b) =>
    a.status === preferredType ? -1 : b.status === preferredType ? 1 : 0,
  );
  // Drop a non-preferred entry only when its preferred twin is present. Two
  // entries sharing an identity at the SAME status are not twins, they are
  // distinct definitions the by-term store cannot tell apart (it strips `term`,
  // and it files every method overload under a shared `name()` key), so
  // collapsing them would lose real definitions. Document order is preserved.
  const preferredIdentities = new Set<string>();
  for (const item of sorted) {
    if (item.status === preferredType) {
      preferredIdentities.add(definitionIdentity(item));
    }
  }
  const preferredData = sorted.filter(
    item =>
      item.status === preferredType ||
      !preferredIdentities.has(definitionIdentity(item)),
  );

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
