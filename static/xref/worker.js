importScripts(
  'fuse.js?v3.4.5',
  'https://unpkg.com/comlink/dist/umd/comlink.min.js',
);

const store = { specs: [], types: [], term: [] };
const searchers = { specs: null, types: null, term: null };

async function setup() {
  const metaURL = '/xref/meta?fields=types,specs,terms';
  const data = await fetch(metaURL).then(res => res.json());

  const { terms } = data;
  const specs = [
    ...new Set(
      Object.values(data.specs).flatMap(({ shortname, spec }) => [
        shortname,
        spec,
      ]),
    ),
  ];
  const types = Object.values(data.types).flat().sort();
  Object.assign(store, { specs, types, term: terms });

  searchers.specs = new Fuse(specs, {});
  searchers.types = new Fuse(types, {});
  searchers.term = new Fuse(terms, {});

  return {
    types: {
      idl: new Set(data.types.idl),
      concept: new Set(data.types.concept),
      markup: new Set(data.types.markup),
    },
    specs: data.specs,
    terms,
  };
}

/**
 * @param {keyof store} type
 * @param {string} text
 */
function search(type, text) {
  const matchedIndexes = searchers[type].search(text).slice(0, 15);
  const suggestions = matchedIndexes.map(i => store[type][i]);
  return suggestions;
}

Comlink.expose({ setup, search });
