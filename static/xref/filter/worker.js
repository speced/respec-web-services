let data = [];

self.addEventListener('message', ({ data: { query, fields = [] } }) => {
  try {
    const filter = getQueryFn(query);
    const filtered = data.filter(filter);
    const result = formatResult(filtered, fields);
    self.postMessage({ result });
  } catch (error) {
    console.error(error);
    self.postMessage({ message: error.message });
  }
});

/**
 * @returns {Promise<(import('respec-xref-route/search').DataEntry & { term: string })[]>}
 */
async function getData() {
  const json = await fetch('/xref/data/xref.json').then(r => r.json());
  data = Object.entries(json).flatMap(([term, entries]) => {
    return entries.map(entry => {
      entry.term = term;
      return entry;
    });
  });
}
getData().catch(console.error);

/** @param {string} rawQuery */
function getQueryFn(rawQuery) {
  const singleEqualSign = /(?<!=)=(?!=)/;
  const query = rawQuery
    .split('\n')
    .filter(s => s.trim() && !s.startsWith('//'))
    .map(s => `(${s.trim().replace(singleEqualSign, '===')})`)
    .join(' && ');
  const body = `
    const { term, uri, spec, shortname, type, for: forContext, normative, status } = entry;
    return (${query || true});
  `;
  console.debug(body);
  return new Function('entry', body);
}

/**
 * @param {import('respec-xref-route').DataEntry[]} result
 * @param {string[]} fields
 */
function formatResult(result, fields) {
  const keyPadding = Math.max(...fields.map(f => f.length));
  return result
    .map(entry => {
      return Object.entries(pickFields(entry, fields))
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k.padEnd(keyPadding, ' ')}: ${JSON.stringify(v)}`)
        .join('\n');
    })
    .join('\n\n');
}

function pickFields(entry, fields) {
  if (!fields.length) return entry;
  const result = {};
  for (const field of fields) {
    result[field] = entry[field];
  }
  return result;
}
