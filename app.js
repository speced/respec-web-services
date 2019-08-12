import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import helmet from "helmet";
import { rawBodyParser } from "./utils/raw-body-parser.js";

import * as caniuseIndex from "./routes/caniuse/index.js";
import * as caniuseUpdate from "./routes/caniuse/update.js";
import * as xrefIndex from "./routes/xref/index.js";
import * as xrefUpdate from "./routes/xref/update.js";
import * as xrefMeta from "./routes/xref/meta.js";

const port = parseInt(process.env.PORT, 10) || 8000;

const app = express();
app.use(compression());

// loggin
app.enable("trust proxy"); // for :remote-addr
app.use(
  morgan(
    ":date[iso] | :remote-addr | :method :status :url | :referrer | :res[content-length] | :response-time ms"
  )
);

app.use(express.static("static"));
// Security
// Defaults https://www.npmjs.com/package/helmet#how-it-works
app.use(
  helmet({
    frameguard: false, // Allow for UI inclusion as iframe in ReSpec pill.
  })
);

// for preflight request
app.options("/xref", cors({ methods: ["POST", "GET"] }));
app.post("/xref", bodyParser.json(), cors(), xrefIndex.route);
app.get("/xref/meta", cors(), xrefMeta.route);
app.post(
  "/xref/update",
  bodyParser.json({ verify: rawBodyParser }),
  xrefUpdate.route
);

app.options("/caniuse", cors({ methods: ["GET"] }));
app.get("/caniuse", cors(), caniuseIndex.route);
app.post(
  "/caniuse/update",
  bodyParser.json({ verify: rawBodyParser }),
  caniuseUpdate.route
);

app.listen(port, () => console.log(`Listening on port ${port}!`));
