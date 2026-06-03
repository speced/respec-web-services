import { Router } from "express";

import usageRoute from "./usage.js";

const monitor = Router();
monitor.get("/usage", usageRoute);

export default monitor;
