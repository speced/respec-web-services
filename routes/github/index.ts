import { Router } from "express";
import cors from "cors";

import contributorsRoute from "./contributors.ts";
import issuesRoute from "./issues.ts";
import commitsRoute from "./commits.ts";
import filesRoute from "./files.ts";

const gh = Router({ mergeParams: true });
gh.get("/contributors", cors(), contributorsRoute);
gh.get("/issues", cors(), issuesRoute);
gh.get("/commits", cors(), commitsRoute);
gh.get("/files", cors(), filesRoute);

export default gh;
