const port = parseInt(process.env.PORT, 10) || 3000;
const app = require("express")();
const bodyParser = require("body-parser");

app.post("/xref", bodyParser.json(), require("./routes/xref/"));
app.post(
  "/xref/update",
  bodyParser.json({ verify: rawBodyParser }),
  require("./routes/xref/update")
);

app.listen(port, () => console.log(`Listening on port ${port}!`));

// utils

function rawBodyParser(req, res, buf, encoding) {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || "utf8");
  }
}
