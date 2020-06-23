var respecConfig = {
  edDraftURI: null,
  editors: [
    {
      name: "ReSpec",
      url: "https://github.com/w3c/respec",
    },
  ],
  lint: {
    "no-http-props": false,
  },
  format: "markdown",
  preProcess: [addSectionIds, fixIncludes],
  postProcess: [
    removeCopyright,
    fixLinks,
    addWikiLinks,
    fixMarkupPostprocess,
    fixupUglyHeadings,
    postProcessEnhance,
  ],
};

function fixIncludes() {
  for (const section of document.querySelectorAll("section[data-include]")) {
    const { include } = section.dataset;
    section.dataset.includeName = include;
    section.dataset.oninclude = "fixMarkupOnInclude";
    section.dataset.include = `https://raw.githubusercontent.com/wiki/w3c/respec/${include}.md`;
  }
}

/**
 * @param {*} _
 * @param {string} content
 */
function fixMarkupOnInclude(_, content) {
  let result = content;

  // Replace < in code snippets with &lt;
  let isInCodeSnippet = false;
  const parts = result.split(/(```)/);
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].startsWith("```")) {
      isInCodeSnippet = !isInCodeSnippet;
      if (isInCodeSnippet) {
        parts[i + 1] = parts[i + 1].replace(/</g, "&lt;");
        // i++;
      }
    }
  }
  result = parts.join("");

  // Inline code: replace "`<some-tag>`" with "`&lt;some-tag>`"
  result = result.replace(/`</g, "`&lt;");

  // Treat all markdown code snippets as "example"
  result = result
    .replace(/``` *(\w+)/g, "<pre class='example $1'>")
    .replace(/``` *$/gm, "</pre>");

  // Add .note and .advisement classes based on line prefix
  result = result
    .split("\n")
    .map(line => {
      if (/^.{0,5}\s*Warning:/.test(line))
        return `<div class="advisement">${line}</div>`;
      if (/^.{0,5}\s*Note:/.test(line))
        return `<div class="note">${line}</div>`;
      return line;
    })
    .join("\n");

  return result;
}

function fixMarkupPostprocess() {
  for (const elem of document.querySelectorAll("code")) {
    if (elem.textContent.startsWith("&lt;")) {
      elem.textContent = elem.textContent.replace(/^&lt;/, "<");
    }
  }
}

function postProcessEnhance() {
  for (const elem of document.querySelectorAll("dl, table")) {
    elem.classList.add("def");
  }
}

function addSectionIds() {
  const sections = document.querySelectorAll("section[data-include]:not([id])");
  for (const section of sections) {
    section.id = section.dataset.include;
  }
}

function removeCopyright() {
  document.querySelector("p.copyright").remove();
}

function fixLinks() {
  const urlBase = location.origin + "/docs/";
  /** @type {NodeListOf<HTMLAnchorElement>} */
  const anchors = document.querySelectorAll(
    "section a:not([href^=http]):not([href^='#'])",
  );
  for (const a of anchors) {
    const href = a.href.split(urlBase, 2)[1];
    // TODO: fix more links!
    if (document.getElementById(href)) {
      a.href = `#${href}`;
    } else if (document.getElementById(`id-${href}`)) {
      // Special section IDs like "conformance" trigger ReSpec "include"
      // behaviour. We manually add `id-` prefix to overcome that.
      a.href = `#id-${href}`;
    } else {
      a.href = `https://github.com/w3c/respec/wiki/${href}`;
    }
  }
}

function addWikiLinks() {
  const createWikiLink = includeName => {
    const wikiLink = document.createElement("a");
    wikiLink.href = `https://github.com/w3c/respec/wiki/${includeName}/_edit`;
    const title = "Edit this section on Wiki";
    wikiLink.title = title;
    wikiLink.setAttribute("aria-label", title);
    wikiLink.textContent = "📝 Edit";
    wikiLink.classList.add("wiki-link");
    return wikiLink;
  };

  const sections = document.querySelectorAll("section[data-include-name]");
  for (const section of sections) {
    const { includeName } = section.dataset;
    const wikiLink = createWikiLink(includeName);
    section.querySelector("h2, h3, h4, h5, h6").append(wikiLink);
  }
}

function fixupUglyHeadings() {
  for (const elem of document.querySelectorAll(".tocxref")) {
    if (elem.textContent.trim().match(/Example/)) {
      elem.closest(".tocline").remove();
    }
  }

  for (const elem of document.querySelectorAll("h2, h3, h4, h5")) {
    if (elem.textContent.match(/Example/)) {
      elem.querySelector("bdi").remove();
    }
  }
}
