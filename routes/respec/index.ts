import express from "express";

import * as sizeRoute from "./size.js";

const router = express.Router({ mergeParams: true });

router.get("/size", sizeRoute.get);
router.put(
  "/size",
  express.urlencoded({ extended: false, parameterLimit: 4, limit: "128b" }),
  sizeRoute.put,
);

export default router;
