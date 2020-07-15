// @ts-check
const crypto = require("crypto");
const fetch = require("node-fetch").default;
const path = require("path");
const { writeFile } = require("fs").promises;
const { env } = require("../../utils/misc");

const SECRET = env("RESPEC_SECRET");

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function route(req, res) {
  if (!isValidGithubSignature(req)) {
    res.status(401); // Unauthorized
    const msg = "Failed to authenticate GitHub hook Signature";
    console.error(msg);
    return res.send(msg);
  }

  try {
    const start = Date.now();
    console.log("Regenerating docs...");
    await regenerateDocs();
    console.log(`Successfully regenerated docs in ${Date.now() - start}ms.`);
    res.sendStatus(200); // ok
  } catch (error) {
    const { message = "", status = 500 } = error;
    console.error(`Failed to regenerate docs: ${message.slice(0, 400)}...`);
    res.status(status);
    res.send(message);
  }
}

function isValidGithubSignature(req) {
  // see: https://developer.github.com/webhooks/securing/
  const hash = crypto
    .createHmac("sha1", SECRET)
    .update(req.rawBody)
    .digest("hex");

  return req.get("X-Hub-Signature") === `sha1=${hash}`;
}

async function regenerateDocs() {
  const url = new URL("https://labs.w3.org/spec-generator/");
  url.searchParams.set("type", "respec");
  url.searchParams.set("url", "https://respec.org/docs/src.html");

  const res = await fetch(url);

  if (!res.ok) {
    const { error = "" } = await res.json();
    // https://stackoverflow.com/a/29497680
    const ansiColors = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
    const message = error.replace(ansiColors, "");
    throw { message, status: res.status };
  }

  const html = await res.text();
  const staticHtmlFile = path.join(__dirname, "../../static/docs/index.html");
  await writeFile(staticHtmlFile, html);
}

module.exports = { route, regenerateDocs };
