import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { prepareWorkspace } from "../../../build/routes/bibrefs/lib/workspace.js";

describe("routes/bibrefs - build workspace", () => {
  let root;

  beforeEach(() => {
    root = mkdtempSync(path.join(os.tmpdir(), "bibrefs-workspace-"));
  });

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it("declares itself CommonJS so the vendored transform loads", () => {
    // This package is "type": "module". Without the declaration, a DATA_DIR
    // inside the checkout makes Node treat the transform as ESM and refuse it,
    // which is how it failed in production while passing here.
    const transform = prepareWorkspace(
      path.join(root, "clone"),
      path.join(root, "out", "biblio.json"),
    );
    const manifest = path.join(
      path.dirname(path.dirname(transform)),
      "package.json",
    );
    expect(JSON.parse(readFileSync(manifest, "utf8")).type).toBe("commonjs");
  });
});
