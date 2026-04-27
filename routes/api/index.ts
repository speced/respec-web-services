import express from "express";
import unicode from "./unicode/index.js";

const router = express.Router({ mergeParams: true });

router.use("/unicode", unicode);

export default router;
