import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";

import {
  getData,
  cache,
  createResponseBody,
} from "../../../../build/routes/caniuse/lib/index.js";

import {
  BROWSERS,
  DEFAULT_BROWSERS,
  SUPPORT_TITLES,
} from "../../../../build/routes/caniuse/lib/constants.js";

const CANIUSE_DIR = path.join(os.tmpdir(), "caniuse");

/** Minimal valid ScraperOutput fixture */
const FIXTURE = {
  all: { chrome: [["100", ["y"]]], firefox: [["99", ["n"]]] },
  summary: { chrome: [["100", ["y"]]] },
};

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
    // ignore – file may not exist
  }
}

describe("caniuse - getData", () => {
  beforeEach(() => cache.clear());

  it("returns null for empty feature string", async () => {
    expect(await getData("")).toBeNull();
  });

  it("returns null for invalid characters (path traversal attempt)", async () => {
    expect(await getData("../etc/passwd")).toBeNull();
    expect(await getData("foo/bar")).toBeNull();
    expect(await getData("feature name")).toBeNull();
  });

  it("returns null for non-existent feature", async () => {
    expect(await getData("nonexistent-feature-xyz")).toBeNull();
  });

  it("returns data for a known feature", async () => {
    await writeFixture("css-grid");
    try {
      const data = await getData("css-grid");
      expect(data).toEqual(FIXTURE);
    } finally {
      await removeFixture("css-grid");
    }
  });

  it("returns null for wf- edge case (exactly 'wf-')", async () => {
    expect(await getData("wf-")).toBeNull();
  });

  it("returns null for wf- feature where stripped name also has no data", async () => {
    expect(await getData("wf-no-such-feature-xyz")).toBeNull();
  });

  it("falls back from wf- prefixed key to the stripped feature name", async () => {
    await writeFixture("css-grid");
    try {
      const data = await getData("wf-css-grid");
      expect(data).toEqual(FIXTURE);
    } finally {
      await removeFixture("css-grid");
    }
  });

  it("caches the result under the original wf- key after a successful fallback", async () => {
    await writeFixture("css-grid");
    try {
      expect(cache.has("wf-css-grid")).toBeFalse();
      await getData("wf-css-grid");
      expect(cache.has("wf-css-grid")).toBeTrue();
    } finally {
      await removeFixture("css-grid");
    }
  });

  it("serves subsequent wf- requests from cache without extra disk I/O", async () => {
    await writeFixture("css-grid");
    try {
      await getData("wf-css-grid"); // warm up cache
      await removeFixture("css-grid"); // remove file; only cache should serve it now
      const data = await getData("wf-css-grid");
      expect(data).toEqual(FIXTURE);
    } finally {
      await removeFixture("css-grid");
    }
  });
});

