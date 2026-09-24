import { createRequest, createResponse } from "node-mocks-http";

import featureRoute from "#routes/api/baseline/feature.ts";
import type { FeatureData } from "#routes/api/baseline/lib/store.ts";
import { store } from "#routes/api/baseline/lib/store-init.ts";

type FeatureRequest = Parameters<typeof featureRoute>[0];
type FeatureResponse = Parameters<typeof featureRoute>[1];

function callRoute(feature: string) {
  const req = createRequest<FeatureRequest>({ params: { feature } });
  const res = createResponse<FeatureResponse>();
  featureRoute(req, res);
  return res;
}

const FEATURE_DATA: FeatureData = {
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
    const res = callRoute("css-animations");
    expect(res.statusCode).toBe(200);
    expect(res._getJSONData().id).toBe("css-animations");
    expect(res._getJSONData().name).toBe("CSS Animations");
  });

  it("returns 404 when feature is unknown", () => {
    const res = callRoute("unknown-feature");
    expect(res.statusCode).toBe(404);
  });

  it("returns 404 when store has no data", () => {
    store.data = null;
    store.byFeature = new Map();
    const res = callRoute("css-animations");
    expect(res.statusCode).toBe(404);
  });

  it("resolves a moved feature to its redirect target", () => {
    const res = callRoute("old-animations");
    expect(res.statusCode).toBe(200);
    expect(res._getJSONData().id).toBe("css-animations");
    expect(res._getJSONData().redirected_from).toBe("old-animations");
    expect(res._getJSONData().name).toBe("CSS Animations");
  });

  it("returns 404 for a moved feature whose target is missing", () => {
    store.data!.features["orphan-moved"] = {
      kind: "moved",
      redirect_target: "nonexistent",
    };
    const res = callRoute("orphan-moved");
    expect(res.statusCode).toBe(404);
  });

  it("resolves a split feature to its redirect targets", () => {
    const res = callRoute("mega-feature");
    expect(res.statusCode).toBe(200);
    expect(res._getJSONData().id).toBe("mega-feature");
    expect(res._getJSONData().kind).toBe("split");
    expect(Array.isArray(res._getJSONData().split_into)).toBeTrue();
    expect(res._getJSONData().split_into.length).toBe(1);
    expect(res._getJSONData().split_into[0].id).toBe("css-animations");
  });
});
