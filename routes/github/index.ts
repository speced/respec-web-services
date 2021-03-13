import { Router } from "express";
import cors from "cors";

import contributorsRoute from "./contributors.js";
import issuesRoute from "./issues.js";
import commitsRoute from "./commits.js";
import filesRoute from "./files.js";

const gh = Router({ mergeParams: true });
gh.get("/contributors", cors(), contributorsRoute);
gh.get("/issues", cors(), issuesRoute);
gh.get("/commits", cors(), commitsRoute);
gh.get("/files", cors(), filesRoute);

export default gh;
