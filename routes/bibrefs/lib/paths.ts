import path from "node:path";

import { env } from "../../../utils/misc.js";

/** Absolute: res.sendFile throws on a relative path. */
export const DATA_FILE = path.resolve(
  env("DATA_DIR"),
  "bibrefs",
  "biblio.json",
);
