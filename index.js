const app = require("express")();
const bodyParser = require("body-parser");
const xrefResponseBody = require("respec-xref-route");
const crypto = require("crypto");
const { exec } = require("child_process");

let xrefData = require("./xref-data.json");

const conf = {
  port: parseInt(process.env.PORT, 10) || 3000,
  bikeshedSecret: process.env.BIKESHED_SECRET || "",
};

app.use(bodyParser.urlencoded({ verify: rawBodyParser, extended: false }));
app.use(bodyParser.json({ verify: rawBodyParser }));

app.post("/xref", (req, res) => {
  const body = xrefResponseBody(req.body, xrefData);
  res.json(body);
});

app.post("/xref/update", handleBikeshedUpdate);

app.listen(conf.port, () => console.log(`Listening on port ${conf.port}!`));

function rawBodyParser(req, res, buf, encoding) {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || "utf8");
  }
}

function handleBikeshedUpdate(req, res) {
  if (req.get("X-GitHub-Event") === "ping") {
    return res.send("Ping back");
  }

  const hash = crypto
    .createHmac("sha1", conf.bikeshedSecret)
    .update(req.rawBody)
    .digest("hex");

  if (req.get("X-Hub-Signature") !== `sha1=${hash}`) {
    res.status(403); // Forbidden
    return res.send("Failed to authenticate GitHub hook Signature");
  }

  if (req.body.refs !== "refs/heads/master") {
    res.status(202); // Accepted
    return res.send("Payload was not for master, aborted.");
  }

  exec("npm run get-xref-data", error => {
    if (error) {
      console.error("X-GitHub-Delivery", req.get("X-GitHub-Delivery"));
      console.error(error);
      res.status(503); // Service Unavailable
      return res.send("Error");
    }

    res.send("OK");

    // reload xref data
    delete require.cache[require.resolve("./xref-data.json")]
    xrefData = require("./xref-data.json");
  });
}
