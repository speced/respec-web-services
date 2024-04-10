import {
  search as _search,
  cache,
} from "../../../../build/routes/xref/lib/search.js";

import byTerm from "./data-by-term.js";
const store = { byTerm };

/**
 * @param {import("../../../../routes/xref/lib/search.js").Query} query
 * @param {import("../../../../routes/xref/lib/search.js").Options} options
 */
const search = (query, options) => {
  const response = _search([query], store, { fields: ["uri"], ...options });
  return response.result[0][1];
};

describe("xref - search", () => {
  describe("options", () => {
    beforeEach(() => cache.clear());

    describe("query", () => {
      it("adds query back to response if requested", () => {
        expect(_search([], store, { query: true })).toEqual({
          result: [],
          query: [],
        });
        expect(_search([], store)).toEqual({ result: [] });
      });

      it("adds id to query if none is given", () => {
        const getQuery = query =>
          _search([query], store, { query: true }).query[0];
        expect(getQuery({ term: "html" })).toEqual({
          term: "html",
          id: "4c0b68a3658fd64c8a77242fffd6e4e615331375",
          types: [],
        });
        expect(getQuery({ term: "html", id: "ID" })).toEqual({
          term: "html",
          id: "ID",
          types: [],
        });
      });
    });

    describe("fields", () => {
      const search = (q, opts) => _search([q], store, { ...opts }).result[0][1];

      it("returns only requested fields", () => {
        expect(
          search({ term: "Baseline" }, { fields: ["spec", "uri"] }),
        ).toEqual([{ spec: "font-metrics-api-1", uri: "#baseline" }]);
      });

      it("returns default fields if not specified", () => {
        expect(search({ term: "Baseline" })).toEqual([
          {
            shortname: "font-metrics-api",
            spec: "font-metrics-api-1",
            type: "interface",
            uri: "#baseline",
            normative: true,
            htmlProse: "test html Prose",
            for: undefined,
          },
        ]);
      });
    });

    describe("all", () => {
      const resultsAll = [
        { uri: "#concept-event" },
        { uri: "#dom-window-event" },
        { uri: "obsolete.html#dom-script-event" },
      ];

      it("skips filter@for if options.all is set and for is not provided", () => {
        expect(search({ term: "event" }, { all: true })).toEqual(resultsAll);
      });

      it("uses filter@for if options.all is set and for is provided", () => {
        expect(
          search({ term: "event", for: "Window" }, { all: true }),
        ).toEqual([resultsAll[1]]);
      });

      it("uses filter@for if options.all is not set", () => {
        expect(
          search({ term: "event", for: "Window" }, { all: true }),
        ).toEqual([resultsAll[1]]);
      });
    });
  });

  describe("backward compatibility", () => {
    it("allows query.specs as string[]", () => {
      const inputQuery = { specs: ["html"], id: "ID" };
      const outputQuery = _search([inputQuery], store, { query: true })
        .query[0];
      expect(outputQuery).toEqual({ specs: [["html"]], id: "ID", types: [] });
    });
  });

  describe("filter@term", () => {
    it("empty string", () => {
      const result = [{ uri: "#dom-referrerpolicy" }];
      expect(search({ term: "", for: "ReferrerPolicy" })).toEqual(result);
      expect(search({ term: '""', for: "ReferrerPolicy" })).toEqual(result);
      expect(search({ term: "''", for: "ReferrerPolicy" })).toEqual([]);
    });

    it("textVariations", () => {
      const types = ["dfn"];
      const result = [{ uri: "webappapis.html#event-handlers" }];
      expect(search({ term: "event handler" })).toEqual(result);
      expect(search({ term: "event handlers" })).toEqual([]);
      expect(search({ term: "event handlers", types })).toEqual(result);

      const resultInfra = { uri: "#user-agent" };
      const resultWaiAria = { uri: "#dfn-user-agent" };
      expect(
        search({ term: "user agents", specs: [["infra"]], types }),
      ).toEqual([resultInfra]);
      expect(search({ term: "user agent", specs: [["infra"]], types })).toEqual(
        [resultInfra],
      );
      expect(
        search({ term: "user agents", specs: [["infra", "wai-aria"]], types }),
      ).toEqual([resultWaiAria]);
      expect(
        search({ term: "user agent", specs: [["infra", "wai-aria"]], types }),
      ).toEqual([resultWaiAria, resultInfra]);
    });

    it("preserves case based on query.types", () => {
      const baseline = [{ uri: "text.html#TermBaseline" }];
      const baselineInterface = [{ uri: "#baseline" }];

      expect(search({ term: "baseline" })).toEqual(baseline);
      expect(search({ term: "baseLine" })).toEqual([]);

      expect(search({ term: "baseLine", types: ["dfn"] })).toEqual(baseline);
      expect(search({ term: "baseLine", types: ["_IDL_"] })).toEqual([]);

      expect(search({ term: "Baseline", types: ["dfn"] })).toEqual(baseline);
      expect(search({ term: "Baseline", types: ["_IDL_"] })).toEqual(
        baselineInterface,
      );
    });
  });

  describe("filter@specs", () => {
    it("skips filter if query.specs not provided", () => {
      const results = search({ term: "script" }).sort((a, b) =>
        a.uri.localeCompare(b.uri),
      );
      const expectedResults = [
        { uri: "interact.html#elementdef-script" },
        { uri: "script.html#ScriptElement" },
        { uri: "scripting.html#script" },
        { uri: "webappapis.html#concept-script" },
      ].sort((a, b) => a.uri.localeCompare(b.uri));

      expect(results).toEqual(expectedResults);
    });

    it("filters on spec id first, then on shortname", () => {
      const term = "inherited value";
      const options = { fields: ["spec", "uri"] };
      expect(search({ term, specs: [["css-cascade-3"]] }, options)).toEqual([
        { spec: "css-cascade-3", uri: "#inherited-value" },
      ]);

      expect(search({ term, specs: [["css-cascade-4"]] }, options)).toEqual([
        { spec: "css-cascade-4", uri: "#inherited-value" },
      ]);
    });

    it("prefers latest version of same spec", () => {
      const term = "inherited value";
      const options = { fields: ["spec", "uri"] };
      expect(search({ term, specs: [["css-cascade"]] }, options)).toEqual([
        { spec: "css-cascade-4", uri: "#inherited-value" },
      ]);
    });

    it("supports fallback chains", () => {
      expect(search({ term: "script", specs: [["dom"], ["svg2"]] })).toEqual([
        { uri: "interact.html#elementdef-script" },
      ]);

      expect(search({ term: "body", specs: [["fetch"], ["html"]] })).toEqual([
        { uri: "#concept-body" },
      ]);
    });
  });

  describe("filter@types", () => {
    const resultMarker = [
      { uri: "#marker" },
      { uri: "painting.html#elementdef-marker" },
      { uri: "painting.html#MarkerElement" },
    ];

    it("skips filter if types are not provided", () => {
      const withoutTypes = [resultMarker[1], resultMarker[0], resultMarker[2]];
      expect(search({ term: "marker" })).toEqual(withoutTypes);
      expect(search({ term: "marker", types: [] })).toEqual(withoutTypes);
    });

    it("uses basic types filter", () => {
      const asDFN = [resultMarker[0]];
      expect(search({ term: "marker", types: ["dfn"] })).toEqual(asDFN);

      const asElement = [resultMarker[1], resultMarker[2]];
      expect(search({ term: "marker", types: ["element"] })).toEqual(asElement);

      const asElementOrDFN = [
        resultMarker[1],
        resultMarker[0],
        resultMarker[2],
      ];
      expect(search({ term: "marker", types: ["element", "dfn"] })).toEqual(
        asElementOrDFN,
      );

      expect(search({ term: "Baseline", types: ["interface"] })).toEqual([
        { uri: "#baseline" },
      ]);
    });

    it("uses _CONCEPT_, _IDL_ aggregate types", () => {
      const asConcept = [resultMarker[1], resultMarker[0], resultMarker[2]];
      expect(search({ term: "marker", types: ["_CONCEPT_"] })).toEqual(
        asConcept,
      );

      expect(search({ term: "Baseline", types: ["_IDL_"] })).toEqual([
        { uri: "#baseline" },
      ]);
    });
  });

  describe("filter@for", () => {
    it("skips filter if for is not provided", () => {
      expect(search({ term: "[[context]]" })).toHaveSize(0);

      const result = [{ uri: "#concept-event" }];
      expect(search({ term: "event" })).toEqual(result);
      expect(search({ term: "event", for: "" })).toEqual(result);
    });

    it("uses for context", () => {
      expect(search({ term: "[[context]]", for: "BluetoothDevice" })).toEqual([
        { uri: "#dom-bluetoothdevice-context-slot" },
      ]);
      expect(search({ term: "[[context]]", for: "WhateverElse" })).toEqual([]);

      expect(search({ term: "event", for: "Window" })).toEqual([
        { uri: "#dom-window-event" },
      ]);
      expect(search({ term: "event", for: "HTMLScriptElement" })).toEqual([
        { uri: "obsolete.html#dom-script-event" },
      ]);
    });

    it("tries lowercase forContext for concepts", () => {
      expect(search({ term: "for each", for: "list" })).toEqual([
        { uri: "#list-iterate" },
      ]);

      expect(search({ term: "for each", for: "LisT" })).toEqual([
        { uri: "#list-iterate" },
      ]);

      expect(search({ term: "aborted", for: "AbortSignal" })).toEqual([
        { uri: "#dom-abortsignal-aborted" },
      ]);
      expect(search({ term: "aborted", for: "abortsignal" })).toEqual([]);
    });
  });
});
