import { PROJECT_ROOT } from "../../build/utils/constants.js";
import { existsSync } from "fs";
import { join } from "path";

describe("utils/constants", () => {
  it("PROJECT_ROOT resolves to the repo root", () => {
    expect(existsSync(join(PROJECT_ROOT, "package.json"))).toBeTrue();
  });
});
