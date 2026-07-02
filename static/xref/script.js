import { autocomplete } from './autocomplete.js?v=5.0.1';
import Fuse from './fuse.js?v=6.0.4';

class OptionSelector extends HTMLInputElement {
  constructor() {
    super();
  }

  static get observedAttributes() {
    return ['data-options'];
  }

  /** @returns {string[]} */
  get values() {
    return Array.from(this.selectedValues);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'data-options') {
      this.options = [...new Set(newValue.split('|'))];
      this.fuse = new Fuse(this.options);
    }
  }

  connectedCallback() {
    this.fuse = new Fuse(this.options);
    const limit = parseInt(this.dataset.limit, 10) || 10;
    const self = this;
    autocomplete({
      input: self,
      fetch(text, update) {
        text = text.toLowerCase();
        const searchResults = self.fuse.search(text).slice(0, limit);
        const values = searchResults.map(r => r.item);
        update(values);
      },
      onSelect(value) {
        self.select(value.trim());
      },
    });

    const name = this.getAttribute('name');
    const sel = `.selections[data-for="${name}"]`;
    this.elSelections = document.querySelector(sel);
    if (!this.elSelections) {
      throw new Error(`${sel} not found`);
    }

    this.selectedValues = new Set();
    const options = this.dataset.options || '';
    this.options = Array.from(new Set(options.split('|')));
  }

  select(value) {
    const { selectedValues, elSelections, options } = this;
    if (value === '' || selectedValues.has(value) || !options.includes(value)) {
      return;
    }

    this.value = '';
    selectedValues.add(value);

    const button = document.createElement('button');
    button.setAttribute('type', 'button');
    button.textContent = value;
    button.addEventListener('click', ev => {
      button.remove();
      selectedValues.delete(value);
    });
    elSelections.appendChild(button);
  }
}

const form = document.getElementById('xref-search');
const output = document.getElementById('output');
const caption = document.querySelector('table caption');

const specStatusType = {
  'prefer-draft': ['draft', 'snapshot'],
  'prefer-snapshot': ['snapshot', 'draft'],
  'only-draft': ['draft'],
  'only-snapshot': ['snapshot'],
};

let metadata;
const options = {
  fields: ['shortname', 'spec', 'uri', 'type', 'for', 'status', 'term'],
  spec_type: ['draft', 'snapshot'],
  all: true,
};

// Except for the following, exceptions take the form {{"SomeException"}}
const exceptionExceptions = new Set([
  'EvalError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'TypeError',
  'URIError',
]);

function getFormData() {
  const { value: term } = form.term;
  const { values: specs } = form.specs;
  const { values: types } = form.types;
  const { value: forContext } = form.for;
  return {
    term,
    ...(specs.length && { specs }),
    ...(types.length && { types }),
    ...(forContext && { for: forContext }),
  };
}

async function handleSubmit() {
  const data = getFormData();
  if (data.term === '') return;

  const params = new URLSearchParams(Object.entries(data));
  history.replaceState(null, null, `?${params}`);

  const body = { keys: [data], options };
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

  // Detect overloaded IDL entries that would produce identical citations.
  // Build a set of "uri|forContext" pairs for entries that need disambiguation.
  const overloadedPairs = detectOverloadedEntries(entries, term);

  let html = '';
  for (const entry of entries) {
    // Use the canonical matched term when available (case-insensitive fallback
    // hits); otherwise fall back to the user's query term (exact match).
    const citeTerm = entry.term || term;
    const specInfo = metadata.specs[entry.status][entry.spec];
    const link = new URL(entry.uri, specInfo.url).href;
    const title = escapeHTML(specInfo.title);
    const cites = metadata.types.idl.has(entry.type)
      ? howToCiteIDL(citeTerm, entry, overloadedPairs)
      : metadata.types.markup.has(entry.type)
        ? howToCiteMarkup(citeTerm, entry)
        : metadata.types.css.has(entry.type) ||
            metadata.types.http.has(entry.type)
          ? howToCiteAnchor(citeTerm, entry)
          : howToCiteTerm(citeTerm, entry);
    // Each citation is its own button: click/tap the citation to copy just it.
    const citeCell = cites.map(citeButton).join('<br>');
    let row = `
      <tr>
        <td><a href="${link}">${title}</a></td>
        <td>${entry.shortname}</td>
        <td>${entry.type}</td>
        <td>${citeCell}</td>
      </tr>`;
    html += row;
  }
  output.innerHTML = html;
}

