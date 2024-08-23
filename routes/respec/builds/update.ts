import path from "node:path";
import { mkdir, readFile } from "node:fs/promises";

import type { Request, Response } from "express";

import { env } from "../../../utils/misc.js";
import sh from "../../../utils/sh.js";

export const PKG_DIR = path.join(env("DATA_DIR"), "respec", "package");

export default async function route(req: Request, res: Response) {
  res.type("text/plain");
  const action = req.body.action;
  if (typeof action !== "string") {
    return res.status(400).send("Missing 'action' in body");
  }
  if (action !== "released") {
    res.status(400); // Bad request
    res.locals.reason = `action-not-released`;
    const msg = `Webhook payload was for ${JSON.stringify(action)}, ignored.`;
    return res.type("text/plain").send(msg);
  }

  try {
    await pullRelease();
    res.sendStatus(200); // ok
  } catch (error) {
    const { message = "", statusCode = 500 } = error;
    console.error(`Failed to pull respec release: ${message.slice(0, 400)}...`);
    res.status(statusCode);
    res.send(message);
  }
}

export async function pullRelease() {
  const start = Date.now();
  console.log("Pulling latest respec release...");

  const dir = path.resolve(PKG_DIR, "..");
  await mkdir(dir, { recursive: true });
  await sh(`npm view respec dist.tarball | xargs curl -s | tar -xz --totals`, {
    cwd: dir,
    output: "stream",
  });

  const { version } = JSON.parse(
    await readFile(path.join(PKG_DIR, "package.json"), "utf8"),
  );
  console.log(
    `Successfully pulled respec v${version} in ${Date.now() - start}ms.`,
  );
}
