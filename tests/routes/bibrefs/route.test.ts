import { createRequest, createResponse } from "node-mocks-http";

import { route } from "#routes/bibrefs/index.ts";
import { DATA_FILE } from "#routes/bibrefs/lib/paths.ts";
import { store } from "#routes/bibrefs/lib/store-init.ts";

type RouteRequest = Parameters<typeof route>[0];
type RouteResponse = Parameters<typeof route>[1];

function call(query: Record<string, unknown>) {
  const req = createRequest<RouteRequest>({ query });
  const res = createResponse<RouteResponse>();
  const sentFile = { path: undefined as string | undefined };
  res.sendFile = ((filePath: string) => {
    sentFile.path = filePath;
    return res;
  }) as RouteResponse["sendFile"];
  spyOn(res, "jsonp").and.callThrough();
  route(req, res);
  return Object.assign(res, { _sentFile: sentFile.path });
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
    expect(res._getJSONData()).toEqual({
      WEBIDL: {
        title: "Web IDL",
        href: "https://example.com/webidl",
        id: "WEBIDL",
      },
    });
    expect(res.getHeader("Cache-Control")).toBe("public, max-age=3600");
    // Parsed, not merely present: an empty Expires satisfies toBeDefined.
    const expires = Date.parse(res.getHeader("Expires") as string);
    expect(expires).not.toBeNaN();
    expect(Math.abs(expires - (Date.now() + 3600_000))).toBeLessThan(60_000);
    expect(res.locals.reason).toBeUndefined();
  });

  const counted: [
    string,
    string | string[],
    { queries: number; errors: number },
  ][] = [
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

  const counts: [string, number, number][] = [
    ["exactly the limit", 500, 200],
    ["one over the limit", 501, 400],
  ];
  for (const [description, count, status] of counts) {
    it(`answers ${status} for ${description}`, () => {
      const refs = Array.from({ length: count }, (_, i) => `K${i}`).join(",");
      const res = call({ refs });
      expect(res.statusCode).withContext(description).toBe(status);
      if (status === 400) {
        expect(res.getHeader("Cache-Control")).toBe("no-store");
        expect(res.locals.reason).toBe("too-many-references");
      }
    });
  }

  it("still sends the whole database when only a jsonp callback is named", () => {
    // Answering callback({}) to a request for everything is a wrong answer
    // dressed as a valid one.
    expect(call({ callback: "myFunc" })._sentFile).toBe(DATA_FILE);
  });

  it("sends the whole database only for a bare GET, as Bikeshed expects", () => {
    // The exact path: a tail-anchored match passes for the wrong directory.
    expect(call({})._sentFile).toBe(DATA_FILE);
    expect(call({}).locals.reason).toBe("whole-store");
  });

  const notBare: [string, Record<string, string>][] = [
    ["an empty refs parameter", { refs: "" }],
    ["a refs parameter under another name", { "refs[]": "WEBIDL" }],
  ];
  for (const [description, query] of notBare) {
    it(`does not send the whole 26 MB database for ${description}`, () => {
      const res = call(query);
      expect(res._sentFile).withContext(description).toBeUndefined();
      expect(res._getJSONData()).toEqual({});
    });
  }

  it("answers through jsonp, which the service this replaces supported", () => {
    // Express falls back to plain JSON when no callback is named, so this only
    // pins that the route does not use res.json and lose ?callback= support.
    expect(call({ refs: "WEBIDL" }).jsonp).toHaveBeenCalled();
  });

  it("blocks prototype keys whatever their case", () => {
    store.references.__PROTO__ = {
      title: "hostile",
      href: "https://example.com/x",
    };
    expect(call({ refs: "__PROTO__" })._getJSONData()).toEqual({});
    expect(call({ refs: "__proto__" })._getJSONData()).toEqual({});
  });

  it("refuses to serve, uncacheably, while the store is degraded", () => {
    store.degraded = true;
    const res = call({ refs: "WEBIDL" });
    expect(res.statusCode).toBe(503);
    expect(res.locals.reason).toBe("degraded");
    expect(res.getHeader("Cache-Control")).toBe("no-store");
  });
});
