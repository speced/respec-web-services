import { existsSync } from "node:fs";
import { join } from "node:path";

import { PROJECT_ROOT } from "#utils/constants.ts";

describe("utils/constants", () => {
  it("PROJECT_ROOT resolves to the repo root", () => {
    expect(existsSync(join(PROJECT_ROOT, "package.json"))).toBeTrue();
  });
});
