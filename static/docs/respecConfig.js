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
    postProcessEnhance,
    cleanup,
  ],
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
  logos: [
    {
      src: "respec-logo.png",
      width: 100,
      height: 100,
      alt: "ReSpec logo",
      url: "https://respec.org/",
    },
  ],
};

function fixIncludes() {
  for (const section of document.querySelectorAll("section[data-include]")) {
    const { include } = section.dataset;
    section.dataset.includeName = include;
    section.dataset.oninclude = "fixMarkupOnInclude";
    section.dataset.include = `https://raw.githubusercontent.com/wiki/w3c/respec/${include}.md`;
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
  let result = content;

  // Escape [[[foo]]] and [[foo]] by adding zero-width space. Ugly, but  other
  // way is upsteam changes for an extreme edge case.
  result = result.replace(/\[\[/g, "[&#8203;[&#8203;");
  // Similary for [= term =] and {{ term }}
  result = result.replace(/\[=/g, "[&#8203;=");
  result = result.replace(/{{/g, "{&#8203;{");

  // Inline code: replace "`<some-tag>`" with "`&lt;some-tag>`"
  result = result.replace(/`</g, "`&lt;");

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
  for (const elem of document.querySelectorAll("section dl, table")) {
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
    "section a:not([href^=http]):not([href^='mailto:']):not([href^='#'])",
  );
  for (const a of anchors) {
    const href = a.href.split(urlBase, 2)[1].split("#").pop();
    // TODO: fix more links!
    if (document.getElementById(href)) {
      a.href = `#${href}`;
    } else if (document.getElementById(`id-${href}`)) {
      // Special section IDs like "conformance" trigger ReSpec "include"
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
  for (const attr of attributesToRemove) {
    document
      .querySelectorAll(`[${attr}]`)
      .forEach(el => el.removeAttribute(attr));
  }
}
