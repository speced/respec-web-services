import { Router } from "express";
import bodyParser from "body-parser";

import * as sizeRoute from "./size.js";

const router = Router({ mergeParams: true });

router.get("/size", sizeRoute.get);
router.put(
  "/size",
  bodyParser.urlencoded({ extended: false, parameterLimit: 4, limit: "128b" }),
  sizeRoute.put,
);

export default router;
