export const IDL_TYPES = new Set([
  "_IDL_",
  "attribute",
  "callback",
  "const",
  "dict-member",
  "dictionary",
  "enum-value",
  "enum",
  "exception",
  "extended-attribute",
  "interface",
  "method",
  "typedef",
]);

// XXX: `CONCEPT_TYPES` includes `element`: otherwise it'll break many specs.
// https://github.com/sidvishnoi/respec-xref-route/issues/57
export const CONCEPT_TYPES = new Set(["_CONCEPT_", "dfn", "event", "element"]);
export const MARKUP_TYPES = new Set(["element", "element-attr", "attr-value"]);
export const CSS_TYPES_INPUT = new Set([
  "property",
  "descriptor",
  "value",
  "type",
  "at-rule",
  "function",
  "selector",
]);
export const CSS_TYPES = new Set([...CSS_TYPES_INPUT].map(t => `css-${t}`));

export const SUPPORTED_TYPES = new Set([
  ...IDL_TYPES,
  ...CONCEPT_TYPES,
  ...MARKUP_TYPES,
  ...CSS_TYPES,
]);

export const QUERY_CACHE_DURATION = 3 * 24 * 60 * 60 * 1000; // 3 days
