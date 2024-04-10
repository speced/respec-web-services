import { Router } from "express";
import cors from "cors";

import payRoute from "./pay.js";

const routes = Router();
routes.get("/pay", cors(), payRoute);

export default routes;
