import { Router } from "express";
import cors from "cors";

import groupsRoute from "./group.js";
import updateRoute from "./update.js";

const w3c = Router();
w3c.get("/groups{/:shortname}{/:type}", cors(), groupsRoute);
w3c.post("/update", updateRoute);

export default w3c;
