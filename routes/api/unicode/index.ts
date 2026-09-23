import path from "node:path";

import cors from "cors";
import express from "express";

import { env, ms } from "#utils/misc.ts";
import namesRoute from "./names.ts";
import updateRoute from "./update.ts";

const DATA_DIR = env("DATA_DIR");

const router = express.Router({ mergeParams: true });

router
  .options("/names", cors({ methods: ["POST", "GET"], maxAge: ms("1day") }))
  .post("/names", express.json({ limit: "2mb" }), cors(), namesRoute);
router.post("/update", updateRoute);
router.use("/data", express.static(path.join(DATA_DIR, "unicode")));

export default router;
