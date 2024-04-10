const form = document.querySelector("form");
const output = document.querySelector("output");
/** @type {HTMLInputElement} */
const searchBox = form.querySelector("input[name=q]");

const API_URL = new URL("https://api.specref.org/");

const REF_STATUSES = new Map([
  ["CR", "W3C Candidate Recommendation"],
  ["ED", "W3C Editor's Draft"],
  ["FPWD", "W3C First Public Working Draft"],
  ["LCWD", "W3C Last Call Working Draft"],
  ["NOTE", "W3C Note"],
  ["PER", "W3C Proposed Edited Recommendation"],
  ["PR", "W3C Proposed Recommendation"],
  ["REC", "W3C Recommendation"],
  ["WD", "W3C Working Draft"],
  ["WG-NOTE", "W3C Working Group Note"],
]);

const defaultsReference = Object.freeze({
  authors: [],
  date: "",
  href: "",
  publisher: "",
  status: "",
  title: "",
  etAl: false,
});

form.addEventListener("submit", async ev => {
  ev.preventDefault();
  const query = searchBox.value;
  if (!query) {
    searchBox.focus();
    return;
  }

  render({ state: "Searching Specref…" });
  const refSearch = new URL("search-refs", API_URL);
  refSearch.searchParams.set("q", query);
  const reverseLookup = new URL("reverse-lookup", API_URL);
  reverseLookup.searchParams.set("urls", query);

  try {
    const startTime = performance.now();
    const jsonData = await Promise.all([
      fetch(refSearch.href).then(response => response.json()),
      fetch(reverseLookup.href).then(response => response.json()),
    ]);
    const includeAllVersions = form.includeAllVersions.checked;
    const results = processResults({ includeAllVersions }, ...jsonData);
    render({
      query,
      results,
      state: "",
      timeTaken: Math.round(performance.now() - startTime) / 1000,
    });
  } catch (err) {
    console.error(err);
    render({ state: "Error! Couldn't do search." });
  } finally {
    searchBox.focus();
  }
});

function processResults({ includeAllVersions = false }, ...fetchedData) {
  /** @type {{ [key: string]: any }} */
  const combinedResults = Object.assign({}, ...fetchedData);
  const results = new Map(Object.entries(combinedResults));
  // remove aliases
  Array.from(results)
    .filter(([, entry]) => entry.aliasOf)
    .map(([key]) => key)
    .reduce((results, key) => results.delete(key) && results, results);
  // Remove versions, if asked to
  if (!includeAllVersions) {
    Array.from(results.values())
      .filter(entry => typeof entry === "object" && "versions" in entry)
      .flat()
      .forEach(version => {
        results.delete(version);
      });
  }
  // Remove legacy string entries
  Array.from(results)
    .filter(([, value]) => typeof value !== "object")
    .forEach(([key]) => results.delete(key));
  return results;
}

function render({ state = "", results, timeTaken, query } = {}) {
  const hidden = !state ? "hidden" : "";
  const stateHTML = `<p class="state" ${hidden}>${state}</p>`;

  if (!results) {
    output.innerHTML = stateHTML;
    return;
  }
  const renderedResults = renderResults(results, query, timeTaken);
  const html = `<section aria-live="polite">${renderedResults}</section>`;
  output.innerHTML = stateHTML + html;
}

/**
 * @param {Map<string, string>} resultMap
 * @param {string} query
 * @param {number} timeTaken
 */
function renderResults(resultMap, query, timeTaken) {
  if (!resultMap.size) {
    return `
      <p class="state">
        Your search - <strong>${query}</strong> -
        did not match any references.
      </p>
    `;
  }
  const definitionPairs = Array.from(resultMap)
    .slice(0, 99)
    .map(toDefinitionPair)
    .reduce((collector, pair) => collector.concat(pair), []);
  return `
    <p class="result-stats">
      ${resultMap.size} results (${timeTaken} seconds).
      ${resultMap.size > 99 ? "Showing first 100 results." : ""}
    </p>
    <dl class="specref-results">${definitionPairs.join("\n")}</dl>
  `;
}

function toDefinitionPair([key, entry]) {
  return `
    <dt>[${key}]</dt>
    <dd>${wireReference(entry)}</dd>
  `;
}

function wireReference(rawRef) {
  if (typeof rawRef !== "object") {
    throw new TypeError("Only modern object references are allowed");
  }
  const ref = Object.assign({}, defaultsReference, rawRef);
  const authors = ref.authors.join("; ") + (ref.etAl ? " et al" : "");
  const status = REF_STATUSES.get(ref.status) || ref.status;
  return `
    <cite>
      <a
        href="${ref.href}"
        target="_blank"
        rel="noopener noreferrer">
        ${ref.title.trim()}</a>.
    </cite>
    <span class="authors">
      ${endWithDot(authors)}
    </span>
    <span class="publisher">
      ${endWithDot(ref.publisher)}
    </span>
    <span class="pubDate">
      ${endWithDot(ref.date)}
    </span>
    <span class="pubStatus">
      ${endWithDot(status)}
    </span>
  `;
}

/** @param {string} str */
function endWithDot(str) {
  const trimmed = str.trim();
  if (!trimmed || trimmed.endsWith(".")) {
    return trimmed;
  }
  return trimmed + ".";
}
