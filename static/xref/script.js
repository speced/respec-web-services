import { autocomplete } from './autocomplete.js?v=5.0.1';
import * as Comlink from 'https://unpkg.com/comlink@4.3.0/dist/esm/comlink.min.js';

class OptionSelector extends HTMLInputElement {
  constructor() {
    super();
  }

  /** @returns {string[]} */
  get values() {
    return Array.from(this.selectedValues);
  }

  connectedCallback() {
    const name = this.getAttribute('name');
    this.options = [];

    const self = this;
    autocomplete({
      input: self,
      async fetch(text, update) {
        const suggestions = await OptionSelector.search(name, text);
        self.options = suggestions;
        update(suggestions);
      },
      onSelect(value) {
        self.select(value.trim());
      },
    });

    const sel = `.selections[data-for="${name}"]`;
    this.elSelections = document.querySelector(sel);
    if (!this.elSelections) {
      throw new Error(`${sel} not found`);
    }

    this.selectedValues = new Set();
  }

  select(value, { ignoreOptions = false } = {}) {
    const { selectedValues, elSelections } = this;
    if (!this.isSelectable(value, { ignoreOptions })) {
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

  isSelectable(value, { ignoreOptions }) {
    const { selectedValues, options } = this;
    return !(
      value === '' ||
      selectedValues.has(value) ||
      !(ignoreOptions || options.includes(value))
    );
  }
}

const form = document.getElementById('xref-search');
const output = document.getElementById('output');
const caption = document.querySelector('table caption');

let metadata;
const options = {
  fields: ['shortname', 'spec', 'uri', 'type', 'for'],
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
    const link = metadata.specs[entry.spec].url + entry.uri;
    const title = metadata.specs[entry.spec].title;
    const cite = metadata.types.idl.has(entry.type)
      ? howToCiteIDL(term, entry)
      : metadata.types.markup.has(entry.type)
      ? howToCiteMarkup(term, entry)
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
  return `[^${term}^]`;
}

function howToCiteTerm(term, entry) {
  const { type, for: forList, shortname } = entry;
  if (forList) {
    return forList.map(f => `[=${f}/${term}=]`).join('<br>');
  }
  return `&lt;a data-cite="${shortname}">${term}&lt;/a>`;
}

async function ready() {
  const searchWorker = Comlink.wrap(new Worker('worker.js'));
  metadata = await searchWorker.setup();
  OptionSelector.search = searchWorker.search;

  autocomplete({
    input: form.term,
    fetch(text, update) {
      searchWorker.search('term', text).then(update);
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
        const ops = { ignoreOptions: true };
        value.split(',').forEach(val => form[field].select(val, ops));
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
}

customElements.define('option-selector', OptionSelector, {
  extends: 'input',
});
ready();