describe("caniuse - constants", () => {
  describe("BROWSERS", () => {
    it("is a Map", () => {
      expect(BROWSERS).toBeInstanceOf(Map);
    });

    it("has expected browser names", () => {
      const expected = [
        "chrome",
        "firefox",
        "safari",
        "edge",
        "opera",
        "ios_saf",
        "samsung",
        "and_chr",
        "and_ff",
        "android",
      ];
      for (const name of expected) {
        expect(BROWSERS.has(name))
          .withContext(`missing browser: ${name}`)
          .toBeTrue();
      }
    });

    it("maps browser IDs to human-readable names", () => {
      expect(BROWSERS.get("chrome")).toBe("Chrome");
      expect(BROWSERS.get("firefox")).toBe("Firefox");
      expect(BROWSERS.get("safari")).toBe("Safari");
      expect(BROWSERS.get("edge")).toBe("Edge");
      expect(BROWSERS.get("ios_saf")).toBe("Safari (iOS)");
      expect(BROWSERS.get("and_chr")).toBe("Chrome (Android)");
    });

    it("does not contain empty values", () => {
      for (const [key, value] of BROWSERS) {
        expect(key).withContext("key is non-empty").toBeTruthy();
        expect(value).withContext(`value for "${key}" is non-empty`).toBeTruthy();
      }
    });
  });

  describe("DEFAULT_BROWSERS", () => {
    it("is an array", () => {
      expect(Array.isArray(DEFAULT_BROWSERS)).toBeTrue();
    });

    it("is a valid subset of BROWSERS", () => {
      for (const browser of DEFAULT_BROWSERS) {
        expect(BROWSERS.has(browser))
          .withContext(`"${browser}" should be in BROWSERS`)
          .toBeTrue();
      }
    });

    it("includes major browsers", () => {
      expect(DEFAULT_BROWSERS).toContain("chrome");
      expect(DEFAULT_BROWSERS).toContain("firefox");
      expect(DEFAULT_BROWSERS).toContain("safari");
      expect(DEFAULT_BROWSERS).toContain("edge");
    });

    it("does not include all browsers", () => {
      expect(DEFAULT_BROWSERS.length).toBeLessThan(BROWSERS.size);
    });
  });

  describe("SUPPORT_TITLES", () => {
    it("is a Map", () => {
      expect(SUPPORT_TITLES).toBeInstanceOf(Map);
    });

    it("has all expected support keys", () => {
      const expectedKeys = ["y", "a", "n", "p", "u", "x", "d"];
      for (const key of expectedKeys) {
        expect(SUPPORT_TITLES.has(key))
          .withContext(`missing support key: "${key}"`)
          .toBeTrue();
      }
    });

    it("maps single keys to descriptive titles", () => {
      expect(SUPPORT_TITLES.get("y")).toBe("Supported.");
      expect(SUPPORT_TITLES.get("n")).toBe("No support, or disabled by default.");
      expect(SUPPORT_TITLES.get("a")).toBe(
        "Almost supported (aka Partial support).",
      );
      expect(SUPPORT_TITLES.get("u")).toBe("Support unknown.");
      expect(SUPPORT_TITLES.get("x")).toBe("Requires prefix to work.");
      expect(SUPPORT_TITLES.get("p")).toBe("No support, but has Polyfill.");
      expect(SUPPORT_TITLES.get("d")).toBe(
        "Disabled by default (needs to be enabled).",
      );
    });

    it("returns undefined for unknown keys", () => {
      expect(SUPPORT_TITLES.get("z")).toBeUndefined();
      expect(SUPPORT_TITLES.get("")).toBeUndefined();
    });
  });
});

