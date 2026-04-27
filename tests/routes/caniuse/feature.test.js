import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";

import route from "../../../build/routes/caniuse/feature.js";
import { cache } from "../../../build/routes/caniuse/lib/index.js";

const CANIUSE_DIR = path.join(os.tmpdir(), "caniuse");

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

/** Builds a lightweight mock Express Response. */
function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
    type(_t) {
      return this;
    },
  };
  return res;
}

/** Builds a minimal mock Express Request for the `/:feature` route. */
function mockReq(feature, query = {}) {
  return { params: { feature }, query };
}

async function writeFixture(name, data = FIXTURE) {
  await fs.mkdir(CANIUSE_DIR, { recursive: true });
  await fs.writeFile(
    path.join(CANIUSE_DIR, `${name}.json`),
    JSON.stringify(data),
    "utf8",
  );
}

async function removeFixture(name) {
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
      const res = mockRes();
      await route(mockReq("nonexistent-xyz"), res);
      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual(jasmine.objectContaining({ error: jasmine.any(String) }));
      expect(res.body.error).toContain("nonexistent-xyz");
    });

    it("returns JSON 404 with a wf- hint for a missing wf- feature", async () => {
      const res = mockRes();
      await route(mockReq("wf-no-such-feature-xyz"), res);
      expect(res.statusCode).toBe(404);
      expect(res.body.error).toContain("wf-");
      expect(res.body.error).toContain("web-features");
    });

    it("returns JSON 404 without wf- hint for the edge case 'wf-'", async () => {
      const res = mockRes();
      await route(mockReq("wf-"), res);
      expect(res.statusCode).toBe(404);
      expect(res.body.error).not.toContain("web-features");
    });
  });

  describe("successful responses", () => {
    it("returns 200 JSON with browser data for a known feature", async () => {
      await writeFixture("css-grid");
      try {
        const res = mockRes();
        await route(mockReq("css-grid"), res);
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual(jasmine.objectContaining({ result: jasmine.any(Array) }));
      } finally {
        await removeFixture("css-grid");
      }
    });

    it("resolves wf- prefixed feature to its caniuse equivalent", async () => {
      await writeFixture("css-grid");
      try {
        const res = mockRes();
        await route(mockReq("wf-css-grid"), res);
        expect(res.statusCode).toBe(200);
        expect(res.body.result).toBeDefined();
      } finally {
        await removeFixture("css-grid");
      }
    });
  });
});
