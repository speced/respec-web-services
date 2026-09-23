import express from "express";

import unicode from "./unicode/index.ts";

const router = express.Router({ mergeParams: true });

router.use("/unicode", unicode);

export default router;
