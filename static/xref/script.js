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

async function ready() {
  const updateInput = (el, values) => {
    el.setAttribute('placeholder', values.slice(0, 5).join(','));
    el.dataset.options = values.join('|');
  };

  const metaURL = new URL(`${form.action}/meta?fields=types,specs,terms`).href;
  const { specs, types, terms } = await fetch(metaURL).then(res => res.json());

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

customElements.define('option-selector', OptionSelector, {
  extends: 'input',
});
ready();
