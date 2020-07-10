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
    "check-punctuation": true,
  },
  preProcess: [addSectionIds, fixIncludes],
  postProcess: [
    fixLinks,
    addWikiLinks,
    fixMarkupPostprocess,
    postProcessEnhance,
    cleanup,
  ],
  canonicalURI: "https://respec.org/docs/",
  github: "w3c/respec",
  otherLinks: [
    {
      key: "Edit this documentation",
      data: [
        {
          value: "GitHub Wiki",
          href: "https://github.com/w3c/respec/wiki",
        },
        {
          value: "Single Page",
          href:
            "https://github.com/marcoscaceres/respec.org/tree/HEAD/static/docs",
        },
      ],
    },
  ],
};

function addSectionIds() {
  const sections = document.querySelectorAll("section[data-include]:not([id])");
  for (const section of sections) {
    section.id = section.dataset.include;
  }
}

function fixIncludes() {
  for (const section of document.querySelectorAll("section[data-include]")) {
    const { include } = section.dataset;
    Object.assign(section.dataset, {
      includeName: include,
      includeFormat: "markdown",
      oninclude: "fixMarkupOnInclude",
      include: `https://raw.githubusercontent.com/wiki/w3c/respec/${include}.md`,
    });
    if (!section.hasAttribute("data-max-toc")) {
      section.dataset.maxToc = section.querySelector("section") ? "2" : "1";
    }
  }
}

/**
 * @param {*} _
 * @param {string} content
 */
function fixMarkupOnInclude(_, content) {
  const ZERO_WIDTH_SPACE = "&#8203;";
  // Escape [[[foo]]] and [[foo]] by adding zero-width space. We remove these
  // extraneous characters in postProcess, so users don't end up copy pasting
  // them. Ugly, but  other way is upstream changes for an extreme edge case.
  content = content
    .replaceAll("[[", `[${ZERO_WIDTH_SPACE}[${ZERO_WIDTH_SPACE}`)
    // Similarly for [= term =], {{ term }}, [^elem^]
    .replaceAll("[=", `[${ZERO_WIDTH_SPACE}=`)
    .replaceAll("{{", `{${ZERO_WIDTH_SPACE}{`)
    .replaceAll("[^", `[${ZERO_WIDTH_SPACE}^`)
    // and also escape | used for inline variables
    .replace(/\`\\\|(\w+)/g, `\`\\|${ZERO_WIDTH_SPACE}$1`)
    .replace(/(\w+)\\\|\`/g, `$1${ZERO_WIDTH_SPACE}\\|\``)
    .replace(/\`\|(\w+)/g, `\`\\|${ZERO_WIDTH_SPACE}$1`)
    .replace(/(\w+)\|\`/g, `$1${ZERO_WIDTH_SPACE}\\|\``);

  // Add .note and .advisement classes based on line prefix
  content = content
    .split("\n")
    .map(line => {
      if (/^.{0,5}\s*Warning:/.test(line))
        return `<div class="advisement">\n\n${line}</div>`;
      if (/^.{0,5}\s*Note:/.test(line))
        return `<div class="note">\n\n${line}</div>`;
      return line;
    })
    .join("\n");

  return content;
}

function fixMarkupPostprocess() {
  const ESCAPED_ZERO_WIDTH_SPACE = "&amp;#8203;";
  for (const elem of document.querySelectorAll("code")) {
    if (elem.innerHTML.includes(ESCAPED_ZERO_WIDTH_SPACE)) {
      elem.innerHTML = elem.innerHTML.replaceAll(ESCAPED_ZERO_WIDTH_SPACE, "");
    }
    if (elem.innerHTML.includes("\\|")) {
      elem.innerHTML = elem.innerHTML.replaceAll("\\|", "|");
    }
  }
}

function postProcessEnhance() {
  document.querySelector("p.copyright").remove();

  for (const elem of document.querySelectorAll("section dl, table")) {
    elem.classList.add("def");
  }
}

function fixLinks() {
  const urlBase = location.origin + "/docs/";
  /** @type {NodeListOf<HTMLAnchorElement>} */
  const anchors = document.querySelectorAll(
    "section a:not([href^=http]):not([href^='mailto:']):not([href^='#'])",
  );
  for (const a of anchors) {
    const href = a.href.split(urlBase, 2)[1].split("#").pop();
    if (document.getElementById(href)) {
      a.href = `#${href}`;
    } else if (document.getElementById(`id-${href}`)) {
      // Special section IDs like "conformance" trigger ReSpec's "include"
      // behaviour. We manually add `id-` prefix to overcome that.
      a.href = `#id-${href}`;
    } else if (document.querySelector(`[data-include-name="${href}"]`)) {
      const { id } = document.querySelector(`[data-include-name="${href}"]`);
      a.href = `#${id}`;
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

  for (const section of document.querySelectorAll("section")) {
    const closest = section.closest("section[data-include-name]");
    if (!closest) continue;
    const { includeName } = closest.dataset;
    const wikiLink = createWikiLink(includeName);
    section.querySelector("h2, h3, h4, h5, h6").append(wikiLink);
  }
}

function cleanup() {
  const attributesToRemove = [
    "data-max-toc",
    "data-include-name",
    "data-oninclude",
  ];
  const selector = attributesToRemove.map(attr => `[${attr}]`).join(", ");
  document.querySelectorAll(selector).forEach(el => {
    attributesToRemove.forEach(attr => el.removeAttribute(attr));
  });

  document.getElementById("respec-dfn-panel").remove();
}
