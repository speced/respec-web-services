import path from "node:path";

import express from "express";
import cors from "cors";

import { env, ms } from "../../../utils/misc.js";

import namesRoute from "./names.js";
import updateRoute from "./update.js";

const DATA_DIR = env("DATA_DIR");

const router = express.Router({ mergeParams: true });

router
  .options("/names", cors({ methods: ["POST", "GET"], maxAge: ms("1day") }))
  .post("/names", express.json({ limit: "2mb" }), cors(), namesRoute);
router.post("/update", updateRoute);
router.use("/data", express.static(path.join(DATA_DIR, "unicode")));

export default router;
