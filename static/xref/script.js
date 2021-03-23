const form = document.getElementById('xref-search');
const output = document.getElementById('output');
const caption = document.querySelector('table caption');
const inputs = {};

const specStatusType = {
  'prefer-draft': ['draft', 'snapshot'],
  'prefer-snapshot': ['snapshot', 'draft'],
  'only-draft': ['draft'],
  'only-snapshot': ['snapshot'],
};

let metadata;
const options = {
  fields: ['shortname', 'spec', 'uri', 'type', 'for', 'status'],
  spec_type: ['draft', 'snapshot'],
  all: true,
};

// Except for the following, exceptions take the form {{"SomeException"}}
const exceptionExceptions = new Set([
  'EvalError',
  'RangeError',
  'ReferenceError',
  'TypeError',
  'URIError',
]);

function getFormData() {
  const getValues = key => inputs[key].value.map(({ value }) => value);
  const term = getValues('term')[0];
  const types = getValues('types');
  const specs = getValues('specs');
  const forContext = getValues('for')[0];
  return {
    term,
    ...(specs.length && { specs }),
    ...(types.length && { types }),
    ...(forContext && { for: forContext }),
  };
}

async function handleSubmit() {
  const data = getFormData();
  if (!data.term) return;

  const params = new URLSearchParams(Object.entries(data));
  history.replaceState(null, null, `?${params}`);

  const body = { queries: [data], options };
  try {
    const response = await fetch(form.action, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    }).then(res => res.json());
    const result = response.result[0][1];
    renderResults(result, data);
  } catch (err) {
    output.innerHTML = `<tr><td colspan="4">Network error. Are you online?</td></tr>`;
    console.error(err);
  }
}

function renderResults(entries, query) {
  const { term } = query;
  caption.innerText = `Searched for "${term}".`;
  if (!entries.length) {
    output.innerHTML = `<tr><td colspan="4">No results found.</td></tr>`;
    return;
  }

  let html = '';
  for (const entry of entries) {
    const specInfo = metadata.specs[entry.status][entry.spec];
    const link = new URL(entry.uri, specInfo.url).href;
    const title = specInfo.title;
    const cite = metadata.types.idl.has(entry.type)
      ? howToCiteIDL(term, entry)
      : metadata.types.markup.has(entry.type)
      ? howToCiteMarkup(term, entry)
      : metadata.types.css.has(entry.type)
      ? howToCiteCSS(term, entry)
      : howToCiteTerm(term, entry);
    let row = `
      <tr>
        <td><a href="${link}">${title}</a></td>
        <td>${entry.shortname}</td>
        <td>${entry.type}</td>
        <td>${cite}</td>
      </tr>`;
    html += row;
  }
  output.innerHTML = html;
}

function howToCiteIDL(term, entry) {
  const { type, for: forList } = entry;
  if (forList) {
    return forList.map(f => `{{${f}/${term ? term : '""'}}}`).join('<br>');
  }
  switch (type) {
    case 'exception':
      if (!exceptionExceptions.has(term)) {
        return `{{"${term}"}}`;
      }
    default:
      return `{{${term}}}`;
  }
}

function howToCiteMarkup(term, entry) {
  const { type, for: forList, shortname } = entry;
  if (forList) {
    return forList.map(f => `[^${f}/${term}^]`).join('<br>');
  }
  if (type === 'element-attr') {
    return `[^/${term}^]`;
  }
  return `[^${term}^]`;
}

function howToCiteCSS(term, entry) {
  const { type, for: forList } = entry;
  term = escapeHTML(term);
  if (!forList) {
    return escapeHTML(`<a data-xref-type="${type}">${term}</a>`);
  }
  return forList
    .map(f =>
      escapeHTML(
        `<a data-xref-type="${type}" data-xref-for="${f}">${term}</a>`,
      ),
    )
    .join('<br>');
}

function howToCiteTerm(term, entry) {
  const { type, for: forList, shortname } = entry;
  term = term.replace('/', '\\/');
  if (forList) {
    return forList.map(f => `[=${f}/${term}=]`).join('<br>');
  }
  return `[=${term}=]`;
}

function escapeHTML(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Sort terms ignoring any initial non-alpha character.
 * @example
 * ```
 * input = ["-a", "_a", "1a", "A", "a"];
 * [...input].sort(); // [ "-a", "1a", "A", "_a", "a" ]
 * [...input].sort(sortTerms); // [ "a", "A", "-a", "_a", "1a" ]
 * ```
 */
function sortTerms(a, b) {
  return a.replace(/^[^a-z]/i, 'Z').localeCompare(b.replace(/^[^a-z]/i, 'Z'));
}

async function ready() {
  const metaURL = new URL(`${form.action}/meta?fields=types,specs,terms`).href;
  const { specs, types, terms } = await fetch(metaURL).then(res => res.json());

  const allShortnames = Object.values(specs).flatMap(specsListByStatus =>
    Object.values(specsListByStatus).map(s => s.shortname),
  );
  const allTypes = Object.values(types).flat(2);

  Object.assign(inputs, {
    term: new Tagify(form.term, {
      whitelist: [...terms].sort(sortTerms).sort(() => 0.5 - Math.random()),
      dropdown: { enabled: 0, maxItems: 20, closeOnSelect: true },
    }),

    specs: new Tagify(form.specs, {
      whitelist: [...new Set(allShortnames)].sort(),
      enforceWhitelist: true,
      dropdown: { enabled: 0, classname: 'tags-look' },
    }),

    types: new Tagify(form.types, {
      whitelist: [...new Set(allTypes)].sort(),
      enforceWhitelist: true,
      dropdown: { enabled: 0, maxItems: 20, classname: 'tags-look' },
    }),

    for: new Tagify(form.for, {
      whitelist: [],
      enforceWhitelist: false,
      dropdown: { enabled: 0, classname: 'tags-look' },
    }),
  });

  form.querySelector("button[type='submit']").removeAttribute('disabled');
  form.addEventListener('submit', event => {
    event.preventDefault();
    handleSubmit();
  });
  form.all.addEventListener('change', ev => {
    options.all = ev.target.checked;
  });
  form.spec_type.addEventListener('change', ev => {
    options.spec_type = specStatusType[ev.target.value];
  });

  const { searchParams } = new URL(window.location.href);
  for (const [field, value] of searchParams) {
    switch (field) {
      case 'term':
      case 'for':
        form[field].value = value;
        break;
      case 'specs':
      case 'types':
        value.split(',').forEach(val => form[field].select(val));
        break;
    }
  }
  if (searchParams.has('term')) {
    handleSubmit();
  }

  // set up Advanced Search toggle
  /** @type {HTMLInputElement} */
  const advancedSearchToggle = form.advanced;
  advancedSearchToggle.onchange = () => {
    const showAdvanced = advancedSearchToggle.checked;
    form.querySelectorAll('.advanced').forEach(input => {
      input.hidden = !showAdvanced;
    });
    // remember choice
    localStorage.setItem('showAdvanced', showAdvanced ? 'yes' : '');
  };

  if (
    localStorage.getItem('showAdvanced') ||
    [...searchParams.keys()].some(k => ['for', 'cite', 'types'].includes(k))
  ) {
    advancedSearchToggle.checked = true;
    advancedSearchToggle.onchange();
  }

  metadata = {
    types: {
      idl: new Set(types.idl),
      concept: new Set(types.concept),
      markup: new Set(types.markup),
      css: new Set(types.css),
    },
    specs,
    terms,
  };
}

ready();
