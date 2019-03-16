const port = parseInt(process.env.PORT, 10) || 3000;
const app = require("express")();
const bodyParser = require("body-parser");
const cors = require("cors");
const rawBodyParser = require("./utils/raw-body-parser");

// for preflight request
app.options("/xref", cors({ methods: ["POST"] }));
app.post("/xref", bodyParser.json(), cors(), require("./routes/xref/").route);

app.post(
  "/xref/update",
  bodyParser.json({
    verify: rawBodyParser
  }),
  require("./routes/xref/update").route
);

app.listen(port, () => console.log(`Listening on port ${port}!`));
