const port = parseInt(process.env.PORT, 10) || 3000;
const app = require("express")();
const bodyParser = require("body-parser");
const xrefResponseBody = require("respec-xref-route");
const xrefData = require("./xref-data.json");

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.post("/xref", (req, res) => {
  const response = xrefResponseBody(req.body, xrefData);
  res.json(response);
});

app.listen(port, () => console.log(`Listening on port ${port}!`));
