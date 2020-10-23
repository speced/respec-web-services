// @ts-check
const fetch = require("node-fetch").default;
const path = require("path");
const { writeFile } = require("fs").promises;
const { HTTPError } = require("../../utils/misc");

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function route(req, res) {
  try {
    const start = Date.now();
    console.log("Regenerating docs...");
    await regenerateDocs();
    console.log(`Successfully regenerated docs in ${Date.now() - start}ms.`);
    res.sendStatus(200); // ok
  } catch (error) {
    const { message = "", statusCode = 500 } = error;
    console.error(`Failed to regenerate docs: ${message.slice(0, 400)}...`);
    res.status(statusCode);
    res.send(message);
  }
}

async function regenerateDocs() {
  const url = new URL("https://labs.w3.org/spec-generator/");
  url.searchParams.set("type", "respec");
  url.searchParams.set("url", "https://respec.org/docs/src.html");

  const res = await fetch(url);

  if (!res.ok) {
    const { error = "" } = await res.json();
    throw new HTTPError(res.status, error);
  }

  const html = await res.text();
  const staticHtmlFile = path.join(__dirname, "../../static/docs/index.html");
  await writeFile(staticHtmlFile, html);
}

module.exports = { route, regenerateDocs };