describe("caniuse - sanitizeBrowsersList (via createResponseBody)", () => {
  beforeAll(async () => {
    // Write fixtures into the CANIUSE_DIR the module already resolved at load time.
    await fs.mkdir(CANIUSE_DIR, { recursive: true });

    // Write a minimal fixture for a feature called "test-feature"
    const fixtureData = {
      all: {
        chrome: [
          ["120", ["y"]],
          ["119", ["y"]],
          ["118", ["y"]],
          ["117", ["a"]],
          ["116", ["n"]],
        ],
        firefox: [
          ["121", ["y"]],
          ["120", ["y"]],
          ["119", ["a"]],
        ],
        safari: [
          ["17", ["y"]],
          ["16", ["a"]],
        ],
        edge: [
          ["120", ["y"]],
        ],
        opera: [
          ["100", ["n"]],
        ],
      },
      summary: {
        chrome: [["120", ["y"]]],
        firefox: [["121", ["y"]]],
        safari: [["17", ["y"]]],
        edge: [["120", ["y"]]],
        opera: [["100", ["n"]]],
      },
    };
    await writeFixture("test-feature", fixtureData);

    // Write a fixture with compound and unknown support keys for HTML tests
    const compoundFixture = {
      all: {
        chrome: [["120", ["y", "x"]]],
        firefox: [["121", ["z"]]],
      },
      summary: {
        chrome: [["120", ["y", "x"]]],
        firefox: [["121", ["z"]]],
      },
    };
    await writeFixture("compound-feature", compoundFixture);
  });

  afterAll(async () => {
    await removeFixture("test-feature");
    await removeFixture("compound-feature");
  });

  it("returns default browsers for undefined input", async () => {
    const result = await createResponseBody({
      feature: "test-feature",
      format: "json",
    });
    expect(result).not.toBeNull();
    expect(Object.keys(result)).toContain("chrome");
    expect(Object.keys(result)).toContain("firefox");
    expect(Object.keys(result)).toContain("safari");
  });

  it("returns default browsers for non-array, non-'all' input", async () => {
    const result = await createResponseBody({
      feature: "test-feature",
      browsers: "invalid-string",
      format: "json",
    });
    expect(result).not.toBeNull();
    expect(Object.keys(result)).toContain("chrome");
  });

  it("returns empty browsers list (all browsers) when 'all' is passed", async () => {
    const result = await createResponseBody({
      feature: "test-feature",
      browsers: "all",
      format: "json",
    });
    expect(result).not.toBeNull();
    expect(Object.keys(result)).toContain("chrome");
    expect(Object.keys(result)).toContain("firefox");
    expect(Object.keys(result)).toContain("safari");
    expect(Object.keys(result)).toContain("edge");
    expect(Object.keys(result)).toContain("opera");
  });

  it("filters invalid browser names from array input", async () => {
    const result = await createResponseBody({
      feature: "test-feature",
      browsers: ["chrome", "invalid-browser", "firefox"],
      format: "json",
    });
    expect(result).not.toBeNull();
    expect(Object.keys(result)).toContain("chrome");
    expect(Object.keys(result)).toContain("firefox");
    expect(Object.keys(result)).not.toContain("invalid-browser");
  });

  it("returns defaults when all array entries are invalid", async () => {
    const result = await createResponseBody({
      feature: "test-feature",
      browsers: ["not-a-browser", "also-invalid"],
      format: "json",
    });
    expect(result).not.toBeNull();
    expect(Object.keys(result)).toContain("chrome");
    expect(Object.keys(result)).toContain("firefox");
  });

  it("returns null for non-existent feature", async () => {
    const result = await createResponseBody({
      feature: "nonexistent-feature",
      format: "json",
    });
    expect(result).toBeNull();
  });

  it("defaults to 4 versions when none specified", async () => {
    const result = await createResponseBody({
      feature: "test-feature",
      browsers: ["chrome"],
      format: "json",
    });
    expect(result).not.toBeNull();
    expect(result.chrome.length).toBe(4);
  });

  it("respects custom version count", async () => {
    const result = await createResponseBody({
      feature: "test-feature",
      browsers: ["chrome"],
      format: "json",
      versions: 2,
    });
    expect(result).not.toBeNull();
    expect(result.chrome.length).toBe(2);
  });

  describe("HTML title attributes (getSupportTitle via formatAsHTML)", () => {
    it("renders 'Supported.' title for a 'y' support key", async () => {
      const html = await createResponseBody({
        feature: "test-feature",
        browsers: ["chrome"],
        format: "html",
      });
      expect(html).not.toBeNull();
      expect(html).toContain('title="Supported."');
    });

    it("renders compound title for ['y', 'x'] support keys", async () => {
      const html = await createResponseBody({
        feature: "compound-feature",
        browsers: ["chrome"],
        format: "html",
      });
      expect(html).not.toBeNull();
      expect(html).toContain(
        'title="Supported. Requires prefix to work."',
      );
    });

    it("renders empty title for unknown support keys", async () => {
      // firefox has ["z"] (unknown) in the compound fixture
      const html = await createResponseBody({
        feature: "compound-feature",
        browsers: ["firefox"],
        format: "html",
      });
      expect(html).not.toBeNull();
      expect(html).toContain('title=""');
    });
  });
});
