import {
  copyFileSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import { PROJECT_ROOT } from "../../../utils/constants.js";

const VENDOR_DIRECTORY = path.join(PROJECT_ROOT, "vendor", "specref");
export const TRANSFORM = "bibref.js";
const VENDORED_FILES = [TRANSFORM, "format-date.js"];

/**
 * Build a directory we own for the vendored transform to run in, and return the
 * file to require.
 *
 * It needs a parent holding both `lib` and `refs`, because it reads its input
 * from `__dirname/../refs`. Write nothing inside the clone: a committed symlink
 * there would send a copy wherever it pointed.
 */
export function prepareWorkspace(cloneDirectory: string, outputFile: string) {
  const workspace = path.join(path.dirname(outputFile), "transform");
  rmSync(workspace, { recursive: true, force: true });
  mkdirSync(path.join(workspace, "lib"), { recursive: true });
  // The transform is CommonJS and this package is "type": "module". Without
  // this, a workspace anywhere under the checkout makes Node find the project's
  // package.json first and refuse to load it.
  writeFileSync(
    path.join(workspace, "package.json"),
    JSON.stringify({ type: "commonjs" }),
    "utf8",
  );
  for (const name of VENDORED_FILES) {
    copyFileSync(
      path.join(VENDOR_DIRECTORY, name),
      path.join(workspace, "lib", name),
    );
  }
  symlinkSync(path.join(cloneDirectory, "refs"), path.join(workspace, "refs"));
  return path.join(workspace, "lib", TRANSFORM);
}
