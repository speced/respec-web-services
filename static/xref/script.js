class OptionSelector extends HTMLInputElement {
  constructor() {
    super();
    this._state = {
      selectedValues: new Set(),
      options: new Set(),
      datalist: document.createElement("datalist"),
    };
  }

  static get sep() {
    return [",", undefined, "Enter"];
  }

  /** @returns {Set<string>} */
  get values() {
    return [...this._state.selectedValues];
  }

  connectedCallback() {
    const { datalist, options } = this._state;

    const name = this.getAttribute("name");

    const elSelections = document.querySelector(
      `.selections[data-for="${this.name}"]`,
    );
    if (!elSelections) {
      throw new Error(`[class="selections"][data-for="${name}"] not found`);
    }
    this._state.elSelections = elSelections;

    this.setAttribute("list", name);

    datalist.setAttribute("id", name);
    this.dataset.values.split("|").forEach(value => {
      options.add(value);
      const option = document.createElement("option");
      option.value = value;
      datalist.appendChild(option);
    });
    this.parentElement.appendChild(datalist);

    this.addEventListener("keyup", event => {
      if (OptionSelector.sep.includes(event.key)) {
        event.preventDefault();
        this.select(this.value.replace(/,$/, "").trim());
      }
    });

    this.addEventListener("blur", () => this.select(this.value.trim()));
  }

  select(value) {
    const { selectedValues, elSelections, options } = this._state;
    if (value === "" || selectedValues.has(value) || !options.has(value)) {
      return;
    }

    this.value = "";
    selectedValues.add(value);

    const button = document.createElement("button");
    button.setAttribute("type", "button");
    button.textContent = value;
    button.addEventListener("click", ev => {
      button.remove();
      selectedValues.delete(value);
    });
    elSelections.appendChild(button);
  }
}

const form = document.getElementById("xref-search");
const output = document.getElementById("output");
const caption = document.querySelector("table caption");

let metadata;
const options = {
  fields: ["shortname", "spec", "uri", "type", "for"],
  all: true,
};

function getFormData() {
  const term = form.querySelector("input[name='term']").value;
  const specs = form.querySelector("input[name='cite']").values;
  const types = form.querySelector("input[name='types']").values;
  const forContext = form.querySelector("input[name='for']").value;
  return {
    term,
    ...(specs.length && { specs }),
    ...(types.length && { types }),
    ...(forContext && { for: forContext }),
  };
}

async function onSubmit(event) {
  // allow onSubmit to be called without the event argument
  if (event && typeof event.preventDefault === "function") {
    event.preventDefault();
  }
  const data = getFormData();
  if (data.term === "") {
    return;
  }
  const body = { keys: [data], options };
  const response = await fetch(form.action, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
  }).then(res => res.json());
  const result = response.result[0][1];
  renderResults(result, data);
}

function renderResults(entries, query) {
  caption.innerText = `Searched for "${query.term}".`;
  if (!entries.length) {
    output.innerHTML = `<tr><td colspan="4">No results found.</td></tr>`;
    return;
  }

  let html = "";
  for (const entry of entries) {
    const link = metadata.specs[entry.spec].url + entry.uri;
    const title = metadata.specs[entry.spec].title;

    let howToCite = "";
    const isIDL = metadata.types.idl.has(entry.type);
    if (isIDL) {
      if (entry.for) {
        howToCite = entry.for.map(f => `{{ ${f}.${query.term} }}`).join("<br>")
      } else {
        howToCite = `{{ ${query.term} }}`
      }
    } else {
      if (entry.for) {
        howToCite = entry.for.map(f => `[= ${f}/${query.term} =]`).join("<br>")
      } else {
        howToCite = `&lt;a data-cite="${entry.shortname}">${query.term}&lt;/a>`
      }
    }

    let row = `
      <tr>
        <td><a href="${link}">${title}</a></td>
        <td>${entry.shortname}</td>
        <td>${entry.type}</td>
        <td>${howToCite}</td>
      </tr>`;
    html += row;
  }
  output.innerHTML = html;
}

async function ready() {
  const createInput = (name, values) => {
    const el = document.createElement("input", { is: "option-selector" });
    el.setAttribute("type", "text");
    el.setAttribute("name", name);
    el.setAttribute("placeholder", values.slice(0, 5).join(","));
    el.dataset.values = values.join("|");
    return el;
  };

  const metaURL = new URL(`${form.action}/meta?fields=types,specs,terms`).href;
  const { specs, types, terms } = await fetch(metaURL).then(res => res.json());

  const shortnames = [...new Set(Object.values(specs).map(s => s.shortname))];
  const newCiteElement = createInput("cite", shortnames.sort());
  document.querySelector("input[name='cite']").replaceWith(newCiteElement);

  const allTypes = [].concat(...Object.values(types)).sort();
  const newTypesElement = createInput("types", allTypes);
  document.querySelector("input[name='types']").replaceWith(newTypesElement);

  const termsList = document.createDocumentFragment();
  for (const term of terms) {
    const option = document.createElement("option");
    option.value = term;
    termsList.appendChild(option);
  }
  document.querySelector("#term-list").appendChild(termsList);

  form.querySelector("button[type='submit']").removeAttribute("disabled");
  form.addEventListener("submit", onSubmit);
  form.querySelector("input[name='all']").addEventListener("change", ev => {
    options.all = ev.target.checked;
  });

  const { searchParams } = new URL(window.location.href);
  for (const [field, value] of searchParams) {
    switch (field) {
      case "term":
      case "for":
        form[field].value = value;
        break;
      case "cite":
      case "types":
        value.split(",").forEach(val => form[field].select(val));
        break;
    }
  }
  if (searchParams.has("term")) {
    onSubmit();
  }

  metadata = {
    types: {
      idl: new Set(types.idl),
      concept: new Set(types.concept),
    },
    specs,
  };
}

customElements.define("option-selector", OptionSelector, {
  extends: "input",
});
ready();