/**
 * Detects IDL entries that would produce identical citations (overloaded
 * methods/constructors). Returns a Set of "uri|forContext" keys for entries
 * that need disambiguation. Entries without a `for` list use an empty string
 * as the forContext part.
 */
function detectOverloadedEntries(entries, term) {
  const citationGroups = new Map();
  for (const entry of entries) {
    if (!metadata.types.idl.has(entry.type)) continue;
    const specKey = entry.spec || '';
    const statusKey = entry.status || '';
    const forList = entry.for || [];
    // Group per individual rendered citation (one per `f`), so overlapping
    // `for` contexts across entries are correctly detected as ambiguous.
    if (forList.length > 0) {
      for (const f of forList) {
        const key = `${f}|${term}|${specKey}|${statusKey}`;
        const group = citationGroups.get(key) ?? [];
        if (!group.length) citationGroups.set(key, group);
        group.push({ entry, f });
      }
    } else {
      const key = `|${term}|${specKey}|${statusKey}`;
      const group = citationGroups.get(key) ?? [];
      if (!group.length) citationGroups.set(key, group);
      group.push({ entry, f: '' });
    }
  }
  // Build a Set of "uri|forContext" strings for ambiguous (entry, f) pairs.
  const overloadedPairs = new Set();
  for (const group of citationGroups.values()) {
    if (group.length > 1) {
      for (const { entry, f } of group) {
        overloadedPairs.add(`${entry.uri}|${f}`);
      }
    }
  }
  return overloadedPairs;
}

function howToCiteIDL(term, entry, overloadedPairs = null) {
  const { type, for: forList } = entry;
  const safeTerm = escapeHTML(term);
  if (forList) {
    return forList.map(f => {
      const safeF = escapeHTML(f);
      let displayTerm = type === 'enum-value' ? `"${safeTerm}"` : safeTerm;
      if (overloadedPairs?.has(`${entry.uri}|${f}`)) {
        const hint = extractOverloadHint(entry.uri, f, term);
        if (hint) {
          displayTerm = displayTerm.replace('()', `(${escapeHTML(hint)})`);
        }
      }
      return `{{${safeF}/${displayTerm ? displayTerm : '""'}}}`;
    });
  }
  let cite;
  switch (type) {
    case 'exception':
      if (!exceptionExceptions.has(term)) {
        cite = `{{"${safeTerm}"}}`;
        break;
      }
    default:
      cite = `{{${safeTerm}}}`;
  }
  if (overloadedPairs?.has(`${entry.uri}|`)) {
    const hint = extractOverloadHint(entry.uri, null, term);
    if (hint) {
      cite = cite.replace('()', `(${escapeHTML(hint)})`);
    }
  }
  return [cite];
}

/**
 * Extracts a human-readable overload hint from a URI fragment.
 *
 * URI fragments for WebIDL definitions follow the pattern:
 *   #dom-<interface>-<method>-<param1>-<param2>-...
 *
 * For example:
 *   #dom-window-postmessage-message-targetorigin-transfer
 *   #dom-window-postmessage-message-options
 *
 * This function strips the known prefix (interface + method) and returns
 * the remaining parts as a parameter list, e.g. "message, targetorigin, transfer".
 */
function extractOverloadHint(uri, forContext, term) {
  if (!uri) return '';
  const hash = uri.includes('#') ? uri.split('#')[1] : uri;
  if (!hash) return '';

  const originalParts = hash.split('-');
  const lowerParts = hash.toLowerCase().split('-');

  // Build the prefix to strip: typically "dom", interface, method
  const prefixParts = ['dom'];
  if (forContext) {
    prefixParts.push(...forContext.toLowerCase().split('-'));
  }
  const cleanTerm = term.replace(/\(.*\)$/, '').toLowerCase();
  if (cleanTerm) {
    prefixParts.push(...cleanTerm.split('-'));
  }

  const matches =
    prefixParts.length <= lowerParts.length &&
    prefixParts.every((p, i) => lowerParts[i] === p);

  if (matches && prefixParts.length < lowerParts.length) {
    return originalParts.slice(prefixParts.length).join(', ');
  }

  return '';
}

