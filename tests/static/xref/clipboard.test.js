import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// static/xref/script.js is an ES module that does top-level DOM work and a
// metadata fetch on load, so it can't be imported here. Slice out the pure
// citeButton helper and evaluate it in isolation to test the citation-button
// markup (the part that does not need a real browser).
const SRC = fileURLToPath(
  new URL("../../../static/xref/script.js", import.meta.url),
);
const text = readFileSync(SRC, "utf8");
const fnBlock = text.slice(
  text.indexOf("function citeButton"),
  text.indexOf("// A single reused live region"),
);
// Fail loudly if the helper is reordered/renamed so the slice no longer
// captures citeButton, rather than silently testing the wrong thing.
if (!fnBlock.includes("aria-label")) {
  throw new Error("could not slice citeButton out of script.js");
}

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`${fnBlock}\nthis.citeButton = citeButton;`, sandbox);
const { citeButton } = sandbox;

describe("xref/script - citeButton", () => {
  it("wraps a citation in a real button so the table cell keeps its role", () => {
    expect(citeButton("{{Window/postMessage}}")).toBe(
      '<button type="button" class="cite" ' +
        'aria-label="Copy citation {{Window/postMessage}}">' +
        "{{Window/postMessage}}</button>",
    );
  });

  it("escapes double quotes in the aria-label so the attribute stays well-formed", () => {
    // Exception citations like {{"DOMException"}} contain literal quotes that
    // would otherwise break out of the aria-label attribute.
    const html = citeButton('{{"DOMException"}}');
    expect(html).toContain('aria-label="Copy citation {{&quot;DOMException&quot;}}"');
    // The visible button text keeps the real quotes (escapeHTML leaves " alone).
    expect(html).toContain('>{{"DOMException"}}</button>');
  });

  it("leaves already-escaped &<> entities intact in the label", () => {
    // `cite` reaches citeButton already escaped for & < > by escapeHTML, so the
    // helper must not double-escape them.
    const html = citeButton("[=a&amp;b/x=]");
    expect(html).toContain('aria-label="Copy citation [=a&amp;b/x=]"');
  });
});
