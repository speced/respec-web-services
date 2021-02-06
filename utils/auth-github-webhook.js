// @ts-check
import bodyParser from "body-parser";
import { createHmac } from "crypto";

/**
 * Middleware to ensure the GitHub webhook request is authentic.
 * @param {string} secret
 */
export default function githubWebhookAuthenticator(secret) {
  const verifier = (req, res, next) => {
    if (isValidGithubSignature(req, secret)) {
      req.body = JSON.parse(req.body.toString());
      if (req.body.zen /** is ping event */) {
        return res.send("pong");
      }
      return next();
    }
    const msg = "Failed to authenticate GitHub hook Signature";
    res.status(401).send(msg);
  };
  return [bodyParser.raw({ type: "application/json" }), verifier];
}

/**
 * See: https://developer.github.com/webhooks/securing/
 * @param {string} secret
 */
function isValidGithubSignature(req, secret) {
  const hash = createHmac("sha1", secret).update(req.body).digest("hex");
  return req.get("X-Hub-Signature") === `sha1=${hash}`;
}
