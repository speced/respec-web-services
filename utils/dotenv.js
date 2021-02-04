// https://github.com/motdotla/dotenv/issues/133#issuecomment-255298822

import { dirname, join } from "path";
import { fileURLToPath } from "url";

import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });
