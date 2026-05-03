import {
  BROWSERS,
  DEFAULT_BROWSERS,
  SUPPORT_TITLES,
} from "../../../../build/routes/caniuse/lib/constants.js";

import { mkdtemp, writeFile, mkdir, rm } from "fs/promises";
import path from "path";
import { tmpdir } from "os";

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
  let tmpDir;
  let caniuseDir;
  let createResponseBody;
  let origDataDir;

  beforeAll(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), "caniuse-test-"));
    caniuseDir = path.join(tmpDir, "caniuse");
    await mkdir(caniuseDir, { recursive: true });

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
    await writeFile(
      path.join(caniuseDir, "test-feature.json"),
      JSON.stringify(fixtureData),
    );

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
    await writeFile(
      path.join(caniuseDir, "compound-feature.json"),
      JSON.stringify(compoundFixture),
    );

    // Set DATA_DIR before importing the module that reads it at load time
    origDataDir = process.env.DATA_DIR;
    process.env.DATA_DIR = tmpDir;

    // Dynamic import after env is set
    const mod = await import(
      "../../../../build/routes/caniuse/lib/index.js"
    );
    createResponseBody = mod.createResponseBody;
  });

  afterAll(async () => {
    if (origDataDir !== undefined) {
      process.env.DATA_DIR = origDataDir;
    }
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("returns default browsers for undefined input", async () => {
    const result = await createResponseBody({
      feature: "test-feature",
      format: "json",
    });
    expect(result).not.toBeNull();
    // Should include default browsers (chrome, firefox, safari, edge, etc.)
    // but not all browsers. The defaults include "samsung", "and_chr", etc.
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
    // Should return defaults since "invalid-string" is not "all"
    expect(Object.keys(result)).toContain("chrome");
  });

  it("returns empty browsers list (all browsers) when 'all' is passed", async () => {
    const result = await createResponseBody({
      feature: "test-feature",
      browsers: "all",
      format: "json",
    });
    expect(result).not.toBeNull();
    // When "all" is passed, sanitizeBrowsersList returns [], which means
    // createResponseBodyJSON pushes all keys from data.all
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
    // "invalid-browser" should be filtered out
    expect(Object.keys(result)).not.toContain("invalid-browser");
  });

  it("returns defaults when all array entries are invalid", async () => {
    const result = await createResponseBody({
      feature: "test-feature",
      browsers: ["not-a-browser", "also-invalid"],
      format: "json",
    });
    expect(result).not.toBeNull();
    // Filtered array is empty, so defaults are used
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
    // Chrome has 5 versions in fixture, should be capped at 4
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
