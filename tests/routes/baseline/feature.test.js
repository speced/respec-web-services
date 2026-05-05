import featureRoute from "../../../build/routes/api/baseline/feature.js";
import { store } from "../../../build/routes/api/baseline/lib/store-init.js";

/** @returns {import("express").Response} */
function makeRes() {
  const res = {
    _status: 200,
    _body: undefined,
    _headers: {},
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
  };
  return res;
}

const FEATURE_DATA = {
  kind: "feature",
  name: "CSS Animations",
  spec: ["https://drafts.csswg.org/css-animations/"],
  status: { baseline: "high", support: {} },
};

describe("routes/api/baseline/feature", () => {
  beforeEach(() => {
    store.data = {
      features: {
        "css-animations": FEATURE_DATA,
        "old-animations": {
          kind: "moved",
          redirect_target: "css-animations",
        },
        "mega-feature": {
          kind: "split",
          redirect_targets: ["css-animations"],
        },
      },
      browsers: {},
      groups: {},
      snapshots: {},
    };
    store.byFeature = new Map([["css-animations", FEATURE_DATA]]);
  });

  afterEach(() => {
    store.data = null;
    store.byFeature = new Map();
    store.bySpecUrl = new Map();
  });

  it("returns feature data for a known feature", () => {
    const req = { params: { feature: "css-animations" } };
    const res = makeRes();
    featureRoute(req, res);
    expect(res._status).toBe(200);
    expect(res._body.id).toBe("css-animations");
    expect(res._body.name).toBe("CSS Animations");
  });

  it("returns 404 when feature is unknown", () => {
    const req = { params: { feature: "unknown-feature" } };
    const res = makeRes();
    featureRoute(req, res);
    expect(res._status).toBe(404);
  });

  it("returns 404 when store has no data", () => {
    store.data = null;
    store.byFeature = new Map();
    const req = { params: { feature: "css-animations" } };
    const res = makeRes();
    featureRoute(req, res);
    expect(res._status).toBe(404);
  });

  it("resolves a moved feature to its redirect target", () => {
    const req = { params: { feature: "old-animations" } };
    const res = makeRes();
    featureRoute(req, res);
    expect(res._status).toBe(200);
    expect(res._body.id).toBe("css-animations");
    expect(res._body.redirected_from).toBe("old-animations");
    expect(res._body.name).toBe("CSS Animations");
  });

  it("returns 404 for a moved feature whose target is missing", () => {
    store.data.features["orphan-moved"] = {
      kind: "moved",
      redirect_target: "nonexistent",
    };
    const req = { params: { feature: "orphan-moved" } };
    const res = makeRes();
    featureRoute(req, res);
    expect(res._status).toBe(404);
  });

  it("resolves a split feature to its redirect targets", () => {
    const req = { params: { feature: "mega-feature" } };
    const res = makeRes();
    featureRoute(req, res);
    expect(res._status).toBe(200);
    expect(res._body.id).toBe("mega-feature");
    expect(res._body.kind).toBe("split");
    expect(Array.isArray(res._body.split_into)).toBeTrue();
    expect(res._body.split_into.length).toBe(1);
    expect(res._body.split_into[0].id).toBe("css-animations");
  });
});
