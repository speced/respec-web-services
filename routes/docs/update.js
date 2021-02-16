// @ts-check
import path from "path";
import { writeFile } from "fs/promises";

import fetch from "node-fetch";

import { HTTPError, legacyDirname } from "../../utils/misc.js";
/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export default async function route(req, res) {
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

export async function regenerateDocs() {
  const url = new URL("https://labs.w3.org/spec-generator/");
  url.searchParams.set("type", "respec");
  url.searchParams.set("url", "https://respec.org/docs/src.html");

  const res = await fetch(url);

  if (!res.ok) {
    const { error = "" } = await res.json();
    throw new HTTPError(res.status, error);
  }

  const errorCount = parseInt(res.headers.get("x-errors-count")) || 0;
  if (errorCount > 0) {
    throw new Error(`There were ${errorCount} errors in processing.`);
  }

  const html = await res.text();
  const __dirname = legacyDirname(import.meta);
  const staticHtmlFile = path.join(__dirname, "../../static/docs/index.html");
  await writeFile(staticHtmlFile, html);
}
