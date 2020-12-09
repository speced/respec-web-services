import path from "path";

import express from "express";
import compression from "compression";
import helmet from "helmet";

import * as logging from "./utils/logging.js";
import { register as registerViewEngine } from "./utils/view-engine.js";
import { legacyDirname } from "./utils/misc.js";
import "./utils/dotenv.js";

import xrefRouter from "./routes/xref/index.js";
import caniuseRouter from "./routes/caniuse/index.js";
import githubRouter from "./routes/github/index.js";
import respecRouter from "./routes/respec/index.js";
import w3cRouter from "./routes/w3c/index.js";
import docsRouter from "./routes/docs/index.js";

const __dirname = legacyDirname(import.meta);

const app = express();
app.use(compression());

// logging
app.enable("trust proxy"); // for :remote-addr
app.use(logging.stdout());
app.use(logging.stderr());

app.use(express.static(path.join(__dirname, "/static")));

app.set("views", path.join(__dirname, "views"));
registerViewEngine(app);

// Security
// Defaults https://www.npmjs.com/package/helmet#how-it-works
app.use(helmet({
  frameguard: false, // Allow for UI inclusion as iframe in ReSpec pill.
}));

app.use("/xref", xrefRouter);
app.use("/caniuse", caniuseRouter);
app.use("/github/:org/:repo", githubRouter);
app.use("/respec", respecRouter);
app.use("/w3c", w3cRouter);
app.use("/docs", docsRouter);
app.get("/", (req, res) => res.redirect("/docs/"));

const port = parseInt(process.env.PORT, 10) || 8000;
app.listen(port, () => console.log(`Listening on port ${port}!`));
