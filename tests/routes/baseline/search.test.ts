import { createRequest, createResponse } from "node-mocks-http";

import { store } from "#routes/api/baseline/lib/store-init.ts";
import searchRoute from "#routes/api/baseline/search.post.ts";

type SearchRequest = Parameters<typeof searchRoute>[0];
type SearchResponse = Parameters<typeof searchRoute>[1];

function callRoute(body: Record<string, unknown>) {
  const req = createRequest<SearchRequest>({ body });
  const res = createResponse<SearchResponse>();
  searchRoute(req, res);
  return res;
}

const EMPTY_STORE_DATA = {
  features: {},
  browsers: {},
  groups: {},
  snapshots: {},
};

describe("routes/api/baseline/search.post", () => {
  afterEach(() => {
    store.data = null;
    store.byFeature = new Map();
    store.bySpecUrl = new Map();
  });

  describe("when store data is unavailable", () => {
    it("returns 503 when store.data is null", () => {
      store.data = null;
      const res = callRoute({ specs: ["https://example.com/spec/"] });
      expect(res.statusCode).toBe(503);
    });
  });

  describe("input validation", () => {
    beforeEach(() => {
      store.data = EMPTY_STORE_DATA;
    });

    it("returns 400 when specs is missing", () => {
      const res = callRoute({});
      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when specs is not an array", () => {
      const res = callRoute({ specs: "https://example.com/" });
      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when specs is an empty array", () => {
      const res = callRoute({ specs: [] });
      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when specs contains an empty string", () => {
      const res = callRoute({ specs: [""] });
      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when specs contains a whitespace-only string", () => {
      const res = callRoute({ specs: ["   "] });
      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when specs contains a non-string value", () => {
      const res = callRoute({ specs: [42] });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("matching", () => {
    beforeEach(() => {
      store.data = EMPTY_STORE_DATA;
      store.bySpecUrl = new Map([
        ["https://drafts.csswg.org/css-animations/", ["css-animations"]],
      ]);
      store.byFeature = new Map([
        [
          "css-animations",
          {
            kind: "feature",
            name: "CSS Animations",
            status: { baseline: "high", support: {} },
          },
        ],
      ]);
    });

    it("returns matching features for a given spec URL", () => {
      const res = callRoute({
        specs: ["https://drafts.csswg.org/css-animations/"],
      });
      expect(res.statusCode).toBe(200);
      expect(res._getJSONData().result).toBeInstanceOf(Array);
      expect(res._getJSONData().result.length).toBe(1);
      expect(res._getJSONData().result[0].id).toBe("css-animations");
    });

    it("returns empty result for non-matching spec URL", () => {
      const res = callRoute({ specs: ["https://example.com/unknown/"] });
      expect(res.statusCode).toBe(200);
      expect(res._getJSONData().result).toEqual([]);
    });
  });
});
