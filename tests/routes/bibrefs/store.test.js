import { getRefs } from "../../../build/routes/bibrefs/lib/store.js";
import {
  validate,
  SMALLEST_PLAUSIBLE_DATABASE,
} from "../../../build/routes/bibrefs/lib/validate.js";

/** Enough entries to clear the store's minimum-size check. */
function bulk() {
  const references = {
    WEBIDL: {
      href: "https://webidl.spec.whatwg.org/",
      title: "Web IDL Standard",
    },
    rfc2119: {
      href: "https://www.rfc-editor.org/info/rfc2119/",
      title: "Key words",
    },
    HTML: {
      href: "https://html.spec.whatwg.org/multipage/",
      title: "HTML Standard",
    },
    ABNF: { aliasOf: "RFC5234" },
    RFC5234: { aliasOf: "rfc5234" },
    rfc5234: {
      href: "https://www.rfc-editor.org/info/rfc5234/",
      title: "ABNF",
    },
  };
  for (
    let i = Object.keys(references).length;
    i < SMALLEST_PLAUSIBLE_DATABASE;
    i++
  ) {
    references[`FILLER-${i}`] = {
      href: `https://example.com/${i}`,
      title: `Filler ${i}`,
    };
  }
  return references;
}

describe("routes/bibrefs - getRefs", () => {
  const references = {
    ABNF: { aliasOf: "RFC5234", id: "ABNF" },
    RFC5234: { aliasOf: "rfc5234", id: "RFC5234" },
    rfc5234: {
      title: "ABNF",
      href: "https://example.com/rfc5234",
      id: "rfc5234",
    },
    WEBIDL: {
      title: "Web IDL",
      href: "https://example.com/webidl",
      id: "WEBIDL",
    },
    "WEBIDL-20161215": {
      title: "Web IDL",
      versionOf: "WEBIDL",
      id: "WEBIDL-20161215",
    },
    x: { aliasOf: "X", id: "x" },
    X: { aliasOf: "x", id: "X" },
  };

  // Whole objects, not just key names: asserting the keys alone would pass even
  // if every value came back null.
  const cases = [
    [
      "emits every entry along an alias chain",
      ["ABNF"],
      {
        ABNF: references.ABNF,
        RFC5234: references.RFC5234,
        rfc5234: references.rfc5234,
      },
    ],
    [
      "emits the versionOf parent",
      ["WEBIDL-20161215"],
      {
        "WEBIDL-20161215": references["WEBIDL-20161215"],
        WEBIDL: references.WEBIDL,
      },
    ],
    [
      "resolves a lower-case citation via its upper-case key",
      ["webidl"],
      {
        webidl: { aliasOf: "WEBIDL", id: "webidl" },
        WEBIDL: references.WEBIDL,
      },
    ],
    ["omits a key it does not have", ["NOPE"], {}],
    [
      "ignores keys named after inherited properties",
      ["toString", "__proto__"],
      {},
    ],
    [
      "answers with one entry per key when two keys share a chain",
      ["ABNF", "RFC5234"],
      {
        ABNF: references.ABNF,
        RFC5234: references.RFC5234,
        rfc5234: references.rfc5234,
      },
    ],
    [
      "answers for a pair of aliases that point at each other",
      ["x"],
      { x: references.x, X: references.X },
    ],
  ];

  for (const [description, keys, expected] of cases) {
    it(description, () => {
      expect(getRefs(references, keys))
        .withContext(keys.join(","))
        .toEqual(expected);
    });
  }

  it("walks a long chain to the end instead of truncating it", () => {
    const chain = {};
    for (let i = 0; i < 40; i++) chain[`a${i}`] = { aliasOf: `a${i + 1}` };
    chain.a40 = { title: "end", href: "https://example.com/end" };
    const output = getRefs(chain, ["a0"]);
    expect(Object.keys(output).length).toBe(41);
    expect(output.a40).toEqual(chain.a40);
  });

  // The data can carry a pointer to a prototype property as easily as a caller
  // can ask for one, so both pointer kinds are checked.
  for (const pointer of ["aliasOf", "versionOf"]) {
    it(`refuses a poisoned ${pointer} rather than answering with it`, () => {
      const poisoned = JSON.parse(
        `{"SEEMS-FINE":{"${pointer}":"__proto__"},"__proto__":{"title":"hostile"}}`,
      );
      const output = getRefs(poisoned, ["SEEMS-FINE"]);
      expect(Object.keys(output)).toEqual(["SEEMS-FINE"]);
      expect(JSON.stringify(output)).not.toContain("hostile");
    });
  }

  it("does not put __proto__ on the wire", () => {
    // An object literal would set the prototype; JSON.parse makes a real own key.
    const hostile = JSON.parse('{"__proto__":{"title":"hostile"}}');
    const output = getRefs(hostile, ["__proto__"]);
    expect(JSON.stringify(output)).toBe("{}");
    expect({}.title).toBeUndefined();
  });
});

describe("routes/bibrefs - validate", () => {
  const valid = bulk();

  // Each case asserts WHICH check fired: "not null" alone passes when a later
  // check happens to catch the same fixture, which hides a deleted one.
  const rejected = [
    ["an array", [], "not a plain object"],
    ["a primitive", "nope", "not a plain object"],
    ["null", null, "not a plain object"],
    [
      "too few references",
      { WEBIDL: { href: "h", title: "t" } },
      "expected 80000+",
    ],
    [
      "a sentinel missing its href",
      { ...valid, WEBIDL: { title: "Web IDL" } },
      "sentinel WEBIDL",
    ],
    [
      "a broken alias chain",
      { ...valid, ABNF: { aliasOf: "ELSEWHERE" } },
      "alias chain broken",
    ],
    [
      "an alias chain whose terminal record is missing",
      { ...valid, rfc5234: undefined },
      "sentinel rfc5234",
    ],
  ];

  for (const [description, data, reason] of rejected) {
    it(`rejects ${description}`, () => {
      expect(validate(data)).withContext(description).toContain(reason);
    });
  }

  it("accepts data that has everything it checks for", () => {
    expect(validate(valid)).toBeNull();
  });
});
