import searchRoute from "../../../build/routes/api/baseline/search.post.js";
import { store } from "../../../build/routes/api/baseline/lib/store-init.js";

/** @returns {import("express").Response} */
function makeRes() {
  const res = {
    _status: 200,
    _body: undefined,
    status(code) {
      this._status = code;
      return this;
    },
    sendStatus(code) {
      this._status = code;
      return this;
    },
    set() {
      return this;
    },
    json(data) {
      this._body = data;
      return this;
    },
  };
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
      const req = { body: { specs: ["https://example.com/spec/"] } };
      const res = makeRes();
      searchRoute(req, res);
      expect(res._status).toBe(503);
    });
  });

  describe("input validation", () => {
    beforeEach(() => {
      store.data = EMPTY_STORE_DATA;
    });

    it("returns 400 when specs is missing", () => {
      const req = { body: {} };
      const res = makeRes();
      searchRoute(req, res);
      expect(res._status).toBe(400);
    });

    it("returns 400 when specs is not an array", () => {
      const req = { body: { specs: "https://example.com/" } };
      const res = makeRes();
      searchRoute(req, res);
      expect(res._status).toBe(400);
    });

    it("returns 400 when specs is an empty array", () => {
      const req = { body: { specs: [] } };
      const res = makeRes();
      searchRoute(req, res);
      expect(res._status).toBe(400);
    });

    it("returns 400 when specs contains an empty string", () => {
      const req = { body: { specs: [""] } };
      const res = makeRes();
      searchRoute(req, res);
      expect(res._status).toBe(400);
    });

    it("returns 400 when specs contains a whitespace-only string", () => {
      const req = { body: { specs: ["   "] } };
      const res = makeRes();
      searchRoute(req, res);
      expect(res._status).toBe(400);
    });

    it("returns 400 when specs contains a non-string value", () => {
      const req = { body: { specs: [42] } };
      const res = makeRes();
      searchRoute(req, res);
      expect(res._status).toBe(400);
    });
  });

  describe("matching", () => {
    beforeEach(() => {
      store.data = EMPTY_STORE_DATA;
      store.bySpecUrl = new Map([
        [
          "https://drafts.csswg.org/css-animations/",
          ["css-animations"],
        ],
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
      const req = {
        body: { specs: ["https://drafts.csswg.org/css-animations/"] },
      };
      const res = makeRes();
      searchRoute(req, res);
      expect(res._status).toBe(200);
      expect(res._body.result).toBeInstanceOf(Array);
      expect(res._body.result.length).toBe(1);
      expect(res._body.result[0].id).toBe("css-animations");
    });

    it("returns empty result for non-matching spec URL", () => {
      const req = { body: { specs: ["https://example.com/unknown/"] } };
      const res = makeRes();
      searchRoute(req, res);
      expect(res._status).toBe(200);
      expect(res._body.result).toEqual([]);
    });
  });
});
