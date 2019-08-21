const port = parseInt(process.env.PORT, 10) || 8000;
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const compression = require("compression");
const helmet = require("helmet");
const rawBodyParser = require("./utils/raw-body-parser");
const logging = require("./utils/logging");

const app = express();
app.use(compression());

// logging
app.enable("trust proxy"); // for :remote-addr
app.use(logging.stdout());
app.use(logging.stderr());

app.use(express.static("static"));
// Security
// Defaults https://www.npmjs.com/package/helmet#how-it-works
app.use(helmet({
  frameguard: false, // Allow for UI inclusion as iframe in ReSpec pill.
}));

// for preflight request
app.options("/xref", cors({ methods: ["POST", "GET"] }));
app.post("/xref", bodyParser.json(), cors(), require("./routes/xref/").route);
app.get("/xref/meta/:field?", cors(), require("./routes/xref/meta").route);
app.post(
  "/xref/update",
  bodyParser.json({ verify: rawBodyParser }),
  require("./routes/xref/update").route
);

app.options("/caniuse", cors({ methods: ["GET"] }));
app.get("/caniuse", cors(), require("./routes/caniuse/").route);
app.post(
  "/caniuse/update",
  bodyParser.json({ verify: rawBodyParser }),
  require("./routes/caniuse/update").route
);

app.listen(port, () => console.log(`Listening on port ${port}!`));
