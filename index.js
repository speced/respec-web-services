"use strict";
const async = require("marcosc-async");
const app = require("express")();
const PORT = 8000;
const { fetchAndWrite } = require("respec/tools/respecDocWriter");
const { URL } = require('url');

const standardResponses = new Map([
  ["missing-src-query", { status: 400, message: "<h1>Missing src param</h1>"}],
  ["bad-src-url", { status: 400, message: "<h1>Bad src param</h1>"}],
]);

function createStandardResponse(key) {
  const { status, message } = standardResponses.get(key);
  return (res, details = "") => {
    res.status(status);
    res.send(message);
    res.end(details ? `<p>${details}</p>` : "");
  };
}


app.listen(PORT, () => {
  console.log(`Example app listening on ${PORT}!`);
});

app.get("/", (req, res) => {
  res.send(`<h1>ReSpec.org!</h1>`);
});

const missingSrcError = createStandardResponse("missing-src-query");
const invalidSrc = createStandardResponse("bad-src-url");
app.get("/build/", (req, res) => {
  if (!req.query.src) {
    return missingSrcError(res);
  }
  let src = "";
  try {
    src = new URL(req.query.src).href;
  } catch (err) {
    return invalidSrc("Could not parse src param into URL.");
  }
  if(!src.startsWith("http")){
    return invalidSrc("Only http(s) URLs allowed");
  }
  async.task(function* run() {
    const haltOnWarn = false;
    const haltOnError = false;
    console.log("... trying to generate ..." + src);
    const result = yield fetchAndWrite(src, "", haltOnWarn, haltOnError);
    console.log("... done! Returning result.");
    res.send(result);
    res.end();
  });
});