function howToCiteMarkup(term, entry) {
  const { type, for: forList } = entry;
  const safeTerm = escapeHTML(term);
  if (forList) {
    return forList.map(f => `[^${escapeHTML(f)}/${safeTerm}^]`);
  }
  if (type === 'element-attr') {
    return [`[^/${safeTerm}^]`];
  }
  return [`[^${safeTerm}^]`];
}

function howToCiteAnchor(term, entry) {
  const { type, for: forList } = entry;
  term = escapeHTML(term);
  if (!forList) {
    return [escapeHTML(`<a data-xref-type="${type}">${term}</a>`)];
  }
  return forList.map(f =>
    escapeHTML(`<a data-xref-type="${type}" data-xref-for="${f}">${term}</a>`),
  );
}

function howToCiteTerm(term, entry) {
  const { type, for: forList } = entry;
  term = escapeHTML(term.replace('/', '\\/'));
  if (forList) {
    return forList.map(f => `[=${escapeHTML(f)}/${term}=]`);
  }
  return [`[=${term}=]`];
}

function escapeHTML(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Render one citation as its own copy button. The accessible name conveys the
// action + value; `cite` is already escaped for &<>, but an attribute value
// also needs " escaped (e.g. exception citations like {{"DOMException"}}).
function citeButton(cite) {
  const label = `Copy citation ${cite.replace(/"/g, '&quot;')}`;
  return `<button type="button" class="cite" aria-label="${label}">${cite}</button>`;
}

// A single reused live region. Reusing one element (rather than appending a
// new toast per click) avoids stacking overlapping toasts and competing
// announcements when copying several citations in quick succession.
let copyToast;
let copyToastTimer;
function showCopyToast(message) {
  if (!copyToast) {
    copyToast = document.createElement('div');
    copyToast.className = 'copy-toast';
    copyToast.setAttribute('role', 'status');
    document.body.appendChild(copyToast);
  }
  clearTimeout(copyToastTimer);
  // Set the text on the next frame so the (already-attached) live region
  // announces it as a change rather than as initial content.
  requestAnimationFrame(() => {
    copyToast.textContent = message;
    copyToast.classList.add('is-visible');
  });
  copyToastTimer = setTimeout(() => {
    copyToast.classList.remove('is-visible');
  }, 1500);
}

async function copyCitation(text) {
  if (!text) return;
  if (!navigator.clipboard) {
    showCopyToast('Clipboard unavailable');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    showCopyToast(`Copied: ${text}`);
  } catch (err) {
    console.error(err);
    showCopyToast('Copy failed');
  }
}

// Click-to-copy: each citation is itself a <button>, so clicking/tapping the
// citation copies just that one. Being a real button, keyboard activation
// (Enter/Space) dispatches a click for free.
output.addEventListener('click', e => {
  const cite = e.target.closest('.cite');
  if (cite) copyCitation(cite.textContent);
});

async function ready() {
  const updateInput = (el, values) => {
    el.setAttribute('placeholder', values.slice(0, 5).join(','));
    el.dataset.options = values.join('|');
  };

  const metaURL = new URL(
    `${form.action}/meta?fields=types,specs,terms,version`,
  ).href;
  const { specs, types, terms, version } = await fetch(metaURL).then(res =>
    res.json(),
  );

  const lastUpdated = new Date(version);
  /** @type {HTMLTimeElement} */
  const lastUpdatedEl = document.getElementById('last-updated-date');
  lastUpdatedEl.textContent = lastUpdated.toLocaleString('default', {
    dateStyle: 'long',
    timeStyle: 'long',
  });
  lastUpdatedEl.dateTime = lastUpdated.toISOString();

  const shortnames = [
    ...new Set(
      Object.values(specs).flatMap(s => Object.values(s).map(s => s.shortname)),
    ),
  ];
  updateInput(form.specs, shortnames.sort());

  const allTypes = [].concat(...Object.values(types)).sort();
  updateInput(form.types, allTypes);

  const fuse = new Fuse(terms);
  autocomplete({
    input: form.term,
    fetch(text, update) {
      const searchResults = fuse.search(text).slice(0, 15);
      const suggestions = searchResults.map(r => r.item);
      update(suggestions);
    },
    onSelect(suggestion) {
      this.input.value = suggestion;
    },
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
      http: new Set(types.http),
    },
    specs,
    terms,
  };
}

customElements.define('option-selector', OptionSelector, {
  extends: 'input',
});
ready();
