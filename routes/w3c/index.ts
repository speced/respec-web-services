import { Router } from "express";
import cors from "cors";

import groupsRoute from "./group.js";

const w3c = Router();
w3c.get("/groups/:shortname?/:type?", cors(), groupsRoute);

export default w3c;
