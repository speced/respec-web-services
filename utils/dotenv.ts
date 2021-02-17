// https://github.com/motdotla/dotenv/issues/133#issuecomment-255298822

import { join } from "path";
import dotenv from "dotenv";
import { PROJECT_ROOT } from "./constants.js";

dotenv.config({ path: join(PROJECT_ROOT, ".env") });
