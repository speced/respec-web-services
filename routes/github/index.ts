import { Router } from "express";
import cors from "cors";

import contributorsRoute from "./contributors.js";
import issuesRoute from "./issues.js";
import commitsRoute from "./commits.js";
import filesRoute from "./files.js";

const gh = Router({ mergeParams: true });

gh.options("/contributors", cors({ methods: ["GET"] }));
gh.get("/contributors", cors(), contributorsRoute);

gh.options("/issues", cors({ methods: ["GET"] }));
gh.get("/issues", cors(), issuesRoute);

gh.options("/commits", cors({ methods: ["GET"] }));
gh.get("/commits", cors(), commitsRoute);

gh.options("/files", cors({ methods: ["GET"] }));
gh.get("/files", cors(), filesRoute);

export default gh;
