import cors from "cors";
import { Router } from "express";

import payRoute from "./pay.ts";

const routes = Router();
routes.get("/pay", cors(), payRoute);

export default routes;
