import { promises as fs } from "node:fs";
import path from "node:path";

import { createRequest, createResponse } from "node-mocks-http";

import route from "#routes/caniuse/feature.ts";
import { cache } from "#routes/caniuse/lib/index.ts";
import { env } from "#utils/misc.ts";

type FeatureRequest = Parameters<typeof route>[0];
type FeatureResponse = Parameters<typeof route>[1];

const CANIUSE_DIR = path.join(env("DATA_DIR"), "caniuse");

const FIXTURE = {
  all: {
    chrome: [["100", ["y"]]],
    firefox: [["99", ["n"]]],
    edge: [["100", ["y"]]],
    safari: [["16", ["y"]]],
    and_chr: [["100", ["y"]]],
    and_ff: [["99", ["n"]]],
    ios_saf: [["16", ["y"]]],
    samsung: [["19", ["y"]]],
  },
  summary: { chrome: [["100", ["y"]]] },
};

async function callRoute(feature: string, query: Record<string, string> = {}) {
  const req = createRequest<FeatureRequest>({ params: { feature }, query });
  const res = createResponse<FeatureResponse>();
  await route(req, res);
  return res;
}

async function writeFixture(name: string, data: unknown = FIXTURE) {
  await fs.mkdir(CANIUSE_DIR, { recursive: true });
  await fs.writeFile(
    path.join(CANIUSE_DIR, `${name}.json`),
    JSON.stringify(data),
    "utf8",
  );
}

async function removeFixture(name: string) {
  try {
    await fs.unlink(path.join(CANIUSE_DIR, `${name}.json`));
  } catch {
    // ignore
  }
}

describe("caniuse - feature route", () => {
  beforeEach(() => cache.clear());

  describe("404 responses", () => {
    it("returns JSON 404 for a missing feature", async () => {
      const res = await callRoute("nonexistent-xyz");
      expect(res.statusCode).toBe(404);
      expect(res._getJSONData()).toEqual(
        jasmine.objectContaining({ error: jasmine.any(String) }),
      );
      expect(res._getJSONData().error).toContain("nonexistent-xyz");
    });

    it("returns JSON 404 with a wf- hint for a missing wf- feature", async () => {
      const res = await callRoute("wf-no-such-feature-xyz");
      expect(res.statusCode).toBe(404);
      expect(res._getJSONData().error).toContain("wf-");
      expect(res._getJSONData().error).toContain("web-features");
    });

    it("returns JSON 404 without wf- hint for the edge case 'wf-'", async () => {
      const res = await callRoute("wf-");
      expect(res.statusCode).toBe(404);
      expect(res._getJSONData().error).not.toContain("web-features");
    });
  });

  describe("successful responses", () => {
    it("returns 200 JSON with browser data for a known feature", async () => {
      await writeFixture("css-grid");
      try {
        const res = await callRoute("css-grid");
        expect(res.statusCode).toBe(200);
        expect(res._getJSONData()).toEqual(
          jasmine.objectContaining({ result: jasmine.any(Array) }),
        );
      } finally {
        await removeFixture("css-grid");
      }
    });

    it("resolves wf- prefixed feature to its caniuse equivalent", async () => {
      await writeFixture("css-grid");
      try {
        const res = await callRoute("wf-css-grid");
        expect(res.statusCode).toBe(200);
        expect(res._getJSONData().result).toBeDefined();
      } finally {
        await removeFixture("css-grid");
      }
    });
  });

  describe("500 responses", () => {
    it("returns JSON 500 when the feature file is malformed JSON", async () => {
      await fs.mkdir(CANIUSE_DIR, { recursive: true });
      await fs.writeFile(
        path.join(CANIUSE_DIR, "broken-feature.json"),
        "not valid json",
        "utf8",
      );
      try {
        const res = await callRoute("broken-feature");
        expect(res.statusCode).toBe(500);
        expect(res._getJSONData()).toEqual(
          jasmine.objectContaining({ error: jasmine.any(String) }),
        );
      } finally {
        try {
          await fs.unlink(path.join(CANIUSE_DIR, "broken-feature.json"));
        } catch {
          /* ignore */
        }
      }
    });
  });
});
