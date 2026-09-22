import { Router } from "express";

import usageRoute from "./usage.ts";

const monitor = Router();
monitor.get("/usage", usageRoute);

export default monitor;
