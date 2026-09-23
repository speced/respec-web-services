import cors from "cors";
import { Router } from "express";

import commitsRoute from "./commits.ts";
import contributorsRoute from "./contributors.ts";
import filesRoute from "./files.ts";
import issuesRoute from "./issues.ts";

const gh = Router({ mergeParams: true });
gh.get("/contributors", cors(), contributorsRoute);
gh.get("/issues", cors(), issuesRoute);
gh.get("/commits", cors(), commitsRoute);
gh.get("/files", cors(), filesRoute);

export default gh;
