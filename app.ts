import path from "path";

import express from "express";
import compression from "compression";
import helmet from "helmet";

import * as logging from "./utils/logging.ts";
import { register as registerViewEngine } from "./utils/view-engine.ts";
import { PROJECT_ROOT } from "./utils/constants.ts";

import xrefRouter from "./routes/xref/index.ts";
import bibrefsRouter from "./routes/bibrefs/index.ts";
import caniuseRouter from "./routes/caniuse/index.ts";
import githubRouter from "./routes/github/index.ts";
import respecRouter from "./routes/respec/index.ts";
import w3cRouter from "./routes/w3c/index.ts";
import baselineRouter from "./routes/api/baseline/index.ts";
import apiRouter from "./routes/api/index.ts";
import wellKnownRouter from "./routes/well-known/index.ts";
import monitorRouter from "./routes/monitor/index.ts";
import docsRouter from "./routes/docs/index.ts";

const app = express();
app.use(compression());

// logging
app.set("trust proxy", 2); // Cloudflare → nginx → Express
app.use(logging.stdout());
app.use(logging.stderr());

app.use(express.static(path.join(PROJECT_ROOT, "/static")));

app.set("views", path.join(import.meta.dirname, "views"));
registerViewEngine(app);

// Security
// Defaults https://www.npmjs.com/package/helmet#how-it-works
// ReSpec pill UI is embedded via iframe on any spec-hosting site,
// so we must not send frame-ancestors or X-Frame-Options.
const cspDirectives = helmet.contentSecurityPolicy.getDefaultDirectives();
delete cspDirectives["frame-ancestors"];

app.use(
  helmet({
    frameguard: false,
    contentSecurityPolicy: { directives: cspDirectives },
  }),
);

app.use("/xref", xrefRouter);
app.use("/bibrefs", bibrefsRouter);
app.use("/caniuse", caniuseRouter);
app.use("/api/baseline", baselineRouter);
app.use("/github/:org/:repo", githubRouter);
app.use("/respec", respecRouter);
app.use("/w3c", w3cRouter);
app.use("/api", apiRouter);
app.use("/.well-known", wellKnownRouter);
app.use("/monitor", monitorRouter);
app.use("/docs", docsRouter);
app.get("/", (_req, res) => res.redirect("/docs/"));

const port = parseInt(process.env.PORT || "", 10) || 8000;
app.listen(port, () => console.log(`Listening on port ${port}!`));
