import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";

import {
  getData,
  cache,
} from "../../../../build/routes/caniuse/lib/index.js";

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
