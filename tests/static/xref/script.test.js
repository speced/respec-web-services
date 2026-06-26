import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// static/xref/script.js is a plain browser script (not a module) that touches
// DOM globals at load time, so it can't be imported directly. Instead, slice
// out the pure citation helpers and the exceptionExceptions set, then evaluate
// them in an isolated context. This exercises the real source, not a copy.
const SRC = fileURLToPath(
  new URL("../../../static/xref/script.js", import.meta.url),
);
const text = readFileSync(SRC, "utf8");

const fnBlock = text.slice(
  text.indexOf("function howToCiteIDL"),
  text.indexOf("async function ready"),
);
const excStart = text.indexOf("const exceptionExceptions");
const excBlock = text.slice(excStart, text.indexOf("]);", excStart) + 3);

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(
  `${excBlock}\n${fnBlock}\n` +
    "this.howToCiteIDL = howToCiteIDL;" +
    "this.howToCiteMarkup = howToCiteMarkup;" +
    "this.howToCiteTerm = howToCiteTerm;",
  sandbox,
);
const { howToCiteIDL, howToCiteMarkup, howToCiteTerm } = sandbox;

const XSS = "<img src=x onerror=alert(1)>";

describe("xref/script - citation HTML escaping", () => {
  it("escapes the term and for-context in IDL citations", () => {
    expect(howToCiteIDL(XSS, { type: "attribute", for: ["Window"] })).not.toContain(
      "<img",
    );
    expect(
      howToCiteIDL("postMessage", { type: "method", for: ["<f>"] }),
    ).toContain("&lt;f&gt;");
    expect(howToCiteIDL(XSS, { type: "interface" })).not.toContain("<img");
  });

  it("escapes the term and for-context in markup citations", () => {
    expect(
      howToCiteMarkup(XSS, { type: "element", for: ["<f>"] }),
    ).not.toContain("<img");
    expect(howToCiteMarkup(XSS, { type: "element-attr" })).not.toContain("<img");
    expect(howToCiteMarkup(XSS, { type: "element" })).not.toContain("<img");
  });

  it("escapes the term and for-context in dfn-term citations", () => {
    expect(howToCiteTerm(XSS, { type: "dfn" })).not.toContain("<img");
    expect(howToCiteTerm("x", { type: "dfn", for: ["<f>"] })).toContain(
      "&lt;f&gt;",
    );
  });

  it("leaves ordinary citations unchanged", () => {
    expect(
      howToCiteIDL("postMessage", { type: "method", for: ["Window"] }),
    ).toBe("{{Window/postMessage}}");
    expect(
      howToCiteIDL("classic", { type: "enum-value", for: ["WorkerType"] }),
    ).toBe('{{WorkerType/"classic"}}');
    expect(howToCiteTerm("a/b", { type: "dfn" })).toBe("[=a\\/b=]");
  });

  it("renders the empty-term fallback (the touched truthiness branch)", () => {
    // `escapeHTML("")` is still falsy, so the `safeTerm ? termPart : '""'`
    // branch must keep producing the empty-string placeholder.
    expect(howToCiteIDL("", { type: "method", for: ["Window"] })).toBe(
      '{{Window/""}}',
    );
  });
});
