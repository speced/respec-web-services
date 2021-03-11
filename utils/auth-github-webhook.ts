import { createHmac } from "crypto";

import express from "express";
import { NextFunction, Request, Response } from "express";

type RawRequest = Request<unknown, unknown, Buffer>;

/**
 * Middleware to ensure the GitHub webhook request is authentic.
 */
export default function githubWebhookAuthenticator(secret: string) {
  const verifier = (req: Request, res: Response, next: NextFunction) => {
    if (isValidGithubSignature(req as RawRequest, secret)) {
      req.body = JSON.parse((req as RawRequest).body.toString());
      if (req.body.zen /** is ping event */) {
        return res.send("pong");
      }
      return next();
    }
    const msg = "Failed to authenticate GitHub hook Signature";
    res.status(401).send(msg);
  };
  return [express.raw({ type: "application/json" }), verifier];
}

/**
 * See: https://developer.github.com/webhooks/securing/
 */
function isValidGithubSignature(req: RawRequest, secret: string) {
  const hash = createHmac("sha1", secret).update(req.body).digest("hex");
  return req.get("X-Hub-Signature") === `sha1=${hash}`;
}
