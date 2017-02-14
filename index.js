"use strict";
const async = require("marcosc-async");
const app = require("express")();
const PORT = 8000;
const { fetchAndWrite } = require("respec/tools/respecDocWriter");
const { URL } = require('url');

const standardResponses = new Map([
  ["missing-src-query", {
    status: 400,
    get message() {
      return `<h1>${this.status} - Missing src param</h1>`;
    }
  }],
  ["bad-src-url", {
    status: 400,
    get message() {
      return `<h1>${this.status} - Bad src param</h1>`;
    }
  }],
  ["insecure-src-url", {
    status: 403,
    get message() {
      return `<h1>${this.status} - Forbidden scheme</h1>`;
    }
  }],
  ["timeout", {
    status: 504,
    get message() {
      return `<h1>${this.status} - Gateway Time-out</h1>`;
    }
  }],
  ["unknown", {
    status: 500,
    get message() {
      return `<h1>${this.status} - Unknown error</h1>`;
    }
  }],
]);

function createStandardResponse(key) {
  const { status, message } = standardResponses.get(key);
  return (res, details = "") => {
    res.status(status);
    res.send(message + ((details) ? `<p>${details}</p>` : ""));
    res.end();
  };
}

app.listen(PORT, () => {
  console.log(`Listening on ${PORT}!`);
});

app.get("/", (req, res) => {
  res.send(`<h1>ReSpec.org!</h1>`);
});

const missingSrcError = createStandardResponse("missing-src-query");
const invalidSrc = createStandardResponse("bad-src-url");
const insecureSrc = createStandardResponse("insecure-src-url");
const timeoutError = createStandardResponse("timeout");
const unknowError = createStandardResponse("unknown");
app.get("/build/", (req, res) => {
  if (!req.query.src) {
    return missingSrcError(res);
  }
  let src;
  try {
    src = new URL(req.query.src);
  } catch (err) {
    return invalidSrc(res, "Could not parse src param into URL.");
  }
  if (!["https:", "https:"].includes(src.protocol)) {
    return insecureSrc(res, "Only http(s) URLs allowed.");
  }
  async.task(function* run() {
    const haltOnWarn = false;
    const haltOnError = false;
    const whenToHalt = { haltOnWarn, haltOnError };
    const timeout = 30000;
    try {
      console.log("... trying to generate ..." + src);
      const result = yield new Promise((resove, reject) => {
        setTimeout(() => {
          reject(new Error(`Took took long (${timeout}ms).`));
        }, timeout);
        return fetchAndWrite(src.href, "", whenToHalt, timeout)
          .then(resove)
          .catch(reject);
      });
      console.log("... done! Returning result.");
      res.send(result);
      res.end();
    } catch (err) {
      if (err.message.startsWith("Took")) {
        return timeoutError(res, err.message);
      }
      return unknowError(res, err.message);
    }
  });
});
