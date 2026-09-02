import { route } from "../../../build/routes/bibrefs/index.js";
import { store } from "../../../build/routes/bibrefs/lib/store-init.js";
import { DATA_FILE } from "../../../build/routes/bibrefs/lib/paths.js";

/** @returns {import("express").Response} */
function makeRes() {
  return {
    locals: {},
    _status: 200,
    _body: undefined,
    _headers: {},
    _sentFile: undefined,
    status(code) {
      this._status = code;
      return this;
    },
    sendStatus(code) {
      this._status = code;
      return this;
    },
    set(name, value) {
      this._headers[name] = value;
      return this;
    },
    json(data) {
      this._body = data;
      return this;
    },
    jsonp(data) {
      this._body = data;
      this._usedJsonp = true;
      return this;
    },
    type() {
      return this;
    },
    sendFile(filePath) {
      this._sentFile = filePath;
      return this;
    },
  };
}

function call(query) {
  const res = makeRes();
  route({ query }, res);
  return res;
}

describe("routes/bibrefs - route", () => {
  beforeEach(() => {
    store.degraded = false;
    store.references = {
      WEBIDL: {
        title: "Web IDL",
        href: "https://example.com/webidl",
        id: "WEBIDL",
      },
    };
  });

  afterEach(() => {
    store.degraded = true;
    store.references = {};
  });

  it("answers with the entries it found, and cache headers ReSpec can read", () => {
    const res = call({ refs: "WEBIDL" });
    // A literal, not store.references.WEBIDL: comparing against the object the
    // module hands back would pass even if it mutated the entry on the way out.
    expect(res._body).toEqual({
      WEBIDL: {
        title: "Web IDL",
        href: "https://example.com/webidl",
        id: "WEBIDL",
      },
    });
    expect(res._headers["Cache-Control"]).toBe("public, max-age=3600");
    // Parsed, not merely present: an empty Expires satisfies toBeDefined.
    const expires = Date.parse(res._headers["Expires"]);
    expect(expires).not.toBeNaN();
    expect(Math.abs(expires - (Date.now() + 3600_000))).toBeLessThan(60_000);
    expect(res.locals.reason).toBeUndefined();
  });

  const counted = [
    ["one key it has", "WEBIDL", { queries: 1, errors: 0 }],
    ["a key it does not have", "WEBIDL,NOPE", { queries: 2, errors: 1 }],
    [
      "a repeated query parameter",
      ["WEBIDL", "NOPE"],
      { queries: 2, errors: 1 },
    ],
    [
      "a comma separated list inside a repeated parameter",
      ["WEBIDL,NOPE", "ALSO-NOPE"],
      { queries: 3, errors: 2 },
    ],
    [
      "references padded with spaces",
      " WEBIDL , NOPE ",
      { queries: 2, errors: 1 },
    ],
  ];
  for (const [description, refs, expected] of counted) {
    it(`counts queries and misses for ${description}`, () => {
      expect(call({ refs }).locals).withContext(description).toEqual(expected);
    });
  }

  const counts = [
    ["exactly the limit", 500, 200],
    ["one over the limit", 501, 400],
  ];
  for (const [description, count, status] of counts) {
    it(`answers ${status} for ${description}`, () => {
      const refs = Array.from({ length: count }, (_, i) => `K${i}`).join(",");
      const res = call({ refs });
      expect(res._status).withContext(description).toBe(status);
      if (status === 400) {
        expect(res._headers["Cache-Control"]).toBe("no-store");
        expect(res.locals.reason).toBe("too-many-references");
      }
    });
  }

  it("sends the whole database only for a bare GET, as Bikeshed expects", () => {
    // The exact path: a tail-anchored match passes for the wrong directory.
    expect(call({})._sentFile).toBe(DATA_FILE);
    expect(call({}).locals.reason).toBe("whole-store");
  });

  const notBare = [
    ["an empty refs parameter", { refs: "" }],
    ["a refs parameter under another name", { "refs[]": "WEBIDL" }],
  ];
  for (const [description, query] of notBare) {
    it(`does not send the whole 26 MB database for ${description}`, () => {
      const res = call(query);
      expect(res._sentFile).withContext(description).toBeUndefined();
      expect(res._body).toEqual({});
    });
  }

  it("answers through jsonp, which the service this replaces supported", () => {
    // Express falls back to plain JSON when no callback is named, so this only
    // pins that the route does not use res.json and lose ?callback= support.
    expect(call({ refs: "WEBIDL" })._usedJsonp).toBe(true);
  });

  it("blocks prototype keys whatever their case", () => {
    store.references["__PROTO__"] = {
      title: "hostile",
      href: "https://example.com/x",
    };
    expect(call({ refs: "__PROTO__" })._body).toEqual({});
    expect(call({ refs: "__proto__" })._body).toEqual({});
  });

  it("refuses to serve, uncacheably, while the store is degraded", () => {
    store.degraded = true;
    const res = call({ refs: "WEBIDL" });
    expect(res._status).toBe(503);
    expect(res.locals.reason).toBe("degraded");
    expect(res._headers["Cache-Control"]).toBe("no-store");
  });
});
