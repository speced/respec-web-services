import path from "path";
import { writeFile } from "fs/promises";

import { Request, Response } from "express";

import { HTTPError } from "../../utils/misc.js";
import { PROJECT_ROOT } from "../../utils/constants.js";

export default async function route(_req: Request, res: Response) {
  try {
    const start = Date.now();
    console.log("Regenerating docs...");
    await regenerateDocs();
    console.log(`Successfully regenerated docs in ${Date.now() - start}ms.`);
    res.sendStatus(200); // ok
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const statusCode = error instanceof HTTPError ? error.statusCode : 500;
    const logged =
      message.length > 400 ? `${message.slice(0, 400)}...` : message;
    console.error(`Failed to regenerate docs: ${logged}`);
    res.status(statusCode);
    res.send(message);
  }
}

const DOCS_SOURCE = "https://respec.org/docs/src.html";

export async function regenerateDocs() {
  const url = new URL("https://www.w3.org/publications/spec-generator/");
  url.searchParams.set("type", "respec");
  url.searchParams.set("url", DOCS_SOURCE);

  const res = await fetch(url.href);

  if (!res.ok) {
    const { error = "" } = (await res.json()) as { error?: string };
    throw new HTTPError(res.status, error);
  }

  const errorCount = parseInt(res.headers.get("x-errors-count") || "0");
  if (errorCount > 0) {
    const warningCount = parseInt(res.headers.get("x-warnings-count") || "0");
    // The generator returns counts only, never the messages themselves.
    throw new Error(
      `ReSpec found ${errorCount} errors and ${warningCount} warnings in ${DOCS_SOURCE}. ` +
        `Run "npx respec -s ${DOCS_SOURCE} -o /dev/null" to see them.`,
    );
  }

  const html = await res.text();
  const staticHtmlFile = path.join(PROJECT_ROOT, "static/docs/index.html");
  await writeFile(staticHtmlFile, html);
}
