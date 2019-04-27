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
const termElement = document.querySelector("input[name='term']");
const forElement = document.querySelector("input[name='for']");
const outputElement = document.getElementById("output");

function getFormData() {
  const term = termElement.value;
  const specs = document.querySelector("input[name='cite']").values;
  const types = document.querySelector("input[name='types']").values;
  const forContext = forElement.value;
  return {
    term,
    ...(specs.length && { specs }),
    ...(types.length && { types }),
    ...(forContext && { for: forContext }),
  };
}

(async function ready() {
  const createInput = (name, placeholder, values) => {
    const el = document.createElement("input", { is: "option-selector" });
    el.setAttribute("type", "text");
    el.setAttribute("name", name);
    el.setAttribute("placeholder", placeholder);
    el.dataset.values = values.join("|");
    return el;
  };

  const metaURL = new URL(`${form.action}/meta?fields=allTypes,specs`).href;
  const metadata = await (await fetch(metaURL)).json();

  const newCiteElement = createInput(
    "cite",
    metadata.specs.slice(0, 5).join(","),
    metadata.specs,
  );
  document.querySelector("input[name='cite']").replaceWith(newCiteElement);

  const newTypesElement = createInput(
    "types",
    metadata.allTypes
      .sort()
      .slice(0, 5)
      .join(","),
    metadata.allTypes,
  );
  document.querySelector("input[name='types']").replaceWith(newTypesElement);
})();

function renderTable(entries) {
  const table = document.getElementById("table").content.cloneNode(true);

  while (outputElement.firstChild) {
    outputElement.removeChild(outputElement.firstChild);
  }
  const td = textContent => {
    const el = document.createElement("td");
    if (textContent) el.textContent = textContent;
    return el;
  };
  for (const entry of entries) {
    const tr = document.createElement("tr");
    tr.append(td(entry.shortname));
    tr.append(td(entry.type));
    tr.append(td(entry.uri));

    const forContext = td();
    forContext.innerHTML = (entry.for || []).join("<br>");
    tr.append(forContext);

    table.querySelector("tbody").append(tr);
  }
  outputElement.appendChild(table);
}

form.addEventListener("submit", async ev => {
  ev.preventDefault();
  const data = getFormData();

  const response = await fetch(form.action, {
    method: "POST",
    body: JSON.stringify({ keys: [data] }),
    headers: {
      "Content-Type": "application/json",
    },
  });
  const json = await response.json();
  const result = json.result[0][1];
  renderTable(result);
});

customElements.define("option-selector", OptionSelector, {
  extends: "input",
});
